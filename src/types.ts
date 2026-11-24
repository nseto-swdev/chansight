import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

export interface AuthProps {
  userId: string;
}

export interface Env {
  OAUTH_KV: KVNamespace;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  TOKEN_ENCRYPTION_KEY: string;
  PUBLIC_BASE_URL?: string;
}

export interface OAuthHandlerEnv extends Env {
  OAUTH_PROVIDER: OAuthHelpers;
}
