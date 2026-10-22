import { NextResponse } from "next/server";
import { PERSONAS } from "../../../data/personas";
import { RELEASE_POLICY } from "../../../tidecloak/policy";
import { connectionInfo, realmConfig, SESSION_TTL_SECONDS } from "../../../lib/server/realm";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = realmConfig();
  return NextResponse.json({
    connection: connectionInfo(),
    policy: RELEASE_POLICY,
    sessionTtlSeconds: SESSION_TTL_SECONDS,
    loginMode: config.mode,
    loginUrl:
      config.mode === "live"
        ? `${config.issuer}/protocol/openid-connect/auth?client_id=${encodeURIComponent(
            config.clientId,
          )}&response_type=code&scope=openid`
        : null,
    personas: PERSONAS.map((persona) => ({
      id: persona.id,
      name: persona.name,
      fullName: persona.fullName,
      initials: persona.initials,
      role: persona.role,
      roleLabel: persona.roleLabel,
      contributionCents: persona.contributionCents,
      kind: persona.kind,
    })),
  });
}
