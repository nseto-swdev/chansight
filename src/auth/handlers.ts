import {
  AuthorizationError,
  authorizationErrorRedirect,
  CimdFetchError,
  type AuthRequest,
} from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";
import {
  DEFAULT_PUBLIC_BASE_URL,
  MCP_SCOPES_SUPPORTED,
  SERVICE_NAME,
} from "../config.js";
import { BUILD_VERSION } from "../generated/build-info.js";
import type { AuthProps, OAuthHandlerEnv } from "../types.js";
import {
  FAVICON_SVG,
  getAppleTouchIconPngBytes,
  getFaviconIcoBytes,
  getIcon128PngBytes,
} from "../web/icons.js";
import { getOgImagePngBytes } from "../web/og-image.js";
import {
  renderAuthorizeConsentPage,
  renderHomePage,
  renderOAuthErrorPage,
  renderPartialGrantErrorPage,
  renderPrivacyPolicyPage,
  renderTermsPage,
} from "../web/pages.js";
import {
  buildGoogleAuthorizeUrl,
  exchangeGoogleCode,
  fetchGoogleUserInfo,
  GoogleOAuthError,
  GoogleTokenInvalidGrantError,
  validateGrantedScopes,
} from "./google-oauth.js";
import { loadGoogleTokens, saveGoogleTokens } from "./token-store.js";

function getBaseUrl(env: OAuthHandlerEnv, requestUrl: string): string {
  const configured = env.PUBLIC_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  try {
    return new URL(requestUrl).origin;
  } catch {
    return DEFAULT_PUBLIC_BASE_URL;
  }
}

function buildAuthorizeRetryUrl(original: AuthRequest): string {
  const params = new URLSearchParams({
    response_type: original.responseType,
    client_id: original.clientId,
    redirect_uri: original.redirectUri,
  });
  if (original.state) params.set("state", original.state);
  if (original.scope.length > 0) params.set("scope", original.scope.join(" "));
  if (original.codeChallenge) {
    params.set("code_challenge", original.codeChallenge);
  }
  if (original.codeChallengeMethod) {
    params.set("code_challenge_method", original.codeChallengeMethod);
  }
  if (original.resource) {
    params.set("resource", original.resource);
  }
  return `/authorize?${params.toString()}`;
}

function htmlResponse(
  html: string,
  status = 200,
  extraHeaders?: Headers
): Response {
  const headers = new Headers(extraHeaders);
  headers.set("Content-Type", "text/html; charset=utf-8");
  return new Response(html, { status, headers });
}

export function createDefaultApp() {
  const app = new Hono<{ Bindings: OAuthHandlerEnv }>();

  app.get("/", (c) => {
    const baseUrl = getBaseUrl(c.env, c.req.url);
    return htmlResponse(renderHomePage(baseUrl));
  });

  app.get("/privacy", (c) => {
    const baseUrl = getBaseUrl(c.env, c.req.url);
    return htmlResponse(renderPrivacyPolicyPage(baseUrl));
  });

  app.get("/terms", (c) => {
    const baseUrl = getBaseUrl(c.env, c.req.url);
    return htmlResponse(renderTermsPage(baseUrl));
  });

  app.get("/health", (c) => {
    return c.json({ ok: true, service: SERVICE_NAME, version: BUILD_VERSION });
  });

  app.get("/favicon.svg", () => {
    return new Response(FAVICON_SVG, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=86400",
      },
    });
  });

  app.get("/favicon.ico", () => {
    return new Response(getFaviconIcoBytes(), {
      status: 200,
      headers: {
        "Content-Type": "image/x-icon",
        "Cache-Control": "public, max-age=86400",
      },
    });
  });

  app.get("/icon-128.png", () => {
    return new Response(getIcon128PngBytes(), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  });

  app.get("/apple-touch-icon.png", () => {
    return new Response(getAppleTouchIconPngBytes(), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  });

  app.get("/og-image.png", () => {
    return new Response(getOgImagePngBytes(), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  });

  app.get("/authorize", async (c) => {
    try {
      const oauth = c.env.OAUTH_PROVIDER;
      const oauthReq = await oauth.parseAuthRequest(c.req.raw);
      const details = await oauth.describeConsent(oauthReq);
      const consent = await oauth.beginConsent(oauthReq);

      const html = renderAuthorizeConsentPage({
        clientName: details.clientName,
        clientDomain: details.clientDomain,
        redirectHost: details.redirectHost,
        redirectIsLoopback: details.redirectIsLoopback,
        actionUrl: "/authorize",
        handle: consent.handle,
      });

      return htmlResponse(html, 200, consent.headers);
    } catch (error) {
      if (error instanceof AuthorizationError && error.redirectTo) {
        return Response.redirect(error.redirectTo, 302);
      }
      if (error instanceof AuthorizationError) {
        return htmlResponse(
          renderOAuthErrorPage({
            title: "連携リクエストを確認できませんでした",
            message: `リクエストが無効または期限切れです（${error.description}）。AIクライアント側でもう一度接続をやり直してください。`,
          }),
          400
        );
      }
      if (error instanceof CimdFetchError) {
        return htmlResponse(
          renderOAuthErrorPage({
            title: "AIクライアント情報の検証に失敗しました",
            message:
              "接続元のAIクライアント情報を取得できませんでした。しばらく待ってからもう一度お試しください。",
          }),
          400
        );
      }
      throw error;
    }
  });

  app.post("/authorize", async (c) => {
    try {
      const oauth = c.env.OAUTH_PROVIDER;
      const form = await c.req.formData();
      const handle = String(form.get("handle") ?? "");
      const decision = String(form.get("decision") ?? "");

      if (!handle) {
        return htmlResponse(
          renderOAuthErrorPage({
            title: "確認画面の有効期限が切れました",
            message:
              "お手数ですが、AIクライアントの設定画面からもう一度連携を開始してください。",
          }),
          400
        );
      }

      if (decision !== "approve") {
        const denied = await oauth.denyConsent(c.req.raw, handle, {
          description: "User denied authorization",
        });
        return new Response(null, { status: 302, headers: denied.headers });
      }

      const approved = await oauth.approveConsent(c.req.raw, handle, {
        scope: [...MCP_SCOPES_SUPPORTED],
      });

      const upstream = await oauth.beginUpstream(approved.request, {
        headers: approved.headers,
      });

      const redirectUri = `${getBaseUrl(c.env, c.req.url)}/callback`;
      const googleUrl = buildGoogleAuthorizeUrl({
        clientId: c.env.GOOGLE_CLIENT_ID,
        redirectUri,
        state: upstream.state,
      });

      upstream.headers.set("Location", googleUrl);
      return new Response(null, { status: 302, headers: upstream.headers });
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return htmlResponse(
          renderOAuthErrorPage({
            title: "確認画面の有効期限が切れました",
            message:
              "ブラウザのセッション期限切れ、または二重送信により処理できませんでした。AIクライアントからもう一度連携をやり直してください。",
          }),
          400
        );
      }
      throw error;
    }
  });

  app.get("/callback", async (c) => {
    try {
      const oauth = c.env.OAUTH_PROVIDER;
      const resumed = await oauth.finishUpstream(c.req.raw);
      const original = resumed.request;
      const retryUrl = buildAuthorizeRetryUrl(original);

      const url = new URL(c.req.url);
      const googleError = url.searchParams.get("error");
      if (googleError) {
        resumed.headers.set(
          "Location",
          authorizationErrorRedirect(
            original,
            "access_denied",
            `Google authorization declined: ${googleError}`
          )
        );
        return new Response(null, { status: 302, headers: resumed.headers });
      }

      const code = url.searchParams.get("code");
      if (!code) {
        return htmlResponse(
          renderOAuthErrorPage({
            title: "Googleからの認証コードが不足しています",
            message: "認証を完了できませんでした。もう一度お試しください。",
            retryUrl,
          }),
          400,
          resumed.headers
        );
      }

      // 1. Check scopes returned in callback query string (early Partial Grant detection)
      const callbackScope = url.searchParams.get("scope");
      if (callbackScope !== null) {
        const callbackScopeCheck = validateGrantedScopes(callbackScope);
        if (!callbackScopeCheck.valid) {
          return htmlResponse(
            renderPartialGrantErrorPage({
              missingScopes: callbackScopeCheck.missingScopes,
              retryUrl,
            }),
            400,
            resumed.headers
          );
        }
      }

      // 2. Exchange authorization code for Google access & refresh tokens
      const redirectUri = `${getBaseUrl(c.env, c.req.url)}/callback`;
      const tokenResponse = await exchangeGoogleCode({
        code,
        clientId: c.env.GOOGLE_CLIENT_ID,
        clientSecret: c.env.GOOGLE_CLIENT_SECRET,
        redirectUri,
      });

      // 3. Authoritative Partial Grant check on the issued token's scope string
      const tokenScopeCheck = validateGrantedScopes(
        tokenResponse.scope ?? callbackScope
      );
      if (!tokenScopeCheck.valid) {
        return htmlResponse(
          renderPartialGrantErrorPage({
            missingScopes: tokenScopeCheck.missingScopes,
            retryUrl,
          }),
          400,
          resumed.headers
        );
      }

      // 4. Identify Google user (sub) and persist encrypted Google tokens in KV
      const userInfo = await fetchGoogleUserInfo(tokenResponse.access_token);
      const userId = encodeURIComponent(userInfo.sub);

      let refreshToken = tokenResponse.refresh_token;
      if (!refreshToken) {
        const existing = await loadGoogleTokens(
          c.env.OAUTH_KV,
          c.env.TOKEN_ENCRYPTION_KEY,
          userId
        );
        refreshToken = existing?.refreshToken;
      }

      if (!refreshToken) {
        return htmlResponse(
          renderOAuthErrorPage({
            title: "リフレッシュトークンを取得できませんでした",
            message:
              "継続利用に必要な認証情報がGoogleから返されませんでした。お手数ですがもう一度ログインをお試しください。",
            retryUrl,
          }),
          400,
          resumed.headers
        );
      }

      const now = Date.now();
      await saveGoogleTokens(
        c.env.OAUTH_KV,
        c.env.TOKEN_ENCRYPTION_KEY,
        userId,
        {
          accessToken: tokenResponse.access_token,
          refreshToken,
          expiresAt: now + (tokenResponse.expires_in ?? 3600) * 1000,
          scope: tokenScopeCheck.grantedScopes.join(" "),
          updatedAt: now,
        }
      );

      // 5. Mint MCP OAuth authorization code and redirect back to AI client
      const props: AuthProps = { userId };
      const { redirectTo } = await oauth.completeAuthorization({
        request: original,
        userId,
        metadata: { connectedAt: now },
        scope: [...MCP_SCOPES_SUPPORTED],
        props,
      });

      resumed.headers.set("Location", redirectTo);
      return new Response(null, { status: 302, headers: resumed.headers });
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return htmlResponse(
          renderOAuthErrorPage({
            title: "認証セッションの有効期限が切れました",
            message:
              "Googleログインの待機時間が過ぎたか、別のブラウザから開かれました。AIクライアント側でもう一度連携をやり直してください。",
          }),
          400
        );
      }
      if (
        error instanceof GoogleTokenInvalidGrantError ||
        error instanceof GoogleOAuthError
      ) {
        return htmlResponse(
          renderOAuthErrorPage({
            title: "Google連携エラー",
            message: error.message,
          }),
          400
        );
      }
      throw error;
    }
  });

  app.notFound((c) => {
    return htmlResponse(
      renderOAuthErrorPage({
        title: "ページが見つかりません",
        message: `指定されたページ（${new URL(c.req.url).pathname}）は存在しません。`,
      }),
      404
    );
  });

  return app;
}

const defaultApp = createDefaultApp();

export const defaultHandler: ExportedHandler<OAuthHandlerEnv> = {
  fetch(request, env, ctx) {
    return defaultApp.fetch(request, env, ctx);
  },
};
