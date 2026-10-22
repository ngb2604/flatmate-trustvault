import { NextResponse } from "next/server";
import { appendLog, withDb } from "../../../../lib/server/db";
import { authenticate } from "../../../../lib/server/realm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  await withDb(async (db) => {
    db.revocations[auth.claims.jti] = auth.claims.exp;
    appendLog(db, {
      kind: "session",
      actor: `${auth.claims.preferred_username} · ${auth.claims.role}`,
      title: "Session revoked · sign-out",
      detail: `Token ${auth.claims.jti.slice(0, 8)}… added to the server revocation list. The client also wiped its in-memory copy.`,
    });
  });

  return NextResponse.json({ ok: true, revoked: auth.claims.jti });
}
