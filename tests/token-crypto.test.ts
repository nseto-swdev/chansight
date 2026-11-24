import { describe, expect, it } from "vitest";
import {
  decryptJson,
  decryptText,
  encryptJson,
  encryptText,
} from "../src/crypto/token-crypto.js";

const TEST_HEX_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const OTHER_HEX_KEY =
  "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";

describe("token-crypto", () => {
  it("encrypts and decrypts text round-trip with a 64-char hex key", async () => {
    const plaintext = "1//0gRefreshTokenExample-SecretValue";
    const encrypted = await encryptText(plaintext, TEST_HEX_KEY);

    expect(encrypted).not.toContain(plaintext);
    expect(encrypted.startsWith("v1.")).toBe(true);

    const decrypted = await decryptText(encrypted, TEST_HEX_KEY);
    expect(decrypted).toBe(plaintext);
  });

  it("uses a unique IV on each encryption", async () => {
    const a = await encryptText("same-secret", TEST_HEX_KEY);
    const b = await encryptText("same-secret", TEST_HEX_KEY);
    expect(a).not.toBe(b);
  });

  it("fails to decrypt with a different key", async () => {
    const encrypted = await encryptText("secret-token", TEST_HEX_KEY);
    await expect(decryptText(encrypted, OTHER_HEX_KEY)).rejects.toThrow();
  });

  it("fails to decrypt tampered ciphertext", async () => {
    const encrypted = await encryptText("secret-token", TEST_HEX_KEY);
    const parts = encrypted.split(".");
    const tampered = `${parts[0]}.${parts[1]}.${parts[2]!.slice(0, -2)}AA`;
    await expect(decryptText(tampered, TEST_HEX_KEY)).rejects.toThrow();
  });

  it("supports passphrase keys (>= 16 chars) via SHA-256 derivation", async () => {
    const passphrase = "a-very-long-passphrase-for-testing";
    const payload = { refreshToken: "rt_123", expiresAt: 1700000000000 };
    const encrypted = await encryptJson(payload, passphrase);
    const decrypted = await decryptJson<typeof payload>(encrypted, passphrase);
    expect(decrypted).toEqual(payload);
  });

  it("rejects short encryption keys", async () => {
    await expect(encryptText("hello", "too-short")).rejects.toThrow(
      /at least 16/
    );
  });
});
