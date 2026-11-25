import {
  GOOGLE_AUTH_URL,
  GOOGLE_TOKEN_URL,
  GOOGLE_USERINFO_URL,
  REQUESTED_GOOGLE_SCOPES,
  REQUIRED_GOOGLE_SCOPES,
} from "../config.js";

export const REAUTH_GUIDANCE_JA =
  "Googleアカウントの認証が失効しました（パスワード変更やアクセス許可の取り消しなどが原因の可能性があります）。お使いのAIクライアント（ChatGPT / Muse等）の設定から ChanSight（チャンサイト）を一度解除し、再度Googleアカウントと連携し直してください。";

export class GoogleTokenInvalidGrantError extends Error {
  readonly code = "invalid_grant";

  constructor(message: string = REAUTH_GUIDANCE_JA) {
    super(message);
    this.name = "GoogleTokenInvalidGrantError";
  }
}

export class GoogleOAuthError extends Error {
  readonly status: number;
  readonly oauthError?: string;

  constructor(message: string, status: number, oauthError?: string) {
    super(message);
    this.name = "GoogleOAuthError";
    this.status = status;
    this.oauthError = oauthError;
  }
}

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
  id_token?: string;
}

export interface ScopeValidationResult {
  valid: boolean;
  grantedScopes: string[];
  missingScopes: string[];
}

export function buildGoogleAuthorizeUrl(options: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", options.clientId);
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", REQUESTED_GOOGLE_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", options.state);
  return url.toString();
}

/**
 * Verifies that Google granted every required YouTube read-only scope (guards against Partial Grant).
 */
export function validateGrantedScopes(
  scopeHeaderOrParam?: string | null
): ScopeValidationResult {
  const grantedScopes = (scopeHeaderOrParam ?? "")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const grantedSet = new Set(grantedScopes);

  const missingScopes = REQUIRED_GOOGLE_SCOPES.filter(
    (required) => !grantedSet.has(required)
  );

  return {
    valid: missingScopes.length === 0,
    grantedScopes,
    missingScopes,
  };
}

interface GoogleErrorPayload {
  error?: string;
  error_description?: string;
}

export async function exchangeGoogleCode(options: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): Promise<GoogleTokenResponse> {
  const fetcher: typeof fetch =
    options.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
  const response = await fetcher(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: options.code,
      client_id: options.clientId,
      client_secret: options.clientSecret,
      redirect_uri: options.redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const body = (await response.json().catch(() => ({}))) as Partial<
    GoogleTokenResponse & GoogleErrorPayload
  >;

  if (!response.ok || !body.access_token) {
    if (body.error === "invalid_grant") {
      throw new GoogleTokenInvalidGrantError(
        "認証コードの有効期限が切れたか、既に使用済みです。もう一度Googleログインをやり直してください。"
      );
    }
    throw new GoogleOAuthError(
      body.error_description ??
        body.error ??
        "Googleトークンの取得に失敗しました。",
      response.status,
      body.error
    );
  }

  return body as GoogleTokenResponse;
}

export async function refreshGoogleAccessToken(options: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
}): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope?: string;
}> {
  const fetcher: typeof fetch =
    options.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
  const response = await fetcher(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: options.refreshToken,
      client_id: options.clientId,
      client_secret: options.clientSecret,
      grant_type: "refresh_token",
    }),
  });

  const body = (await response.json().catch(() => ({}))) as Partial<
    GoogleTokenResponse & GoogleErrorPayload
  >;

  if (!response.ok || !body.access_token) {
    if (body.error === "invalid_grant") {
      throw new GoogleTokenInvalidGrantError();
    }
    throw new GoogleOAuthError(
      body.error_description ??
        body.error ??
        "Googleアクセストークンの更新に失敗しました。",
      response.status,
      body.error
    );
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresIn: body.expires_in ?? 3600,
    scope: body.scope,
  };
}

export async function fetchGoogleUserInfo(
  accessToken: string,
  fetchImpl?: typeof fetch
): Promise<{ sub: string }> {
  const fetcher: typeof fetch =
    fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
  const response = await fetcher(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new GoogleOAuthError(
      "Googleユーザー情報の取得に失敗しました。",
      response.status
    );
  }

  const data = (await response.json()) as { sub?: string };
  if (!data.sub) {
    throw new GoogleOAuthError("GoogleユーザーIDを取得できませんでした。", 502);
  }

  return { sub: data.sub };
}
