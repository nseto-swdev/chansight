import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  forceRefreshGoogleAccessToken,
  getValidGoogleAccessToken,
} from "../auth/token-store.js";
import type { AuthProps, Env } from "../types.js";
import { YouTubeClient } from "../youtube/client.js";
import { createYouTubeMcpServer } from "./server.js";

/**
 * Stateless Streamable HTTP MCP handler for Cloudflare Workers (no Durable Objects).
 */
export async function handleMcpRequest(
  request: Request,
  env: Env,
  props: AuthProps
): Promise<Response> {
  const tokenOptions = {
    kv: env.OAUTH_KV,
    encryptionKey: env.TOKEN_ENCRYPTION_KEY,
    userId: props.userId,
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  };

  const youtube = new YouTubeClient({
    getAccessToken: () => getValidGoogleAccessToken(tokenOptions),
    forceRefreshAccessToken: () => forceRefreshGoogleAccessToken(tokenOptions),
  });

  const server = createYouTubeMcpServer(youtube);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await transport.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
}

export const mcpApiHandler: ExportedHandler<Env> & {
  fetch: NonNullable<ExportedHandler<Env>["fetch"]>;
} = {
  async fetch(request, env, ctx) {
    const props = (ctx as ExecutionContext<AuthProps | undefined>).props;
    if (!props?.userId) {
      return new Response(
        JSON.stringify({
          error: "invalid_token",
          error_description: "Missing authenticated user context.",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return handleMcpRequest(request, env, props);
  },
};
