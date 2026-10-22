import { NextResponse } from "next/server";
import { appendLog, loadDb, withDb } from "../../../../lib/server/db";
import { authenticate } from "../../../../lib/server/realm";
import type { EncryptedField } from "../../../../types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PiiBody {
  fields?: Record<string, EncryptedField>;
}

const FIELD_NAME = /^[a-zA-Z0-9_]{1,24}$/;

function validField(value: unknown): value is EncryptedField {
  if (!value || typeof value !== "object") return false;
  const field = value as EncryptedField;
  return (
    field.alg === "AES-GCM-256" &&
    typeof field.iv === "string" &&
    field.iv.length > 0 &&
    field.iv.length < 256 &&
    typeof field.ciphertext === "string" &&
    field.ciphertext.length > 0 &&
    field.ciphertext.length < 32768
  );
}

/** Owner-only ciphertext fetch. The server never receives the AES key. */
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  const record = await loadDb().then((db) => db.pii[auth.claims.sub] ?? null);

  return NextResponse.json({
    ownerSub: auth.claims.sub,
    record,
    note:
      "Ciphertext only. Decryption happens in the owner's browser with a non-extractable AES-GCM key.",
  });
}

/**
 * Stores client-encrypted fields. The payload is validated as ciphertext and
 * written verbatim; no plaintext PII ever reaches this server.
 */
export async function PUT(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  let body: PiiBody;
  try {
    body = (await request.json()) as PiiBody;
  } catch {
    return NextResponse.json(
      { error: "INVALID_BODY", message: "Expected a JSON body." },
      { status: 400 },
    );
  }

  const entries = Object.entries(body.fields ?? {});
  if (entries.length === 0 || entries.length > 6) {
    return NextResponse.json(
      {
        error: "INVALID_FIELDS",
        message: "Send between 1 and 6 encrypted fields.",
      },
      { status: 400 },
    );
  }

  for (const [name, field] of entries) {
    if (!FIELD_NAME.test(name) || !validField(field)) {
      return NextResponse.json(
        {
          error: "INVALID_CIPHERTEXT",
          message: `Field “${name}” is not a valid AES-GCM-256 ciphertext envelope.`,
        },
        { status: 400 },
      );
    }
  }

  const fields = Object.fromEntries(entries);

  const result = await withDb((db) => {
    db.pii[auth.claims.sub] = { updatedAt: Date.now(), fields };

    let payoutLinked = false;
    if (fields.bankIban && db.deposits[auth.claims.sub]) {
      db.deposits[auth.claims.sub].payoutRef = fields.bankIban;
      payoutLinked = true;
    }

    appendLog(db, {
      kind: "vault",
      actor: `${auth.claims.preferred_username} · ${auth.claims.role}`,
      title: "Protected fields sealed · AES-256-GCM",
      detail: `${entries.length} field${entries.length === 1 ? "" : "s"} (${entries
        .map(([name]) => name)
        .join(", ")}) encrypted in the browser before storage. Ciphertext preview ENC_TIDE_v1:${fields[
        entries[0][0]
      ].ciphertext.slice(0, 12)}… — the server cannot decrypt.${payoutLinked ? " Encrypted payout reference linked to the deposit." : ""}`,
      signature: fields[entries[0][0]].iv,
    });

    return {
      updatedAt: db.pii[auth.claims.sub].updatedAt,
      fields: Object.fromEntries(
        entries.map(([name, field]) => [
          name,
          {
            alg: field.alg,
            iv: field.iv,
            ciphertext: field.ciphertext,
            preview: `ENC_TIDE_v1:${field.ciphertext.slice(0, 16)}…`,
          },
        ]),
      ),
      payoutLinked,
    };
  });

  return NextResponse.json({ ok: true, ...result });
}
