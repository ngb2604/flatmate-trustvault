import { NextResponse } from "next/server";
import { fileClaimPayload } from "../../../../lib/approval";
import { appendLog, withDb } from "../../../../lib/server/db";
import { snapshot, verifySignature } from "../../../../lib/server/engine";
import { authenticate, roleForbidden } from "../../../../lib/server/realm";
import type { Claim, EncryptedField } from "../../../../types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ClaimBody {
  claimId?: string;
  amountCents?: number;
  reason?: string;
  evidenceName?: string;
  evidenceUrl?: string;
  evidenceHash?: string;
  at?: number;
  signature?: string;
  confidentialNote?: EncryptedField | null;
}

function validEncryptedField(value: unknown): value is EncryptedField {
  if (!value || typeof value !== "object") return false;
  const field = value as EncryptedField;
  return (
    field.alg === "AES-GCM-256" &&
    typeof field.iv === "string" &&
    field.iv.length > 0 &&
    field.iv.length < 256 &&
    typeof field.ciphertext === "string" &&
    field.ciphertext.length < 32768
  );
}

export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  if (auth.claims.role !== "landlord") {
    return roleForbidden(
      auth.claims,
      ["landlord"],
      "Only the landlord role may file a deduction claim. Tenants co-sign instead.",
    );
  }

  let body: ClaimBody;
  try {
    body = (await request.json()) as ClaimBody;
  } catch {
    return NextResponse.json(
      { error: "INVALID_BODY", message: "Expected a JSON body." },
      { status: 400 },
    );
  }

  const claimId = typeof body.claimId === "string" ? body.claimId : "";
  const amountCents =
    typeof body.amountCents === "number" ? Math.round(body.amountCents) : 0;
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 400) : "";
  const evidenceName =
    typeof body.evidenceName === "string"
      ? body.evidenceName.slice(0, 120)
      : "evidence.jpg";
  const evidenceUrl =
    typeof body.evidenceUrl === "string" ? body.evidenceUrl.slice(0, 2048) : "";
  const evidenceHash =
    typeof body.evidenceHash === "string" ? body.evidenceHash : "";
  const at = typeof body.at === "number" ? body.at : Date.now();
  const signature = typeof body.signature === "string" ? body.signature : "";

  if (!/^[a-z0-9_]{4,64}$/i.test(claimId)) {
    return NextResponse.json(
      { error: "INVALID_CLAIM_ID", message: "Claim id must be 4-64 safe characters." },
      { status: 400 },
    );
  }
  if (!/^[0-9a-f]{64}$/.test(evidenceHash)) {
    return NextResponse.json(
      {
        error: "EVIDENCE_HASH_REQUIRED",
        message: "A SHA-256 evidence commitment is required before filing.",
      },
      { status: 400 },
    );
  }

  const result = await withDb(async (db) => {
    if (db.claim && db.claim.status === "pending") {
      return {
        error: NextResponse.json(
          { error: "CLAIM_PENDING", message: "A claim is already awaiting signatures." },
          { status: 409 },
        ),
      } as const;
    }
    if (amountCents < 100) {
      return {
        error: NextResponse.json(
          { error: "AMOUNT_TOO_SMALL", message: "Claim amount must be at least $1.00." },
          { status: 400 },
        ),
      } as const;
    }
    if (amountCents > db.vault.totalCents) {
      return {
        error: NextResponse.json(
          {
            error: "AMOUNT_EXCEEDS_VAULT",
            message: "Claim cannot exceed the locked escrow balance.",
          },
          { status: 400 },
        ),
      } as const;
    }

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

    const payload = fileClaimPayload(claimId, amountCents, at, evidenceHash, "bay");
    if (!verifySignature(user.publicKeySpki, payload, signature)) {
      return {
        error: NextResponse.json(
          {
            error: "SIGNATURE_INVALID",
            message: "Landlord claim signature did not verify against the registered key.",
          },
          { status: 403 },
        ),
      } as const;
    }

    const confidentialNote = validEncryptedField(body.confidentialNote)
      ? body.confidentialNote
      : null;

    const claim: Claim = {
      id: claimId,
      amountCents,
      reason: reason || "Deduction claim",
      evidenceUrl: evidenceUrl || "/evidence/leaking-faucet.jpg",
      evidenceName,
      evidenceHash,
      filedAt: at,
      landlordSignature: signature,
      landlordFingerprint: user.fingerprint,
      confidentialNote,
      approvals: {},
      status: "pending",
    };
    db.claim = claim;

    appendLog(db, {
      kind: "claim",
      actor: "Mr. Bảy · landlord",
      title: `Deduction claim filed · $${(amountCents / 100).toFixed(2)}`,
      detail: `${claim.reason} Evidence “${evidenceName}” attached; SHA-256 commitment 0x${evidenceHash.slice(0, 12)}… locked into the claim.${confidentialNote ? " Confidential note stored as AES-256-GCM ciphertext the server cannot read." : ""} 0 of 2 tenant signatures collected.`,
      amountCents,
      signature,
      at,
    });

    return { claim, state: snapshot(db) } as const;
  });

  if ("error" in result) return result.error;

  return NextResponse.json({
    ok: true,
    claim: result.claim,
    state: result.state,
  });
}
