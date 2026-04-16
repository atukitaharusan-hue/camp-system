# Campsite Booking SaaS

キャンプ場の予約〜チェックインまでを完全自動化するWebアプリケーションプラットフォーム。

## 🚀 概要

- **予約業務の自動化**: 人件費削減とUX向上を実現
- **LINE連携**: 外部リンクからの流入で予約導線を最適化
- **QRチェックイン**: 非接触チェックインで効率化
- **マルチキャンプ場対応**: 将来的な事業拡大を見据えた設計

## 🛠️ 技術スタック

- **Frontend**: Next.js 16 (App Router)
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **決済**: Stripe
- **通知**: LINE Messaging API (将来拡張)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
- **LINE LIFF**: LINEアプリ内Webアプリ

## 📋 機能一覧

### ユーザー機能
- ✅ 日付・人数選択
- ✅ サイト選択UI（座席指定）
- ✅ オプション選択（アーリーチェックイン等）
- ✅ 決済（Stripeクレジットカード、現地決済）
- ✅ 予約確認・通知
- ✅ LINE LIFFログイン
- ✅ QRコードチェックイン

### 管理者機能
- ✅ 予約一覧・管理
- ✅ サイト情報管理（水はけ・傾斜・景観）
- ✅ CSVエクスポート
- ✅ 手動予約追加
- ✅ 管理画面 (`/admin`)

### チェックイン機能
- ✅ QRコードチェックイン (`/checkin?id=xxx`)
- ✅ チェックイン時間記録
- ✅ ステータス更新

## 🗄️ データベース設計

詳細は [`docs/database-schema.md`](docs/database-schema.md) を参照してください。

### 主要テーブル
- `profiles` - ユーザー情報
- `campgrounds` - キャンプ場情報
- `sites` - サイト情報
- `reservations` - 予約情報
- `payments` - 決済情報
- `check_ins` - チェックイン情報

## 🚀 セットアップ

### 1. リポジトリのクローン
```bash
git clone <repository-url>
cd campsite-booking
```

### 2. 依存関係のインストール
```bash
npm install
```

### 3. 環境変数の設定
`.env.local` ファイルを作成し、以下の値を設定：

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# LINE LIFF
NEXT_PUBLIC_LINE_LIFF_ID=your_line_liff_id_here

# LINE Messaging API (将来拡張用)
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token_here
LINE_CHANNEL_SECRET=your_line_channel_secret_here
```

### 4. データベースのセットアップ
Supabaseプロジェクトを作成し、以下のSQLを実行：

```bash
supabase db push
```

または、マイグレーションファイルを実行：
```bash
supabase migration up
```

### 5. 開発サーバーの起動
```bash
npm run dev
```

ブラウザで `http://localhost:3000` にアクセス。

## 📱 LINE LIFF 設定

1. LINE Developers Console で LIFF アプリを作成
2. LIFF ID を取得して環境変数に設定
3. Endpoint URL を `https://your-domain.com` に設定
4. 必要に応じてスコープを設定（profile, openid）

## 💳 Stripe 設定

1. Stripe Dashboard でアカウント作成
2. APIキーを取得して環境変数に設定
3. Webhook エンドポイントを設定（決済完了通知用）

## 🔧 ビルド・デプロイ

### ビルド
```bash
npm run build
```

### プロダクションデプロイ
```bash
npm start
```

Vercel, Netlify 等のプラットフォームにデプロイ可能。

## 📂 プロジェクト構造

```
src/
├── app/                    # Next.js App Router
│   ├── admin/             # 管理画面
│   ├── api/               # API Routes
│   ├── booking/           # 予約フロー
│   │   ├── confirmation/  # 予約確認
│   │   ├── options/       # オプション選択
│   │   └── sites/         # サイト選択
│   ├── checkin/           # チェックイン
│   └── layout.tsx         # ルートレイアウト
├── components/            # 再利用コンポーネント
│   ├── QRCodeDisplay.tsx # QRコード表示
│   └── StripePayment.tsx # Stripe決済
├── lib/                   # ユーティリティ
│   ├── liff.ts           # LINE LIFF 設定
│   ├── stripe.ts         # Stripe 設定
│   └── supabase.ts       # Supabase 設定
└── types/                 # TypeScript 型定義
    └── database.ts        # DB型定義
```

## 🤝 貢献

1. Fork する
2. Feature ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. コミットする (`git commit -m 'Add amazing feature'`)
4. Push する (`git push origin feature/amazing-feature`)
5. Pull Request を作成

## 📄 ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。
- `check_ins` - チェックイン履歴

## 🚀 開発環境セットアップ

### 1. 依存関係インストール
```bash
npm install
```

### 2. 環境変数設定
```bash
cp .env.example .env.local
```

以下の環境変数を設定してください：
- Supabase URL & Keys
- Stripe Keys
- LINE API Keys (将来拡張用)

### 3. Supabase マイグレーション実行
```bash
# Supabase CLI がインストールされている場合
supabase db push
```

または、Supabase Dashboard からマイグレーションSQLを手動実行。

### 4. 開発サーバー起動
```bash
npm run dev
```

## 📁 プロジェクト構造

```
campsite-booking/
├── src/
│   ├── app/                 # Next.js App Router
│   ├── lib/                 # ユーティリティ・設定
│   │   ├── supabase.ts     # Supabase クライアント
│   │   └── stripe.ts       # Stripe 設定
│   └── types/              # TypeScript 型定義
├── supabase/
│   └── migrations/         # DB マイグレーション
├── docs/                   # ドキュメント
└── public/                 # 静的ファイル
```

## 🔒 セキュリティ

- Row Level Security (RLS) によるデータアクセス制御
- トランザクションによる同時予約競合防止
- 決済情報の安全な処理（Stripe）

## 📊 パフォーマンス

- 高速レスポンス（同時予約時の競合防止）
- 最適化されたデータベースインデックス
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
