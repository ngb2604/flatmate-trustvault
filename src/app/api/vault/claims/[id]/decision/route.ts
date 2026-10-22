import { NextResponse } from "next/server";
import { TENANT_IDS } from "../../../../../../data/personas";
import { decisionPayload } from "../../../../../../lib/approval";
import { withDb } from "../../../../../../lib/server/db";
import { applyDecision, snapshot, verifySignature } from "../../../../../../lib/server/engine";
import { authenticate, roleForbidden } from "../../../../../../lib/server/realm";
import type { Decision, TenantId } from "../../../../../../types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DecisionBody {
  decision?: Decision;
  signature?: string;
  signedAt?: number;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  if (auth.claims.role !== "tenant" && auth.claims.role !== "lead_tenant") {
    return roleForbidden(
      auth.claims,
      ["tenant", "lead_tenant"],
      "Only tenant roles may sign or reject a deduction claim.",
    );
  }

  let body: DecisionBody;
  try {
    body = (await request.json()) as DecisionBody;
  } catch {
    return NextResponse.json(
      { error: "INVALID_BODY", message: "Expected a JSON body." },
      { status: 400 },
    );
  }

  const decision: Decision = body.decision === "reject" ? "reject" : "approve";
  const signature = typeof body.signature === "string" ? body.signature : "";
  const signedAt = typeof body.signedAt === "number" ? body.signedAt : Date.now();

  if (!signature) {
    return NextResponse.json(
      { error: "SIGNATURE_REQUIRED", message: "A detached ES256 signature is required." },
      { status: 400 },
    );
  }

  const result = await withDb(async (db) => {
    const user = db.users[auth.claims.sub];
    if (!user) {
      return {
        error: NextResponse.json(
          {
            error: "IDENTITY_NOT_REGISTERED",
            message: "Sign in again so the server can register your signing key.",
          },
          { status: 401 },
        ),
      } as const;
    }

    const tenantId = user.personaId as TenantId;
    if (!TENANT_IDS.includes(tenantId)) {
      return {
        error: NextResponse.json(
          {
            error: "NOT_A_TENANT",
            callerSub: auth.claims.sub,
            message: "This identity is not one of the three bond contributors.",
          },
          { status: 403 },
        ),
      } as const;
    }

    const claim = db.claim;
    if (!claim || claim.id !== id) {
      return {
        error: NextResponse.json(
          { error: "CLAIM_NOT_FOUND", message: "No matching open claim." },
          { status: 404 },
        ),
      } as const;
    }
    if (claim.status !== "pending") {
      return {
        error: NextResponse.json(
          {
            error: "CLAIM_CLOSED",
            message: `Claim already ${claim.status}.`,
          },
          { status: 409 },
        ),
      } as const;
    }
    if (claim.approvals[tenantId]) {
      return {
        error: NextResponse.json(
          {
            error: "DECISION_DUPLICATE",
            message: "This tenant already signed this claim.",
          },
          { status: 409 },
        ),
      } as const;
    }

    const payload = decisionPayload(
      claim.id,
      claim.amountCents,
      tenantId,
      decision,
      signedAt,
    );
    if (!verifySignature(user.publicKeySpki, payload, signature)) {
      return {
        error: NextResponse.json(
          {
            error: "SIGNATURE_INVALID",
            callerSub: auth.claims.sub,
            message:
              "Signature did not verify against the registered public key for this identity.",
          },
          { status: 403 },
        ),
      } as const;
    }

    const outcome = applyDecision(
      db,
      tenantId,
      decision,
      signature,
      user.fingerprint,
      signedAt,
    );

    return { outcome, state: snapshot(db) } as const;
  });

  if ("error" in result) return result.error;

  return NextResponse.json({
    ok: true,
    outcome: result.outcome,
    state: result.state,
  });
}
