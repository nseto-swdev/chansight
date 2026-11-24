import { decryptJson, encryptJson } from "../crypto/token-crypto.js";
import {
  GoogleTokenInvalidGrantError,
  refreshGoogleAccessToken,
} from "./google-oauth.js";

const TOKEN_KV_PREFIX = "google_tokens:";
const EXPIRY_SKEW_MS = 60_000;

export interface StoredGoogleTokenRecord {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
  updatedAt: number;
}

export interface TokenStoreKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

function tokenKey(userId: string): string {
  return `${TOKEN_KV_PREFIX}${userId}`;
}

export async function saveGoogleTokens(
  kv: TokenStoreKV,
  encryptionKey: string,
  userId: string,
  record: StoredGoogleTokenRecord
): Promise<void> {
  const encrypted = await encryptJson(record, encryptionKey);
  await kv.put(tokenKey(userId), encrypted);
}

export async function loadGoogleTokens(
  kv: TokenStoreKV,
  encryptionKey: string,
  userId: string
): Promise<StoredGoogleTokenRecord | null> {
  const raw = await kv.get(tokenKey(userId));
  if (!raw) return null;
  return decryptJson<StoredGoogleTokenRecord>(raw, encryptionKey);
}

export async function deleteGoogleTokens(
  kv: TokenStoreKV,
  userId: string
): Promise<void> {
  await kv.delete(tokenKey(userId));
}

export interface AccessTokenResolverOptions {
  kv: TokenStoreKV;
  encryptionKey: string;
  userId: string;
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
  nowMs?: number;
}

/**
 * Returns a valid Google access token for the user, refreshing via the encrypted
 * refresh token when expired. Throws GoogleTokenInvalidGrantError if re-auth is required.
 */
export async function getValidGoogleAccessToken(
  options: AccessTokenResolverOptions
): Promise<string> {
  const now = options.nowMs ?? Date.now();
  const stored = await loadGoogleTokens(
    options.kv,
    options.encryptionKey,
    options.userId
  );

  if (!stored || !stored.refreshToken) {
    throw new GoogleTokenInvalidGrantError();
  }

  if (stored.accessToken && stored.expiresAt - EXPIRY_SKEW_MS > now) {
    return stored.accessToken;
  }

  return refreshAndPersistGoogleAccessToken(options, stored);
}

/**
 * Forces an access token refresh (used if YouTube API returns 401 unexpectedly).
 */
export async function forceRefreshGoogleAccessToken(
  options: AccessTokenResolverOptions
): Promise<string> {
  const stored = await loadGoogleTokens(
    options.kv,
    options.encryptionKey,
    options.userId
  );

  if (!stored || !stored.refreshToken) {
    throw new GoogleTokenInvalidGrantError();
  }

  return refreshAndPersistGoogleAccessToken(options, stored);
}

async function refreshAndPersistGoogleAccessToken(
  options: AccessTokenResolverOptions,
  stored: StoredGoogleTokenRecord
): Promise<string> {
  const now = options.nowMs ?? Date.now();
  try {
    const refreshed = await refreshGoogleAccessToken({
      refreshToken: stored.refreshToken,
      clientId: options.clientId,
      clientSecret: options.clientSecret,
      fetchImpl: options.fetchImpl,
    });

    const updated: StoredGoogleTokenRecord = {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? stored.refreshToken,
      expiresAt: now + refreshed.expiresIn * 1000,
      scope: refreshed.scope ?? stored.scope,
      updatedAt: now,
    };

    await saveGoogleTokens(
      options.kv,
      options.encryptionKey,
      options.userId,
      updated
    );

    return updated.accessToken;
  } catch (error) {
    if (error instanceof GoogleTokenInvalidGrantError) {
      await deleteGoogleTokens(options.kv, options.userId);
    }
    throw error;
  }
}
