"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_CLAIM_CENTS,
  DEFAULT_CLAIM_REASON,
  DEFAULT_EVIDENCE,
  PERSONAS,
  TENANT_IDS,
  personaById,
} from "../data/personas";
import {
  decodeJwt,
  decryptField,
  encryptField,
  generateDataKey,
  generateIdentity,
  sha256Hex,
  signPayload,
  verifyJwtWithJwks,
} from "../lib/crypto";
import { decisionPayload, fileClaimPayload } from "../lib/approval";
import { consensusFrom, permissionsFor } from "../tidecloak/policy";
import { connectTideCloak, type RealmInfo } from "../tidecloak/client";
import type {
  AppState,
  AttackAlert,
  Claim,
  Decision,
  EncryptedField,
  InspectorSnapshot,
  LogEntry,
  PayoutLine,
  PersonaId,
  PersonaIdentity,
  SessionClaims,
  SessionInfo,
  TenantId,
  TideRole,
  VaultState,
} from "../types";

interface RemoteState {
  vault: VaultState;
  wallets: Record<PersonaId, number>;
  claim: Claim | null;
  payouts: PayoutLine[];
  log: LogEntry[];
}

interface PiiRecord {
  updatedAt: number;
  fields: Record<string, EncryptedField>;
}

interface ApiResult<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  data: T;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

async function hashEvidence(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (response.ok) {
      return await sha256Hex(await response.arrayBuffer());
    }
  } catch {
    // A commitment to the reference is still recorded below.
  }
  return await sha256Hex(`evidence-ref:${url}`);
}

async function api<T = Record<string, unknown>>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {
    ...(init.body ? { "content-type": "application/json" } : {}),
  };
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetch(path, {
    ...init,
    headers,
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as T;
  return { ok: response.ok, status: response.status, data };
}

function clearLegacyStorage() {
  try {
    // Sessions and PII must survive only in memory.
    window.localStorage.clear();
    window.sessionStorage.clear();
  } catch {
    // Storage may be unavailable; memory-only is still enforced.
  }
}

export function useTrustVault() {
  const [state, setState] = useState<AppState | null>(null);
  const [realm, setRealm] = useState<RealmInfo | null>(null);
  const [booting, setBooting] = useState(true);
  const [bootMessage, setBootMessage] = useState(
    "Contacting TideCloak realm…",
  );
  const [bootError, setBootError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [authMessage, setAuthMessage] = useState(
    "Choose a demo identity to mint a session.",
  );
  const [pii, setPii] = useState<PiiRecord | null>(null);
  const [inspector, setInspector] = useState<InspectorSnapshot | null>(null);
  const [piiBusy, setPiiBusy] = useState(false);
  const [piiError, setPiiError] = useState<string | null>(null);

  const realmRef = useRef<RealmInfo | null>(null);
  const remoteRef = useRef<RemoteState | null>(null);
  const identitiesRef = useRef<Partial<Record<PersonaId, PersonaIdentity>>>({});
  const fingerprintsRef = useRef<Record<PersonaId, string>>({
    minh: "",
    lan: "",
    tuan: "",
    bay: "",
  });
  const sessionsRef = useRef<Partial<Record<PersonaId, SessionInfo>>>({});
  const tokensRef = useRef<Partial<Record<PersonaId, string>>>({});
  const piiKeysRef = useRef<Partial<Record<PersonaId, CryptoKey>>>({});
  const piiRef = useRef<PiiRecord | null>(null);
  const activeIdRef = useRef<PersonaId>("minh");
  const alertRef = useRef<AttackAlert | null>(null);
  const busyRef = useRef(false);

  const compose = (): AppState | null => {
    const remote = remoteRef.current;
    const info = realmRef.current;
    if (!remote || !info) return null;
    return {
      activeId: activeIdRef.current,
      vault: remote.vault,
      wallets: remote.wallets,
      claim: remote.claim,
      payouts: remote.payouts,
      log: remote.log,
      alert: alertRef.current,
      sessions: sessionsRef.current,
      fingerprints: fingerprintsRef.current,
      connection: info.connection,
    };
  };

  const publish = () => {
    const next = compose();
    if (next) setState(next);
  };

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        clearLegacyStorage();
        const info = await connectTideCloak();
        if (cancelled) return;
        realmRef.current = info;
        setRealm(info);

        setBootMessage("Generating browser-held ECDSA P-256 keys…");
        const identities = {} as Record<PersonaId, PersonaIdentity>;
        const fingerprints = {} as Record<PersonaId, string>;

        await Promise.all(
          PERSONAS.map(async (persona) => {
            const local = await generateIdentity();
            identities[persona.id] = {
              id: persona.id,
              role: persona.role,
              fingerprint: local.fingerprint,
              publicKey: local.publicKey,
              keys: local.keys,
            };
            fingerprints[persona.id] = local.fingerprint;
          }),
        );

        if (cancelled) return;
        identitiesRef.current = identities;
        fingerprintsRef.current = fingerprints;
        setBootMessage("Opening the policy gateway…");
        await sleep(300);
        if (cancelled) return;
        setBooting(false);
      } catch (error) {
        if (cancelled) return;
        console.error("[TrustVault] Boot failed", error);
        setBootError(
          error instanceof Error ? error.message : "Unable to reach the realm.",
        );
        setBooting(false);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const refreshState = async (token: string) => {
    const response = await api<{ state: RemoteState }>("/api/vault/state", token);
    if (response.ok) {
      remoteRef.current = response.data.state;
      publish();
    }
    return response;
  };

  const loadPii = async (token: string) => {
    const response = await api<{ record: PiiRecord | null }>(
      "/api/vault/pii",
      token,
    );
    if (response.ok) {
      piiRef.current = response.data.record;
      setPii(response.data.record);
    }
  };

  const refreshInspector = async (token?: string) => {
    const activeToken = token ?? tokensRef.current[activeIdRef.current];
    if (!activeToken) return;
    const response = await api<{ inspector: InspectorSnapshot }>(
      "/api/vault/inspector",
      activeToken,
    );
    if (response.ok) setInspector(response.data.inspector);
  };

  const mintSession = async (id: PersonaId): Promise<SessionInfo> => {
    const identity = identitiesRef.current[id];
    if (!identity) throw new Error("Identity keys are still being generated.");
    const persona = personaById(id);

    const response = await api<{
      token: string;
      claims: SessionClaims;
      verified: boolean;
      message?: string;
    }>("/api/auth/token", "", {
      method: "POST",
      body: JSON.stringify({
        personaId: id,
        publicKeySpki: identity.publicKey,
        fingerprint: identity.fingerprint,
      }),
    });

    if (!response.ok) {
      throw new Error(
        response.data.message ??
          `The realm refused to issue a ${persona.role} session.`,
      );
    }

    const verified = await verifyJwtWithJwks(response.data.token);
    const session: SessionInfo = {
      personaId: id,
      token: response.data.token,
      claims: response.data.claims,
      verified,
    };

    sessionsRef.current[id] = session;
    tokensRef.current[id] = response.data.token;
    return session;
  };

  const ensureSession = async (id: PersonaId): Promise<SessionInfo> => {
    const existing = sessionsRef.current[id];
    if (existing && existing.claims.exp * 1000 > Date.now() + 5_000) {
      return existing;
    }
    return mintSession(id);
  };

  const signIn = async (id: PersonaId) => {
    await runExclusive(async () => {
      const persona = personaById(id);
      setAuthMessage(`Requesting a ${persona.role} session from the realm…`);

      // Every explicit sign-in rotates the token, even for the same identity.
      const session = await mintSession(id);
      activeIdRef.current = id;
      const response = await api<{ state: RemoteState }>(
        "/api/vault/state",
        session.token,
      );
      if (!response.ok) {
        throw new Error("The server rejected the new session.");
      }

      remoteRef.current = response.data.state;
      alertRef.current = null;
      setState(compose());

      // Load owner-only ciphertext and the server view before revealing the
      // dashboard, so no request can race a fast sign-out.
      await Promise.all([
        loadPii(session.token),
        refreshInspector(session.token),
      ]);

      setSignedIn(true);
      setAuthMessage(`Signed in as ${persona.fullName}.`);
    });
  };

  const switchPersona = (id: PersonaId) => {
    if (signedIn && activeIdRef.current === id) return;
    if (busyRef.current) {
      // Queue the switch behind the in-flight signature/deposit operation.
      window.setTimeout(() => switchPersona(id), 150);
      return;
    }
    void signIn(id);
  };

  const signOut = () => {
    void runExclusive(async () => {
      const activeToken = tokensRef.current[activeIdRef.current];
      if (activeToken) {
        await api("/api/auth/logout", activeToken, { method: "POST" });
      }
      sessionsRef.current = {};
      tokensRef.current = {};
      alertRef.current = null;
      piiRef.current = null;
      setPii(null);
      setInspector(null);
      setSignedIn(false);
      setState(null);
      setAuthMessage("Signed out. Session tokens were cleared from memory.");
    });
  };

  const attemptUnilateralWithdrawal = async () => {
    await runExclusive(async () => {
      const current = remoteRef.current;
      const id = activeIdRef.current;
      const session = sessionsRef.current[id];
      if (!current || !session || id !== "minh") return;

      const response = await api<AttackAlert & { receipt: string }>(
        "/api/vault/unilateral-attempt",
        session.token,
        {
          method: "POST",
          body: JSON.stringify({
            intent: "withdraw_all",
            amountCents: current.vault.totalCents,
          }),
        },
      );
      const data = response.data;
      alertRef.current = {
        id: `alert_${crypto.randomUUID().slice(0, 8)}`,
        code: (data.code as AttackAlert["code"]) ?? "NO_MASTER_KEY",
        status: 403,
        title: data.title ?? "TIDECLOAK POLICY VIOLATION · 403",
        detail: data.detail ?? "Unilateral withdrawal rejected.",
        policy: data.policy ?? "tide.bond.release.v1",
        actor: "Minh · lead_tenant",
        at: data.at ?? Date.now(),
        signature: data.receipt ?? "",
      };
      await refreshState(session.token);
    });
  };

  const attemptForceDeduct = async () => {
    await runExclusive(async () => {
      const id = activeIdRef.current;
      const session = sessionsRef.current[id];
      if (!session || id !== "bay") return;

      const response = await api<AttackAlert & { receipt: string }>(
        "/api/vault/unilateral-attempt",
        session.token,
        {
          method: "POST",
          body: JSON.stringify({ intent: "force_deduct", amountCents: 30_000 }),
        },
      );
      const data = response.data;
      alertRef.current = {
        id: `alert_${crypto.randomUUID().slice(0, 8)}`,
        code: (data.code as AttackAlert["code"]) ?? "MISSING_CONSENSUS",
        status: 403,
        title: data.title ?? "TIDECLOAK POLICY VIOLATION · 403",
        detail: data.detail ?? "Unilateral deduction rejected.",
        policy: data.policy ?? "tide.bond.release.v1",
        actor: "Mr. Bảy · landlord",
        at: data.at ?? Date.now(),
        signature: data.receipt ?? "",
      };
      await refreshState(session.token);
    });
  };

  const fileClaim = async (
    amountCents: number,
    reason: string,
    evidenceUrl: string,
    evidenceName: string,
    confidentialNote?: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    if (busyRef.current) {
      return { ok: false, error: "Another TideCloak operation is in flight." };
    }

    const current = remoteRef.current;
    const id = activeIdRef.current;
    const session = sessionsRef.current[id];
    const identity = identitiesRef.current[id];
    if (!current || !session || !identity) {
      return { ok: false, error: "Vault not ready." };
    }
    if (!permissionsFor(personaById(id).role).fileClaim) {
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
      const evidenceHash = await hashEvidence(evidenceUrl);
      const claimId = `clm_${crypto.randomUUID().slice(0, 8)}`;
      const at = Date.now();
      const payload = fileClaimPayload(claimId, amount, at, evidenceHash, id);
      const signature = await signPayload(identity.keys, payload);

      let note: EncryptedField | null = null;
      if (confidentialNote?.trim()) {
        const key =
          piiKeysRef.current[id] ?? (await generateDataKey());
        piiKeysRef.current[id] = key;
        note = await encryptField(key, confidentialNote.trim());
      }

      const response = await api<{
        state?: RemoteState;
        message?: string;
      }>("/api/vault/claims", session.token, {
        method: "POST",
        body: JSON.stringify({
          claimId,
          amountCents: amount,
          reason: reason.trim() || DEFAULT_CLAIM_REASON,
          evidenceUrl,
          evidenceName,
          evidenceHash,
          at,
          signature,
          confidentialNote: note,
        }),
      });

      if (!response.ok) return response.data.message ?? "Claim rejected.";
      if (response.data.state) {
        remoteRef.current = response.data.state;
        publish();
      }
      await refreshInspector(session.token);
      return true;
    });

    if (outcome !== true) {
      return {
        ok: false,
        error:
          typeof outcome === "string"
            ? outcome
            : "TideCloak rejected the claim request. Check the audit log.",
      };
    }
    return { ok: true };
  };

  const signClaim = async (decision: Decision) => {
    await runExclusive(async () => {
      const id = activeIdRef.current;
      const session = sessionsRef.current[id];
      const identity = identitiesRef.current[id];
      const claim = remoteRef.current?.claim;
      if (!session || !identity || !claim || claim.status !== "pending") return;
      if (!permissionsFor(personaById(id).role).signClaim) return;
      const tenantId = id as TenantId;
      if (!TENANT_IDS.includes(tenantId)) return;
      if (claim.approvals[tenantId]) return;

      const signedAt = Date.now();
      const payload = decisionPayload(
        claim.id,
        claim.amountCents,
        tenantId,
        decision,
        signedAt,
      );
      const signature = await signPayload(identity.keys, payload);

      const response = await api<{
        state?: RemoteState;
        message?: string;
      }>(`/api/vault/claims/${encodeURIComponent(claim.id)}/decision`, session.token, {
        method: "POST",
        body: JSON.stringify({ decision, signature, signedAt }),
      });

      if (!response.ok) {
        setBootError(response.data.message ?? "Signature rejected by the server.");
        return;
      }
      if (response.data.state) {
        remoteRef.current = response.data.state;
        publish();
      }
      await refreshInspector(session.token);
    });
  };

  const runDisputeScenario = async () => {
    await runExclusive(async () => {
      const activeSession = sessionsRef.current[activeIdRef.current];
      if (!activeSession) return;

      const bayIdentity = identitiesRef.current.bay;
      if (!bayIdentity) return;
      const baySession = await ensureSession("bay");

      if (!remoteRef.current?.claim) {
        const evidenceHash = await hashEvidence(DEFAULT_EVIDENCE);
        const claimId = `clm_${crypto.randomUUID().slice(0, 8)}`;
        const at = Date.now();
        const payload = fileClaimPayload(
          claimId,
          DEFAULT_CLAIM_CENTS,
          at,
          evidenceHash,
          "bay",
        );
        const signature = await signPayload(bayIdentity.keys, payload);
        const response = await api<{ state?: RemoteState; message?: string }>(
          "/api/vault/claims",
          baySession.token,
          {
            method: "POST",
            body: JSON.stringify({
              claimId,
              amountCents: DEFAULT_CLAIM_CENTS,
              reason: DEFAULT_CLAIM_REASON,
              evidenceUrl: DEFAULT_EVIDENCE,
              evidenceName: "broken_faucet.jpg",
              evidenceHash,
              at,
              signature,
              confidentialNote: null,
            }),
          },
        );
        if (!response.ok || !response.data.state) return;
        remoteRef.current = response.data.state;
      }

      for (const tenantId of ["lan", "tuan"] as TenantId[]) {
        const claim: Claim | null = remoteRef.current?.claim ?? null;
        if (!claim || claim.status !== "pending") break;
        if (claim.approvals[tenantId]) continue;

        const identity = identitiesRef.current[tenantId];
        if (!identity) break;
        const session = await ensureSession(tenantId);
        const signedAt = Date.now();
        const payload = decisionPayload(
          claim.id,
          claim.amountCents,
          tenantId,
          "reject",
          signedAt,
        );
        const signature = await signPayload(identity.keys, payload);
        const response: ApiResult<{ state?: RemoteState; message?: string }> =
          await api<{ state?: RemoteState; message?: string }>(
            `/api/vault/claims/${encodeURIComponent(claim.id)}/decision`,
            session.token,
            {
              method: "POST",
              body: JSON.stringify({ decision: "reject", signature, signedAt }),
            },
          );
        if (!response.ok || !response.data.state) break;
        remoteRef.current = response.data.state;
      }

      publish();
      await refreshInspector(activeSession.token);
    });
  };

  const resetDemo = async () => {
    await runExclusive(async () => {
      const session = sessionsRef.current[activeIdRef.current];
      if (!session) return;
      const response = await api<{ state: RemoteState }>("/api/vault/reset", session.token, {
        method: "POST",
      });
      if (!response.ok) return;
      remoteRef.current = response.data.state;
      alertRef.current = null;
      publish();
      await Promise.all([
        loadPii(session.token),
        refreshInspector(session.token),
      ]);
    });
  };

  const piiKeyFor = async (id: PersonaId): Promise<CryptoKey> => {
    const existing = piiKeysRef.current[id];
    if (existing) return existing;
    const key = await generateDataKey();
    piiKeysRef.current[id] = key;
    return key;
  };

  const saveProtectedFields = async (
    fields: Record<string, string>,
  ): Promise<{ ok: boolean; error?: string }> => {
    const id = activeIdRef.current;
    const session = sessionsRef.current[id];
    if (!session) return { ok: false, error: "Sign in first." };

    const entries = Object.entries(fields).filter(([, value]) => value.trim());
    if (entries.length === 0) {
      return { ok: false, error: "Enter at least one value to protect." };
    }

    setPiiBusy(true);
    setPiiError(null);
    try {
      const key = await piiKeyFor(id);
      const encrypted: Record<string, EncryptedField> = {};
      for (const [name, value] of entries) {
        encrypted[name] = await encryptField(key, value.trim());
      }

      const response = await api<{ message?: string }>("/api/vault/pii", session.token, {
        method: "PUT",
        body: JSON.stringify({ fields: encrypted }),
      });
      if (!response.ok) {
        const message = response.data.message ?? "Encryption write failed.";
        setPiiError(message);
        return { ok: false, error: message };
      }

      await Promise.all([loadPii(session.token), refreshInspector(session.token)]);
      return { ok: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Encryption failed.";
      setPiiError(message);
      return { ok: false, error: message };
    } finally {
      setPiiBusy(false);
    }
  };

  const revealProtectedFields = async (): Promise<{
    ok: boolean;
    values?: Record<string, string>;
    error?: string;
  }> => {
    const id = activeIdRef.current;
    const session = sessionsRef.current[id];
    if (!session) return { ok: false, error: "Sign in first." };
    if (!piiRef.current) return { ok: false, error: "No protected fields stored." };

    const key = piiKeysRef.current[id];
    if (!key) {
      return {
        ok: false,
        error:
          "The decryption key lives only in the browser tab that created it. Sign in there to reveal these fields.",
      };
    }

    try {
      const values: Record<string, string> = {};
      for (const [name, field] of Object.entries(piiRef.current.fields)) {
        values[name] = await decryptField(key, field);
      }
      return { ok: true, values };
    } catch {
      return { ok: false, error: "Ciphertext could not be decrypted with this key." };
    }
  };

  const decodeActiveToken = () => {
    const token = tokensRef.current[activeIdRef.current];
    return token ? decodeJwt(token) : { header: null, payload: null };
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
    realm,
    connection: realm?.connection ?? null,
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
    pii,
    piiBusy,
    piiError,
    inspector,
    saveProtectedFields,
    revealProtectedFields,
    refreshInspector,
    decodeActiveToken,
    roles: (activeSession?.claims.realmRoles ?? []) as TideRole[],
  };
}

export type TrustVaultController = ReturnType<typeof useTrustVault>;
