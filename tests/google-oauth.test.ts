import { describe, expect, it, vi } from "vitest";
import {
  buildGoogleAuthorizeUrl,
  exchangeGoogleCode,
  GoogleTokenInvalidGrantError,
  refreshGoogleAccessToken,
  validateGrantedScopes,
} from "../src/auth/google-oauth.js";
import { REQUIRED_GOOGLE_SCOPES } from "../src/config.js";

describe("google-oauth", () => {
  it("builds Google OAuth authorize URL with offline access and consent prompt", () => {
    const urlStr = buildGoogleAuthorizeUrl({
      clientId: "client-123",
      redirectUri: "https://chansight.nseto.com/callback",
      state: "opaque-state",
    });

    const url = new URL(urlStr);
    expect(url.origin + url.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth"
    );
    expect(url.searchParams.get("client_id")).toBe("client-123");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("opaque-state");

    const scopes = url.searchParams.get("scope")!.split(" ");
    expect(scopes).toContain(REQUIRED_GOOGLE_SCOPES[0]);
    expect(scopes).toContain(REQUIRED_GOOGLE_SCOPES[1]);
    expect(scopes).toContain("openid");
  });

  it("validates granted scopes when all required scopes are present", () => {
    const result = validateGrantedScopes(
      "openid https://www.googleapis.com/auth/yt-analytics.readonly https://www.googleapis.com/auth/youtube.readonly"
    );
    expect(result.valid).toBe(true);
    expect(result.missingScopes).toEqual([]);
  });

  it("detects Partial Grant when one required scope is missing", () => {
    const result = validateGrantedScopes(
      "openid https://www.googleapis.com/auth/youtube.readonly"
    );
    expect(result.valid).toBe(false);
    expect(result.missingScopes).toEqual([
      "https://www.googleapis.com/auth/yt-analytics.readonly",
    ]);
  });

  it("detects Partial Grant when scope string is empty", () => {
    const result = validateGrantedScopes("");
    expect(result.valid).toBe(false);
    expect(result.missingScopes).toHaveLength(2);
  });

  it("exchanges authorization code for tokens", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "ya29.access",
          refresh_token: "1//refresh",
          expires_in: 3600,
          scope: REQUIRED_GOOGLE_SCOPES.join(" "),
          token_type: "Bearer",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const token = await exchangeGoogleCode({
      code: "auth-code",
      clientId: "cid",
      clientSecret: "csec",
      redirectUri: "https://chansight.nseto.com/callback",
      fetchImpl: mockFetch,
    });

    expect(token.access_token).toBe("ya29.access");
    expect(token.refresh_token).toBe("1//refresh");
  });

  it("throws GoogleTokenInvalidGrantError with Japanese re-auth guidance on invalid_grant refresh", async () => {
    const mockFetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: "invalid_grant",
            error_description: "Token has been expired or revoked.",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
    );

    await expect(
      refreshGoogleAccessToken({
        refreshToken: "1//revoked",
        clientId: "cid",
        clientSecret: "csec",
        fetchImpl: mockFetch,
      })
    ).rejects.toThrow(GoogleTokenInvalidGrantError);

    try {
      await refreshGoogleAccessToken({
        refreshToken: "1//revoked",
        clientId: "cid",
        clientSecret: "csec",
        fetchImpl: mockFetch,
      });
    } catch (err) {
      expect((err as Error).message).toContain("Googleアカウント");
      expect((err as Error).message).toContain("連携");
    }
  });
});
