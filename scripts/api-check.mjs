import assert from "node:assert/strict";
import { webcrypto as crypto } from "node:crypto";

const BASE = "http://localhost:3000";

async function createKeyMaterial() {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const spki = await crypto.subtle.exportKey("spki", pair.publicKey);
  return {
    pair,
    publicKeySpki: Buffer.from(spki).toString("base64"),
    fingerprint: Buffer.from(spki).toString("hex").slice(0, 32),
  };
}

async function tokenFor(personaId) {
  const material = await createKeyMaterial();
  const response = await fetch(`${BASE}/api/auth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      personaId,
      publicKeySpki: material.publicKeySpki,
      fingerprint: material.fingerprint,
    }),
  });
  assert.equal(response.status, 200, `${personaId} token status`);
  return response.json();
}

async function call(path, { token, method = "GET", body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json() };
}

const minh = await tokenFor("minh");
const bay = await tokenFor("bay");
const lan = await tokenFor("lan");

// 1. Protected state requires a valid Bearer token.
let result = await call("/api/vault/state");
assert.equal(result.status, 401);
assert.equal(result.data.error, "UNAUTHENTICATED");
result = await call("/api/vault/state", { token: `${minh.token}tampered` });
assert.equal(result.status, 401);
assert.equal(result.data.error, "INVALID_TOKEN");
result = await call("/api/vault/state", { token: minh.token });
assert.equal(result.status, 200);
assert.equal(result.data.caller.sub, "usr_minh");
assert.deepEqual(result.data.caller.role, "lead_tenant");
console.log("bearer enforcement: missing/tampered 401, valid 200");

// 2. Unilateral attempts always evaluate to a signed 403 policy receipt.
result = await call("/api/vault/unilateral-attempt", {
  token: minh.token,
  method: "POST",
  body: { intent: "withdraw_all", amountCents: 120000 },
});
assert.equal(result.status, 403);
assert.equal(result.data.error, "TIDECLOAK_EMERGENT_AUTHORITY_MISSING");
assert.equal(result.data.callerSub, "usr_minh");
assert.deepEqual(result.data.callerRoles, ["lead_tenant"]);
assert.match(result.data.receipt, /^eyJ/);
console.log("lead_tenant withdraw_all: 403 TIDECLOAK_EMERGENT_AUTHORITY_MISSING + signed receipt");

result = await call("/api/vault/unilateral-attempt", {
  token: bay.token,
  method: "POST",
  body: { intent: "force_deduct", amountCents: 30000 },
});
assert.equal(result.status, 403);
assert.equal(result.data.code, "MISSING_CONSENSUS");
assert.equal(result.data.callerSub, "usr_bay");
console.log("landlord force_deduct: 403 MISSING_CONSENSUS");

// 3. Claim filing is landlord-only.
result = await call("/api/vault/claims", {
  token: minh.token,
  method: "POST",
  body: {
    claimId: "clm_attack",
    amountCents: 15000,
    reason: "tenant attempt",
    evidenceHash: "a".repeat(64),
    at: Date.now(),
    signature: "x",
  },
});
assert.equal(result.status, 403);
assert.equal(result.data.error, "FORBIDDEN_ROLE");
assert.equal(result.data.callerSub, "usr_minh");
console.log("tenant POST /api/vault/claims: 403 FORBIDDEN_ROLE");

// 4. Tenant decisions on a claim are bound to the tenant role.
result = await call("/api/vault/claims/clm_missing/decision", {
  token: bay.token,
  method: "POST",
  body: { decision: "approve", signature: "x", signedAt: Date.now() },
});
assert.equal(result.status, 403);
assert.equal(result.data.error, "FORBIDDEN_ROLE");
console.log("landlord decision endpoint: 403 FORBIDDEN_ROLE");

// 5. Deposits are identity-bound and tenant-only.
result = await call("/api/vault/deposit", {
  token: bay.token,
  method: "POST",
});
assert.equal(result.status, 403);
result = await call("/api/vault/deposit", {
  token: minh.token,
  method: "POST",
});
assert.equal(result.status, 200);
assert.equal(result.data.deposit.personaId, "minh");
console.log("deposit: landlord 403, tenant 200 bound to usr_minh");

// 6. PII is accepted only as ciphertext and returned only to its owner.
const field = {
  alg: "AES-GCM-256",
  iv: "AAAAAAAAAAAAAAAA",
  ciphertext: "dGVzdC1jaXBoZXJ0ZXh0",
};
result = await call("/api/vault/pii", {
  token: minh.token,
  method: "PUT",
  body: { fields: { bankIban: field } },
});
assert.equal(result.status, 200);
result = await call("/api/vault/pii", { token: minh.token });
assert.equal(result.status, 200);
assert.ok(result.data.record.fields.bankIban.ciphertext);
result = await call("/api/vault/pii", { token: lan.token });
assert.equal(result.status, 200);
assert.equal(result.data.record, null, "other identities must not read this record");
console.log("PII: ciphertext accepted, owner-only fetch enforced");

// 7. Sign-out revokes the exact token; replay is rejected.
result = await call("/api/auth/logout", { token: lan.token, method: "POST" });
assert.equal(result.status, 200);
result = await call("/api/vault/state", { token: lan.token });
assert.equal(result.status, 401);
assert.equal(result.data.error, "SESSION_REVOKED");
console.log("logout: token replay rejected with SESSION_REVOKED");

// 8. The raw ledger contains no plaintext PII.
const fs = await import("node:fs/promises");
const ledger = await fs.readFile("data/vault-db.json", "utf8");
assert.ok(ledger.includes("dGVzdC1jaXBoZXJ0ZXh0"));
assert.ok(!ledger.includes("VN98-TECHCOMBANK"));
console.log("ledger inspection: ciphertext present, plaintext IBAN absent");

console.log("\nAPI security check passed");
