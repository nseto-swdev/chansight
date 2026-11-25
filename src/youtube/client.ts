import {
  YOUTUBE_ANALYTICS_API_BASE,
  YOUTUBE_DATA_API_BASE,
} from "../config.js";
import {
  formatMinutesToHoursJa,
  formatSecondsJa,
  parseIsoDurationToSeconds,
  resolveDateRange,
  resolveMonthlyDateRange,
  translateAgeGroup,
  translateContentType,
  translateDeviceType,
  translateGender,
  translateSubscribedStatus,
  translateTrafficSource,
} from "./formatters.js";

export class YouTubeApiError extends Error {
  readonly status: number;
  readonly reason?: string;

  constructor(message: string, status: number, reason?: string) {
    super(message);
    this.name = "YouTubeApiError";
    this.status = status;
    this.reason = reason;
  }
}

export interface ChannelBasicInfo {
  channelId: string;
  title: string;
  customUrl?: string;
  publishedAt?: string;
  subscriberCount: number | null;
  hiddenSubscriberCount: boolean;
  totalViews: number;
  videoCount: number;
}

export interface ChannelOverviewResult {
  channel: ChannelBasicInfo;
  period: { startDate: string; endDate: string };
  metrics: {
    views: number;
    estimatedMinutesWatched: number;
    estimatedHoursWatched: number;
    watchTimeFormatted: string;
    averageViewDurationSeconds: number;
    averageViewDurationFormatted: string;
    subscribersGained: number;
    subscribersLost: number;
    netSubscribers: number;
  };
}

export interface TopVideoItem {
  rank: number;
  videoId: string;
  title: string;
  publishedAt: string | null;
  url: string;
  views: number;
  estimatedMinutesWatched: number;
  estimatedHoursWatched: number;
  averageViewDurationSeconds: number;
  averageViewDurationFormatted: string;
  averageViewPercentage: number | null;
  likes: number;
  subscribersGained: number;
}

export interface TopVideosResult {
  period: { startDate: string; endDate: string };
  sortBy: "views" | "watchTime";
  videos: TopVideoItem[];
}

export interface TrafficSourceItem {
  sourceType: string;
  sourceLabelJa: string;
  views: number;
  viewSharePercent: number;
  estimatedMinutesWatched: number;
  estimatedHoursWatched: number;
  watchTimeSharePercent: number;
}

export interface TrafficSourcesResult {
  period: { startDate: string; endDate: string };
  totalViews: number;
  totalEstimatedMinutesWatched: number;
  sources: TrafficSourceItem[];
}

export interface VideoAnalyticsResult {
  videoId: string;
  url: string;
  title: string | null;
  publishedAt: string | null;
  period: { startDate: string; endDate: string };
  hasAnalyticsData: boolean;
  metrics: {
    views: number;
    estimatedMinutesWatched: number;
    estimatedHoursWatched: number;
    watchTimeFormatted: string;
    averageViewDurationSeconds: number;
    averageViewDurationFormatted: string;
    averageViewPercentage: number;
    likes: number;
    dislikes: number;
    comments: number;
    shares: number;
    subscribersGained: number;
    subscribersLost: number;
    netSubscribers: number;
  };
  lifetimeStats?: {
    views: number;
    likes: number;
    comments: number;
  };
}

export interface RecentVideoItem {
  videoId: string;
  title: string;
  publishedAt: string | null;
  url: string;
  contentKind: "live" | "short" | "video";
  durationSeconds: number | null;
  durationFormatted: string | null;
  views: number;
  likes: number;
  comments: number;
}

export interface RecentVideosResult {
  channelId: string;
  channelTitle: string;
  videos: RecentVideoItem[];
}

export interface TimeSeriesPoint {
  date: string;
  views: number;
  estimatedMinutesWatched: number;
  estimatedHoursWatched: number;
  averageViewDurationSeconds: number;
  averageViewDurationFormatted: string;
  subscribersGained: number;
  subscribersLost: number;
  netSubscribers: number;
}

export interface DailyMetricsResult {
  granularity: "day" | "month";
  period: { startDate: string; endDate: string };
  totals: {
    views: number;
    estimatedMinutesWatched: number;
    estimatedHoursWatched: number;
    subscribersGained: number;
    subscribersLost: number;
    netSubscribers: number;
  };
  series: TimeSeriesPoint[];
}

export type BreakdownType =
  | "subscribedStatus"
  | "contentType"
  | "demographics"
  | "country"
  | "device"
  | "searchTerms"
  | "externalUrls";

export interface BreakdownRow {
  key: string;
  labelJa: string;
  views?: number;
  viewSharePercent?: number;
  estimatedMinutesWatched?: number;
  estimatedHoursWatched?: number;
  watchTimeSharePercent?: number;
  averageViewDurationSeconds?: number;
  averageViewDurationFormatted?: string;
  likes?: number;
  subscribersGained?: number;
  subscribersLost?: number;
  netSubscribers?: number;
  viewerPercentage?: number;
  ageGroup?: string;
  gender?: string;
}

export interface AudienceAndFormatBreakdownResult {
  breakdown: BreakdownType;
  period: { startDate: string; endDate: string };
  videoId?: string;
  totalViews?: number;
  totalEstimatedMinutesWatched?: number;
  items: BreakdownRow[];
}

interface AnalyticsReportResponse {
  columnHeaders?: Array<{
    name: string;
    columnType: string;
    dataType: string;
  }>;
  rows?: Array<Array<string | number>>;
}

interface GoogleApiErrorResponse {
  error?: {
    code?: number;
    message?: string;
    errors?: Array<{ reason?: string; message?: string }>;
  };
}

export interface YouTubeClientOptions {
  getAccessToken: () => Promise<string>;
  forceRefreshAccessToken?: () => Promise<string>;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

/**
 * Extracts a clean 11-char/ID videoId even if a full YouTube URL is passed.
 */
export function normalizeVideoId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("videoId を指定してください。");
  }

  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const url = new URL(trimmed);
      if (url.hostname === "youtu.be") {
        const id = url.pathname.replace(/^\/+/, "").split("/")[0];
        if (id) return id;
      }
      const vParam = url.searchParams.get("v");
      if (vParam) return vParam;

      const shortsMatch = url.pathname.match(/\/(?:shorts|live|embed)\/([^/?#]+)/);
      if (shortsMatch?.[1]) return shortsMatch[1];
    }
  } catch {
    // Fall through to raw ID check
  }

  if (!/^[a-zA-Z0-9_-]{6,32}$/.test(trimmed)) {
    throw new Error(
      `videoId の形式が正しくありません: "${trimmed}"（例: dQw4w9WgXcQ）`
    );
  }
  return trimmed;
}

function toNumber(value: string | number | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function mapRowByColumnName(
  headers: AnalyticsReportResponse["columnHeaders"],
  row: Array<string | number>
): Record<string, string | number> {
  const record: Record<string, string | number> = {};
  if (!headers) return record;
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    if (header) {
      record[header.name] = row[i] ?? 0;
    }
  }
  return record;
}

export class YouTubeClient {
  private readonly getAccessToken: () => Promise<string>;
  private readonly forceRefreshAccessToken?: () => Promise<string>;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;

  constructor(options: YouTubeClientOptions) {
    this.getAccessToken = options.getAccessToken;
    this.forceRefreshAccessToken = options.forceRefreshAccessToken;
    this.fetchImpl =
      options.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
    this.now = options.now ?? (() => new Date());
  }

  private async requestJson<T>(url: string): Promise<T> {
    const accessToken = await this.getAccessToken();
    let response = await this.fetchImpl(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    // If token was unexpectedly rejected (401), try refreshing once.
    if (response.status === 401 && this.forceRefreshAccessToken) {
      const refreshedToken = await this.forceRefreshAccessToken();
      response = await this.fetchImpl(url, {
        headers: {
          Authorization: `Bearer ${refreshedToken}`,
          Accept: "application/json",
        },
      });
    }

    if (!response.ok) {
      const errBody = (await response
        .json()
        .catch(() => ({}))) as GoogleApiErrorResponse;
      const reason = errBody.error?.errors?.[0]?.reason;
      const rawMessage = errBody.error?.message ?? response.statusText;

      if (response.status === 401) {
        throw new YouTubeApiError(
          "YouTube APIの認証に失敗しました。AIクライアント側でGoogleアカウントの再連携をお試しください。",
          401,
          reason
        );
      }
      if (
        response.status === 403 &&
        (reason === "quotaExceeded" || reason === "dailyLimitExceeded")
      ) {
        throw new YouTubeApiError(
          "現在YouTube APIの1日あたりの利用上限（クォータ）に達しています。しばらく時間をおいてから再度お試しください。",
          403,
          reason
        );
      }
      if (response.status === 403) {
        throw new YouTubeApiError(
          `YouTubeデータへのアクセス権限が不足しています（${rawMessage}）。Googleアカウントの再連携で必要な閲覧権限をすべて許可してください。`,
          403,
          reason
        );
      }

      throw new YouTubeApiError(
        `YouTube APIエラー (${response.status}): ${rawMessage}`,
        response.status,
        reason
      );
    }

    return (await response.json()) as T;
  }

  async getChannelInfo(): Promise<ChannelBasicInfo> {
    const url = new URL(`${YOUTUBE_DATA_API_BASE}/channels`);
    url.searchParams.set("part", "snippet,statistics");
    url.searchParams.set("mine", "true");

    const data = await this.requestJson<{
      items?: Array<{
        id: string;
        snippet?: {
          title?: string;
          customUrl?: string;
          publishedAt?: string;
        };
        statistics?: {
          subscriberCount?: string;
          hiddenSubscriberCount?: boolean;
          viewCount?: string;
          videoCount?: string;
        };
      }>;
    }>(url.toString());

    const channel = data.items?.[0];
    if (!channel) {
      throw new YouTubeApiError(
        "連携されたGoogleアカウントにYouTubeチャンネルが見つかりませんでした。正しいYouTubeチャンネル（ブランドアカウントを含む）を選択して再連携してください。",
        404,
        "channelNotFound"
      );
    }

    const hidden = Boolean(channel.statistics?.hiddenSubscriberCount);
    return {
      channelId: channel.id,
      title: channel.snippet?.title ?? "（チャンネル名不明）",
      customUrl: channel.snippet?.customUrl,
      publishedAt: channel.snippet?.publishedAt,
      subscriberCount: hidden
        ? null
        : toNumber(channel.statistics?.subscriberCount),
      hiddenSubscriberCount: hidden,
      totalViews: toNumber(channel.statistics?.viewCount),
      videoCount: toNumber(channel.statistics?.videoCount),
    };
  }

  async getChannelOverview(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<ChannelOverviewResult> {
    const period = resolveDateRange(params?.startDate, params?.endDate, this.now());

    const analyticsUrl = new URL(`${YOUTUBE_ANALYTICS_API_BASE}/reports`);
    analyticsUrl.searchParams.set("ids", "channel==MINE");
    analyticsUrl.searchParams.set("startDate", period.startDate);
    analyticsUrl.searchParams.set("endDate", period.endDate);
    analyticsUrl.searchParams.set(
      "metrics",
      "views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost"
    );

    const [channel, report] = await Promise.all([
      this.getChannelInfo(),
      this.requestJson<AnalyticsReportResponse>(analyticsUrl.toString()),
    ]);

    const firstRow = report.rows?.[0];
    const mapped = firstRow
      ? mapRowByColumnName(report.columnHeaders, firstRow)
      : {};

    const views = toNumber(mapped["views"]);
    const estimatedMinutesWatched = toNumber(mapped["estimatedMinutesWatched"]);
    const averageViewDurationSeconds = toNumber(mapped["averageViewDuration"]);
    const subscribersGained = toNumber(mapped["subscribersGained"]);
    const subscribersLost = toNumber(mapped["subscribersLost"]);

    return {
      channel,
      period,
      metrics: {
        views,
        estimatedMinutesWatched,
        estimatedHoursWatched: roundTo(estimatedMinutesWatched / 60, 2),
        watchTimeFormatted: formatMinutesToHoursJa(estimatedMinutesWatched),
        averageViewDurationSeconds,
        averageViewDurationFormatted: formatSecondsJa(averageViewDurationSeconds),
        subscribersGained,
        subscribersLost,
        netSubscribers: subscribersGained - subscribersLost,
      },
    };
  }

  async getTopVideos(params?: {
    startDate?: string;
    endDate?: string;
    maxResults?: number;
    sortBy?: "views" | "watchTime";
  }): Promise<TopVideosResult> {
    const period = resolveDateRange(params?.startDate, params?.endDate, this.now());
    const maxResults = Math.min(Math.max(params?.maxResults ?? 10, 1), 50);
    const sortBy = params?.sortBy ?? "views";
    const sortParam =
      sortBy === "watchTime" ? "-estimatedMinutesWatched" : "-views";

    const analyticsUrl = new URL(`${YOUTUBE_ANALYTICS_API_BASE}/reports`);
    analyticsUrl.searchParams.set("ids", "channel==MINE");
    analyticsUrl.searchParams.set("startDate", period.startDate);
    analyticsUrl.searchParams.set("endDate", period.endDate);
    analyticsUrl.searchParams.set("dimensions", "video");
    analyticsUrl.searchParams.set(
      "metrics",
      "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,subscribersGained"
    );
    analyticsUrl.searchParams.set("sort", sortParam);
    analyticsUrl.searchParams.set("maxResults", String(maxResults));

    const report = await this.requestJson<AnalyticsReportResponse>(
      analyticsUrl.toString()
    );

    const rows = report.rows ?? [];
    if (rows.length === 0) {
      return { period, sortBy, videos: [] };
    }

    const mappedRows = rows.map((row) =>
      mapRowByColumnName(report.columnHeaders, row)
    );
    const videoIds = mappedRows
      .map((r) => String(r["video"] ?? ""))
      .filter(Boolean);

    const metadataById = await this.fetchVideosMetadata(videoIds);

    const videos: TopVideoItem[] = mappedRows.map((row, index) => {
      const videoId = String(row["video"] ?? "");
      const meta = metadataById.get(videoId);
      const minutesWatched = toNumber(row["estimatedMinutesWatched"]);
      const avgDuration = toNumber(row["averageViewDuration"]);
      const avgPctRaw = row["averageViewPercentage"];

      return {
        rank: index + 1,
        videoId,
        title:
          meta?.title ?? "（タイトル取得不可・削除済みまたは非公開動画）",
        publishedAt: meta?.publishedAt ?? null,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        views: toNumber(row["views"]),
        estimatedMinutesWatched: minutesWatched,
        estimatedHoursWatched: roundTo(minutesWatched / 60, 2),
        averageViewDurationSeconds: avgDuration,
        averageViewDurationFormatted: formatSecondsJa(avgDuration),
        averageViewPercentage:
          avgPctRaw !== undefined ? roundTo(toNumber(avgPctRaw), 2) : null,
        likes: toNumber(row["likes"]),
        subscribersGained: toNumber(row["subscribersGained"]),
      };
    });

    return { period, sortBy, videos };
  }

  async getTrafficSources(params?: {
    startDate?: string;
    endDate?: string;
    maxResults?: number;
  }): Promise<TrafficSourcesResult> {
    const period = resolveDateRange(params?.startDate, params?.endDate, this.now());
    const maxResults = Math.min(Math.max(params?.maxResults ?? 20, 1), 50);

    const analyticsUrl = new URL(`${YOUTUBE_ANALYTICS_API_BASE}/reports`);
    analyticsUrl.searchParams.set("ids", "channel==MINE");
    analyticsUrl.searchParams.set("startDate", period.startDate);
    analyticsUrl.searchParams.set("endDate", period.endDate);
    analyticsUrl.searchParams.set("dimensions", "insightTrafficSourceType");
    analyticsUrl.searchParams.set("metrics", "views,estimatedMinutesWatched");
    analyticsUrl.searchParams.set("sort", "-views");
    analyticsUrl.searchParams.set("maxResults", String(maxResults));

    const report = await this.requestJson<AnalyticsReportResponse>(
      analyticsUrl.toString()
    );

    const rows = report.rows ?? [];
    const mappedRows = rows.map((row) =>
      mapRowByColumnName(report.columnHeaders, row)
    );

    const totalViews = mappedRows.reduce(
      (sum, row) => sum + toNumber(row["views"]),
      0
    );
    const totalMinutes = mappedRows.reduce(
      (sum, row) => sum + toNumber(row["estimatedMinutesWatched"]),
      0
    );

    const sources: TrafficSourceItem[] = mappedRows.map((row) => {
      const sourceType = String(row["insightTrafficSourceType"] ?? "UNKNOWN");
      const views = toNumber(row["views"]);
      const minutes = toNumber(row["estimatedMinutesWatched"]);
      return {
        sourceType,
        sourceLabelJa: translateTrafficSource(sourceType),
        views,
        viewSharePercent:
          totalViews > 0 ? roundTo((views / totalViews) * 100, 1) : 0,
        estimatedMinutesWatched: minutes,
        estimatedHoursWatched: roundTo(minutes / 60, 2),
        watchTimeSharePercent:
          totalMinutes > 0 ? roundTo((minutes / totalMinutes) * 100, 1) : 0,
      };
    });

    return {
      period,
      totalViews,
      totalEstimatedMinutesWatched: totalMinutes,
      sources,
    };
  }

  async getVideoAnalytics(params: {
    videoId: string;
    startDate?: string;
    endDate?: string;
  }): Promise<VideoAnalyticsResult> {
    const videoId = normalizeVideoId(params.videoId);
    const period = resolveDateRange(params.startDate, params.endDate, this.now());

    const analyticsUrl = new URL(`${YOUTUBE_ANALYTICS_API_BASE}/reports`);
    analyticsUrl.searchParams.set("ids", "channel==MINE");
    analyticsUrl.searchParams.set("startDate", period.startDate);
    analyticsUrl.searchParams.set("endDate", period.endDate);
    analyticsUrl.searchParams.set(
      "metrics",
      "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,dislikes,comments,shares,subscribersGained,subscribersLost"
    );
    analyticsUrl.searchParams.set("filters", `video==${videoId}`);

    const [metadataById, report] = await Promise.all([
      this.fetchVideosMetadata([videoId], true),
      this.requestJson<AnalyticsReportResponse>(analyticsUrl.toString()),
    ]);

    const meta = metadataById.get(videoId);
    const firstRow = report.rows?.[0];
    const mapped = firstRow
      ? mapRowByColumnName(report.columnHeaders, firstRow)
      : {};

    const views = toNumber(mapped["views"]);
    const estimatedMinutesWatched = toNumber(mapped["estimatedMinutesWatched"]);
    const averageViewDurationSeconds = toNumber(mapped["averageViewDuration"]);
    const averageViewPercentage = roundTo(
      toNumber(mapped["averageViewPercentage"]),
      2
    );
    const likes = toNumber(mapped["likes"]);
    const dislikes = toNumber(mapped["dislikes"]);
    const comments = toNumber(mapped["comments"]);
    const shares = toNumber(mapped["shares"]);
    const subscribersGained = toNumber(mapped["subscribersGained"]);
    const subscribersLost = toNumber(mapped["subscribersLost"]);

    return {
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: meta?.title ?? null,
      publishedAt: meta?.publishedAt ?? null,
      period,
      hasAnalyticsData: Boolean(firstRow),
      metrics: {
        views,
        estimatedMinutesWatched,
        estimatedHoursWatched: roundTo(estimatedMinutesWatched / 60, 2),
        watchTimeFormatted: formatMinutesToHoursJa(estimatedMinutesWatched),
        averageViewDurationSeconds,
        averageViewDurationFormatted: formatSecondsJa(averageViewDurationSeconds),
        averageViewPercentage,
        likes,
        dislikes,
        comments,
        shares,
        subscribersGained,
        subscribersLost,
        netSubscribers: subscribersGained - subscribersLost,
      },
      lifetimeStats: meta?.lifetimeStats,
    };
  }

  /**
   * Lists the channel's most recently uploaded videos/streams using
   * `channels.list` + `playlistItems.list` + `videos.list` (avoids 100-unit `search.list`).
   */
  async getRecentVideos(params?: {
    maxResults?: number;
  }): Promise<RecentVideosResult> {
    const maxResults = Math.min(Math.max(params?.maxResults ?? 10, 1), 50);

    const channelUrl = new URL(`${YOUTUBE_DATA_API_BASE}/channels`);
    channelUrl.searchParams.set("part", "snippet,contentDetails");
    channelUrl.searchParams.set("mine", "true");

    const channelData = await this.requestJson<{
      items?: Array<{
        id: string;
        snippet?: { title?: string };
        contentDetails?: {
          relatedPlaylists?: { uploads?: string };
        };
      }>;
    }>(channelUrl.toString());

    const channel = channelData.items?.[0];
    if (!channel) {
      throw new YouTubeApiError(
        "連携されたGoogleアカウントにYouTubeチャンネルが見つかりませんでした。",
        404,
        "channelNotFound"
      );
    }

    const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) {
      return {
        channelId: channel.id,
        channelTitle: channel.snippet?.title ?? "（チャンネル名不明）",
        videos: [],
      };
    }

    const playlistUrl = new URL(`${YOUTUBE_DATA_API_BASE}/playlistItems`);
    playlistUrl.searchParams.set("part", "snippet,contentDetails");
    playlistUrl.searchParams.set("playlistId", uploadsPlaylistId);
    playlistUrl.searchParams.set("maxResults", String(maxResults));

    const playlistData = await this.requestJson<{
      items?: Array<{
        snippet?: {
          title?: string;
          publishedAt?: string;
          resourceId?: { videoId?: string };
        };
        contentDetails?: {
          videoId?: string;
          videoPublishedAt?: string;
        };
      }>;
    }>(playlistUrl.toString());

    const rawItems = playlistData.items ?? [];
    const videoIds = rawItems
      .map((item) => item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId ?? "")
      .filter(Boolean);

    if (videoIds.length === 0) {
      return {
        channelId: channel.id,
        channelTitle: channel.snippet?.title ?? "（チャンネル名不明）",
        videos: [],
      };
    }

    const videosUrl = new URL(`${YOUTUBE_DATA_API_BASE}/videos`);
    videosUrl.searchParams.set(
      "part",
      "snippet,statistics,contentDetails,liveStreamingDetails"
    );
    videosUrl.searchParams.set("id", videoIds.join(","));

    const videosData = await this.requestJson<{
      items?: Array<{
        id: string;
        snippet?: { title?: string; publishedAt?: string };
        statistics?: {
          viewCount?: string;
          likeCount?: string;
          commentCount?: string;
        };
        contentDetails?: { duration?: string };
        liveStreamingDetails?: Record<string, unknown>;
      }>;
    }>(videosUrl.toString());

    const detailMap = new Map(
      (videosData.items ?? []).map((item) => [item.id, item])
    );

    const videos: RecentVideoItem[] = rawItems
      .map((item) => {
        const videoId =
          item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId ?? "";
        if (!videoId) return null;
        const detail = detailMap.get(videoId);
        const durationSeconds = parseIsoDurationToSeconds(
          detail?.contentDetails?.duration
        );
        const isLive = Boolean(detail?.liveStreamingDetails);
        const contentKind: RecentVideoItem["contentKind"] = isLive
          ? "live"
          : durationSeconds !== null && durationSeconds > 0 && durationSeconds <= 61
            ? "short"
            : "video";

        return {
          videoId,
          title:
            detail?.snippet?.title ??
            item.snippet?.title ??
            "（タイトル不明）",
          publishedAt:
            detail?.snippet?.publishedAt ??
            item.contentDetails?.videoPublishedAt ??
            item.snippet?.publishedAt ??
            null,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          contentKind,
          durationSeconds,
          durationFormatted:
            durationSeconds !== null ? formatSecondsJa(durationSeconds) : null,
          views: toNumber(detail?.statistics?.viewCount),
          likes: toNumber(detail?.statistics?.likeCount),
          comments: toNumber(detail?.statistics?.commentCount),
        };
      })
      .filter((v): v is RecentVideoItem => v !== null);

    return {
      channelId: channel.id,
      channelTitle: channel.snippet?.title ?? "（チャンネル名不明）",
      videos,
    };
  }

  /**
   * Returns daily or monthly time-series metrics for the channel (0 Data API units).
   */
  async getDailyMetrics(params?: {
    startDate?: string;
    endDate?: string;
    granularity?: "day" | "month";
  }): Promise<DailyMetricsResult> {
    const granularity = params?.granularity ?? "day";
    const period =
      granularity === "month"
        ? resolveMonthlyDateRange(params?.startDate, params?.endDate, this.now())
        : resolveDateRange(params?.startDate, params?.endDate, this.now());

    const analyticsUrl = new URL(`${YOUTUBE_ANALYTICS_API_BASE}/reports`);
    analyticsUrl.searchParams.set("ids", "channel==MINE");
    analyticsUrl.searchParams.set("startDate", period.startDate);
    analyticsUrl.searchParams.set("endDate", period.endDate);
    analyticsUrl.searchParams.set("dimensions", granularity);
    analyticsUrl.searchParams.set(
      "metrics",
      "views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost"
    );
    analyticsUrl.searchParams.set("sort", granularity);

    const report = await this.requestJson<AnalyticsReportResponse>(
      analyticsUrl.toString()
    );

    const rows = report.rows ?? [];
    const series: TimeSeriesPoint[] = rows.map((row) => {
      const mapped = mapRowByColumnName(report.columnHeaders, row);
      const views = toNumber(mapped["views"]);
      const minutes = toNumber(mapped["estimatedMinutesWatched"]);
      const avgDuration = toNumber(mapped["averageViewDuration"]);
      const gained = toNumber(mapped["subscribersGained"]);
      const lost = toNumber(mapped["subscribersLost"]);

      return {
        date: String(mapped[granularity] ?? ""),
        views,
        estimatedMinutesWatched: minutes,
        estimatedHoursWatched: roundTo(minutes / 60, 2),
        averageViewDurationSeconds: avgDuration,
        averageViewDurationFormatted: formatSecondsJa(avgDuration),
        subscribersGained: gained,
        subscribersLost: lost,
        netSubscribers: gained - lost,
      };
    });

    const totalViews = series.reduce((s, p) => s + p.views, 0);
    const totalMinutes = series.reduce(
      (s, p) => s + p.estimatedMinutesWatched,
      0
    );
    const totalGained = series.reduce((s, p) => s + p.subscribersGained, 0);
    const totalLost = series.reduce((s, p) => s + p.subscribersLost, 0);

    return {
      granularity,
      period,
      totals: {
        views: totalViews,
        estimatedMinutesWatched: totalMinutes,
        estimatedHoursWatched: roundTo(totalMinutes / 60, 2),
        subscribersGained: totalGained,
        subscribersLost: totalLost,
        netSubscribers: totalGained - totalLost,
      },
      series,
    };
  }

  /**
   * Returns audience demographics, subscriber status, content format (live/shorts/video),
   * country, device, search terms, or external URL breakdowns (0 Data API units).
   */
  async getAudienceAndFormatBreakdown(params: {
    breakdown: BreakdownType;
    startDate?: string;
    endDate?: string;
    videoId?: string;
    maxResults?: number;
  }): Promise<AudienceAndFormatBreakdownResult> {
    const period = resolveDateRange(params.startDate, params.endDate, this.now());
    const normalizedVideoId = params.videoId
      ? normalizeVideoId(params.videoId)
      : undefined;

    const analyticsUrl = new URL(`${YOUTUBE_ANALYTICS_API_BASE}/reports`);
    analyticsUrl.searchParams.set("ids", "channel==MINE");
    analyticsUrl.searchParams.set("startDate", period.startDate);
    analyticsUrl.searchParams.set("endDate", period.endDate);

    const filters: string[] = [];
    if (normalizedVideoId) {
      filters.push(`video==${normalizedVideoId}`);
    }

    switch (params.breakdown) {
      case "subscribedStatus":
        analyticsUrl.searchParams.set("dimensions", "subscribedStatus");
        analyticsUrl.searchParams.set(
          "metrics",
          "views,estimatedMinutesWatched,averageViewDuration"
        );
        analyticsUrl.searchParams.set("sort", "-views");
        break;
      case "contentType":
        analyticsUrl.searchParams.set("dimensions", "creatorContentType");
        analyticsUrl.searchParams.set(
          "metrics",
          "views,estimatedMinutesWatched,averageViewDuration,likes,subscribersGained,subscribersLost"
        );
        analyticsUrl.searchParams.set("sort", "-views");
        break;
      case "demographics":
        analyticsUrl.searchParams.set("dimensions", "ageGroup,gender");
        analyticsUrl.searchParams.set("metrics", "viewerPercentage");
        analyticsUrl.searchParams.set("sort", "gender,ageGroup");
        break;
      case "country": {
        const limit = Math.min(Math.max(params.maxResults ?? 20, 1), 50);
        analyticsUrl.searchParams.set("dimensions", "country");
        analyticsUrl.searchParams.set(
          "metrics",
          "views,estimatedMinutesWatched,averageViewDuration,subscribersGained"
        );
        analyticsUrl.searchParams.set("sort", "-views");
        analyticsUrl.searchParams.set("maxResults", String(limit));
        break;
      }
      case "device":
        analyticsUrl.searchParams.set("dimensions", "deviceType");
        analyticsUrl.searchParams.set("metrics", "views,estimatedMinutesWatched");
        analyticsUrl.searchParams.set("sort", "-views");
        break;
      case "searchTerms": {
        const limit = Math.min(Math.max(params.maxResults ?? 20, 1), 25);
        analyticsUrl.searchParams.set(
          "dimensions",
          "insightTrafficSourceDetail"
        );
        analyticsUrl.searchParams.set("metrics", "views,estimatedMinutesWatched");
        analyticsUrl.searchParams.set("sort", "-views");
        analyticsUrl.searchParams.set("maxResults", String(limit));
        filters.push("insightTrafficSourceType==YT_SEARCH");
        break;
      }
      case "externalUrls": {
        const limit = Math.min(Math.max(params.maxResults ?? 20, 1), 25);
        analyticsUrl.searchParams.set(
          "dimensions",
          "insightTrafficSourceDetail"
        );
        analyticsUrl.searchParams.set("metrics", "views,estimatedMinutesWatched");
        analyticsUrl.searchParams.set("sort", "-views");
        analyticsUrl.searchParams.set("maxResults", String(limit));
        filters.push("insightTrafficSourceType==EXT_URL");
        break;
      }
    }

    if (filters.length > 0) {
      analyticsUrl.searchParams.set("filters", filters.join(";"));
    }

    const report = await this.requestJson<AnalyticsReportResponse>(
      analyticsUrl.toString()
    );
    const mappedRows = (report.rows ?? []).map((row) =>
      mapRowByColumnName(report.columnHeaders, row)
    );

    if (params.breakdown === "demographics") {
      const items: BreakdownRow[] = mappedRows.map((row) => {
        const ageGroup = String(row["ageGroup"] ?? "");
        const gender = String(row["gender"] ?? "");
        return {
          key: `${ageGroup}:${gender}`,
          labelJa: `${translateGender(gender)}・${translateAgeGroup(ageGroup)}`,
          ageGroup,
          gender,
          viewerPercentage: roundTo(toNumber(row["viewerPercentage"]), 2),
        };
      });
      return {
        breakdown: params.breakdown,
        period,
        videoId: normalizedVideoId,
        items,
      };
    }

    const totalViews = mappedRows.reduce(
      (sum, row) => sum + toNumber(row["views"]),
      0
    );
    const totalMinutes = mappedRows.reduce(
      (sum, row) => sum + toNumber(row["estimatedMinutesWatched"]),
      0
    );

    const items: BreakdownRow[] = mappedRows.map((row) => {
      let key = "";
      let labelJa = "";

      switch (params.breakdown) {
        case "subscribedStatus":
          key = String(row["subscribedStatus"] ?? "");
          labelJa = translateSubscribedStatus(key);
          break;
        case "contentType":
          key = String(row["creatorContentType"] ?? "");
          labelJa = translateContentType(key);
          break;
        case "country":
          key = String(row["country"] ?? "");
          labelJa = key;
          break;
        case "device":
          key = String(row["deviceType"] ?? "");
          labelJa = translateDeviceType(key);
          break;
        case "searchTerms":
        case "externalUrls":
          key = String(row["insightTrafficSourceDetail"] ?? "");
          labelJa = key;
          break;
      }

      const views = toNumber(row["views"]);
      const minutes = toNumber(row["estimatedMinutesWatched"]);
      const item: BreakdownRow = {
        key,
        labelJa,
        views,
        viewSharePercent:
          totalViews > 0 ? roundTo((views / totalViews) * 100, 1) : 0,
        estimatedMinutesWatched: minutes,
        estimatedHoursWatched: roundTo(minutes / 60, 2),
        watchTimeSharePercent:
          totalMinutes > 0 ? roundTo((minutes / totalMinutes) * 100, 1) : 0,
      };

      if (row["averageViewDuration"] !== undefined) {
        const avgSec = toNumber(row["averageViewDuration"]);
        item.averageViewDurationSeconds = avgSec;
        item.averageViewDurationFormatted = formatSecondsJa(avgSec);
      }
      if (row["likes"] !== undefined) {
        item.likes = toNumber(row["likes"]);
      }
      if (row["subscribersGained"] !== undefined) {
        const gained = toNumber(row["subscribersGained"]);
        item.subscribersGained = gained;
        if (row["subscribersLost"] !== undefined) {
          const lost = toNumber(row["subscribersLost"]);
          item.subscribersLost = lost;
          item.netSubscribers = gained - lost;
        }
      }

      return item;
    });

    return {
      breakdown: params.breakdown,
      period,
      videoId: normalizedVideoId,
      totalViews,
      totalEstimatedMinutesWatched: totalMinutes,
      items,
    };
  }

  private async fetchVideosMetadata(
    videoIds: string[],
    includeStatistics = false
  ): Promise<
    Map<
      string,
      {
        title: string;
        publishedAt: string | null;
        lifetimeStats?: { views: number; likes: number; comments: number };
      }
    >
  > {
    const result = new Map<
      string,
      {
        title: string;
        publishedAt: string | null;
        lifetimeStats?: { views: number; likes: number; comments: number };
      }
    >();

    if (videoIds.length === 0) return result;

    const url = new URL(`${YOUTUBE_DATA_API_BASE}/videos`);
    url.searchParams.set(
      "part",
      includeStatistics ? "snippet,statistics" : "snippet"
    );
    url.searchParams.set("id", videoIds.join(","));

    const data = await this.requestJson<{
      items?: Array<{
        id: string;
        snippet?: { title?: string; publishedAt?: string };
        statistics?: {
          viewCount?: string;
          likeCount?: string;
          commentCount?: string;
        };
      }>;
    }>(url.toString());

    for (const item of data.items ?? []) {
      result.set(item.id, {
        title: item.snippet?.title ?? "（タイトル不明）",
        publishedAt: item.snippet?.publishedAt ?? null,
        lifetimeStats: item.statistics
          ? {
              views: toNumber(item.statistics.viewCount),
              likes: toNumber(item.statistics.likeCount),
              comments: toNumber(item.statistics.commentCount),
            }
          : undefined,
      });
    }

    return result;
  }
}
