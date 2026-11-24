const CIPHER_VERSION = "v1";
const IV_LENGTH_BYTES = 12;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(encoded: string): Uint8Array {
  const padded = encoded
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(encoded.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function importAesKey(secret: string): Promise<CryptoKey> {
  if (!secret || secret.length < 16) {
    throw new Error(
      "Encryption key must be configured and at least 16 characters long."
    );
  }

  let keyMaterial: ArrayBuffer;
  if (/^[0-9a-fA-F]{64}$/.test(secret)) {
    keyMaterial = toArrayBuffer(hexToBytes(secret));
  } else {
    const encoded = new TextEncoder().encode(secret);
    keyMaterial = await crypto.subtle.digest("SHA-256", toArrayBuffer(encoded));
  }

  return crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts a plaintext string using AES-256-GCM with a random 96-bit IV.
 * Format: `v1.<base64url(iv)>.<base64url(ciphertext+tag)>`
 */
export async function encryptText(
  plaintext: string,
  secret: string
): Promise<string> {
  const key = await importAesKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const encoded = new TextEncoder().encode(plaintext);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(encoded)
  );

  return `${CIPHER_VERSION}.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(encrypted))}`;
}

/**
 * Decrypts a payload created by `encryptText`.
 */
export async function decryptText(
  payload: string,
  secret: string
): Promise<string> {
  const parts = payload.split(".");
  if (parts.length !== 3 || parts[0] !== CIPHER_VERSION) {
    throw new Error("Invalid encrypted payload format.");
  }

  const key = await importAesKey(secret);
  const iv = fromBase64Url(parts[1]!);
  const ciphertext = fromBase64Url(parts[2]!);

  if (iv.length !== IV_LENGTH_BYTES) {
    throw new Error("Invalid IV length in encrypted payload.");
  }

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(ciphertext)
  );

  return new TextDecoder().decode(decrypted);
}

export async function encryptJson<T>(value: T, secret: string): Promise<string> {
  return encryptText(JSON.stringify(value), secret);
}

export async function decryptJson<T>(
  payload: string,
  secret: string
): Promise<T> {
  const plaintext = await decryptText(payload, secret);
  return JSON.parse(plaintext) as T;
}
