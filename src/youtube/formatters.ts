const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export interface DateRange {
  startDate: string;
  endDate: string;
}

export function formatDateUTC(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Resolves a YYYY-MM-DD date range, defaulting to the last 28 days up to today (UTC).
 */
export function resolveDateRange(
  startDate?: string,
  endDate?: string,
  now: Date = new Date()
): DateRange {
  const resolvedEnd = endDate ?? formatDateUTC(now);

  let resolvedStart = startDate;
  if (!resolvedStart) {
    const base = endDate ? new Date(`${endDate}T00:00:00Z`) : new Date(now);
    base.setUTCDate(base.getUTCDate() - 28);
    resolvedStart = formatDateUTC(base);
  }

  if (!DATE_REGEX.test(resolvedStart) || !DATE_REGEX.test(resolvedEnd)) {
    throw new Error(
      "日付は YYYY-MM-DD 形式で指定してください（例: 2026-10-01）。"
    );
  }

  if (resolvedStart > resolvedEnd) {
    throw new Error(
      `開始日 (${resolvedStart}) は終了日 (${resolvedEnd}) 以前にしてください。`
    );
  }

  return { startDate: resolvedStart, endDate: resolvedEnd };
}

export function formatSecondsJa(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0秒";
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;

  if (hours > 0) {
    return `${hours}時間${minutes}分${secs}秒`;
  }
  if (minutes > 0) {
    return `${minutes}分${secs}秒`;
  }
  return `${secs}秒`;
}

export function formatMinutesToHoursJa(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return "0時間";
  const hours = minutes / 60;
  return `${hours.toFixed(1)}時間（${Math.round(minutes).toLocaleString("ja-JP")}分）`;
}

export const TRAFFIC_SOURCE_LABELS_JA: Record<string, string> = {
  ADVERTISING: "YouTube 広告",
  ANNOTATION: "アノテーション",
  CAMPAIGN_CARD: "キャンペーンカード",
  END_SCREEN: "終了画面",
  EXT_URL: "外部サイト・SNS",
  HASHTAGS: "ハッシュタグページ",
  LIVE_REDIRECT: "ライブ リダイレクト",
  NO_LINK_EMBEDDED: "埋め込みプレーヤー（その他）",
  NO_LINK_OTHER: "直接入力・不明なソース",
  NOTIFICATION: "通知",
  PLAYLIST: "再生リスト",
  PRODUCT_PAGE: "商品ページ",
  PROMOTED: "プロモーション",
  RELATED_VIDEO: "関連動画",
  SHORTS: "ショートフィード",
  SOUND_PAGE: "サウンドページ",
  SUBSCRIBER: "ブラウジング機能（ホーム・登録チャンネル等）",
  YT_CHANNEL: "チャンネルページ",
  YT_OTHER_PAGE: "その他の YouTube 機能",
  YT_PLAYLIST_PAGE: "再生リストページ",
  YT_SEARCH: "YouTube 検索",
};

export function translateTrafficSource(code: string): string {
  return TRAFFIC_SOURCE_LABELS_JA[code] ?? code;
}
