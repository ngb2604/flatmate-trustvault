import { NextResponse } from "next/server";
import { loadDb } from "../../../../lib/server/db";
import { snapshot } from "../../../../lib/server/engine";
import { authenticate } from "../../../../lib/server/realm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  const db = await loadDb();
  const state = snapshot(db);

  return NextResponse.json({
    state,
    caller: {
      sub: auth.claims.sub,
      name: auth.claims.name,
      role: auth.claims.role,
      scope: auth.claims.scope,
    },
  });
}
