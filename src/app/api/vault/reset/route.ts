import { NextResponse } from "next/server";
import { appendLog, withDb } from "../../../../lib/server/db";
import { resetVault, snapshot } from "../../../../lib/server/engine";
import { authenticate } from "../../../../lib/server/realm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  const state = await withDb(async (db) => {
    resetVault(db);
    appendLog(db, {
      kind: "reset",
      actor: "ADMIN · demo",
      title: "Demo state reset",
      detail: `Requested by ${auth.claims.sub}. New claim ID and fresh approval state. Session tokens and encrypted records were preserved; private keys remain non-extractable in the browser.`,
    });
    return snapshot(db);
  });

  return NextResponse.json({ ok: true, state });
}
