import { NextResponse } from "next/server";
import { PERSONAS } from "../../../../data/personas";
import type { PersonaId } from "../../../../types";
import { appendLog, withDb } from "../../../../lib/server/db";
import { mintToken, realmConfig } from "../../../../lib/server/realm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TokenRequest {
  personaId?: string;
  publicKeySpki?: string;
  fingerprint?: string;
}

export async function POST(request: Request) {
  const config = realmConfig();
  if (config.mode === "live") {
    return NextResponse.json(
      {
        error: "LIVE_REALM",
        message:
          "This deployment delegates sign-in to a live TideCloak realm. Use the realm login redirect.",
        loginUrl: `${config.issuer}/protocol/openid-connect/auth`,
      },
      { status: 409 },
    );
  }

  let body: TokenRequest;
  try {
    body = (await request.json()) as TokenRequest;
  } catch {
    return NextResponse.json(
      { error: "INVALID_BODY", message: "Expected a JSON body." },
      { status: 400 },
    );
  }

  const persona = PERSONAS.find((candidate) => candidate.id === body.personaId);
  if (!persona) {
    return NextResponse.json(
      { error: "UNKNOWN_IDENTITY", message: "Unknown persona id." },
      { status: 400 },
    );
  }

  const publicKeySpki = typeof body.publicKeySpki === "string" ? body.publicKeySpki : "";
  const fingerprint = typeof body.fingerprint === "string" ? body.fingerprint : "";
  if (publicKeySpki.length < 40 || !/^[A-Za-z0-9+/=]+$/.test(publicKeySpki)) {
    return NextResponse.json(
      {
        error: "PUBLIC_KEY_REQUIRED",
        message:
          "A browser-held ES256 public key (SPKI base64) is required to bind the session.",
      },
      { status: 400 },
    );
  }

  const personaId = persona.id as PersonaId;

  const result = await withDb(async (db) => {
    const minted = await mintToken(db, personaId, publicKeySpki, fingerprint);
    appendLog(db, {
      kind: "session",
      actor: `${persona.name} · ${persona.role}`,
      title: `${persona.fullName} signed in · ES256 session`,
      detail: `Scope ${minted.claims.scope}. Session ${minted.claims.jti.slice(0, 8)}… bound to a non-extractable P-256 key (thumbprint ${minted.claims.cnf?.spkiSha256.slice(0, 12)}…). Signature verified by the server on every request.`,
      signature: minted.token.split(".")[2],
    });
    return minted;
  });

  return NextResponse.json({
    token: result.token,
    claims: result.claims,
    verified: true,
  });
}
