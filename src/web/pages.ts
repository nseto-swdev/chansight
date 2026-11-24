import {
  CONTACT_EMAIL,
  GOOGLE_SCOPE_LABELS_JA,
  MCP_ROUTE,
  SERVICE_DISPLAY_NAME,
  SERVICE_NAME,
} from "../config.js";

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderLayout(options: {
  title: string;
  description: string;
  body: string;
}): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(options.title)}</title>
  <meta name="description" content="${escapeHtml(options.description)}" />
  <style>
    :root {
      --bg: #f8f7fc;
      --surface: #ffffff;
      --surface-soft: #f2effb;
      --text: #1f1b2e;
      --muted: #5c5670;
      --border: #e6e0f5;
      --primary: #6d4aff;
      --primary-hover: #5835eb;
      --accent: #ff4f8b;
      --success: #0d9488;
      --danger: #dc2626;
      --danger-soft: #fef2f2;
      --radius: 16px;
      --shadow: 0 10px 30px rgba(45, 29, 98, 0.08);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Yu Gothic UI", "Meiryo", -apple-system, BlinkMacSystemFont, sans-serif;
      background:
        radial-gradient(circle at top right, rgba(255, 79, 139, 0.10), transparent 38%),
        radial-gradient(circle at top left, rgba(109, 74, 255, 0.12), transparent 42%),
        var(--bg);
      color: var(--text);
      line-height: 1.75;
    }
    a { color: var(--primary); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .container {
      max-width: 860px;
      margin: 0 auto;
      padding: 24px 20px 64px;
    }
    header.site-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 8px 0 28px;
      flex-wrap: wrap;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-weight: 800;
      font-size: 1.15rem;
      color: var(--text);
    }
    .brand:hover { text-decoration: none; }
    .brand-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 11px;
      background: linear-gradient(135deg, var(--primary), var(--accent));
      color: #fff;
      font-weight: 900;
      font-size: 1rem;
    }
    nav.header-nav {
      display: flex;
      gap: 18px;
      font-size: 0.92rem;
    }
    nav.header-nav a { color: var(--muted); }
    nav.header-nav a:hover { color: var(--primary); }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 28px;
      box-shadow: var(--shadow);
      margin-bottom: 22px;
    }
    .hero {
      text-align: center;
      padding: 40px 28px;
    }
    .pill {
      display: inline-block;
      padding: 4px 14px;
      border-radius: 999px;
      background: var(--surface-soft);
      color: var(--primary);
      font-size: 0.85rem;
      font-weight: 700;
      margin-bottom: 14px;
    }
    h1 {
      margin: 0 0 14px;
      font-size: clamp(1.6rem, 4vw, 2.25rem);
      line-height: 1.35;
      letter-spacing: -0.01em;
    }
    h2 {
      margin: 0 0 14px;
      font-size: 1.25rem;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    h3 {
      margin: 22px 0 8px;
      font-size: 1.05rem;
    }
    p { margin: 0 0 14px; }
    .lead {
      color: var(--muted);
      font-size: 1.02rem;
      max-width: 640px;
      margin: 0 auto 24px;
    }
    .endpoint-box {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      background: #1a162b;
      color: #f8f7fc;
      border-radius: 12px;
      padding: 14px 16px;
      margin: 18px auto 8px;
      max-width: 620px;
      flex-wrap: wrap;
    }
    .endpoint-url {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.96rem;
      word-break: break-all;
      text-align: left;
      flex: 1;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border: none;
      border-radius: 10px;
      padding: 11px 18px;
      font-size: 0.95rem;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.15s ease, transform 0.1s ease;
    }
    .btn-primary {
      background: var(--primary);
      color: #fff;
    }
    .btn-primary:hover {
      background: var(--primary-hover);
      text-decoration: none;
    }
    .btn-secondary {
      background: var(--surface-soft);
      color: var(--text);
    }
    .btn-secondary:hover {
      background: #e7e1fa;
      text-decoration: none;
    }
    .btn-copy {
      background: var(--accent);
      color: #fff;
      padding: 9px 14px;
      font-size: 0.88rem;
      white-space: nowrap;
    }
    .btn-copy:hover { background: #e63c78; }
    .copy-note {
      font-size: 0.85rem;
      color: var(--muted);
      margin-bottom: 0;
    }
    .steps {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-top: 16px;
    }
    .step {
      background: var(--surface-soft);
      border-radius: 14px;
      padding: 18px;
    }
    .step-num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--primary);
      color: #fff;
      font-weight: 800;
      font-size: 0.88rem;
      margin-bottom: 10px;
    }
    .step-title {
      font-weight: 700;
      margin-bottom: 6px;
      font-size: 1rem;
    }
    .step p {
      margin: 0;
      font-size: 0.92rem;
      color: var(--muted);
    }
    .prompt-list {
      display: grid;
      gap: 10px;
      margin-top: 12px;
    }
    .prompt-chip {
      background: #faf9ff;
      border: 1px dashed #cfc5f5;
      border-radius: 12px;
      padding: 12px 16px;
      font-size: 0.95rem;
    }
    .trust-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 14px;
      margin-top: 14px;
    }
    .trust-item {
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
    }
    .trust-item strong {
      display: block;
      margin-bottom: 4px;
      color: var(--success);
    }
    .trust-item p {
      margin: 0;
      font-size: 0.9rem;
      color: var(--muted);
    }
    .alert-danger {
      background: var(--danger-soft);
      border: 1px solid #fecaca;
      border-radius: 12px;
      padding: 18px;
      margin: 16px 0;
    }
    .alert-danger strong { color: var(--danger); }
    .scope-list {
      margin: 12px 0;
      padding-left: 20px;
    }
    .scope-list li { margin-bottom: 8px; }
    .actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 20px;
    }
    .legal h3 {
      border-left: 4px solid var(--primary);
      padding-left: 10px;
      margin-top: 26px;
    }
    .legal ul { padding-left: 22px; }
    .legal li { margin-bottom: 6px; }
    .callout {
      background: var(--surface-soft);
      border-radius: 12px;
      padding: 16px 18px;
      margin: 16px 0;
      font-size: 0.94rem;
    }
    footer.site-footer {
      text-align: center;
      color: var(--muted);
      font-size: 0.86rem;
      padding-top: 16px;
    }
    footer.site-footer a {
      color: var(--muted);
      margin: 0 10px;
    }
    @media (max-width: 600px) {
      .card, .hero { padding: 22px 18px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="site-header">
      <a class="brand" href="/">
        <span class="brand-badge">CS</span>
        <span>${escapeHtml(SERVICE_DISPLAY_NAME)}</span>
      </a>
      <nav class="header-nav">
        <a href="/">トップ</a>
        <a href="/privacy">プライバシーポリシー</a>
        <a href="/terms">利用規約</a>
      </nav>
    </header>
    ${bodyContent(options.body)}
    <footer class="site-footer">
      <div>
        <a href="/">ホーム</a>
        <a href="/privacy">プライバシーポリシー</a>
        <a href="/terms">利用規約</a>
      </div>
      <p style="margin-top: 8px;">&copy; ${new Date().getUTCFullYear()} ${escapeHtml(SERVICE_DISPLAY_NAME)}</p>
    </footer>
  </div>
</body>
</html>`;
}

function bodyContent(body: string): string {
  return `<main>${body}</main>`;
}

export function renderHomePage(publicBaseUrl: string): string {
  const normalizedBase = publicBaseUrl.replace(/\/+$/, "");
  const mcpUrl = `${normalizedBase}${MCP_ROUTE}`;

  return renderLayout({
    title: `${SERVICE_DISPLAY_NAME} | YouTubeアナリティクスをChatGPTやClaudeで分析`,
    description:
      "個人YouTuber・VTuber向け。ChatGPTやClaudeにURLを登録してGoogleログインするだけで、YouTubeアナリティクスを自然な日本語で分析できる無料MCPサーバー。",
    body: `
    <section class="card hero">
      <span class="pill">個人YouTuber・VTuber向け / 無料</span>
      <h1>YouTubeアナリティクスを、<br />いつものAIチャットにそのまま相談。</h1>
      <p class="lead">
        ${escapeHtml(SERVICE_DISPLAY_NAME)}は、あなたのYouTubeチャンネルの数字をChatGPTやClaudeから直接読み取れるようにする連携ツールです。
        難しい設定やCSVダウンロードは不要。普段どおり日本語で話しかけるだけで分析できます。
      </p>

      <div class="endpoint-box">
        <span class="endpoint-url" id="mcp-url">${escapeHtml(mcpUrl)}</span>
        <button type="button" class="btn btn-copy" id="copy-btn" onclick="copyMcpUrl()">URLをコピー</button>
      </div>
      <p class="copy-note" id="copy-status">ChatGPTやClaudeの「MCPサーバー（コネクタ / アプリ）」設定にこのURLを貼り付けて使います。</p>
    </section>

    <section class="card">
      <h2>かんたん3ステップで連携</h2>
      <div class="steps">
        <div class="step">
          <div class="step-num">1</div>
          <div class="step-title">エンドポイントURLをコピー</div>
          <p>上のピンク色のボタンから、<code>${escapeHtml(mcpUrl)}</code> をコピーします。</p>
        </div>
        <div class="step">
          <div class="step-num">2</div>
          <div class="step-title">ChatGPT / Claude に登録</div>
          <p>お使いのAIツールの設定（コネクタ / アプリ / カスタムMCP追加）を開き、コピーしたURLを貼り付けます。</p>
        </div>
        <div class="step">
          <div class="step-num">3</div>
          <div class="step-title">Googleでログインして許可</div>
          <p>自動で開くGoogle画面で自分のチャンネルを選び、閲覧権限を許可すれば準備完了！すぐに質問できます。</p>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>たとえば、こんな聞き方ができます</h2>
      <div class="prompt-list">
        <div class="prompt-chip">「過去28日間のチャンネル全体の再生回数と登録者数の増減をまとめて教えて！」</div>
        <div class="prompt-chip">「最近1ヶ月でよく見られた動画トップ5と、それぞれのタイトル・総再生時間を一覧にして」</div>
        <div class="prompt-chip">「視聴者さんはどこから来てくれてる？ブラウジング・関連動画・検索の割合を教えて」</div>
        <div class="prompt-chip">「動画ID〇〇の配信、平均視聴率や登録者増減はどうだった？次回に活かせるポイントも考えて」</div>
      </div>
    </section>

    <section class="card">
      <h2>安心して使えるしくみ</h2>
      <div class="trust-grid">
        <div class="trust-item">
          <strong>完全な「読み取り専用」</strong>
          <p>動画の削除・非公開化・タイトル変更・コメント投稿などの操作権限は一切リクエストしません。</p>
        </div>
        <div class="trust-item">
          <strong>AI学習には一切使いません</strong>
          <p>取得したアナリティクスデータはあなたの質問に答えるためだけに使い、AIモデルの学習や第三者提供は行いません。</p>
        </div>
        <div class="trust-item">
          <strong>いつでも連携解除OK</strong>
          <p>Googleアカウントのセキュリティ設定から、ワンクリックでいつでも連携を解除できます。</p>
        </div>
      </div>
    </section>

    <script>
      function copyMcpUrl() {
        var url = document.getElementById('mcp-url').textContent;
        var btn = document.getElementById('copy-btn');
        var status = document.getElementById('copy-status');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function() {
            btn.textContent = 'コピーしました！';
            status.textContent = 'コピー完了！ChatGPTやClaudeの設定画面に貼り付けてください。';
            setTimeout(function() { btn.textContent = 'URLをコピー'; }, 2500);
          });
        }
      }
    </script>
    `,
  });
}

export function renderPrivacyPolicyPage(): string {
  return renderLayout({
    title: `プライバシーポリシー | ${SERVICE_DISPLAY_NAME}`,
    description: `${SERVICE_DISPLAY_NAME}のプライバシーポリシーおよびGoogle API Services User Data Policy（Limited Use）への準拠について。`,
    body: `
    <article class="card legal">
      <h1>プライバシーポリシー</h1>
      <p>最終更新日: 2026年11月25日</p>
      <p>
        ${escapeHtml(SERVICE_DISPLAY_NAME)}（以下「本サービス」）は、利用者のプライバシーを尊重し、GoogleアカウントおよびYouTubeから取得するデータを適切かつ安全に取り扱います。
      </p>

      <h3>1. 取得する情報と利用するGoogle APIスコープ</h3>
      <p>本サービスは、利用者が明示的に認可した場合に限り、以下の読み取り専用スコープおよび識別子を使用します。</p>
      <ul>
        <li><code>https://www.googleapis.com/auth/yt-analytics.readonly</code>：チャンネルおよび動画の再生回数、総再生時間、平均視聴時間、平均視聴率、流入元、登録者増減などのYouTube Analytics指標の取得</li>
        <li><code>https://www.googleapis.com/auth/youtube.readonly</code>：チャンネル名、登録者数、動画タイトル、公開日などの基本情報の取得</li>
        <li><code>openid</code>：利用者を識別するためのGoogleアカウント固有ID（sub）の取得</li>
      </ul>
      <p>本サービスは動画の作成・編集・削除、チャンネル設定の変更などの書き込み権限は一切取得しません。</p>

      <h3>2. 情報の利用目的</h3>
      <p>取得した情報は、利用者が接続したMCP対応AIクライアント（ChatGPT、Claude等）からのリクエストに応答し、利用者自身のYouTubeチャンネル分析結果を表示するためのみに使用します。</p>

      <h3>3. Google API Services User Data Policy（Limited Use要件）への準拠</h3>
      <div class="callout">
        <p>
          本サービスによるGoogle APIから受け取った情報の使用および他のアプリへの転送は、限定的な使用（Limited Use）要件を含め、
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>
          に完全に準拠します。
        </p>
        <p style="margin-bottom: 0; font-size: 0.9rem;">
          ${escapeHtml(SERVICE_NAME)}'s use and transfer to any other app of information received from Google APIs will adhere to the
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>,
          including the Limited Use requirements.
        </p>
      </div>

      <h3>4. AIモデルの学習・トレーニングへの非利用</h3>
      <p>
        <strong>本サービスは、Google APIを通じて取得したユーザーデータおよびYouTubeアナリティクスデータを、汎用AIモデルや機械学習モデルの学習・ファインチューニング・改善の目的で一切使用しません。</strong>
        また、広告配信、データ販売、マーケティング目的での利用および第三者への提供も行いません。
      </p>

      <h3>5. データの保存・暗号化・保護</h3>
      <ul>
        <li>YouTube Analyticsから取得したレポートデータや動画情報は、レスポンス生成のために一時的にメモリ上で処理されるのみであり、本サービスのデータベース等には永続保存しません。</li>
        <li>APIアクセスの継続に必要なGoogle OAuthのリフレッシュトークンおよびアクセストークンは、AES-256-GCM方式で暗号化したうえでCloudflare KVに安全に保存されます。</li>
        <li>通信はすべてHTTPS（TLS）によって暗号化されます。</li>
      </ul>

      <h3>6. 連携解除およびデータ削除</h3>
      <p>
        利用者はいつでも、Googleアカウントの「サードパーティ製のアプリとサービス」管理ページ（<a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">https://myaccount.google.com/permissions</a>）から本サービスのアクセス権を取り消すことができます。
        アクセス権が取り消された場合、本サービスはただちにYouTubeデータへアクセスできなくなります。保存されたトークン情報の即時削除をご希望の場合は、下記お問い合わせ先までご連絡ください。
      </p>

      <h3>7. お問い合わせ</h3>
      <p>
        本ポリシーに関するご質問・削除依頼は、以下までご連絡ください。<br />
        連絡先: <a href="mailto:${escapeHtml(CONTACT_EMAIL)}">${escapeHtml(CONTACT_EMAIL)}</a>
      </p>
    </article>
    `,
  });
}

export function renderTermsPage(): string {
  return renderLayout({
    title: `利用規約 | ${SERVICE_DISPLAY_NAME}`,
    description: `${SERVICE_DISPLAY_NAME}の利用規約です。`,
    body: `
    <article class="card legal">
      <h1>利用規約</h1>
      <p>最終更新日: 2026年11月25日</p>
      <p>
        本規約は、${escapeHtml(SERVICE_DISPLAY_NAME)}（以下「本サービス」）の利用条件を定めるものです。利用者は本サービスを利用することにより、本規約に同意したものとみなされます。
      </p>

      <h3>1. サービス内容</h3>
      <p>
        本サービスは、利用者自身のGoogleアカウントと連携し、YouTube Analytics APIおよびYouTube Data API v3から取得した読み取り専用の分析データを、MCP（Model Context Protocol）経由で利用者のAIクライアントへ提供するサービスです。
      </p>

      <h3>2. YouTube利用規約・Googleプライバシーポリシーへの同意</h3>
      <p>
        本サービスはYouTube APIサービスを利用しています。本サービスの利用者は、
        <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">YouTube 利用規約</a>
        および
        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google プライバシーポリシー</a>
        にも同意するものとします。
      </p>

      <h3>3. 利用者の責任</h3>
      <ul>
        <li>利用者は、自身が正当な管理権限を有するYouTubeチャンネルのみを本サービスに連携するものとします。</li>
        <li>本サービスを接続するAIクライアント（ChatGPT、Claude等）側でのデータ取り扱いについては、各AIサービスの利用規約・プライバシー設定を利用者自身の責任で確認してください。</li>
      </ul>

      <h3>4. 禁止事項</h3>
      <ul>
        <li>本サービスまたはYouTube APIに対し過度な負荷をかける行為、自動化ツール等による不正な大量アクセス</li>
        <li>第三者のアカウントやトークンを不正に利用する行為</li>
        <li>本サービスのセキュリティ機構を回避・攻撃する行為</li>
        <li>法令または公序良俗に反する行為</li>
      </ul>

      <h3>5. 免責事項・サービスの変更および終了</h3>
      <ul>
        <li>本サービスは現状有姿（AS IS）で無償提供され、特定の目的への適合性、正確性、完全性、継続的な稼働を保証するものではありません。</li>
        <li>YouTube APIの仕様変更・利用上限（クォータ制限）・メンテナンス等により、予告なく機能の一部または全部が利用できなくなる場合があります。</li>
        <li>運営者は、本サービスの利用または利用不能により生じた損害について、法令上許容される範囲で一切の責任を負いません。</li>
      </ul>

      <h3>6. 規約の変更および準拠法</h3>
      <p>
        本規約は必要に応じて変更されることがあります。本規約の解釈および適用は日本法に準拠するものとします。
      </p>
    </article>
    `,
  });
}

export function renderAuthorizeConsentPage(options: {
  clientName: string;
  clientDomain?: string;
  redirectHost: string;
  redirectIsLoopback: boolean;
  actionUrl: string;
  handle: string;
}): string {
  const scopeItems = Object.values(GOOGLE_SCOPE_LABELS_JA)
    .map((label) => `<li>${escapeHtml(label)}</li>`)
    .join("");

  const clientOriginNote = options.clientDomain
    ? `提供元ドメイン: <strong>${escapeHtml(options.clientDomain)}</strong>`
    : "このAIクライアントは動的登録（DCR）により接続を要求しています。";

  const loopbackWarning = options.redirectIsLoopback
    ? `<div class="alert-danger"><strong>ローカルアプリへの送信:</strong> 認証情報はお使いのパソコン上のアプリ（<code>${escapeHtml(options.redirectHost)}</code>）へ送信されます。ご自身で接続操作を開始した場合のみ許可してください。</div>`
    : "";

  return renderLayout({
    title: `Googleアカウント連携の確認 | ${SERVICE_DISPLAY_NAME}`,
    description: `${SERVICE_DISPLAY_NAME}とAIクライアントの連携確認画面です。`,
    body: `
    <section class="card">
      <span class="pill">連携の確認</span>
      <h1>YouTubeアナリティクスの連携を許可しますか？</h1>
      <p>
        AIクライアント「<strong>${escapeHtml(options.clientName)}</strong>」が、${escapeHtml(SERVICE_DISPLAY_NAME)}を通じてあなたのYouTubeチャンネル分析データを読み取ることをリクエストしています。
      </p>
      <p style="font-size: 0.9rem; color: var(--muted);">
        ${clientOriginNote}<br />
        認証結果の送信先ホスト: <strong>${escapeHtml(options.redirectHost)}</strong>
      </p>
      ${loopbackWarning}

      <div class="callout">
        <strong>許可される内容（すべて読み取り専用です）</strong>
        <ul class="scope-list">${scopeItems}</ul>
        <p style="margin: 8px 0 0; font-size: 0.88rem; color: var(--muted);">
          ※ 次のGoogleログイン画面では、表示されるすべてのチェックボックスをオンにして「続行」を押してください。動画の編集や削除は一切できません。
        </p>
      </div>

      <form method="POST" action="${escapeHtml(options.actionUrl)}">
        <input type="hidden" name="handle" value="${escapeHtml(options.handle)}" />
        <div class="actions">
          <button type="submit" name="decision" value="approve" class="btn btn-primary">Googleアカウントでログインして許可する</button>
          <button type="submit" name="decision" value="deny" class="btn btn-secondary">キャンセル（拒否する）</button>
        </div>
      </form>
    </section>
    `,
  });
}

export function renderPartialGrantErrorPage(options: {
  missingScopes: string[];
  retryUrl: string;
}): string {
  const missingItems = options.missingScopes
    .map((scope) => {
      const label = GOOGLE_SCOPE_LABELS_JA[scope] ?? scope;
      return `<li><strong>${escapeHtml(label)}</strong><br /><small style="color: var(--muted);">${escapeHtml(scope)}</small></li>`;
    })
    .join("");

  return renderLayout({
    title: `必要な権限が許可されませんでした | ${SERVICE_DISPLAY_NAME}`,
    description: "YouTubeアナリティクス連携に必要な権限が不足しています。",
    body: `
    <section class="card">
      <span class="pill">あと一歩で完了です</span>
      <h1>必要なYouTubeの閲覧権限がチェックされていません</h1>
      <p>
        Googleの許可画面で一部のチェックが外れていたため、連携を完了できませんでした。
        ${escapeHtml(SERVICE_DISPLAY_NAME)}を使うには、以下の<strong>読み取り専用権限がすべて必要</strong>です。
      </p>

      <div class="alert-danger">
        <strong>許可されなかった権限:</strong>
        <ul class="scope-list">${missingItems}</ul>
      </div>

      <div class="callout">
        <strong>やり直しのコツ：</strong><br />
        下のボタンからもう一度Google画面を開き、表示されるチェックボックスを<strong>すべてオン</strong>にして「続行」を押してください。
      </div>

      <div class="actions">
        <a class="btn btn-primary" href="${escapeHtml(options.retryUrl)}">もう一度Googleログインをやり直す</a>
        <a class="btn btn-secondary" href="/">トップページへ戻る</a>
      </div>
    </section>
    `,
  });
}

export function renderOAuthErrorPage(options: {
  title: string;
  message: string;
  retryUrl?: string;
}): string {
  const retryButton = options.retryUrl
    ? `<a class="btn btn-primary" href="${escapeHtml(options.retryUrl)}">もう一度やり直す</a>`
    : "";

  return renderLayout({
    title: `${options.title} | ${SERVICE_DISPLAY_NAME}`,
    description: options.message,
    body: `
    <section class="card">
      <h1>${escapeHtml(options.title)}</h1>
      <div class="alert-danger">
        <p style="margin: 0;">${escapeHtml(options.message)}</p>
      </div>
      <div class="actions">
        ${retryButton}
        <a class="btn btn-secondary" href="/">トップページへ戻る</a>
      </div>
    </section>
    `,
  });
}
