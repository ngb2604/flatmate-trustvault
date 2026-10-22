import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { NextResponse } from "next/server";
import { personaById } from "../../data/personas";
import type {
  ConnectionInfo,
  PersonaId,
  SessionClaims,
  TideRole,
} from "../../types";
import {
  loadDb,
  pruneRevocations,
  subFor,
  type UserRecord,
  type VaultRecord,
} from "./db";

export const TIDECLOAK_SDK_VERSION = "0.14.41";
export const SESSION_TTL_SECONDS = 15 * 60;

export interface RealmConfig {
  mode: "demo" | "live";
  issuer: string;
  realm: string;
  clientId: string;
  url: string | null;
}

export function realmConfig(): RealmConfig {
  const url = process.env.NEXT_PUBLIC_TIDECLOAK_URL ?? null;
  const realm = process.env.NEXT_PUBLIC_TIDECLOAK_REALM ?? null;
  const clientId =
    process.env.NEXT_PUBLIC_TIDECLOAK_CLIENT_ID ?? "flatmate-trustvault";

  if (url && realm) {
    return {
      mode: "live",
      issuer: `${url.replace(/\/$/, "")}/realms/${realm}`,
      realm,
      clientId,
      url,
    };
  }

  return {
    mode: "demo",
    issuer: "https://local.tidecloak.demo/realms/tide-demo",
    realm: "tide-demo",
    clientId,
    url: null,
  };
}

export function connectionInfo(): ConnectionInfo {
  const config = realmConfig();
  return {
    mode: config.mode,
    realm: config.realm,
    issuer: config.issuer.replace(/^https?:\/\//, ""),
    sdkVersion: TIDECLOAK_SDK_VERSION,
    note:
      config.mode === "live"
        ? "Live TideCloak realm: tokens are issued and verified against the configured realm."
        : "Built-in demo realm: the server issues and verifies real ES256 JWTs. Live TideCloak settings are a configuration preview in this build.",
  };
}

export function scopeFor(role: TideRole): string {
  if (role === "landlord") return "openid tide.vault.read tide.claim.file";
  if (role === "arbitrator") return "openid tide.vault.read tide.dispute.arbitrate";
  return "openid tide.vault.read tide.claim.sign tide.pii.write";
}

export interface TokenClaims extends SessionClaims {
  preferred_username: string;
  realm_access: { roles: TideRole[] };
  resource_access: Record<string, { roles: TideRole[] }>;
  cnf?: { spkiSha256: string; personaId: PersonaId };
}

export interface MintResult {
  token: string;
  claims: TokenClaims;
}

export function registerUser(
  db: VaultRecord,
  personaId: PersonaId,
  publicKeySpki: string,
  fingerprint: string,
): UserRecord {
  const persona = personaById(personaId);
  const sub = subFor(personaId);
  const user: UserRecord = {
    sub,
    personaId,
    name: persona.name,
    fullName: persona.fullName,
    role: persona.role,
    fingerprint,
    publicKeySpki,
    registeredAt: db.users[sub]?.registeredAt ?? Date.now(),
  };
  db.users[sub] = user;
  return user;
}

export async function mintToken(
  db: VaultRecord,
  personaId: PersonaId,
  publicKeySpki: string,
  fingerprint: string,
): Promise<MintResult> {
  const config = realmConfig();
  const persona = personaById(personaId);
  const user = registerUser(db, personaId, publicKeySpki, fingerprint);
  const role = persona.role;
  const scope = scopeFor(role);
  const jti = crypto.randomUUID();
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + SESSION_TTL_SECONDS;

  const claims: TokenClaims = {
    iss: config.issuer,
    sub: user.sub,
    name: persona.fullName,
    preferred_username: persona.name,
    role,
    realmRoles: [role],
    clientRoles: [role],
    scope,
    iat,
    exp,
    jti,
    realm_access: { roles: [role] },
    resource_access: { [config.clientId]: { roles: [role] } },
    cnf: {
      spkiSha256: crypto
        .createHash("sha256")
        .update(Buffer.from(publicKeySpki, "base64"))
        .digest("hex"),
      personaId,
    },
  };

  const privateKey = crypto.createPrivateKey({
    key: db.realm.privateKeyJwk,
    format: "jwk",
  });
  const token = await new SignJWT({ ...claims, aud: config.clientId })
    .setProtectedHeader({ alg: "ES256", typ: "JWT", kid: db.realm.kid })
    .sign(privateKey);

  return { token, claims };
}

export type AuthResult =
  | { ok: true; token: string; claims: TokenClaims; db: VaultRecord }
  | { ok: false; response: NextResponse };

export async function authenticate(req: Request): Promise<AuthResult> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "UNAUTHENTICATED",
          message: "Missing Authorization: Bearer <TideCloak token> header.",
        },
        { status: 401 },
      ),
    };
  }

  const db = await loadDb();
  pruneRevocations(db);

  try {
    const publicKey = crypto.createPublicKey({
      key: db.realm.privateKeyJwk,
      format: "jwk",
    });
    const { payload } = await jwtVerify(token, publicKey, {
      issuer: realmConfig().issuer,
      audience: realmConfig().clientId,
    });
    const claims = payload as unknown as TokenClaims;

    if (db.revocations[claims.jti]) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: "SESSION_REVOKED",
            message: "This session was signed out and is no longer valid.",
            callerSub: claims.sub,
          },
          { status: 401 },
        ),
      };
    }

    return { ok: true, token, claims, db };
  } catch (error) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "INVALID_TOKEN",
          message:
            error instanceof Error
              ? `Token verification failed: ${error.message}`
              : "Token verification failed.",
        },
        { status: 401 },
      ),
    };
  }
}

export function hasRole(claims: TokenClaims, roles: TideRole[]): boolean {
  return roles.includes(claims.role);
}

export function roleForbidden(
  claims: TokenClaims,
  required: TideRole[],
  message: string,
): NextResponse {
  return NextResponse.json(
    {
      error: "FORBIDDEN_ROLE",
      callerSub: claims.sub,
      callerRoles: [claims.role, ...claims.realmRoles.filter((r) => r !== claims.role)],
      requiredRoles: required,
      message,
    },
    { status: 403 },
  );
}
