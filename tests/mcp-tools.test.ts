import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { describe, expect, it, vi } from "vitest";
import { GoogleTokenInvalidGrantError } from "../src/auth/google-oauth.js";
import { createYouTubeMcpServer } from "../src/mcp/server.js";
import { YouTubeClient } from "../src/youtube/client.js";

async function callMcpJsonRpc(
  youtube: YouTubeClient,
  payload: Record<string, unknown>
): Promise<{ status: number; json: any }> {
  const server = createYouTubeMcpServer(youtube);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  try {
    const req = new Request("https://chansight.nseto.com/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify(payload),
    });

    const res = await transport.handleRequest(req);
    const json = await res.json();
    return { status: res.status, json };
  } finally {
    await transport.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
}

describe("MCP Server (Stateless Streamable HTTP)", () => {
  it("exposes serverInfo icons on initialize", async () => {
    const youtube = new YouTubeClient({
      getAccessToken: async () => "ya29.mock",
      fetchImpl: vi.fn(),
    });

    const { status, json } = await callMcpJsonRpc(youtube, {
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      },
    });

    expect(status).toBe(200);
    expect(json.result.serverInfo.name).toBe("ChanSight");
    expect(json.result.serverInfo.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "https://chansight.nseto.com/favicon.svg",
          mimeType: "image/svg+xml",
        }),
        expect.objectContaining({
          src: "https://chansight.nseto.com/icon-128.png",
          mimeType: "image/png",
        }),
      ])
    );
  });

  it("lists all 7 YouTube Analytics tools", async () => {
    const youtube = new YouTubeClient({
      getAccessToken: async () => "ya29.mock",
      fetchImpl: vi.fn(),
    });

    const { status, json } = await callMcpJsonRpc(youtube, {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    });

    expect(status).toBe(200);
    const toolNames = json.result.tools.map((t: { name: string }) => t.name);
    expect(toolNames).toEqual([
      "get_channel_overview",
      "get_top_videos",
      "get_traffic_sources",
      "get_video_analytics",
      "get_recent_videos",
      "get_daily_metrics",
      "get_audience_and_format_breakdown",
    ]);
  });

  it("executes get_video_analytics and returns Japanese summary + JSON metrics", async () => {
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/youtube/v3/videos")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: "abcDEF12345",
                snippet: {
                  title: "【初配信】はじめましてVTuberです！",
                  publishedAt: "2026-11-01T10:00:00Z",
                },
                statistics: {
                  viewCount: "50000",
                  likeCount: "3200",
                  commentCount: "410",
                },
              },
            ],
          }),
          { status: 200 }
        );
      }
      if (url.includes("youtubeanalytics.googleapis.com/v2/reports")) {
        return new Response(
          JSON.stringify({
            columnHeaders: [
              { name: "views", columnType: "METRIC", dataType: "INTEGER" },
              {
                name: "estimatedMinutesWatched",
                columnType: "METRIC",
                dataType: "INTEGER",
              },
              {
                name: "averageViewDuration",
                columnType: "METRIC",
                dataType: "INTEGER",
              },
              {
                name: "averageViewPercentage",
                columnType: "METRIC",
                dataType: "FLOAT",
              },
              { name: "likes", columnType: "METRIC", dataType: "INTEGER" },
              { name: "dislikes", columnType: "METRIC", dataType: "INTEGER" },
              { name: "comments", columnType: "METRIC", dataType: "INTEGER" },
              { name: "shares", columnType: "METRIC", dataType: "INTEGER" },
              {
                name: "subscribersGained",
                columnType: "METRIC",
                dataType: "INTEGER",
              },
              {
                name: "subscribersLost",
                columnType: "METRIC",
                dataType: "INTEGER",
              },
            ],
            rows: [[20000, 120000, 360, 61.5, 1800, 10, 220, 150, 400, 12]],
          }),
          { status: 200 }
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const youtube = new YouTubeClient({
      getAccessToken: async () => "ya29.mock",
      fetchImpl: mockFetch,
      now: () => new Date("2026-11-25T00:00:00Z"),
    });

    const { status, json } = await callMcpJsonRpc(youtube, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "get_video_analytics",
        arguments: {
          videoId: "https://youtu.be/abcDEF12345",
          startDate: "2026-11-01",
          endDate: "2026-11-25",
        },
      },
    });

    expect(status).toBe(200);
    expect(json.result.isError).toBeUndefined();
    const text: string = json.result.content[0].text;
    expect(text).toContain("【初配信】はじめましてVTuberです！");
    expect(text).toContain("61.5%");
    expect(text).toContain('"netSubscribers": 388');
  });

  it("returns clear Japanese re-auth message when Google refresh token has invalid_grant", async () => {
    const youtube = new YouTubeClient({
      getAccessToken: async () => {
        throw new GoogleTokenInvalidGrantError();
      },
      fetchImpl: vi.fn(),
    });

    const { status, json } = await callMcpJsonRpc(youtube, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "get_channel_overview",
        arguments: {},
      },
    });

    expect(status).toBe(200);
    expect(json.result.isError).toBe(true);
    const text: string = json.result.content[0].text;
    expect(text).toContain("Googleアカウントの再連携が必要です");
    expect(text).toContain("invalid_grant");
  });
});
