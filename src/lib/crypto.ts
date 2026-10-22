const encoder = new TextEncoder();

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

export function base64UrlFromBytes(bytes: Uint8Array): string {
  return bytesToBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function base64UrlFromString(value: string): string {
  return base64UrlFromBytes(encoder.encode(value));
}

export async function sha256Hex(data: string | ArrayBuffer): Promise<string> {
  const input = typeof data === "string" ? encoder.encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export interface LocalIdentity {
  keys: CryptoKeyPair;
  fingerprint: string;
  publicKey: string;
}

export async function generateIdentity(): Promise<LocalIdentity> {
  const keys = (await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign", "verify"],
  )) as CryptoKeyPair;

  const raw = await crypto.subtle.exportKey("spki", keys.publicKey);
  const fingerprint = await sha256Hex(raw);

  return {
    keys,
    fingerprint,
    publicKey: bytesToBase64(new Uint8Array(raw)),
  };
}

export async function signPayload(
  keys: CryptoKeyPair,
  payload: unknown,
): Promise<string> {
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    keys.privateKey,
    encoder.encode(JSON.stringify(payload)),
  );
  return bytesToBase64(new Uint8Array(signature));
}

export async function verifyPayload(
  publicKeyBase64: string,
  payload: unknown,
  signatureBase64: string,
): Promise<boolean> {
  try {
    const raw = Uint8Array.from(atob(publicKeyBase64), (char) =>
      char.charCodeAt(0),
    );
    const publicKey = await crypto.subtle.importKey(
      "spki",
      raw,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const signature = Uint8Array.from(atob(signatureBase64), (char) =>
      char.charCodeAt(0),
    );
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      signature,
      encoder.encode(JSON.stringify(payload)),
    );
  } catch {
    return false;
  }
}

export async function signRaw(
  keys: CryptoKeyPair,
  value: string,
): Promise<string> {
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    keys.privateKey,
    encoder.encode(value),
  );
  return base64UrlFromBytes(new Uint8Array(signature));
}

function bytesFromBase64Url(value: string): Uint8Array {
  const normalised = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalised.padEnd(
    normalised.length + ((4 - (normalised.length % 4)) % 4),
    "=",
  );
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

export async function verifyRaw(
  publicKeyBase64: string,
  value: string,
  signatureBase64Url: string,
): Promise<boolean> {
  try {
    const raw = Uint8Array.from(atob(publicKeyBase64), (char) =>
      char.charCodeAt(0),
    );
    const publicKey = await crypto.subtle.importKey(
      "spki",
      raw,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      bytesFromBase64Url(signatureBase64Url),
      encoder.encode(value),
    );
  } catch {
    return false;
  }
}

export function shortFingerprint(fingerprint: string): string {
  return `0x${fingerprint.slice(0, 6)}…${fingerprint.slice(-6)}`;
}

export function shortHash(hash: string): string {
  return `0x${hash.slice(0, 8)}…${hash.slice(-4)}`;
}

export function shortSignature(signature: string): string {
  return `${signature.slice(0, 14)}…${signature.slice(-6)}`;
}

/* ------------------------------------------------------------------ */
/* Field-level data protection (client-side AES-256-GCM)               */
/* ------------------------------------------------------------------ */

export async function generateDataKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptField(
  key: CryptoKey,
  plaintext: string,
): Promise<{ alg: "AES-GCM-256"; iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext),
  );
  return {
    alg: "AES-GCM-256",
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptField(
  key: CryptoKey,
  field: { iv: string; ciphertext: string },
): Promise<string> {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(field.iv) },
    key,
    base64ToBytes(field.ciphertext),
  );
  return new TextDecoder().decode(plaintext);
}

/* ------------------------------------------------------------------ */
/* Client-side JWT verification against the realm JWKS                 */
/* ------------------------------------------------------------------ */

export async function verifyJwtWithJwks(
  token: string,
  jwksUrl = "/api/auth/jwks",
): Promise<boolean> {
  try {
    const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
    if (!encodedHeader || !encodedPayload || !encodedSignature) return false;

    const header = JSON.parse(
      new TextDecoder().decode(bytesFromBase64Url(encodedHeader)),
    ) as { alg?: string; kid?: string };
    if (header.alg !== "ES256") return false;

    const response = await fetch(jwksUrl, { cache: "no-store" });
    if (!response.ok) return false;
    const jwks = (await response.json()) as {
      keys: Array<JsonWebKey & { kid?: string }>;
    };
    const jwk = jwks.keys.find((key) => !header.kid || key.kid === header.kid);
    if (!jwk) return false;

    const publicKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      bytesFromBase64Url(encodedSignature),
      encoder.encode(`${encodedHeader}.${encodedPayload}`),
    );
    if (!valid) return false;

    const payload = JSON.parse(
      new TextDecoder().decode(bytesFromBase64Url(encodedPayload)),
    ) as { exp?: number };
    return typeof payload.exp === "number"
      ? payload.exp > Math.floor(Date.now() / 1000)
      : true;
  } catch {
    return false;
  }
}

export function decodeJwt(token: string): {
  header: Record<string, unknown> | null;
  payload: Record<string, unknown> | null;
} {
  try {
    const [header, payload] = token.split(".");
    return {
      header: JSON.parse(
        new TextDecoder().decode(bytesFromBase64Url(header)),
      ) as Record<string, unknown>,
      payload: JSON.parse(
        new TextDecoder().decode(bytesFromBase64Url(payload)),
      ) as Record<string, unknown>,
    };
  } catch {
    return { header: null, payload: null };
  }
}
