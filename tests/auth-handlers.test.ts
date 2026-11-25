import type {
  AuthRequest,
  OAuthHelpers,
} from "@cloudflare/workers-oauth-provider";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultApp } from "../src/auth/handlers.js";
import { loadGoogleTokens } from "../src/auth/token-store.js";
import { REQUIRED_GOOGLE_SCOPES } from "../src/config.js";
import type { OAuthHandlerEnv } from "../src/types.js";

const TEST_ENC_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function createMockKV() {
  const store = new Map<string, string>();
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  } as unknown as KVNamespace & { store: Map<string, string> };
}

function createSampleAuthRequest(): AuthRequest {
  return {
    responseType: "code",
    clientId: "client-chatgpt",
    redirectUri: "https://chatgpt.com/connector_platform_oauth_redirect",
    scope: ["youtube:analytics:read"],
    state: "client-state-xyz",
    codeChallenge: "challenge123",
    codeChallengeMethod: "S256",
    resource: "https://chansight.nseto.com/mcp",
    issuer: "https://chansight.nseto.com",
  };
}

function createMockEnv(oauthOverrides: Partial<OAuthHelpers> = {}) {
  const kv = createMockKV();
  const oauthProvider = {
    parseAuthRequest: vi.fn(async () => createSampleAuthRequest()),
    describeConsent: vi.fn(async () => ({
      clientId: "client-chatgpt",
      clientName: "ChatGPT",
      clientDomain: "chatgpt.com",
      redirectUri: "https://chatgpt.com/connector_platform_oauth_redirect",
      redirectHost: "chatgpt.com",
      redirectIsLoopback: false,
      scope: ["youtube:analytics:read"],
    })),
    beginConsent: vi.fn(async () => ({
      handle: "consent-handle-1",
      headers: new Headers({
        "X-Frame-Options": "DENY",
        "Content-Security-Policy": "frame-ancestors 'none'",
      }),
    })),
    approveConsent: vi.fn(async () => ({
      request: createSampleAuthRequest(),
      headers: new Headers(),
    })),
    denyConsent: vi.fn(async () => ({
      request: createSampleAuthRequest(),
      redirectTo:
        "https://chatgpt.com/connector_platform_oauth_redirect?error=access_denied",
      headers: new Headers({
        Location:
          "https://chatgpt.com/connector_platform_oauth_redirect?error=access_denied",
      }),
    })),
    beginUpstream: vi.fn(async () => ({
      state: "upstream-state-abc",
      headers: new Headers(),
    })),
    finishUpstream: vi.fn(async () => ({
      request: createSampleAuthRequest(),
      data: undefined,
      headers: new Headers(),
    })),
    completeAuthorization: vi.fn(async () => ({
      redirectTo:
        "https://chatgpt.com/connector_platform_oauth_redirect?code=mcp-code-999&state=client-state-xyz",
    })),
    ...oauthOverrides,
  } as unknown as OAuthHelpers;

  const env: OAuthHandlerEnv = {
    OAUTH_KV: kv,
    GOOGLE_CLIENT_ID: "google-cid",
    GOOGLE_CLIENT_SECRET: "google-csec",
    TOKEN_ENCRYPTION_KEY: TEST_ENC_KEY,
    PUBLIC_BASE_URL: "https://chansight.nseto.com",
    OAUTH_PROVIDER: oauthProvider,
  };

  return { env, kv, oauthProvider };
}

describe("auth and web handlers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("serves /, /privacy, /terms, and /health without authentication", async () => {
    const app = createDefaultApp();
    const { env } = createMockEnv();

    const homeRes = await app.fetch(
      new Request("https://chansight.nseto.com/"),
      env
    );
    expect(homeRes.status).toBe(200);
    expect(await homeRes.text()).toContain("https://chansight.nseto.com/mcp");

    const privacyRes = await app.fetch(
      new Request("https://chansight.nseto.com/privacy"),
      env
    );
    expect(privacyRes.status).toBe(200);
    expect(await privacyRes.text()).toContain("Limited Use");

    const termsRes = await app.fetch(
      new Request("https://chansight.nseto.com/terms"),
      env
    );
    expect(termsRes.status).toBe(200);
    expect(await termsRes.text()).toContain("利用規約");

    const healthRes = await app.fetch(
      new Request("https://chansight.nseto.com/health"),
      env
    );
    expect(healthRes.status).toBe(200);
    expect(await healthRes.json()).toEqual({
      ok: true,
      service: "ChanSight",
      version: expect.stringMatching(/^[0-9a-f]{7}-\d{8}-\d{4}Z$/),
    });

    const svgRes = await app.fetch(
      new Request("https://chansight.nseto.com/favicon.svg"),
      env
    );
    expect(svgRes.status).toBe(200);
    expect(svgRes.headers.get("Content-Type")).toContain("image/svg+xml");
    expect(await svgRes.text()).toContain("<svg");

    const icoRes = await app.fetch(
      new Request("https://chansight.nseto.com/favicon.ico"),
      env
    );
    expect(icoRes.status).toBe(200);
    expect(icoRes.headers.get("Content-Type")).toContain("image/x-icon");
    const icoBytes = new Uint8Array(await icoRes.arrayBuffer());
    expect(icoBytes[2]).toBe(1); // ICO type = 1

    const png128Res = await app.fetch(
      new Request("https://chansight.nseto.com/icon-128.png"),
      env
    );
    expect(png128Res.status).toBe(200);
    expect(png128Res.headers.get("Content-Type")).toContain("image/png");
    const pngBytes = new Uint8Array(await png128Res.arrayBuffer());
    expect(Array.from(pngBytes.slice(0, 4))).toEqual([137, 80, 78, 71]);

    const appleRes = await app.fetch(
      new Request("https://chansight.nseto.com/apple-touch-icon.png"),
      env
    );
    expect(appleRes.status).toBe(200);
    expect(appleRes.headers.get("Content-Type")).toContain("image/png");
  });

  it("renders Japanese consent page on GET /authorize and redirects to Google on approval", async () => {
    const app = createDefaultApp();
    const { env } = createMockEnv();

    const getRes = await app.fetch(
      new Request("https://chansight.nseto.com/authorize?client_id=client-chatgpt"),
      env
    );
    expect(getRes.status).toBe(200);
    expect(getRes.headers.get("X-Frame-Options")).toBe("DENY");
    const html = await getRes.text();
    expect(html).toContain("ChatGPT");
    expect(html).toContain("consent-handle-1");

    const form = new FormData();
    form.set("handle", "consent-handle-1");
    form.set("decision", "approve");
    const postRes = await app.fetch(
      new Request("https://chansight.nseto.com/authorize", {
        method: "POST",
        body: form,
      }),
      env
    );
    expect(postRes.status).toBe(302);
    const location = postRes.headers.get("Location")!;
    expect(location).toContain("https://accounts.google.com/o/oauth2/v2/auth");
    expect(location).toContain("access_type=offline");
    expect(location).toContain("prompt=consent");
    expect(location).toContain("state=upstream-state-abc");
  });

  it("blocks Partial Grant on /callback and renders Japanese re-auth prompt without completing authorization", async () => {
    const app = createDefaultApp();
    const { env, oauthProvider } = createMockEnv();

    const res = await app.fetch(
      new Request(
        "https://chansight.nseto.com/callback?code=g-code&state=upstream-state-abc&scope=openid%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fyoutube.readonly"
      ),
      env
    );

    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("必要なYouTubeの閲覧権限がチェックされていません");
    expect(html).toContain("yt-analytics.readonly");
    expect(html).toContain("/authorize?");
    expect(oauthProvider.completeAuthorization).not.toHaveBeenCalled();
  });

  it("completes full Google OAuth callback, encrypts refresh token in KV, and redirects to AI client", async () => {
    const app = createDefaultApp();
    const { env, kv, oauthProvider } = createMockEnv();

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response(
          JSON.stringify({
            access_token: "ya29.real-access",
            refresh_token: "1//real-refresh-secret",
            expires_in: 3600,
            scope: `openid ${REQUIRED_GOOGLE_SCOPES.join(" ")}`,
            token_type: "Bearer",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("openidconnect.googleapis.com/v1/userinfo")) {
        return new Response(JSON.stringify({ sub: "109876543210" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await app.fetch(
      new Request(
        `https://chansight.nseto.com/callback?code=g-code&state=upstream-state-abc&scope=${encodeURIComponent(`openid ${REQUIRED_GOOGLE_SCOPES.join(" ")}`)}`
      ),
      env
    );

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("code=mcp-code-999");
    expect(oauthProvider.completeAuthorization).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "109876543210",
        props: { userId: "109876543210" },
      })
    );

    const rawKvValue = kv.store.get("google_tokens:109876543210");
    expect(rawKvValue).toBeTruthy();
    expect(rawKvValue).not.toContain("1//real-refresh-secret");

    const decrypted = await loadGoogleTokens(kv, TEST_ENC_KEY, "109876543210");
    expect(decrypted?.refreshToken).toBe("1//real-refresh-secret");
    expect(decrypted?.accessToken).toBe("ya29.real-access");
  });
});
