# ChanSight（チャンサイト）

YouTuber・VTuber 向けの **薄くて無料枠に収まるマルチテナント型 YouTube Analytics Remote MCP サーバー**（Cloudflare Workers 上で動作）。

ChatGPT や Muse などの MCP 対応 AI クライアントにエンドポイント URL を登録して Google ログインするだけで、自分の YouTube チャンネルのアナリティクスを自然な日本語で分析できます。

- **公開サービス**: https://chansight.nseto.com/
- **MCP エンドポイント**: `https://chansight.nseto.com/mcp`

---

## 主な特徴

- **Cloudflare Workers 無料枠設計**: Durable Objects を使わず、単一 Worker + Cloudflare KV だけの完全ステートレス Streamable HTTP 構成。
- **OAuth 2.1 完全対応**: `@cloudflare/workers-oauth-provider` を利用し、PKCE (S256)・Dynamic Client Registration (RFC 7591)・Client ID Metadata Documents (CIMD)・RFC 9728 Protected Resource Metadata に対応（ChatGPT / Muse 両対応）。
- **安全なトークン管理**: Google のリフレッシュトークン・アクセストークンは AES-256-GCM で暗号化して KV に保存。アナリティクスデータはサーバーに永続保存しません。
- **YouTube API 特有のエラー対策**:
  - **部分許可（Partial Grant）検知**: 必須スコープが 1 つでも未許可ならエラー画面を表示し、そのまま再認可へ誘導。
  - **トークン失効（`invalid_grant`）対策**: パスワード変更や連携解除時に AI クライアントへ明確な日本語の再連携案内を返却。
- **日本語 UI & Google OAuth 審査対応**: トップページ（3 ステップ接続ガイド）、プライバシーポリシー（Limited Use 準拠・AI 学習非利用明記）、利用規約を Worker から直接配信。

---

## 提供する MCP ツール

| ツール名                            | 概要                                                                                                        | 主なパラメータ                                                   |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `get_channel_overview`              | 指定期間（デフォルト過去 28 日）のチャンネル全体サマリーと基本情報を取得                                    | `startDate?`, `endDate?`                                         |
| `get_top_videos`                    | 再生回数または総再生時間の上位動画一覧（タイトル・公開日を Data API v3 で補完）                             | `startDate?`, `endDate?`, `maxResults?`, `sortBy?`               |
| `get_traffic_sources`               | 流入元別（ブラウジング・関連動画・検索・ショート等）の再生回数・総再生時間・構成比                          | `startDate?`, `endDate?`, `maxResults?`                          |
| `get_video_analytics`               | 指定した動画 ID（または YouTube URL）の詳細指標（平均視聴率・高評価・登録者増減等）                         | `videoId`, `startDate?`, `endDate?`                              |
| `get_recent_videos`                 | 最新の動画・ライブ配信アーカイブ・ショート一覧を新しい順で取得（`search.list` 不使用）                      | `maxResults?`                                                    |
| `get_daily_metrics`                 | 指定期間の日別（`day`）または月別（`month`）の時系列推移を取得                                              | `startDate?`, `endDate?`, `granularity?`                         |
| `get_audience_and_format_breakdown` | 登録状態・コンテンツ種別（動画/ショート/ライブ）・年齢/性別・国・デバイス・検索ワード・外部流入元の分解分析 | `breakdown`, `startDate?`, `endDate?`, `videoId?`, `maxResults?` |

### 使用する Google API スコープ（読み取り専用）

- `https://www.googleapis.com/auth/yt-analytics.readonly`
- `https://www.googleapis.com/auth/youtube.readonly`
- `openid`

---

## フォルダ・ファイル構成

主要な構成は以下のとおりです。詳細な設計・シーケンス図は [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) を参照してください。

```text
src/
├── index.ts              # Worker エントリ（OAuthProvider 設定）
├── config.ts             # サービス定義・必須 Google スコープ
├── types.ts              # 環境変数・認証コンテキスト型
├── auth/                 # Google OAuth・暗号化トークンストア・Hono ルータ
├── crypto/               # AES-256-GCM トークン暗号化
├── mcp/                  # ステートレス Streamable HTTP ハンドラ & 7 ツール
├── web/                  # 日本語静的 HTML ページ（/, /privacy, /terms 等）& アイコン
└── youtube/              # YouTube Analytics / Data API クライアント & 日本語整形
tests/                    # Vitest 単体テスト
docs/ARCHITECTURE.md      # 詳細アーキテクチャ・ファイル構成ドキュメント
```

---

## ローカル開発 & テスト

### 必要環境

- Node.js 20 以上（推奨: Node.js 24）

### セットアップ

```bash
npm install
cp .dev.vars.example .dev.vars
```

`.dev.vars` に Google OAuth クライアント情報とローカル用の `TOKEN_ENCRYPTION_KEY` を設定します。

```bash
# 型チェック
npm run typecheck

# 単体テスト（Vitest）
npm test

# ローカル Worker 起動 (http://localhost:8787)
npm run dev
```

---

## セルフホスト（独自ドメインでのデプロイ手順）

ご自身の Cloudflare アカウントと GCP プロジェクトで運用したい場合は、以下の手順でデプロイできます。

1. **Google Cloud Console 設定**
   - **YouTube Analytics API** と **YouTube Data API v3** を有効化
   - OAuth 同意画面（外部）で読み取り専用スコープを設定
   - OAuth 2.0 クライアント ID（ウェブアプリケーション）を作成し、承認済みリダイレクト URI に `https://<あなたのドメイン>/callback` を登録
2. **Wrangler 設定の準備**
   - `wrangler.example.jsonc` を参考に `wrangler.jsonc` のドメイン・`PUBLIC_BASE_URL`・KV ID を設定
   - `src/config.ts` の `DEFAULT_PUBLIC_BASE_URL` / `CONTACT_EMAIL` を必要に応じて変更
3. **Cloudflare KV 作成 & シークレット登録**

   ```bash
   npx wrangler login
   npx wrangler kv namespace create OAUTH_KV
   npx wrangler kv namespace create OAUTH_KV --preview

   # 暗号化キー生成（64文字 hex）
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   npx wrangler secret put TOKEN_ENCRYPTION_KEY
   ```

4. **デプロイ**
   ```bash
   npm run deploy
   ```

---

## セキュリティ・プライバシー

- 脆弱性報告・セキュリティ設計: [SECURITY.md](SECURITY.md)
- コントリビューション方法: [CONTRIBUTING.md](CONTRIBUTING.md)
- ライセンス: [MIT License](LICENSE)
