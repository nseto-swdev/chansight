import OAuthProvider, {
  GrantType,
  OAuthError,
} from "@cloudflare/workers-oauth-provider";
import {
  GoogleOAuthError,
  GoogleTokenInvalidGrantError,
  REAUTH_GUIDANCE_JA,
} from "./auth/google-oauth.js";
import { defaultHandler } from "./auth/handlers.js";
import { getValidGoogleAccessToken } from "./auth/token-store.js";
import {
  DEFAULT_PUBLIC_BASE_URL,
  MCP_ROUTE,
  MCP_SCOPES_SUPPORTED,
  SERVICE_DISPLAY_NAME,
} from "./config.js";
import { mcpApiHandler } from "./mcp/handler.js";
import type { AuthProps, Env } from "./types.js";

const providerCache = new Map<string, OAuthProvider<Env>>();

function normalizeBaseUrl(raw?: string): string {
  const base = (raw?.trim() || DEFAULT_PUBLIC_BASE_URL).replace(/\/+$/, "");
  return base;
}

export function createOAuthProvider(baseUrl: string): OAuthProvider<Env> {
  const normalizedBase = normalizeBaseUrl(baseUrl);
  const canonicalResource = `${normalizedBase}${MCP_ROUTE}`;

  return new OAuthProvider<Env>({
    apiRoute: MCP_ROUTE,
    apiHandler: mcpApiHandler,
    defaultHandler: defaultHandler as ExportedHandler<Env>,
    authorizeEndpoint: "/authorize",
    tokenEndpoint: "/oauth/token",
    clientRegistrationEndpoint: "/oauth/register",
    clientIdMetadataDocumentEnabled: true,
    scopesSupported: [...MCP_SCOPES_SUPPORTED],
    requiredScopes: [...MCP_SCOPES_SUPPORTED],
    refreshTokenIdleTTL: 30 * 24 * 60 * 60, // Sliding 30-day idle TTL
    resourceMetadata: {
      resource: canonicalResource,
      authorization_servers: [normalizedBase],
      bearer_methods_supported: ["header"],
      resource_name: `${SERVICE_DISPLAY_NAME} YouTube Analytics MCP`,
    },
    tokenExchangeCallback: async ({ grantType, props, env }) => {
      if (grantType !== GrantType.REFRESH_TOKEN) {
        return;
      }

      const authProps = props as AuthProps | undefined;
      if (!authProps?.userId) {
        return;
      }

      try {
        await getValidGoogleAccessToken({
          kv: env.OAUTH_KV,
          encryptionKey: env.TOKEN_ENCRYPTION_KEY,
          userId: authProps.userId,
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        });
      } catch (error) {
        if (error instanceof GoogleTokenInvalidGrantError) {
          throw new OAuthError("invalid_grant", {
            description: REAUTH_GUIDANCE_JA,
          });
        }
        if (error instanceof GoogleOAuthError) {
          throw new OAuthError("temporarily_unavailable", {
            description:
              "Google認証サーバーとの通信が一時的に失敗しました。しばらくしてから再試行してください。",
            statusCode: 503,
          });
        }
        throw error;
      }
    },
  });
}

function getProviderForEnv(env: Env): OAuthProvider<Env> {
  const baseUrl = normalizeBaseUrl(env.PUBLIC_BASE_URL);
  let provider = providerCache.get(baseUrl);
  if (!provider) {
    provider = createOAuthProvider(baseUrl);
    providerCache.set(baseUrl, provider);
  }
  return provider;
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return getProviderForEnv(env).fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
