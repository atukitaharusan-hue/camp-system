# Campsite Booking SaaS

キャンプ場の予約〜チェックインまでを完全自動化するWebアプリケーションプラットフォーム。

## 概要

- **予約業務の自動化**: 人件費削減とUX向上を実現
- **LINE連携**: LIFF (LINE Front-end Framework) によるLINEアプリ内予約
- **QRチェックイン**: 非接触チェックインで効率化
- **マルチキャンプ場対応**: 将来的な事業拡大を見据えた設計

## 技術スタック

| カテゴリ | 技術 |
|---|---|
| Frontend | Next.js 16 (App Router / Turbopack) |
| Backend | Supabase (PostgreSQL + Auth + RLS) |
| 決済 | Stripe |
| LINE連携 | @line/liff, LIFF CLI |
| 言語 | TypeScript 5 |
| スタイリング | Tailwind CSS 4 |
| 状態管理 | Zustand |

## 前提条件

- **Node.js** v22 以上
- **npm** v10 以上
- **Docker** (Supabase ローカル環境に必要)
- **Supabase CLI** v2.60 以上
- **mkcert** (LIFF ローカル開発に必要)

```bash
# Supabase CLI のインストール
brew install supabase/tap/supabase

# mkcert のインストール
brew install mkcert
```

## ローカル開発環境セットアップ

### 1. リポジトリのクローンと依存関係インストール

```bash
git clone https://github.com/atukitaharusan-hue/camp-system.git
cd camp-system
npm install
```

### 2. 環境変数の設定

`.env.local` を作成：

```env
# Supabase (ローカル)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase start で表示される anon key>

# Stripe (テスト用ダミーまたは実際のテストキー)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_dummy
STRIPE_SECRET_KEY=sk_test_dummy

# LINE LIFF
NEXT_PUBLIC_LINE_LIFF_ID=<LIFF ID>

# Admin
ADMIN_EMAILS=your-email@example.com
```

### 3. Supabase ローカル環境の起動

Docker が起動していることを確認してから：

```bash
supabase start
```

初回起動時にマイグレーションとシードデータが自動適用されます。
起動後に表示される `anon key` を `.env.local` に設定してください。

### 4. データベース型の生成

```bash
npx supabase gen types typescript --local > src/types/database.ts
```

### 5. 開発サーバーの起動

```bash
npm run dev
```

`http://localhost:3000` でアクセスできます。

## LINE LIFF ローカル開発

LIFF 連携をローカルで開発する場合の手順です。

### 1. LIFF CLI のインストール

```bash
npm install -g @line/liff-cli
```

### 2. チャネルの追加

[LINE Developers Console](https://developers.line.biz/console/) でチャネルを作成済みであることを確認し：

```bash
liff-cli channel add <チャネルID>
# チャネルシークレットの入力を求められます

liff-cli channel use <チャネルID>
```

### 3. LIFF アプリの作成

```bash
liff-cli app create \
  --channel-id <チャネルID> \
  --name "Camp System Dev" \
  --endpoint-url https://localhost:9000 \
  --view-type full
```

表示された LIFF ID を `.env.local` の `NEXT_PUBLIC_LINE_LIFF_ID` に設定します。

### 4. HTTPS 証明書の作成

```bash
mkcert -install
mkcert localhost
```

プロジェクトルートに `localhost.pem` と `localhost-key.pem` が生成されます（`.gitignore` 済み）。

### 5. LIFF プロキシサーバーの起動

Next.js dev サーバーが `http://localhost:3000` で起動している状態で：

```bash
liff-cli serve \
  --liff-id <LIFF ID> \
  --url http://localhost:3000/
```

| URL | 用途 |
|---|---|
| `http://localhost:3000` | Next.js 開発サーバー |
| `https://localhost:9000` | LIFF HTTPS プロキシ |
| `https://liff.line.me/<LIFF ID>` | LINE アプリからのアクセス |

## ビルド

```bash
npm run build
npm start
```

## プロジェクト構造

```
camp-system/
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── admin/              # 管理画面
│   │   ├── api/                # API Routes
│   │   ├── booking/            # 予約フロー
│   │   ├── checkin/            # チェックイン
│   │   └── reservation/        # 予約詳細
│   ├── components/             # UIコンポーネント
│   │   ├── admin/              # 管理画面用
│   │   ├── booking/            # 予約フロー用
│   │   └── reservation/        # 予約詳細用
│   ├── lib/                    # ユーティリティ
│   │   ├── admin/              # 管理系データアクセス (fetchData.ts 等)
│   │   ├── liff.ts             # LINE LIFF 設定
│   │   ├── stripe.ts           # Stripe 設定
│   │   ├── supabase.ts         # Supabase クライアント
│   │   └── supabaseServer.ts   # Supabase サーバー用クライアント
│   ├── stores/                 # Zustand ストア
│   └── types/                  # TypeScript 型定義
│       └── database.ts         # Supabase 自動生成型
├── supabase/
│   ├── migrations/             # DB マイグレーション (8ファイル)
│   └── seed.sql                # 初期データ
├── docs/
│   └── database-schema.md      # DB設計ドキュメント
└── public/                     # 静的ファイル
```

## データベース

詳細は [docs/database-schema.md](docs/database-schema.md) を参照。

### 主要テーブル

| テーブル | 用途 |
|---|---|
| `profiles` | ユーザー情報 |
| `campgrounds` | キャンプ場情報 |
| `sites` | サイト情報 |
| `plans` / `plan_sites` | 料金プラン |
| `options` | オプション（レンタル・イベント等） |
| `reservations` / `guest_reservations` | 予約情報 |
| `payments` | 決済情報 |
| `check_ins` | チェックイン履歴 |
| `app_settings` | アプリ設定 |
| `notifications` / `action_logs` | 通知・操作ログ |

## セキュリティ

- Row Level Security (RLS) によるデータアクセス制御
- トランザクションによる同時予約競合防止
- 決済情報の安全な処理 (Stripe)
- 静的生成による高速なページロード

## 🚀 デプロイ

Vercel へのデプロイを推奨：

```bash
npm run build
vercel --prod
```

## 📝 開発ロードマップ

### Phase 1 (MVP) ✅
- 基本予約フロー
- 管理画面基盤
- DB設計・マイグレーション

### Phase 2 (基本機能)
- Stripe決済統合
- LINE通知システム
- QRチェックイン

### Phase 3 (拡張機能)
- 分析ダッシュボード
- 電話対応機能
- マルチキャンプ場管理

## 🤝 貢献

1. Fork して機能ブランチを作成
2. 変更をコミット
3. プッシュして Pull Request を作成

## 📄 ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。
