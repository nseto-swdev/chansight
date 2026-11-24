# Contributing to ChanSight

ChanSight への貢献を歓迎します！バグ報告、機能提案、ドキュメント改善、Pull Request など気軽にお寄せください。

## 開発環境のセットアップ

### 必要環境

- Node.js 20 以上（推奨: Node.js 24）
- npm

### ローカル起動

```bash
npm install
cp .dev.vars.example .dev.vars
```

`.dev.vars` にローカル検証用の値を設定したら、以下で起動できます。

```bash
npm run dev
```

## チェック項目（PR 作成前）

変更を行ったら、以下のチェックがすべて通ることを確認してください。

```bash
npm run typecheck
npm test
```

## 設計方針・制約

PR を作成する際は、本プロジェクトの以下の設計方針に沿うようにしてください。

1. **Cloudflare Workers 無料枠に収める**: Durable Objects は使用せず、完全ステートレスな Streamable HTTP 構成を維持します。
2. **YouTube API は読み取り専用**: 書き込み系スコープは追加しません。
3. **シークレットをコミットしない**: `.dev.vars` や実際の認証情報・トークンを含めないでください。
4. **テストを追加する**: 新しいツールやエラーハンドリングを追加する場合は `tests/` に Vitest の単体テストを追加してください。

## 構造について

ディレクトリ構成や OAuth / MCP の処理フローの詳細は [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) を参照してください。
