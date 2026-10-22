import { NextResponse } from "next/server";
import { DB_FILE, dbStats, loadDb } from "../../../../lib/server/db";
import { authenticate, realmConfig } from "../../../../lib/server/realm";
import type { InspectorSnapshot } from "../../../../types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only "what the server sees" view. Everything sensitive is either
 * ciphertext or a public key fingerprint; no plaintext PII and no session
 * tokens are returned.
 */
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  const db = await loadDb();
  const stats = await dbStats();

  const snapshot: InspectorSnapshot = {
    file: DB_FILE.replace(process.cwd(), "").replace(/\\/g, "/").replace(/^\//, ""),
    fileBytes: stats.bytes,
    updatedAt: stats.updatedAt,
    realm: {
      kid: db.realm.kid,
      alg: "ES256",
      issuer: realmConfig().issuer,
      privateKey: "[redacted — held by the realm, never sent to clients]",
    },
    users: Object.values(db.users).map((user) => ({
      sub: user.sub,
      personaId: user.personaId,
      role: user.role,
      fingerprint: user.fingerprint,
      keyType: "ECDSA P-256 · SPKI · non-extractable client key",
      registeredAt: user.registeredAt,
    })),
    deposits: Object.entries(db.deposits).map(([sub, deposit]) => ({
      sub,
      personaId: deposit.personaId,
      amountCents: deposit.amountCents,
      at: deposit.at,
      payoutRef: deposit.payoutRef,
    })),
    pii: Object.entries(db.pii).map(([sub, record]) => ({
      sub,
      personaId: db.users[sub]?.personaId ?? "minh",
      updatedAt: record.updatedAt,
      fields: record.fields,
    })),
    claimNote: db.claim?.confidentialNote ?? null,
    sessions: {
      revoked: Object.keys(db.revocations).length,
      active: Object.keys(db.users).length,
    },
  };

  return NextResponse.json({ inspector: snapshot });
}
