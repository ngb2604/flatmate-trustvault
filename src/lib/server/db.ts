import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  INITIAL_TOTAL_CENTS,
  PERSONAS,
} from "../../data/personas";
import type {
  Claim,
  EncryptedField,
  LogEntry,
  PayoutLine,
  PersonaId,
  TideRole,
  VaultState,
} from "../../types";

export interface UserRecord {
  sub: string;
  personaId: PersonaId;
  name: string;
  fullName: string;
  role: TideRole;
  fingerprint: string;
  publicKeySpki: string;
  registeredAt: number;
}

export interface DepositRecord {
  personaId: PersonaId;
  amountCents: number;
  at: number;
  payoutRef: EncryptedField | null;
}

export interface PiiRecord {
  updatedAt: number;
  fields: Record<string, EncryptedField>;
}

export interface VaultRecord {
  version: 1;
  realm: {
    privateKeyJwk: JsonWebKey;
    kid: string;
    createdAt: number;
  };
  vault: VaultState & { id: string };
  wallets: Record<PersonaId, number>;
  claim: Claim | null;
  payouts: PayoutLine[];
  log: LogEntry[];
  users: Record<string, UserRecord>;
  deposits: Record<string, DepositRecord>;
  pii: Record<string, PiiRecord>;
  /** jti -> exp (unix seconds) so expired revocations can be pruned. */
  revocations: Record<string, number>;
  updatedAt: number;
}

export const DB_FILE = path.join(process.cwd(), "data", "vault-db.json");
export const GENESIS_HASH = "0".repeat(64);
export const VAULT_ID = "vault_flat_7a";

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function subFor(personaId: PersonaId): string {
  return `usr_${personaId}`;
}

export function appendLog(
  db: VaultRecord,
  entry: Omit<LogEntry, "id" | "at" | "hash" | "prevHash"> & { at?: number },
): LogEntry {
  const prevHash = db.log[0]?.hash ?? GENESIS_HASH;
  const at = entry.at ?? Date.now();
  const payload = {
    kind: entry.kind,
    actor: entry.actor,
    title: entry.title,
    detail: entry.detail,
    amountCents: entry.amountCents,
    signature: entry.signature,
    at,
    prevHash,
  };
  const hash = sha256(`${prevHash}|${JSON.stringify(payload)}`);
  const logEntry: LogEntry = {
    ...payload,
    id: `log_${crypto.randomUUID().slice(0, 8)}`,
    hash,
  };
  db.log = [logEntry, ...db.log];
  return logEntry;
}

function seedLogs(db: VaultRecord) {
  appendLog(db, {
    kind: "vault",
    actor: "VAULT",
    title: "Escrow vault sealed · $1,200.00",
    detail:
      "Ownership ledger committed: Minh $400.00 · Lan $400.00 · Tuấn $400.00. No master key provisioned.",
    amountCents: INITIAL_TOTAL_CENTS,
  });
  appendLog(db, {
    kind: "session",
    actor: "TIDECLOAK",
    title: "Server realm online · 4 identities registered",
    detail:
      "Policy tide.bond.release.v1 armed. Sessions are issued by the server and verified on every API request. Release requires landlord + 2/3 tenants.",
  });
}

function createSeed(): VaultRecord {
  const { privateKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: "P-256",
  });
  const privateKeyJwk = privateKey.export({ format: "jwk" }) as JsonWebKey;

  const db: VaultRecord = {
    version: 1,
    realm: {
      privateKeyJwk,
      kid: `tc_${crypto.randomUUID().slice(0, 8)}`,
      createdAt: Date.now(),
    },
    vault: {
      id: VAULT_ID,
      totalCents: INITIAL_TOTAL_CENTS,
      frozenCents: 0,
      initialTotalCents: INITIAL_TOTAL_CENTS,
    },
    wallets: { minh: 0, lan: 0, tuan: 0, bay: 0 },
    claim: null,
    payouts: [],
    log: [],
    users: {},
    deposits: {},
    pii: {},
    revocations: {},
    updatedAt: Date.now(),
  };

  for (const persona of PERSONAS) {
    if (persona.kind !== "tenant") continue;
    db.deposits[subFor(persona.id)] = {
      personaId: persona.id,
      amountCents: persona.contributionCents,
      at: db.realm.createdAt,
      payoutRef: null,
    };
  }

  seedLogs(db);
  return db;
}

type GlobalWithDb = typeof globalThis & {
  __trustVaultWriteChain?: Promise<unknown>;
  __trustVaultInit?: Promise<VaultRecord>;
};
const globalDb = globalThis as GlobalWithDb;

async function readDbFile(): Promise<VaultRecord | null> {
  let raw: string;
  try {
    raw = await fs.readFile(DB_FILE, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }

  // A concurrent write can truncate the file for a few milliseconds. Retry
  // before concluding anything; never seed over an existing ledger.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return JSON.parse(raw) as VaultRecord;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 15));
      raw = await fs.readFile(DB_FILE, "utf8");
    }
  }
  throw new Error("data/vault-db.json exists but could not be parsed.");
}

async function writeDbFile(db: VaultRecord): Promise<void> {
  db.updatedAt = Date.now();
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
  // Direct write is used instead of rename because OneDrive-backed folders on
  // Windows can reject replace-renames (EPERM). readDbFile retries parse races.
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

export async function loadDb(): Promise<VaultRecord> {
  const existing = await readDbFile();
  if (existing) return existing;

  // Exactly one realm seed may win, even when several routes boot at once.
  if (!globalDb.__trustVaultInit) {
    globalDb.__trustVaultInit = (async () => {
      const raced = await readDbFile();
      if (raced) return raced;
      const fresh = createSeed();
      await writeDbFile(fresh);
      return fresh;
    })();
  }

  return globalDb.__trustVaultInit;
}

/**
 * Serialises every read-modify-write against the JSON ledger so concurrent
 * API requests cannot clobber each other.
 */
export async function withDb<T>(
  mutate: (db: VaultRecord) => T | Promise<T>,
): Promise<T> {
  const previous = globalDb.__trustVaultWriteChain ?? Promise.resolve();
  let release: () => void = () => {};
  globalDb.__trustVaultWriteChain = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    const db = await loadDb();
    const result = await mutate(db);
    await writeDbFile(db);
    return result;
  } finally {
    release();
  }
}

export async function dbStats(): Promise<{ bytes: number; updatedAt: number }> {
  try {
    const stat = await fs.stat(DB_FILE);
    const db = await loadDb();
    return { bytes: stat.size, updatedAt: db.updatedAt };
  } catch {
    return { bytes: 0, updatedAt: 0 };
  }
}

export function pruneRevocations(db: VaultRecord) {
  const now = Math.floor(Date.now() / 1000);
  for (const [jti, exp] of Object.entries(db.revocations)) {
    if (exp < now) delete db.revocations[jti];
  }
}
