import { describe, expect, it } from "vitest";
import {
  renderHomePage,
  renderPartialGrantErrorPage,
  renderPrivacyPolicyPage,
  renderTermsPage,
} from "../src/web/pages.js";

describe("web pages", () => {
  it("renders landing page with MCP endpoint URL, OGP tags, and clean branding", () => {
    const html = renderHomePage("https://chansight.nseto.com");
    expect(html).toContain("https://chansight.nseto.com/mcp");
    expect(html).toContain("かんたん3ステップ");
    expect(html).toContain("/favicon.svg");
    expect(html).toContain("/favicon.ico");
    expect(html).toContain("/privacy");
    expect(html).toContain("/terms");
    expect(html).toContain(
      '<meta property="og:image" content="https://chansight.nseto.com/og-image.png" />'
    );
    expect(html).toContain(
      '<meta name="twitter:card" content="summary_large_image" />'
    );
    expect(html).toContain('<span class="brand-name">ChanSight</span>');
    expect(html).toContain('<span class="brand-sub">チャンサイト</span>');
    expect(html).not.toContain("ChanSight（チャンサイト）");
    expect(html).toMatch(/[0-9a-f]{7}-\d{8}-\d{4}Z/);
  });

  it("renders privacy policy with Google Limited Use and no AI training statement", () => {
    const html = renderPrivacyPolicyPage();
    expect(html).toContain("Google API Services User Data Policy");
    expect(html).toContain("Limited Use");
    expect(html).toContain("AIモデル");
    expect(html).toContain("学習");
    expect(html).toContain("AES-256-GCM");
    expect(html).toContain("support-chansight@nseto.com");
  });

  it("renders terms of service referencing YouTube Terms", () => {
    const html = renderTermsPage();
    expect(html).toContain("利用規約");
    expect(html).toContain("YouTube");
  });

  it("renders partial grant error page listing missing scopes and retry link", () => {
    const html = renderPartialGrantErrorPage({
      missingScopes: ["https://www.googleapis.com/auth/yt-analytics.readonly"],
      retryUrl: "/authorize?retry=1",
    });
    expect(html).toContain("yt-analytics.readonly");
    expect(html).toContain("もう一度Googleログインをやり直す");
    expect(html).toContain('href="/authorize?retry=1"');
  });
});
