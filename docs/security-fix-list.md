# セキュリティ修正リスト（重大・高）

このリストは 2026-05-01 のセキュリティチェック結果をもとに、まず優先して直すべき「重大」と「高」の項目を実装順に整理したものです。

## 1. 重大: Supabase RLS の anon 書き込み権限を撤去する

- [x] RLSを締める前の前提確認: 公開予約フローが必要とする SELECT/INSERT と、管理画面の direct write 依存を整理する
- [x] 管理API化の土台として、Route Handler 用の管理者認証ガードを追加する
- [x] `app_settings` の保存処理を認証済み管理API経由に変更する
- [ ] `sites`, `plans`, `plan_sites`, `plan_options`, `options`, `events`, `app_settings`, `closed_dates`, `closed_date_ranges`, `site_closures`, `admin_members`, `admin_invites`, `import_jobs`, `import_job_rows`, `notification_logs`, `admin_action_logs` の anon INSERT/UPDATE/DELETE を禁止する
- [ ] 公開画面で必要な SELECT だけを明示的に残す
- [ ] 管理画面の保存・更新処理は認証済みサーバー API 経由、または Supabase Auth の role claim で許可する方針に寄せる
- [ ] `guest_reservations` は公開予約作成に必要な INSERT は残し、SELECT/UPDATE は用途別に絞る

対象候補:

- `supabase/migrations/20240104000000_guest_reservations.sql`
- `supabase/migrations/20240106000000_import_jobs.sql`
- `supabase/migrations/20240107000000_notification_and_action_logs.sql`
- `supabase/migrations/20240108000000_add_guest_breakdown.sql`
- `supabase/migrations/20240109000000_app_data_tables.sql`
- `supabase/migrations/20260420112000_plan_options_rls.sql`
- `src/app/api/admin/settings/route.ts`
- `src/lib/admin/requestAuth.ts`

完了条件:

- ブラウザに公開される `NEXT_PUBLIC_SUPABASE_ANON_KEY` だけでは管理系テーブルを書き換えられない
- 公開予約フロー、公開カレンダー、QR表示に必要な読み取りだけが動作する

## 2. 重大: `ADMIN_PASSWORD` 未設定時に管理機能を閉じる

- [x] `ADMIN_PASSWORD` 未設定時に `/admin` 配下をフリーアクセスにしない
- [x] QR閲覧用パスワード設定 API でも `ADMIN_PASSWORD` 未設定を管理者扱いしない
- [x] README の環境変数説明を `ADMIN_PASSWORD` 必須として更新する

対象候補:

- `src/proxy.ts`
- `src/app/api/qr-access/password/route.ts`
- `README.md`

完了条件:

- 本番相当の環境で `ADMIN_PASSWORD` が空なら管理画面・管理APIが 401/403/500 のいずれかで閉じる
- README のセットアップ通りに設定すれば管理ログインが使える

## 3. 重大: 管理者アカウントの平文パスワード保存をやめる

- [ ] `admin_account` 設定に `password` を保存しない
- [ ] アカウント画面でパスワードを表示しない
- [ ] 初回設定画面のパスワード欄を削除するか、保存が必要ならハッシュ化して用途を明確にする
- [ ] 既存の `app_settings.admin_account.password` を移行または無視する方針を決める

対象候補:

- `src/app/admin/setup/page.tsx`
- `src/app/admin/account/page.tsx`
- `src/lib/admin/fetchData.ts`
- `src/types/admin.ts`

完了条件:

- DB とクライアント状態に管理者パスワードの平文が残らない
- UI からパスワード表示機能が消えている

## 4. 高: `/api/import-reservations` に管理者認証を追加する

- [x] API 冒頭で `admin_session` を検証する
- [x] `ADMIN_PASSWORD` 未設定時は実行不可にする
- [x] 不正アクセス時は予約・取込ログ・操作ログを一切作らない

対象候補:

- `src/app/api/import-reservations/route.ts`
- `src/lib/admin/session.ts`

完了条件:

- 未ログイン状態で POST しても 401 になり、DB変更が発生しない
- 管理画面からのインポートは従来通り成功する

## 5. 高: Stripe PaymentIntent の金額をサーバー側で決定する

- [ ] クライアントから送られた `amount` をそのまま信用しない
- [ ] 予約内容または予約IDをもとにサーバー側で料金を再計算する
- [ ] 金額の整数・最小値・最大値を検証する
- [ ] PaymentIntent に reservation id などの metadata を付与する
- [ ] 必要に応じて idempotency key を導入する

対象候補:

- `src/app/api/create-payment-intent/route.ts`
- `src/components/StripePayment.tsx`
- `src/lib/pricing.ts`
- `src/lib/createReservation.ts`

完了条件:

- 任意の `amount` を POST しても不正な PaymentIntent を作れない
- 予約金額と Stripe 金額がサーバー側で一致する

## 6. 高: QRチェックイン API の更新対象を検証する

- [ ] QRセッションの対象予約と、更新対象 `reservationId` の関係をサーバー側で検証する
- [ ] 本人予約、または同一顧客の関連予約として確認できる場合のみ更新する
- [ ] 関係がない予約IDは 403 または 404 にする

対象候補:

- `src/app/api/qr-access/checkin/route.ts`
- `src/app/api/qr-access/reservations/route.ts`
- `src/lib/qrAccessServer.ts`

完了条件:

- あるQRで認証したあと、別顧客の予約IDを送ってもチェックイン状態に変更できない
- チェックイン画面からの正規操作は従来通り動く

## 7. 高: 管理セッショントークンを期限付き・失効可能にする

- [ ] セッション署名には `ADMIN_PASSWORD` そのものではなく `ADMIN_SESSION_SECRET` など別シークレットを使う
- [ ] トークン payload に `iat`, `exp`, `jti` を入れる
- [ ] 検証時に署名・期限を確認する
- [ ] ログイン失敗のレート制限を検討する

対象候補:

- `src/lib/admin/session.ts`
- `src/app/api/admin-auth/route.ts`
- `src/proxy.ts`

完了条件:

- Cookie の `maxAge` だけでなく、トークン自体にも期限がある
- パスワード変更やセッションシークレット変更で既存トークンを無効化できる

## 推奨作業順

1. RLS の anon 書き込み撤去
2. `ADMIN_PASSWORD` 未設定時の fail-closed 化
3. `/api/import-reservations` の認証追加
4. 管理者アカウント平文パスワード保存の廃止
5. QRチェックイン API の更新対象検証
6. 管理セッショントークン強化
7. Stripe PaymentIntent 金額検証

RLS は影響範囲が最も大きいため最優先です。ただし一度に大きく変えると管理画面が広く壊れやすいので、マイグレーション追加と管理API化を小さく分けて進めます。
