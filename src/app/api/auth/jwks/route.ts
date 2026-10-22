import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { loadDb } from "../../../../lib/server/db";
import { realmConfig } from "../../../../lib/server/realm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public JWKS for the demo realm. The browser verifies its own session token
 * against this key the moment sign-in completes.
 */
export async function GET() {
  const db = await loadDb();
  const publicKey = crypto.createPublicKey({
    key: db.realm.privateKeyJwk,
    format: "jwk",
  });
  const jwk = publicKey.export({ format: "jwk" }) as JsonWebKey & {
    kty?: string;
    crv?: string;
    x?: string;
    y?: string;
  };

  return NextResponse.json({
    issuer: realmConfig().issuer,
    keys: [
      {
        kty: jwk.kty,
        crv: jwk.crv,
        x: jwk.x,
        y: jwk.y,
        alg: "ES256",
        use: "sig",
        kid: db.realm.kid,
      },
    ],
  });
}
