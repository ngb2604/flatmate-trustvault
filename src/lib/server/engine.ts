import crypto from "node:crypto";
import { SignJWT } from "jose";
import {
  INITIAL_TOTAL_CENTS,
  PERSONAS,
  TENANT_IDS,
  personaById,
} from "../../data/personas";
import { splitProRata } from "../format";
import { RELEASE_POLICY as POLICY, consensusFrom } from "../../tidecloak/policy";
import type {
  Claim,
  Decision,
  PayoutLine,
  PersonaId,
  TenantId,
} from "../../types";
import type { TokenClaims } from "./realm";
import { realmConfig } from "./realm";
import {
  VAULT_ID,
  appendLog,
  sha256,
  subFor,
  type VaultRecord,
} from "./db";

export interface RemoteState {
  vault: VaultRecord["vault"];
  wallets: VaultRecord["wallets"];
  claim: Claim | null;
  payouts: PayoutLine[];
  log: VaultRecord["log"];
}

export function snapshot(db: VaultRecord): RemoteState {
  return {
    vault: { ...db.vault },
    wallets: { ...db.wallets },
    claim: db.claim ? { ...db.claim } : null,
    payouts: [...db.payouts],
    log: [...db.log],
  };
}

export function verifySignature(
  publicKeySpki: string,
  payload: unknown,
  signatureBase64: string,
): boolean {
  try {
    const key = crypto.createPublicKey({
      key: Buffer.from(publicKeySpki, "base64"),
      format: "der",
      type: "spki",
    });
    return crypto.verify(
      "sha256",
      Buffer.from(JSON.stringify(payload)),
      { key, dsaEncoding: "ieee-p1363" },
      Buffer.from(signatureBase64, "base64"),
    );
  } catch {
    return false;
  }
}

export async function signPolicyReceipt(
  db: VaultRecord,
  claims: TokenClaims,
  code: string,
  message: string,
): Promise<string> {
  const config = realmConfig();
  const now = Math.floor(Date.now() / 1000);
  const privateKey = crypto.createPrivateKey({
    key: db.realm.privateKeyJwk,
    format: "jwk",
  });
  return new SignJWT({
    kind: "policy.receipt",
    code,
    message,
    policy: POLICY.id,
    callerSub: claims.sub,
    callerRoles: [claims.role],
  })
    .setProtectedHeader({ alg: "ES256", typ: "JWT-receipt", kid: db.realm.kid })
    .setIssuer(config.issuer)
    .setAudience(config.clientId)
    .setSubject(claims.sub)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .setJti(crypto.randomUUID())
    .sign(privateKey);
}

function contributions(): Record<string, number> {
  const result: Record<string, number> = {};
  for (const persona of PERSONAS) {
    result[persona.id] = persona.contributionCents;
  }
  return result;
}

export function settleClaim(db: VaultRecord, claim: Claim): void {
  const refundPool = db.vault.totalCents - claim.amountCents;
  const shares = splitProRata(refundPool, contributions(), TENANT_IDS);

  db.wallets = {
    ...db.wallets,
    bay: db.wallets.bay + claim.amountCents,
    minh: db.wallets.minh + shares.minh,
    lan: db.wallets.lan + shares.lan,
    tuan: db.wallets.tuan + shares.tuan,
  };

  db.payouts = [
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

  db.claim = {
    ...claim,
    status: "settled",
    resolution: "consensus",
    settledAt: Date.now(),
  };
  db.vault = { ...db.vault, totalCents: 0, frozenCents: 0 };

  appendLog(db, {
    kind: "authority",
    actor: "TIDECLOAK",
    title: "Emergent Authority unlocked",
    detail: `Policy ${POLICY.id} satisfied: landlord signature + 2/3 tenant approvals. One-time authority granted for ${claim.id}, then dissolved.`,
    amountCents: claim.amountCents,
  });
  appendLog(db, {
    kind: "payout",
    actor: "VAULT",
    title: "Atomic settlement · 4 wallets credited",
    detail: `${cut(claim.amountCents)} to Mr. Bảy · ${cut(shares.minh)} each to Minh, Lan and Tuấn. Refund never passed through the lead tenant.`,
    amountCents: db.vault.initialTotalCents,
  });
}

export function disputeClaim(db: VaultRecord, claim: Claim): void {
  const refundPool = db.vault.totalCents - claim.amountCents;
  const shares = splitProRata(refundPool, contributions(), TENANT_IDS);

  db.wallets = {
    ...db.wallets,
    minh: db.wallets.minh + shares.minh,
    lan: db.wallets.lan + shares.lan,
    tuan: db.wallets.tuan + shares.tuan,
  };

  db.payouts = TENANT_IDS.map((id) => ({
    personaId: id,
    amountCents: shares[id],
    label: "Undisputed refund",
    kind: "refund" as const,
  }));

  db.claim = {
    ...claim,
    status: "disputed",
    resolution: "dispute",
    settledAt: Date.now(),
  };
  db.vault = {
    ...db.vault,
    totalCents: claim.amountCents,
    frozenCents: claim.amountCents,
  };

  appendLog(db, {
    kind: "dispute",
    actor: "TIDECLOAK",
    title: "Dispute lock engaged · partial freeze",
    detail: `Tenant rejection threshold reached. ${cut(refundPool)} refunded immediately to the three contributors; only the disputed ${cut(claim.amountCents)} stays locked for ${POLICY.arbitration}.`,
    amountCents: claim.amountCents,
  });
  appendLog(db, {
    kind: "payout",
    actor: "VAULT",
    title: "Undisputed refund executed · 3 wallets credited",
    detail: `${cut(shares.minh)} each returned directly to Minh, Lan and Tuấn. The landlord's wallet received $0.00.`,
    amountCents: refundPool,
  });
}

function cut(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export interface DecisionOutcome {
  decision: Decision;
  tenantId: TenantId;
  settled: boolean;
  disputed: boolean;
  consensus: ReturnType<typeof consensusFrom>;
}

export function applyDecision(
  db: VaultRecord,
  tenantId: TenantId,
  decision: Decision,
  signature: string,
  fingerprint: string,
  signedAt: number,
): DecisionOutcome {
  const claim = db.claim;
  if (!claim) throw new Error("No claim is open.");

  const approval = {
    tenantId,
    decision,
    signature,
    fingerprint,
    signedAt,
    verified: true,
  };
  db.claim = {
    ...claim,
    approvals: { ...claim.approvals, [tenantId]: approval },
  };

  const consensus = consensusFrom(db.claim.approvals);
  const persona = personaById(tenantId);

  appendLog(db, {
    kind: "sign",
    actor: `${persona.name} · ${persona.roleLabel}`,
    title:
      decision === "approve"
        ? `Tenant signature collected · ${cut(claim.amountCents)} claim`
        : `Tenant rejected claim · ${cut(claim.amountCents)}`,
    detail:
      decision === "approve"
        ? `${persona.name} co-signed with ES256 (${signature.slice(0, 14)}…${signature.slice(-6)}). ${consensus.approvals} of 2 required approvals collected; ${consensus.remaining} still needed. Server verification passed.`
        : `${persona.name} rejected the deduction. ${consensus.rejections} of 2 rejection locks engaged. Server verification passed.`,
    signature,
    at: signedAt,
  });

  let settled = false;
  let disputed = false;
  if (consensus.thresholdMet) {
    settleClaim(db, db.claim!);
    settled = true;
  } else if (consensus.rejectionLock) {
    disputeClaim(db, db.claim!);
    disputed = true;
  }

  return { decision, tenantId, settled, disputed, consensus };
}

export function resetVault(db: VaultRecord): void {
  db.vault = {
    id: VAULT_ID,
    totalCents: INITIAL_TOTAL_CENTS,
    frozenCents: 0,
    initialTotalCents: INITIAL_TOTAL_CENTS,
  };
  db.wallets = { minh: 0, lan: 0, tuan: 0, bay: 0 };
  db.claim = null;
  db.payouts = [];
  db.log = [];

  appendLog(db, {
    kind: "vault",
    actor: "VAULT",
    title: "Escrow vault re-sealed · $1,200.00",
    detail:
      "Ownership ledger restored: Minh $400.00 · Lan $400.00 · Tuấn $400.00. Wallets cleared. No master key provisioned.",
    amountCents: INITIAL_TOTAL_CENTS,
  });
  appendLog(db, {
    kind: "session",
    actor: "TIDECLOAK",
    title: "Server realm online · 4 identities registered",
    detail:
      "Policy tide.bond.release.v1 armed. Sessions are issued by the server and verified on every API request. Session tokens and encrypted records were preserved.",
  });
}

export function findUserBySub(db: VaultRecord, sub: string) {
  return db.users[sub] ?? null;
}

export { sha256, subFor };
