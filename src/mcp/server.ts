import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  GoogleTokenInvalidGrantError,
  REAUTH_GUIDANCE_JA,
} from "../auth/google-oauth.js";
import { SERVICE_NAME } from "../config.js";
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

export function createYouTubeMcpServer(youtube: YouTubeClient): McpServer {
  const server = new McpServer({
    name: SERVICE_NAME,
    version: "1.0.0",
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

  return server;
}
