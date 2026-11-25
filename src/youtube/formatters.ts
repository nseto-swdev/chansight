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

/**
 * Parses an ISO 8601 YouTube duration string (e.g. "PT1H23M45S", "PT45S") into seconds.
 */
export function parseIsoDurationToSeconds(iso?: string | null): number | null {
  if (!iso) return null;
  const match = iso.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);
  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

/**
 * Normalizes a YYYY-MM-DD date string to the 1st of its month (required by YouTube Analytics `dimensions=month`).
 */
export function toFirstOfMonth(dateStr: string): string {
  if (!DATE_REGEX.test(dateStr)) {
    throw new Error(
      "日付は YYYY-MM-DD 形式で指定してください（例: 2026-10-01）。"
    );
  }
  return `${dateStr.slice(0, 7)}-01`;
}

/**
 * Resolves a monthly date range aligned to YYYY-MM-01 boundaries (defaulting to the last 6 months).
 */
export function resolveMonthlyDateRange(
  startDate?: string,
  endDate?: string,
  now: Date = new Date()
): DateRange {
  const endBase = endDate
    ? toFirstOfMonth(endDate)
    : `${formatDateUTC(now).slice(0, 7)}-01`;

  let startBase: string;
  if (startDate) {
    startBase = toFirstOfMonth(startDate);
  } else {
    const dt = new Date(`${endBase}T00:00:00Z`);
    dt.setUTCMonth(dt.getUTCMonth() - 5);
    startBase = `${formatDateUTC(dt).slice(0, 7)}-01`;
  }

  if (startBase > endBase) {
    throw new Error(
      `開始月 (${startBase}) は終了月 (${endBase}) 以前にしてください。`
    );
  }

  return { startDate: startBase, endDate: endBase };
}

export const SUBSCRIBED_STATUS_LABELS_JA: Record<string, string> = {
  SUBSCRIBED: "チャンネル登録済み",
  UNSUBSCRIBED: "未登録（新規・非登録）",
};

export function translateSubscribedStatus(code: string): string {
  return SUBSCRIBED_STATUS_LABELS_JA[code] ?? code;
}

export const CONTENT_TYPE_LABELS_JA: Record<string, string> = {
  VIDEO_ON_DEMAND: "通常動画",
  SHORTS: "ショート動画",
  LIVE_STREAM: "ライブ配信",
  STORY: "ストーリー",
  UNSPECIFIED: "その他",
};

export function translateContentType(code: string): string {
  return CONTENT_TYPE_LABELS_JA[code] ?? code;
}

export const DEVICE_TYPE_LABELS_JA: Record<string, string> = {
  MOBILE: "スマートフォン",
  DESKTOP: "PC（パソコン）",
  TV: "テレビ",
  TABLET: "タブレット",
  GAME_CONSOLE: "ゲーム機",
  UNKNOWN_PLATFORM: "その他",
};

export function translateDeviceType(code: string): string {
  return DEVICE_TYPE_LABELS_JA[code] ?? code;
}

export const GENDER_LABELS_JA: Record<string, string> = {
  female: "女性",
  male: "男性",
  genderUserSpecified: "その他（ユーザー指定）",
};

export function translateGender(code: string): string {
  return GENDER_LABELS_JA[code] ?? code;
}

export const AGE_GROUP_LABELS_JA: Record<string, string> = {
  "age13-17": "13〜17歳",
  "age18-24": "18〜24歳",
  "age25-34": "25〜34歳",
  "age35-44": "35〜44歳",
  "age45-54": "45〜54歳",
  "age55-64": "55〜64歳",
  "age65-": "65歳以上",
};

export function translateAgeGroup(code: string): string {
  return AGE_GROUP_LABELS_JA[code] ?? code;
}
