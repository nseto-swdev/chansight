import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  GoogleTokenInvalidGrantError,
  REAUTH_GUIDANCE_JA,
} from "../auth/google-oauth.js";
import {
  DEFAULT_PUBLIC_BASE_URL,
  SERVICE_DISPLAY_NAME,
  SERVICE_NAME,
} from "../config.js";
import { BUILD_VERSION } from "../generated/build-info.js";
import { YouTubeApiError, type YouTubeClient } from "../youtube/client.js";

const dateParamSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 形式で指定してください")
  .optional();

function formatToolError(error: unknown): CallToolResult {
  if (error instanceof GoogleTokenInvalidGrantError) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: [
            "【Googleアカウントの再連携が必要です】",
            error.message || REAUTH_GUIDANCE_JA,
            "",
            "エラーコード: invalid_grant",
          ].join("\n"),
        },
      ],
    };
  }

  if (error instanceof YouTubeApiError) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `【YouTubeデータ取得エラー】\n${error.message}`,
        },
      ],
    };
  }

  const message =
    error instanceof Error ? error.message : "不明なエラーが発生しました。";
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: `エラーが発生しました: ${message}`,
      },
    ],
  };
}

function formatJsonResult(summary: string, data: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: `${summary}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``,
      },
    ],
  };
}

export function createYouTubeMcpServer(
  youtube: YouTubeClient,
  publicBaseUrl: string = DEFAULT_PUBLIC_BASE_URL
): McpServer {
  const baseUrl = publicBaseUrl.replace(/\/+$/, "");
  const server = new McpServer({
    name: SERVICE_NAME,
    title: SERVICE_DISPLAY_NAME,
    version: BUILD_VERSION,
    websiteUrl: baseUrl,
    icons: [
      {
        src: `${baseUrl}/favicon.svg`,
        mimeType: "image/svg+xml",
        sizes: ["any"],
      },
      {
        src: `${baseUrl}/icon-128.png`,
        mimeType: "image/png",
        sizes: ["128x128"],
      },
    ],
  });

  server.registerTool(
    "get_channel_overview",
    {
      title: "チャンネル全体サマリー取得",
      description:
        "指定期間（デフォルトは過去28日間）のYouTubeチャンネル全体の再生回数、総再生時間、平均視聴時間、登録者増減とチャンネル基本情報を返します。",
      inputSchema: {
        startDate: dateParamSchema.describe(
          "集計開始日 (YYYY-MM-DD)。省略時は終了日の28日前。"
        ),
        endDate: dateParamSchema.describe(
          "集計終了日 (YYYY-MM-DD)。省略時は本日 (UTC)。"
        ),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ startDate, endDate }) => {
      try {
        const result = await youtube.getChannelOverview({ startDate, endDate });
        const summary = [
          `チャンネル: ${result.channel.title} (${result.period.startDate} 〜 ${result.period.endDate})`,
          `再生回数: ${result.metrics.views.toLocaleString("ja-JP")}回 / 総再生時間: ${result.metrics.watchTimeFormatted} / 平均視聴時間: ${result.metrics.averageViewDurationFormatted} / 登録者増減: ${result.metrics.netSubscribers >= 0 ? "+" : ""}${result.metrics.netSubscribers}人 (+${result.metrics.subscribersGained} / -${result.metrics.subscribersLost})`,
        ].join("\n");
        return formatJsonResult(summary, result);
      } catch (error) {
        return formatToolError(error);
      }
    }
  );

  server.registerTool(
    "get_top_videos",
    {
      title: "人気動画ランキング取得",
      description:
        "指定期間の再生回数または総再生時間の上位動画一覧を返します。動画タイトルと公開日も自動補完します。",
      inputSchema: {
        startDate: dateParamSchema.describe(
          "集計開始日 (YYYY-MM-DD)。省略時は終了日の28日前。"
        ),
        endDate: dateParamSchema.describe(
          "集計終了日 (YYYY-MM-DD)。省略時は本日 (UTC)。"
        ),
        maxResults: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("取得件数 (1〜50、デフォルト10)。"),
        sortBy: z
          .enum(["views", "watchTime"])
          .optional()
          .describe(
            "並び順: 'views' (再生回数順、デフォルト) または 'watchTime' (総再生時間順)。"
          ),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ startDate, endDate, maxResults, sortBy }) => {
      try {
        const result = await youtube.getTopVideos({
          startDate,
          endDate,
          maxResults,
          sortBy,
        });
        const sortLabel =
          result.sortBy === "watchTime" ? "総再生時間順" : "再生回数順";
        const summary =
          result.videos.length > 0
            ? `上位動画 ${result.videos.length}件（${result.period.startDate} 〜 ${result.period.endDate} / ${sortLabel}）`
            : `指定期間（${result.period.startDate} 〜 ${result.period.endDate}）に集計対象の動画データがありませんでした。`;
        return formatJsonResult(summary, result);
      } catch (error) {
        return formatToolError(error);
      }
    }
  );

  server.registerTool(
    "get_traffic_sources",
    {
      title: "流入元別アナリティクス取得",
      description:
        "指定期間の流入元別（ブラウジング機能、関連動画、YouTube検索、ショートフィードなど）の再生回数と総再生時間・構成比を返します。",
      inputSchema: {
        startDate: dateParamSchema.describe(
          "集計開始日 (YYYY-MM-DD)。省略時は終了日の28日前。"
        ),
        endDate: dateParamSchema.describe(
          "集計終了日 (YYYY-MM-DD)。省略時は本日 (UTC)。"
        ),
        maxResults: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("取得件数 (1〜50、デフォルト20)。"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ startDate, endDate, maxResults }) => {
      try {
        const result = await youtube.getTrafficSources({
          startDate,
          endDate,
          maxResults,
        });
        const summary =
          result.sources.length > 0
            ? `流入元別データ ${result.sources.length}件（${result.period.startDate} 〜 ${result.period.endDate} / 合計 ${result.totalViews.toLocaleString("ja-JP")}回再生）`
            : `指定期間（${result.period.startDate} 〜 ${result.period.endDate}）の流入元データはありませんでした。`;
        return formatJsonResult(summary, result);
      } catch (error) {
        return formatToolError(error);
      }
    }
  );

  server.registerTool(
    "get_video_analytics",
    {
      title: "動画別詳細アナリティクス取得",
      description:
        "指定した videoId（またはYouTube動画URL）の詳細指標（再生回数、総再生時間、平均視聴時間、平均視聴率、高評価数、コメント数、共有数、登録者増減など）を返します。",
      inputSchema: {
        videoId: z
          .string()
          .min(1)
          .describe("対象の動画ID（例: dQw4w9WgXcQ）またはYouTube動画URL。"),
        startDate: dateParamSchema.describe(
          "集計開始日 (YYYY-MM-DD)。省略時は終了日の28日前。"
        ),
        endDate: dateParamSchema.describe(
          "集計終了日 (YYYY-MM-DD)。省略時は本日 (UTC)。"
        ),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ videoId, startDate, endDate }) => {
      try {
        const result = await youtube.getVideoAnalytics({
          videoId,
          startDate,
          endDate,
        });
        const titleText = result.title ?? result.videoId;
        const summary = result.hasAnalyticsData
          ? `動画「${titleText}」のアナリティクス（${result.period.startDate} 〜 ${result.period.endDate}）: ${result.metrics.views.toLocaleString("ja-JP")}回再生 / 平均視聴時間 ${result.metrics.averageViewDurationFormatted} / 平均視聴率 ${result.metrics.averageViewPercentage}% / 高評価 ${result.metrics.likes} / 登録者増減 ${result.metrics.netSubscribers >= 0 ? "+" : ""}${result.metrics.netSubscribers}`
          : `動画「${titleText}」は指定期間（${result.period.startDate} 〜 ${result.period.endDate}）のアナリティクスデータがまだ集計されていません。`;
        return formatJsonResult(summary, result);
      } catch (error) {
        return formatToolError(error);
      }
    }
  );

  server.registerTool(
    "get_recent_videos",
    {
      title: "最新の動画・配信一覧取得",
      description:
        "チャンネルの最新アップロード動画・ライブ配信アーカイブ・ショート動画の一覧（新しい順）を返します。「昨日の配信どうだった？」のように最新動画の videoId を調べる用途に最適です。",
      inputSchema: {
        maxResults: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("取得件数 (1〜50、デフォルト10)。"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ maxResults }) => {
      try {
        const result = await youtube.getRecentVideos({ maxResults });
        const summary =
          result.videos.length > 0
            ? `チャンネル「${result.channelTitle}」の最新動画・配信 ${result.videos.length}件（新しい順）`
            : `チャンネル「${result.channelTitle}」に公開済みの動画が見つかりませんでした。`;
        return formatJsonResult(summary, result);
      } catch (error) {
        return formatToolError(error);
      }
    }
  );

  server.registerTool(
    "get_daily_metrics",
    {
      title: "日別・月別推移アナリティクス取得",
      description:
        "指定期間の日別（day）または月別（month）の再生回数・総再生時間・平均視聴時間・登録者増減の時系列推移を返します。伸びた日や月ごとのトレンド分析に使えます。",
      inputSchema: {
        startDate: dateParamSchema.describe(
          "集計開始日 (YYYY-MM-DD)。granularity='month' の場合は自動的に月初 (YYYY-MM-01) に揃えます。"
        ),
        endDate: dateParamSchema.describe(
          "集計終了日 (YYYY-MM-DD)。granularity='month' の場合は自動的に月初 (YYYY-MM-01) に揃えます。"
        ),
        granularity: z
          .enum(["day", "month"])
          .optional()
          .describe(
            "集計粒度: 'day'（日別、デフォルト・過去28日）または 'month'（月別・デフォルト過去6ヶ月）。"
          ),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ startDate, endDate, granularity }) => {
      try {
        const result = await youtube.getDailyMetrics({
          startDate,
          endDate,
          granularity,
        });
        const unitLabel = result.granularity === "month" ? "月別" : "日別";
        const summary =
          result.series.length > 0
            ? `${unitLabel}推移 ${result.series.length}件（${result.period.startDate} 〜 ${result.period.endDate} / 合計 ${result.totals.views.toLocaleString("ja-JP")}回再生 / 登録者増減 ${result.totals.netSubscribers >= 0 ? "+" : ""}${result.totals.netSubscribers}人）`
            : `指定期間（${result.period.startDate} 〜 ${result.period.endDate}）の${unitLabel}データがありませんでした。`;
        return formatJsonResult(summary, result);
      } catch (error) {
        return formatToolError(error);
      }
    }
  );

  server.registerTool(
    "get_audience_and_format_breakdown",
    {
      title: "視聴者属性・コンテンツ種別・流入詳細の分析",
      description:
        "視聴者や配信形式を軸にチャンネル（または特定動画）を分解分析します。subscribedStatus（登録済み/未登録）、contentType（通常動画/ショート/ライブ配信）、demographics（年齢層・性別）、country（国別）、device（スマホ/PC/TV等）、searchTerms（YouTube検索ワード）、externalUrls（X等の外部流入元）に対応しています。",
      inputSchema: {
        breakdown: z
          .enum([
            "subscribedStatus",
            "contentType",
            "demographics",
            "country",
            "device",
            "searchTerms",
            "externalUrls",
          ])
          .describe(
            "分析軸: subscribedStatus / contentType / demographics / country / device / searchTerms / externalUrls"
          ),
        startDate: dateParamSchema.describe(
          "集計開始日 (YYYY-MM-DD)。省略時は終了日の28日前。"
        ),
        endDate: dateParamSchema.describe(
          "集計終了日 (YYYY-MM-DD)。省略時は本日 (UTC)。"
        ),
        videoId: z
          .string()
          .min(1)
          .optional()
          .describe(
            "特定動画に絞り込む場合の動画IDまたはYouTube URL（省略時はチャンネル全体）。"
          ),
        maxResults: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe(
            "取得上限件数（country は最大50、searchTerms / externalUrls はAPI仕様上最大25）。"
          ),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ breakdown, startDate, endDate, videoId, maxResults }) => {
      try {
        const result = await youtube.getAudienceAndFormatBreakdown({
          breakdown,
          startDate,
          endDate,
          videoId,
          maxResults,
        });
        const labels: Record<typeof breakdown, string> = {
          subscribedStatus: "登録状態別（登録済み vs 未登録）",
          contentType: "コンテンツ種別（通常動画 / ショート / ライブ配信）",
          demographics: "視聴者の年齢層・性別",
          country: "国・地域別",
          device: "デバイス別",
          searchTerms: "YouTube検索ワード上位",
          externalUrls: "外部サイト・SNS流入元上位",
        };
        const scopeText = result.videoId ? `動画 ${result.videoId}` : "チャンネル全体";
        const summary =
          result.items.length > 0
            ? `${scopeText}の${labels[breakdown]}（${result.period.startDate} 〜 ${result.period.endDate}）: ${result.items.length}件`
            : `${scopeText}の指定期間（${result.period.startDate} 〜 ${result.period.endDate}）における${labels[breakdown]}データはありませんでした。`;
        return formatJsonResult(summary, result);
      } catch (error) {
        return formatToolError(error);
      }
    }
  );

  return server;
}
