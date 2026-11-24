import { describe, expect, it, vi } from "vitest";
import { GoogleTokenInvalidGrantError } from "../src/auth/google-oauth.js";
import {
  getValidGoogleAccessToken,
  loadGoogleTokens,
  saveGoogleTokens,
  type TokenStoreKV,
} from "../src/auth/token-store.js";

const KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function createMemoryKV(): TokenStoreKV & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    async get(key) {
      return store.get(key) ?? null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
  };
}

describe("token-store", () => {
  it("encrypts tokens before writing to KV so plaintext refresh token is never stored", async () => {
    const kv = createMemoryKV();
    await saveGoogleTokens(kv, KEY, "user-1", {
      accessToken: "ya29.plain-access",
      refreshToken: "1//super-secret-refresh-token",
      expiresAt: 2_000_000_000_000,
      scope: "openid",
      updatedAt: 1_700_000_000_000,
    });

    const raw = kv.store.get("google_tokens:user-1");
    expect(raw).toBeTruthy();
    expect(raw).not.toContain("1//super-secret-refresh-token");
    expect(raw).not.toContain("ya29.plain-access");

    const loaded = await loadGoogleTokens(kv, KEY, "user-1");
    expect(loaded?.refreshToken).toBe("1//super-secret-refresh-token");
  });

  it("returns cached access token without hitting Google when not expired", async () => {
    const kv = createMemoryKV();
    const now = 1_700_000_000_000;
    await saveGoogleTokens(kv, KEY, "user-1", {
      accessToken: "ya29.valid",
      refreshToken: "1//rt",
      expiresAt: now + 300_000,
      scope: "scope",
      updatedAt: now,
    });

    const mockFetch = vi.fn();
    const token = await getValidGoogleAccessToken({
      kv,
      encryptionKey: KEY,
      userId: "user-1",
      clientId: "cid",
      clientSecret: "csec",
      fetchImpl: mockFetch,
      nowMs: now,
    });

    expect(token).toBe("ya29.valid");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("refreshes expired token and persists updated encrypted record in KV", async () => {
    const kv = createMemoryKV();
    const now = 1_700_000_000_000;
    await saveGoogleTokens(kv, KEY, "user-1", {
      accessToken: "ya29.expired",
      refreshToken: "1//rt-original",
      expiresAt: now - 10_000,
      scope: "scope",
      updatedAt: now - 3_600_000,
    });

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "ya29.fresh-new",
          expires_in: 3600,
          token_type: "Bearer",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const token = await getValidGoogleAccessToken({
      kv,
      encryptionKey: KEY,
      userId: "user-1",
      clientId: "cid",
      clientSecret: "csec",
      fetchImpl: mockFetch,
      nowMs: now,
    });

    expect(token).toBe("ya29.fresh-new");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const updated = await loadGoogleTokens(kv, KEY, "user-1");
    expect(updated?.accessToken).toBe("ya29.fresh-new");
    expect(updated?.refreshToken).toBe("1//rt-original");
    expect(updated?.expiresAt).toBe(now + 3_600_000);
  });

  it("deletes revoked token from KV and throws GoogleTokenInvalidGrantError on invalid_grant", async () => {
    const kv = createMemoryKV();
    const now = 1_700_000_000_000;
    await saveGoogleTokens(kv, KEY, "user-1", {
      accessToken: "ya29.expired",
      refreshToken: "1//revoked",
      expiresAt: now - 10_000,
      scope: "scope",
      updatedAt: now - 3_600_000,
    });

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid_grant" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(
      getValidGoogleAccessToken({
        kv,
        encryptionKey: KEY,
        userId: "user-1",
        clientId: "cid",
        clientSecret: "csec",
        fetchImpl: mockFetch,
        nowMs: now,
      })
    ).rejects.toThrow(GoogleTokenInvalidGrantError);

    expect(kv.store.has("google_tokens:user-1")).toBe(false);
  });
});
