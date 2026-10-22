import { NextResponse } from "next/server";
import { personaById } from "../../../../data/personas";
import { appendLog, withDb } from "../../../../lib/server/db";
import { snapshot } from "../../../../lib/server/engine";
import { authenticate, roleForbidden } from "../../../../lib/server/realm";
import type { PersonaId } from "../../../../types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Records the authenticated tenant's bond contribution against their sub.
 * The demo ledger is seeded because the lease predates the dashboard; this
 * endpoint proves deposits are identity-bound and role-gated.
 */
export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  if (auth.claims.role !== "tenant" && auth.claims.role !== "lead_tenant") {
    return roleForbidden(
      auth.claims,
      ["tenant", "lead_tenant"],
      "Only a tenant may contribute a deposit share.",
    );
  }

  const result = await withDb(async (db) => {
    const user = db.users[auth.claims.sub];
    if (!user) {
      return {
        error: NextResponse.json(
          {
            error: "IDENTITY_NOT_REGISTERED",
            message: "Sign in again before depositing.",
          },
          { status: 401 },
        ),
      } as const;
    }

    const persona = personaById(user.personaId);
    const existing = db.deposits[auth.claims.sub];
    if (existing) {
      return {
        status: "already-recorded" as const,
        deposit: existing,
        state: snapshot(db),
      };
    }

    const deposit = {
      personaId: user.personaId as PersonaId,
      amountCents: persona.contributionCents,
      at: Date.now(),
      payoutRef: db.pii[auth.claims.sub]?.fields.bankIban ?? null,
    };
    db.deposits[auth.claims.sub] = deposit;
    db.vault.totalCents += deposit.amountCents;
    db.vault.initialTotalCents += deposit.amountCents;

    appendLog(db, {
      kind: "vault",
      actor: `${persona.name} · ${persona.role}`,
      title: `Deposit recorded · $${(deposit.amountCents / 100).toFixed(2)}`,
      detail: `Contribution bound to TideCloak sub ${auth.claims.sub}. Payout reference ${deposit.payoutRef ? "is encrypted at rest" : "not yet registered"}.`,
      amountCents: deposit.amountCents,
    });

    return {
      status: "recorded" as const,
      deposit,
      state: snapshot(db),
    };
  });

  if ("error" in result) return result.error;

  return NextResponse.json({
    ok: true,
    status: result.status,
    deposit: result.deposit,
    state: result.state,
  });
}
