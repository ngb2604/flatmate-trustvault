import { NextResponse } from "next/server";
import {
  forceDeductionBlocked,
  unilateralWithdrawalBlocked,
} from "../../../../tidecloak/policy";
import { appendLog, withDb } from "../../../../lib/server/db";
import { signPolicyReceipt } from "../../../../lib/server/engine";
import { authenticate } from "../../../../lib/server/realm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AttemptBody {
  intent?: "withdraw_all" | "force_deduct";
  amountCents?: number;
}

/**
 * Security verification endpoint: any attempt to move the vault without a live
 * multi-party consensus is evaluated against the TideCloak policy and rejected
 * with a signed 403 receipt.
 */
export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  let body: AttemptBody;
  try {
    body = (await request.json()) as AttemptBody;
  } catch {
    body = {};
  }

  const intent = body.intent === "force_deduct" ? "force_deduct" : "withdraw_all";
  const evaluation =
    intent === "force_deduct" ? forceDeductionBlocked() : unilateralWithdrawalBlocked();

  const amountCents =
    typeof body.amountCents === "number" && Number.isFinite(body.amountCents)
      ? Math.round(body.amountCents)
      : 0;

  const at = Date.now();
  const receipt = await withDb(async (db) => {
    const signed = await signPolicyReceipt(
      db,
      auth.claims,
      evaluation.code,
      evaluation.detail,
    );
    appendLog(db, {
      kind: "blocked",
      actor: `${auth.claims.preferred_username} · ${auth.claims.role}`,
      title:
        intent === "force_deduct"
          ? "Unilateral deduction blocked · 403"
          : "Unilateral withdrawal blocked · 403",
      detail: `${evaluation.detail} Caller ${auth.claims.sub} presented role ${auth.claims.role}; the server rejected the mutation.`,
      amountCents: amountCents || db.vault.totalCents,
      signature: signed,
      at,
    });
    return signed;
  });

  return NextResponse.json(
    {
      error: "TIDECLOAK_EMERGENT_AUTHORITY_MISSING",
      code: evaluation.code,
      status: 403,
      title: evaluation.title,
      detail: evaluation.detail,
      policy: evaluation.policy,
      intent,
      amountCents,
      callerSub: auth.claims.sub,
      callerRoles: auth.claims.realmRoles,
      at,
      receipt,
      message:
        "Unilateral custody override rejected. Operation requires cryptographic alignment of 1 landlord claim + >= 2/3 tenant signatures.",
    },
    { status: 403 },
  );
}
