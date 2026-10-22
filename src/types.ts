export type PersonaId = "minh" | "lan" | "tuan" | "bay";
export type TenantId = "minh" | "lan" | "tuan";
export type TideRole = "tenant" | "lead_tenant" | "landlord" | "arbitrator";
export type Accent = "emerald" | "violet" | "cyan" | "amber";

export interface PersonaDefinition {
  id: PersonaId;
  name: string;
  fullName: string;
  initials: string;
  role: TideRole;
  roleLabel: string;
  contributionCents: number;
  accent: Accent;
  kind: "tenant" | "landlord";
}

export interface PersonaIdentity {
  id: PersonaId;
  role: TideRole;
  fingerprint: string;
  publicKey: string;
  keys: CryptoKeyPair;
}

export interface SessionClaims {
  iss: string;
  sub: string;
  name: string;
  role: TideRole;
  realmRoles: TideRole[];
  clientRoles: TideRole[];
  scope: string;
  iat: number;
  exp: number;
  jti: string;
}

export interface EncryptedField {
  alg: "AES-GCM-256";
  iv: string;
  ciphertext: string;
}

export interface InspectorRecord {
  sub: string;
  personaId: PersonaId;
  role: TideRole;
  fingerprint: string;
  keyType: string;
  registeredAt: number;
}

export interface InspectorDeposit {
  sub: string;
  personaId: PersonaId;
  amountCents: number;
  at: number;
  payoutRef: EncryptedField | null;
}

export interface InspectorPii {
  sub: string;
  personaId: PersonaId;
  updatedAt: number;
  fields: Record<string, EncryptedField>;
}

export interface InspectorSnapshot {
  file: string;
  fileBytes: number;
  updatedAt: number;
  realm: { kid: string; alg: string; issuer: string; privateKey: string };
  users: InspectorRecord[];
  deposits: InspectorDeposit[];
  pii: InspectorPii[];
  claimNote: EncryptedField | null;
  sessions: { revoked: number; active: number };
}

export interface SessionInfo {
  personaId: PersonaId;
  token: string;
  claims: SessionClaims;
  verified: boolean;
}

export type ClaimStatus = "pending" | "settled" | "disputed";
export type Decision = "approve" | "reject";

export interface SignedApproval {
  tenantId: TenantId;
  decision: Decision;
  signature: string;
  fingerprint: string;
  signedAt: number;
  verified: boolean;
}

export interface Claim {
  id: string;
  amountCents: number;
  reason: string;
  evidenceUrl: string;
  evidenceName: string;
  evidenceHash: string;
  filedAt: number;
  landlordSignature: string;
  landlordFingerprint: string;
  /** Confidential note encrypted client-side before it reaches this server. */
  confidentialNote?: EncryptedField | null;
  approvals: Partial<Record<TenantId, SignedApproval>>;
  status: ClaimStatus;
  settledAt?: number;
  resolution?: "consensus" | "dispute";
}

export type LogKind =
  | "session"
  | "vault"
  | "blocked"
  | "claim"
  | "sign"
  | "authority"
  | "payout"
  | "dispute"
  | "reset";

export interface LogEntry {
  id: string;
  at: number;
  kind: LogKind;
  actor: string;
  title: string;
  detail: string;
  amountCents?: number;
  signature?: string;
  hash: string;
  prevHash: string;
}

export interface AttackAlert {
  id: string;
  code: "NO_MASTER_KEY" | "MISSING_CONSENSUS" | "ROLE_REQUIRED";
  status: 403;
  title: string;
  detail: string;
  policy: string;
  actor: string;
  at: number;
  signature: string;
}

export interface PayoutLine {
  personaId: PersonaId;
  amountCents: number;
  label: string;
  kind: "compensation" | "refund" | "frozen";
}

export interface VaultState {
  totalCents: number;
  frozenCents: number;
  initialTotalCents: number;
}

export interface ConnectionInfo {
  mode: "demo" | "live";
  realm: string;
  issuer: string;
  sdkVersion: string;
  note: string;
}

export interface AppState {
  activeId: PersonaId;
  vault: VaultState;
  wallets: Record<PersonaId, number>;
  claim: Claim | null;
  payouts: PayoutLine[];
  log: LogEntry[];
  alert: AttackAlert | null;
  sessions: Partial<Record<PersonaId, SessionInfo>>;
  fingerprints: Record<PersonaId, string>;
  connection: ConnectionInfo;
}
