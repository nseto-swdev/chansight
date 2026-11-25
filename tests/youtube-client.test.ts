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

  it("lists recent videos via uploads playlist without calling search API and classifies live/short/video", async () => {
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).not.toContain("/youtube/v3/search");
      if (url.includes("/youtube/v3/channels")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: "UC_VTUBER",
                snippet: { title: "テストVTuber Ch." },
                contentDetails: {
                  relatedPlaylists: { uploads: "UU_VTUBER" },
                },
              },
            ],
          }),
          { status: 200 }
        );
      }
      if (url.includes("/youtube/v3/playlistItems")) {
        expect(url).toContain("playlistId=UU_VTUBER");
        return new Response(
          JSON.stringify({
            items: [
              {
                snippet: { title: "昨日の雑談配信" },
                contentDetails: {
                  videoId: "live0000001",
                  videoPublishedAt: "2026-11-24T12:00:00Z",
                },
              },
              {
                snippet: { title: "歌ってみたショート" },
                contentDetails: {
                  videoId: "shrt0000002",
                  videoPublishedAt: "2026-11-23T09:00:00Z",
                },
              },
              {
                snippet: { title: "ゲーム実況まとめ" },
                contentDetails: {
                  videoId: "vid00000003",
                  videoPublishedAt: "2026-11-20T09:00:00Z",
                },
              },
            ],
          }),
          { status: 200 }
        );
      }
      if (url.includes("/youtube/v3/videos")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: "live0000001",
                snippet: {
                  title: "昨日の雑談配信",
                  publishedAt: "2026-11-24T12:00:00Z",
                },
                statistics: { viewCount: "3400", likeCount: "410", commentCount: "55" },
                contentDetails: { duration: "PT1H30M15S" },
                liveStreamingDetails: { actualStartTime: "2026-11-24T12:00:00Z" },
              },
              {
                id: "shrt0000002",
                snippet: {
                  title: "歌ってみたショート",
                  publishedAt: "2026-11-23T09:00:00Z",
                },
                statistics: { viewCount: "15000", likeCount: "900", commentCount: "30" },
                contentDetails: { duration: "PT48S" },
              },
              {
                id: "vid00000003",
                snippet: {
                  title: "ゲーム実況まとめ",
                  publishedAt: "2026-11-20T09:00:00Z",
                },
                statistics: { viewCount: "5200", likeCount: "320", commentCount: "40" },
                contentDetails: { duration: "PT12M5S" },
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

    const result = await client.getRecentVideos({ maxResults: 3 });
    expect(result.channelTitle).toBe("テストVTuber Ch.");
    expect(result.videos).toHaveLength(3);
    expect(result.videos[0]?.contentKind).toBe("live");
    expect(result.videos[0]?.durationFormatted).toBe("1時間30分15秒");
    expect(result.videos[1]?.contentKind).toBe("short");
    expect(result.videos[2]?.contentKind).toBe("video");
  });

  it("normalizes monthly date ranges to YYYY-MM-01 for getDailyMetrics(granularity='month')", async () => {
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      expect(url.searchParams.get("dimensions")).toBe("month");
      expect(url.searchParams.get("startDate")).toBe("2026-09-01");
      expect(url.searchParams.get("endDate")).toBe("2026-11-01");
      return new Response(
        JSON.stringify({
          columnHeaders: [
            { name: "month", columnType: "DIMENSION", dataType: "STRING" },
            { name: "views", columnType: "METRIC", dataType: "INTEGER" },
            { name: "estimatedMinutesWatched", columnType: "METRIC", dataType: "INTEGER" },
            { name: "averageViewDuration", columnType: "METRIC", dataType: "INTEGER" },
            { name: "subscribersGained", columnType: "METRIC", dataType: "INTEGER" },
            { name: "subscribersLost", columnType: "METRIC", dataType: "INTEGER" },
          ],
          rows: [
            ["2026-09", 10000, 50000, 300, 120, 10],
            ["2026-10", 15000, 75000, 310, 200, 15],
            ["2026-11", 12000, 60000, 290, 180, 12],
          ],
        }),
        { status: 200 }
      );
    });

    const client = new YouTubeClient({
      getAccessToken: async () => "ya29.test",
      fetchImpl: mockFetch,
      now: fixedNow,
    });

    const result = await client.getDailyMetrics({
      granularity: "month",
      startDate: "2026-09-15",
      endDate: "2026-11-25",
    });

    expect(result.period).toEqual({
      startDate: "2026-09-01",
      endDate: "2026-11-01",
    });
    expect(result.series).toHaveLength(3);
    expect(result.totals.views).toBe(37000);
    expect(result.totals.netSubscribers).toBe(463);
  });

  it("handles audience & format breakdowns including contentType, demographics, and clamped searchTerms", async () => {
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const dim = url.searchParams.get("dimensions");

      if (dim === "creatorContentType") {
        return new Response(
          JSON.stringify({
            columnHeaders: [
              { name: "creatorContentType", columnType: "DIMENSION", dataType: "STRING" },
              { name: "views", columnType: "METRIC", dataType: "INTEGER" },
              { name: "estimatedMinutesWatched", columnType: "METRIC", dataType: "INTEGER" },
              { name: "averageViewDuration", columnType: "METRIC", dataType: "INTEGER" },
              { name: "likes", columnType: "METRIC", dataType: "INTEGER" },
              { name: "subscribersGained", columnType: "METRIC", dataType: "INTEGER" },
              { name: "subscribersLost", columnType: "METRIC", dataType: "INTEGER" },
            ],
            rows: [
              ["LIVE_STREAM", 8000, 120000, 900, 600, 90, 5],
              ["SHORTS", 20000, 10000, 30, 1200, 210, 15],
            ],
          }),
          { status: 200 }
        );
      }

      if (dim === "ageGroup,gender") {
        expect(url.searchParams.get("metrics")).toBe("viewerPercentage");
        return new Response(
          JSON.stringify({
            columnHeaders: [
              { name: "ageGroup", columnType: "DIMENSION", dataType: "STRING" },
              { name: "gender", columnType: "DIMENSION", dataType: "STRING" },
              { name: "viewerPercentage", columnType: "METRIC", dataType: "FLOAT" },
            ],
            rows: [
              ["age18-24", "male", 42.5],
              ["age25-34", "female", 28.3],
            ],
          }),
          { status: 200 }
        );
      }

      if (dim === "insightTrafficSourceDetail") {
        expect(url.searchParams.get("filters")).toContain(
          "insightTrafficSourceType==YT_SEARCH"
        );
        expect(url.searchParams.get("maxResults")).toBe("25");
        return new Response(
          JSON.stringify({
            columnHeaders: [
              { name: "insightTrafficSourceDetail", columnType: "DIMENSION", dataType: "STRING" },
              { name: "views", columnType: "METRIC", dataType: "INTEGER" },
              { name: "estimatedMinutesWatched", columnType: "METRIC", dataType: "INTEGER" },
            ],
            rows: [["vtuber 歌枠", 900, 4500]],
          }),
          { status: 200 }
        );
      }

      throw new Error(`Unexpected dimensions: ${dim}`);
    });

    const client = new YouTubeClient({
      getAccessToken: async () => "ya29.test",
      fetchImpl: mockFetch,
      now: fixedNow,
    });

    const contentRes = await client.getAudienceAndFormatBreakdown({
      breakdown: "contentType",
    });
    expect(contentRes.items[0]?.labelJa).toBe("ライブ配信");
    expect(contentRes.items[1]?.labelJa).toBe("ショート動画");
    expect(contentRes.items[1]?.netSubscribers).toBe(195);

    const demoRes = await client.getAudienceAndFormatBreakdown({
      breakdown: "demographics",
    });
    expect(demoRes.items[0]?.labelJa).toBe("男性・18〜24歳");
    expect(demoRes.items[0]?.viewerPercentage).toBe(42.5);

    const searchRes = await client.getAudienceAndFormatBreakdown({
      breakdown: "searchTerms",
      maxResults: 50,
    });
    expect(searchRes.items[0]?.key).toBe("vtuber 歌枠");
  });
});
