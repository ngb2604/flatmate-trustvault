const encoder = new TextEncoder();

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
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
