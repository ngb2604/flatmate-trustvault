import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_CLAIM_CENTS,
  DEFAULT_CLAIM_REASON,
  DEFAULT_EVIDENCE,
  INITIAL_TOTAL_CENTS,
  PERSONAS,
  TENANT_IDS,
  personaById,
} from "../data/personas";
import {
  base64UrlFromString,
  generateIdentity,
  sha256Hex,
  shortSignature,
  signPayload,
  signRaw,
  verifyPayload,
  verifyRaw,
  type LocalIdentity,
} from "../lib/crypto";
import { money, splitProRata } from "../lib/format";
import {
  RELEASE_POLICY,
  consensusFrom,
  forceDeductionBlocked,
  permissionsFor,
  unilateralWithdrawalBlocked,
} from "../tidecloak/policy";
import { connectTideCloak } from "../tidecloak/client";
import type {
  AppState,
  AttackAlert,
  Claim,
  Decision,
  LogEntry,
  LogKind,
  PayoutLine,
  PersonaDefinition,
  PersonaId,
  PersonaIdentity,
  SessionClaims,
  SessionInfo,
  SignedApproval,
  TenantId,
} from "../types";

const ISSUER = "https://local.tidecloak.demo/realms/tide-demo";
const GENESIS_HASH = "0".repeat(64);
const SESSION_TTL_SECONDS = 15 * 60;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Commit to the evidence bytes, not just the filename. Falls back to hashing
 * the URL only when the browser cannot read the image (e.g. remote CORS).
 */
async function hashEvidence(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (response.ok) {
      return await sha256Hex(await response.arrayBuffer());
    }
  } catch {
    // The demo still records a commitment to the reference below.
  }
  return await sha256Hex(`evidence-ref:${url}`);
}

async function mintSession(
  issuer: LocalIdentity,
  persona: PersonaDefinition,
): Promise<SessionInfo> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = {
    alg: "ES256",
    typ: "JWT",
    kid: `tc_${issuer.fingerprint.slice(0, 12)}`,
  };
  const payload = {
    iss: ISSUER,
    sub: `usr_${persona.id}_${crypto.randomUUID().slice(0, 8)}`,
    preferred_username: persona.name,
    realm_access: { roles: [persona.role] },
    scope:
      persona.kind === "landlord"
        ? "openid tide.vault.read tide.claim.file"
        : "openid tide.vault.read tide.claim.sign",
    iat: issuedAt,
    exp: issuedAt + SESSION_TTL_SECONDS,
    jti: crypto.randomUUID(),
  };

  const signingInput = `${base64UrlFromString(JSON.stringify(header))}.${base64UrlFromString(
    JSON.stringify(payload),
  )}`;
  const signature = await signRaw(issuer.keys, signingInput);
  const token = `${signingInput}.${signature}`;
  const verified = await verifyRaw(
    issuer.publicKey,
    signingInput,
    signature,
  );

  const claims: SessionClaims = {
    iss: payload.iss,
    sub: payload.sub,
    name: persona.name,
    role: persona.role,
    scope: payload.scope,
    iat: payload.iat,
    exp: payload.exp,
    jti: payload.jti,
  };

  return { personaId: persona.id, token, claims, verified };
}

function createInitialState(
  connection: AppState["connection"],
  sessions: Partial<Record<PersonaId, SessionInfo>>,
  fingerprints: Record<PersonaId, string>,
  activeId: PersonaId = "minh",
): AppState {
  return {
    activeId,
    vault: {
      totalCents: INITIAL_TOTAL_CENTS,
      frozenCents: 0,
      initialTotalCents: INITIAL_TOTAL_CENTS,
    },
    wallets: { minh: 0, lan: 0, tuan: 0, bay: 0 },
    claim: null,
    payouts: [],
    log: [],
    alert: null,
    sessions,
    fingerprints,
    connection,
  };
}

async function appendLog(
  base: AppState,
  entry: Omit<LogEntry, "id" | "at" | "hash" | "prevHash">,
): Promise<AppState> {
  const prevHash = base.log[0]?.hash ?? GENESIS_HASH;
  const at = Date.now();
  const payload = { ...entry, at, prevHash };
  const hash = await sha256Hex(`${prevHash}|${JSON.stringify(payload)}`);
  const logEntry: LogEntry = {
    ...payload,
    id: `log_${crypto.randomUUID().slice(0, 8)}`,
    hash,
  };
  return { ...base, log: [logEntry, ...base.log] };
}

async function seedLogs(base: AppState): Promise<AppState> {
  let next = base;
  next = await appendLog(next, {
    kind: "vault" as LogKind,
    actor: "VAULT",
    title: "Escrow vault sealed · $1,200.00",
    detail:
      "Ownership ledger committed: Minh $400.00 · Lan $400.00 · Tuấn $400.00. No master key provisioned.",
    amountCents: INITIAL_TOTAL_CENTS,
  });
  next = await appendLog(next, {
    kind: "session",
    actor: "TIDECLOAK",
    title: "Realm connected · 4 identities registered",
    detail: `Realm ${base.connection.realm} · policy ${RELEASE_POLICY.id} armed. No session exists until a user signs in. Release requires landlord + 2/3 tenants.`,
  });
  return next;
}

export function useTrustVault() {
  const [state, setState] = useState<AppState | null>(null);
  const [booting, setBooting] = useState(true);
  const [bootMessage, setBootMessage] = useState(
    "Contacting TideCloak realm…",
  );
  const [bootError, setBootError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [authMessage, setAuthMessage] = useState(
    "Choose a TideCloak identity to mint a session.",
  );

  const stateRef = useRef<AppState | null>(null);
  const identitiesRef = useRef<Partial<Record<PersonaId, PersonaIdentity>>>({});
  const issuerRef = useRef<LocalIdentity | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        const connection = await connectTideCloak();
        if (cancelled) return;

        setBootMessage("Generating browser-held ECDSA P-256 keys…");
        const issuer = await generateIdentity();
        const identities = {} as Record<PersonaId, PersonaIdentity>;
        const sessions: Partial<Record<PersonaId, SessionInfo>> = {};
        const fingerprints = {} as Record<PersonaId, string>;

        for (const persona of PERSONAS) {
          const local = await generateIdentity();
          identities[persona.id] = {
            id: persona.id,
            role: persona.role,
            fingerprint: local.fingerprint,
            publicKey: local.publicKey,
            keys: local.keys,
          };
          fingerprints[persona.id] = local.fingerprint;
        }

        if (cancelled) return;
        identitiesRef.current = identities;
        issuerRef.current = issuer;
        setBootMessage("Sealing the escrow vault…");

        let initial = createInitialState(connection, sessions, fingerprints);
        initial = await seedLogs(initial);

        await sleep(420);
        if (cancelled) return;

        stateRef.current = initial;
        setState(initial);
        setBooting(false);
      } catch (error) {
        if (cancelled) return;
        console.error("[TrustVault] Boot failed", error);
        setBootError(
          error instanceof Error ? error.message : "Unable to boot demo realm.",
        );
        setBooting(false);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const commit = (next: AppState) => {
    stateRef.current = next;
    setState(next);
  };

  const runExclusive = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (busyRef.current) return undefined;
    busyRef.current = true;
    setBusy(true);
    try {
      return await fn();
    } catch (error) {
      console.error("[TrustVault] Operation failed", error);
      setBootError(
        error instanceof Error ? error.message : "Operation failed.",
      );
      return undefined;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const signIn = async (id: PersonaId) => {
    const persona = personaById(id);

    await runExclusive(async () => {
      const current = stateRef.current;
      const issuer = issuerRef.current;
      if (!current || !issuer) return;
      if (current.activeId === id && current.sessions[id]?.verified) return;

      setAuthMessage(`Minting a ${persona.role} session for ${persona.name}…`);
      const rotated = Boolean(current.sessions[id]);
      const session = await mintSession(issuer, persona);

      let next: AppState = {
        ...current,
        activeId: id,
        sessions: { ...current.sessions, [id]: session },
      };

      next = await appendLog(next, {
        kind: "session",
        actor: `${persona.name} · ${persona.role}`,
        title: rotated
          ? "Session rotated · new ES256 token"
          : `${persona.name} signed in · ES256 session`,
        detail: `Scope ${session.claims.scope}. Private key non-extractable; token held in memory. ${session.verified ? "Signature verified in-browser." : "Signature verification failed."}`,
        signature: session.token.split(".")[2],
      });

      await sleep(120);
      commit(next);
      setSignedIn(true);
      setAuthMessage("Choose a TideCloak identity to mint a session.");
    });
  };

  const switchPersona = (id: PersonaId) => {
    void signIn(id);
  };

  const signOut = () => {
    const current = stateRef.current;
    if (current) commit({ ...current, sessions: {} });
    setSignedIn(false);
    setAuthMessage("Signed out. Session tokens were cleared from memory.");
  };

  const attemptUnilateralWithdrawal = async () => {
    await runExclusive(async () => {
      const current = stateRef.current;
      const identity = identitiesRef.current.minh;
      if (!current || !identity || current.activeId !== "minh") return;

      const at = Date.now();
      const evaluation = unilateralWithdrawalBlocked();
      const signature = await signPayload(identity.keys, {
        v: 1,
        intent: "vault.withdraw_all",
        amountCents: current.vault.totalCents,
        actor: "minh",
        at,
      });

      const alert: AttackAlert = {
        id: `alert_${crypto.randomUUID().slice(0, 8)}`,
        code: evaluation.code as AttackAlert["code"],
        status: 403,
        title: evaluation.title,
        detail: evaluation.detail,
        policy: evaluation.policy,
        actor: "Minh · tenant_lead",
        at,
        signature,
      };

      let next: AppState = { ...current, alert };
      next = await appendLog(next, {
        kind: "blocked",
        actor: "Minh · tenant_lead",
        title: "Unilateral withdrawal blocked · 403",
        detail: evaluation.detail,
        amountCents: current.vault.totalCents,
        signature,
      });
      commit(next);
    });
  };

  const attemptForceDeduct = async () => {
    await runExclusive(async () => {
      const current = stateRef.current;
      const identity = identitiesRef.current.bay;
      if (!current || !identity || current.activeId !== "bay") return;

      const at = Date.now();
      const evaluation = forceDeductionBlocked();
      const signature = await signPayload(identity.keys, {
        v: 1,
        intent: "vault.force_deduct",
        amountCents: 30_000,
        actor: "bay",
        at,
      });

      const alert: AttackAlert = {
        id: `alert_${crypto.randomUUID().slice(0, 8)}`,
        code: evaluation.code as AttackAlert["code"],
        status: 403,
        title: evaluation.title,
        detail: evaluation.detail,
        policy: evaluation.policy,
        actor: "Mr. Bảy · landlord",
        at,
        signature,
      };

      let next: AppState = { ...current, alert };
      next = await appendLog(next, {
        kind: "blocked",
        actor: "Mr. Bảy · landlord",
        title: "Unilateral deduction blocked · 403",
        detail: evaluation.detail,
        amountCents: 30_000,
        signature,
      });
      commit(next);
    });
  };

  const createClaimInternal = async (
    base: AppState,
    amountCents: number,
    reason: string,
    evidenceUrl: string,
    evidenceName: string,
  ): Promise<{ state: AppState; claim: Claim }> => {
    const landlord = identitiesRef.current.bay;
    if (!landlord) throw new Error("Landlord identity unavailable.");

    const at = Date.now();
    const claimId = `clm_${crypto.randomUUID().slice(0, 8)}`;
    const evidenceHash = await hashEvidence(evidenceUrl);
    const payload = {
      v: 1,
      policy: RELEASE_POLICY.id,
      claimId,
      amountCents,
      decision: "file",
      actor: "bay",
      at,
      evidenceHash,
    };
    const landlordSignature = await signPayload(landlord.keys, payload);
    const verified = await verifyPayload(
      landlord.publicKey,
      payload,
      landlordSignature,
    );
    if (!verified) throw new Error("Landlord claim signature failed verification.");

    const claim: Claim = {
      id: claimId,
      amountCents,
      reason,
      evidenceUrl,
      evidenceName,
      evidenceHash,
      filedAt: at,
      landlordSignature,
      landlordFingerprint: landlord.fingerprint,
      approvals: {},
      status: "pending",
    };

    let next: AppState = { ...base, claim };
    next = await appendLog(next, {
      kind: "claim",
      actor: "Mr. Bảy · landlord",
      title: `Deduction claim filed · ${money(amountCents)}`,
      detail: `${reason} Evidence “${evidenceName}” attached; SHA-256 commitment 0x${evidenceHash.slice(0, 12)}… locked into the claim. 0 of 2 tenant signatures collected.`,
      amountCents,
      signature: landlordSignature,
    });

    return { state: next, claim };
  };

  async function settle(base: AppState, claim: Claim): Promise<AppState> {
    const contributions: Record<string, number> = {};
    for (const persona of PERSONAS) {
      contributions[persona.id] = persona.contributionCents;
    }

    const refundPool = base.vault.totalCents - claim.amountCents;
    const shares = splitProRata(refundPool, contributions, TENANT_IDS);

    const wallets = {
      ...base.wallets,
      bay: base.wallets.bay + claim.amountCents,
      minh: base.wallets.minh + shares.minh,
      lan: base.wallets.lan + shares.lan,
      tuan: base.wallets.tuan + shares.tuan,
    };

    const payouts: PayoutLine[] = [
      ...TENANT_IDS.map((id) => ({
        personaId: id,
        amountCents: shares[id],
        label: "Direct bond refund",
        kind: "refund" as const,
      })),
      {
        personaId: "bay" as PersonaId,
        amountCents: claim.amountCents,
        label: "Repair compensation",
        kind: "compensation" as const,
      },
    ];

    let next: AppState = {
      ...base,
      claim: {
        ...claim,
        status: "settled",
        resolution: "consensus",
        settledAt: Date.now(),
      },
      wallets,
      vault: { ...base.vault, totalCents: 0, frozenCents: 0 },
      payouts,
    };

    next = await appendLog(next, {
      kind: "authority",
      actor: "TIDECLOAK",
      title: "Emergent Authority unlocked",
      detail: `Policy ${RELEASE_POLICY.id} satisfied: landlord signature + 2/3 tenant approvals. One-time authority granted for ${claim.id}, then dissolved.`,
      amountCents: claim.amountCents,
    });

    next = await appendLog(next, {
      kind: "payout",
      actor: "VAULT",
      title: "Atomic settlement · 4 wallets credited",
      detail: `${money(claim.amountCents)} to Mr. Bảy · ${money(shares.minh)} each to Minh, Lan and Tuấn. Refund never passed through the lead tenant.`,
      amountCents: base.vault.totalCents,
    });

    return next;
  }

  async function dispute(
    base: AppState,
    claim: Claim,
    _trigger: "tenant-rejection" | "demo",
  ): Promise<AppState> {
    const contributions: Record<string, number> = {};
    for (const persona of PERSONAS) {
      contributions[persona.id] = persona.contributionCents;
    }

    const refundPool = base.vault.totalCents - claim.amountCents;
    const shares = splitProRata(refundPool, contributions, TENANT_IDS);

    const wallets = {
      ...base.wallets,
      minh: base.wallets.minh + shares.minh,
      lan: base.wallets.lan + shares.lan,
      tuan: base.wallets.tuan + shares.tuan,
    };

    const payouts: PayoutLine[] = TENANT_IDS.map((id) => ({
      personaId: id,
      amountCents: shares[id],
      label: "Undisputed refund",
      kind: "refund" as const,
    }));

    let next: AppState = {
      ...base,
      claim: {
        ...claim,
        status: "disputed",
        resolution: "dispute",
        settledAt: Date.now(),
      },
      wallets,
      vault: {
        ...base.vault,
        totalCents: claim.amountCents,
        frozenCents: claim.amountCents,
      },
      payouts,
    };

    next = await appendLog(next, {
      kind: "dispute",
      actor: "TIDECLOAK",
      title: "Dispute lock engaged · partial freeze",
      detail: `Tenant rejection threshold reached. ${money(refundPool)} refunded immediately to the three contributors; only the disputed ${money(claim.amountCents)} stays locked for ${RELEASE_POLICY.arbitration}.`,
      amountCents: claim.amountCents,
    });

    next = await appendLog(next, {
      kind: "payout",
      actor: "VAULT",
      title: "Undisputed refund executed · 3 wallets credited",
      detail: `${money(shares.minh)} each returned directly to Minh, Lan and Tuấn. The landlord's wallet received $0.00.`,
      amountCents: refundPool,
    });

    return next;
  }

  const addTenantDecision = async (
    base: AppState,
    tenantId: TenantId,
    decision: Decision,
  ): Promise<AppState> => {
    const claim = base.claim;
    if (!claim || claim.status !== "pending") return base;
    if (claim.approvals[tenantId]) return base;

    const identity = identitiesRef.current[tenantId];
    const persona = personaById(tenantId);
    if (!identity) return base;

    const at = Date.now();
    const payload = {
      v: 1,
      policy: RELEASE_POLICY.id,
      claimId: claim.id,
      amountCents: claim.amountCents,
      decision,
      tenant: tenantId,
      at,
    };
    const signature = await signPayload(identity.keys, payload);
    const verified = await verifyPayload(identity.publicKey, payload, signature);
    if (!verified) throw new Error("Tenant signature failed verification.");

    const approval: SignedApproval = {
      tenantId,
      decision,
      signature,
      fingerprint: identity.fingerprint,
      signedAt: at,
      verified,
    };

    const nextClaim: Claim = {
      ...claim,
      approvals: { ...claim.approvals, [tenantId]: approval },
    };
    const consensus = consensusFrom(nextClaim.approvals);

    let next: AppState = { ...base, claim: nextClaim };
    const approved = decision === "approve";

    next = await appendLog(next, {
      kind: "sign",
      actor: `${persona.name} · ${persona.roleLabel}`,
      title: approved
        ? `Tenant signature collected · ${money(claim.amountCents)} claim`
        : `Tenant rejected claim · ${money(claim.amountCents)}`,
      detail: approved
        ? `${persona.name} co-signed with ES256 (${shortSignature(signature)}). ${consensus.approvals} of 2 required approvals collected; ${consensus.remaining} still needed.`
        : `${persona.name} rejected the deduction. ${consensus.rejections} of 2 rejection locks engaged.`,
      signature,
    });

    if (consensus.thresholdMet) return settle(next, nextClaim);
    if (consensus.rejectionLock) return dispute(next, nextClaim, "tenant-rejection");
    return next;
  };

  const fileClaim = async (
    amountCents: number,
    reason: string,
    evidenceUrl: string,
    evidenceName: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    if (busyRef.current) {
      return { ok: false, error: "Another TideCloak operation is in flight." };
    }

    const current = stateRef.current;
    if (!current) return { ok: false, error: "Vault not ready." };
    const activeRole = personaById(current.activeId).role;
    if (!permissionsFor(activeRole).fileClaim) {
      return {
        ok: false,
        error: "Access denied: this session's role cannot file a claim.",
      };
    }
    if (current.claim?.status === "pending") {
      return { ok: false, error: "A claim is already awaiting signatures." };
    }

    const amount = Math.round(amountCents);
    if (!Number.isFinite(amount) || amount < 100) {
      return { ok: false, error: "Claim amount must be at least $1.00." };
    }
    if (amount > current.vault.totalCents) {
      return {
        ok: false,
        error: "Claim cannot exceed the locked escrow balance.",
      };
    }

    const outcome = await runExclusive(async () => {
      const latest = stateRef.current;
      if (!latest) return false;
      const created = await createClaimInternal(
        latest,
        amount,
        reason.trim() || DEFAULT_CLAIM_REASON,
        evidenceUrl,
        evidenceName,
      );
      commit(created.state);
      return true;
    });

    if (outcome !== true) {
      return {
        ok: false,
        error: "TideCloak rejected the claim request. Check the audit log.",
      };
    }
    return { ok: true };
  };

  const signClaim = async (decision: Decision) => {
    await runExclusive(async () => {
      const current = stateRef.current;
      if (!current?.claim || current.claim.status !== "pending") return;
      if (!permissionsFor(personaById(current.activeId).role).signClaim) return;
      const tenantId = current.activeId as TenantId;
      if (!TENANT_IDS.includes(tenantId)) return;
      if (current.claim.approvals[tenantId]) return;

      const next = await addTenantDecision(current, tenantId, decision);
      commit(next);
    });
  };

  const runDisputeScenario = async () => {
    await runExclusive(async () => {
      let current = stateRef.current;
      if (!current) return;

      if (!current.claim) {
        const created = await createClaimInternal(
          current,
          DEFAULT_CLAIM_CENTS,
          DEFAULT_CLAIM_REASON,
          DEFAULT_EVIDENCE,
          "broken_faucet.jpg",
        );
        current = created.state;
      }

      if (!current.claim || current.claim.status !== "pending") {
        commit(current);
        return;
      }

      const pendingClaim = current.claim;
      const rejectionOrder: TenantId[] = ["lan", "tuan", "minh"];
      const undecided = rejectionOrder.filter(
        (id) => !pendingClaim.approvals[id],
      );
      for (const id of undecided.slice(0, 2)) {
        current = await addTenantDecision(current, id, "reject");
        if (current.claim?.status !== "pending") break;
      }
      commit(current);
    });
  };

  const resetDemo = async () => {
    await runExclusive(async () => {
      const current = stateRef.current;
      if (!current) return;

      let sessions = current.sessions;
      const issuer = issuerRef.current;
      if (!sessions.minh && issuer) {
        sessions = {
          ...sessions,
          minh: await mintSession(issuer, personaById("minh")),
        };
      }

      let next = createInitialState(
        current.connection,
        sessions,
        current.fingerprints,
        "minh",
      );

      next = await appendLog(next, {
        kind: "vault",
        actor: "VAULT",
        title: "Escrow vault re-sealed · $1,200.00",
        detail:
          "Ownership ledger restored: Minh $400.00 · Lan $400.00 · Tuấn $400.00. Wallets cleared. No master key provisioned.",
        amountCents: INITIAL_TOTAL_CENTS,
      });
      next = await appendLog(next, {
        kind: "reset",
        actor: "ADMIN · demo",
        title: "Demo state reset",
        detail:
          "New claim ID and fresh approval state. Session tokens preserved; private keys remain non-extractable in this tab.",
      });

      commit(next);
    });
  };

  const activePersona = state ? personaById(state.activeId) : PERSONAS[0];
  const activeSession = state?.sessions[state.activeId];
  const activeFingerprint = state?.fingerprints[state.activeId];

  let status: "protected" | "pending" | "settled" | "disputed" = "protected";
  if (state?.claim?.status === "pending") status = "pending";
  if (state?.claim?.status === "settled") status = "settled";
  if (state?.claim?.status === "disputed") status = "disputed";

  const consensus = state?.claim
    ? consensusFrom(state.claim.approvals)
    : null;

  return {
    state,
    booting,
    bootMessage,
    bootError,
    clearError: () => setBootError(null),
    busy,
    signedIn,
    authMessage,
    activePersona,
    activeSession,
    activeFingerprint,
    status,
    consensus,
    signIn,
    signOut,
    switchPersona,
    attemptUnilateralWithdrawal,
    attemptForceDeduct,
    fileClaim,
    signClaim,
    runDisputeScenario,
    resetDemo,
  };
}

export type TrustVaultController = ReturnType<typeof useTrustVault>;
