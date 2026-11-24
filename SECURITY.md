# Security Policy

## Reporting a Vulnerability

ChanSight のセキュリティ上の脆弱性を発見された場合は、**公開 Issue には投稿せず**、以下のいずれかの方法で非公開にご連絡ください。

- メール: `support-chansight@nseto.com`
- GitHub の **Private Vulnerability Reporting**（有効化されている場合）

内容を確認のうえ、できるだけ速やかに対応方針をご連絡します。

## Security Architecture Highlights

本プロジェクトでは以下のセキュリティ対策を採用しています。

- **最小権限（Read-only）**: Google API スコープは `yt-analytics.readonly` / `youtube.readonly` / `openid` のみ要求し、動画の編集・削除等の書き込み権限は一切取得しません。
- **Partial Grant 検証**: Google OAuth コールバック時に付与スコープを検証し、必須スコープが欠けている場合はトークン発行を中止して再認可を促します。
- **トークン暗号化保存**: Google のリフレッシュトークンおよびアクセストークンは AES-256-GCM（ランダム 96-bit IV）で暗号化したうえで Cloudflare KV に保存します。
- **OAuth 2.1 & Confused Deputy 対策**: PKCE (S256) の強制、`__Host-` ブラウザバインディング Cookie、`X-Frame-Options: DENY` / `Content-Security-Policy: frame-ancestors 'none'` によるクリックジャッキング・CSRF 対策を実施しています。
- **分析データの非永続化**: YouTube Analytics API の取得結果はレスポンス生成時にメモリ上で処理するのみで、サーバー側に永続保存しません。
- **シークレット管理**: `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`、`TOKEN_ENCRYPTION_KEY` はリポジトリに含めず、Cloudflare Workers Secrets（ローカル開発時は `.gitignore` 対象の `.dev.vars`）で管理します。
