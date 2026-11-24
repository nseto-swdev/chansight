import { describe, expect, it, vi } from "vitest";
import { normalizeVideoId, YouTubeClient } from "../src/youtube/client.js";

describe("normalizeVideoId", () => {
  it("accepts raw video IDs and extracts IDs from YouTube URLs", () => {
    expect(normalizeVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(
      normalizeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s")
    ).toBe("dQw4w9WgXcQ");
    expect(normalizeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ"
    );
    expect(
      normalizeVideoId("https://www.youtube.com/shorts/abcDEF12345")
    ).toBe("abcDEF12345");
    expect(normalizeVideoId("https://www.youtube.com/live/liveID12345")).toBe(
      "liveID12345"
    );
  });

  it("rejects invalid video IDs", () => {
    expect(() => normalizeVideoId("   ")).toThrow();
    expect(() => normalizeVideoId("bad id with spaces")).toThrow();
  });
});

describe("YouTubeClient", () => {
  const fixedNow = () => new Date("2026-11-25T00:00:00Z");

  it("returns channel overview combining Data API channel info and Analytics summary", async () => {
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/youtube/v3/channels")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: "UC_TEST_VTUBER",
                snippet: {
                  title: "テストVTuber Ch.",
                  customUrl: "@testvtuber",
                  publishedAt: "2024-01-01T00:00:00Z",
                },
                statistics: {
                  subscriberCount: "12500",
                  hiddenSubscriberCount: false,
                  viewCount: "980000",
                  videoCount: "120",
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
            rows: [[45000, 180000, 240, 620, 45]],
          }),
          { status: 200 }
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new YouTubeClient({
      getAccessToken: async () => "ya29.test",
      fetchImpl: mockFetch,
      now: fixedNow,
    });

    const overview = await client.getChannelOverview();
    expect(overview.period).toEqual({
      startDate: "2026-10-28",
      endDate: "2026-11-25",
    });
    expect(overview.channel.title).toBe("テストVTuber Ch.");
    expect(overview.channel.subscriberCount).toBe(12500);
    expect(overview.metrics.views).toBe(45000);
    expect(overview.metrics.estimatedHoursWatched).toBe(3000);
    expect(overview.metrics.averageViewDurationFormatted).toBe("4分0秒");
    expect(overview.metrics.netSubscribers).toBe(575);
  });

  it("enriches top videos with title and publishedAt from YouTube Data API v3", async () => {
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("youtubeanalytics.googleapis.com/v2/reports")) {
        return new Response(
          JSON.stringify({
            columnHeaders: [
              { name: "video", columnType: "DIMENSION", dataType: "STRING" },
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
              {
                name: "subscribersGained",
                columnType: "METRIC",
                dataType: "INTEGER",
              },
            ],
            rows: [
              ["vid11111111", 12000, 60000, 300, 52.34, 800, 150],
              ["vid22222222", 8000, 24000, 180, 41.2, 420, 60],
            ],
          }),
          { status: 200 }
        );
      }
      if (url.includes("/youtube/v3/videos")) {
        expect(url).toContain("id=vid11111111%2Cvid22222222");
        return new Response(
          JSON.stringify({
            items: [
              {
                id: "vid11111111",
                snippet: {
                  title: "【歌枠】アニソン縛りで歌うよ！",
                  publishedAt: "2026-11-10T12:00:00Z",
                },
              },
            ],
          }),
          { status: 200 }
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new YouTubeClient({
      getAccessToken: async () => "ya29.test",
      fetchImpl: mockFetch,
      now: fixedNow,
    });

    const result = await client.getTopVideos({ maxResults: 5 });
    expect(result.videos).toHaveLength(2);
    expect(result.videos[0]?.title).toBe("【歌枠】アニソン縛りで歌うよ！");
    expect(result.videos[0]?.publishedAt).toBe("2026-11-10T12:00:00Z");
    expect(result.videos[1]?.title).toContain("タイトル取得不可");
  });

  it("translates traffic sources to Japanese labels with share percentages", async () => {
    const mockFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          columnHeaders: [
            {
              name: "insightTrafficSourceType",
              columnType: "DIMENSION",
              dataType: "STRING",
            },
            { name: "views", columnType: "METRIC", dataType: "INTEGER" },
            {
              name: "estimatedMinutesWatched",
              columnType: "METRIC",
              dataType: "INTEGER",
            },
          ],
          rows: [
            ["SUBSCRIBER", 600, 3000],
            ["RELATED_VIDEO", 300, 1500],
            ["YT_SEARCH", 100, 500],
          ],
        }),
        { status: 200 }
      )
    );

    const client = new YouTubeClient({
      getAccessToken: async () => "ya29.test",
      fetchImpl: mockFetch,
      now: fixedNow,
    });

    const result = await client.getTrafficSources();
    expect(result.totalViews).toBe(1000);
    expect(result.sources[0]?.sourceLabelJa).toContain("ブラウジング機能");
    expect(result.sources[0]?.viewSharePercent).toBe(60);
    expect(result.sources[1]?.sourceLabelJa).toBe("関連動画");
    expect(result.sources[2]?.sourceLabelJa).toBe("YouTube 検索");
  });

  it("retries once with forceRefreshAccessToken when YouTube returns 401", async () => {
    let callCount = 0;
    const mockFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      callCount++;
      const auth = (init?.headers as Record<string, string>)?.Authorization;
      if (callCount === 1) {
        expect(auth).toBe("Bearer stale-token");
        return new Response(JSON.stringify({ error: { message: "Invalid Credentials" } }), {
          status: 401,
        });
      }
      expect(auth).toBe("Bearer fresh-token");
      return new Response(
        JSON.stringify({
          columnHeaders: [
            { name: "insightTrafficSourceType", columnType: "DIMENSION", dataType: "STRING" },
            { name: "views", columnType: "METRIC", dataType: "INTEGER" },
            { name: "estimatedMinutesWatched", columnType: "METRIC", dataType: "INTEGER" },
          ],
          rows: [["SHORTS", 500, 250]],
        }),
        { status: 200 }
      );
    });

    const forceRefresh = vi.fn(async () => "fresh-token");
    const client = new YouTubeClient({
      getAccessToken: async () => "stale-token",
      forceRefreshAccessToken: forceRefresh,
      fetchImpl: mockFetch,
      now: fixedNow,
    });

    const result = await client.getTrafficSources();
    expect(forceRefresh).toHaveBeenCalledTimes(1);
    expect(result.sources[0]?.sourceType).toBe("SHORTS");
  });

  it("invokes globalThis.fetch with globalThis receiver (avoids Workers Illegal invocation)", async () => {
    const originalFetch = globalThis.fetch;
    let observedThis: unknown = null;
    globalThis.fetch = async function (this: unknown) {
      observedThis = this;
      return new Response(
        JSON.stringify({
          columnHeaders: [
            { name: "insightTrafficSourceType", columnType: "DIMENSION", dataType: "STRING" },
            { name: "views", columnType: "METRIC", dataType: "INTEGER" },
            { name: "estimatedMinutesWatched", columnType: "METRIC", dataType: "INTEGER" },
          ],
          rows: [],
        }),
        { status: 200 }
      );
    } as typeof fetch;

    try {
      const client = new YouTubeClient({
        getAccessToken: async () => "ya29.test",
        now: fixedNow,
      });
      await client.getTrafficSources();
      expect(observedThis).toBe(globalThis);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
