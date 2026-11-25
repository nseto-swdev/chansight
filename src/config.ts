export const SERVICE_NAME = "ChanSight";
export const SERVICE_NAME_JA = "チャンサイト";
export const SERVICE_DISPLAY_NAME = `${SERVICE_NAME}（${SERVICE_NAME_JA}）`;
export const DEFAULT_PUBLIC_BASE_URL = "https://chansight.nseto.com";
export const CONTACT_EMAIL = "support-chansight@nseto.com";
export const REPOSITORY_URL = "https://github.com/nseto-swdev/chansight";

export const MCP_ROUTE = "/mcp";

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_USERINFO_URL =
  "https://openidconnect.googleapis.com/v1/userinfo";

export const YOUTUBE_ANALYTICS_API_BASE =
  "https://youtubeanalytics.googleapis.com/v2";
export const YOUTUBE_DATA_API_BASE = "https://www.googleapis.com/youtube/v3";

export const REQUIRED_GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/yt-analytics.readonly",
  "https://www.googleapis.com/auth/youtube.readonly",
] as const;

export const REQUESTED_GOOGLE_SCOPES = [
  "openid",
  ...REQUIRED_GOOGLE_SCOPES,
] as const;

export const MCP_SCOPES_SUPPORTED = ["youtube:analytics:read"] as const;

export const GOOGLE_SCOPE_LABELS_JA: Record<string, string> = {
  "https://www.googleapis.com/auth/yt-analytics.readonly":
    "YouTube Analytics のレポート閲覧（再生回数・総再生時間・流入元など）",
  "https://www.googleapis.com/auth/youtube.readonly":
    "YouTube アカウント情報の閲覧（チャンネル名・動画タイトル・公開日など）",
};
