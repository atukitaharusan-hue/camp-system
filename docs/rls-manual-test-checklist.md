# RLS 変更後の手動テストチェックリスト

## 事前準備

- [ ] `.env.local` に `ADMIN_PASSWORD` が設定されている
- [ ] `.env.local` に `ADMIN_SESSION_SECRET` が設定されている
- [ ] `.env.local` に `SUPABASE_SERVICE_ROLE_KEY` が設定されている
- [ ] localhostでLINEなし予約を試す場合、`.env.local` に `NEXT_PUBLIC_ENABLE_DEV_LIFF_PROFILE=true` または `NEXT_PUBLIC_LINE_LIFF_ID=dummy_liff_id` が設定されている
- [ ] dev serverを停止してから再起動する

```bash
npm run dev
```

- [ ] ローカルSupabaseに未適用migrationを適用する

```bash
supabase migration up --local
```

`supabase migration up --local` が使えない環境では、`supabase/migrations/20260501090000_restrict_anon_admin_writes.sql` の内容をローカルSupabase StudioのSQL Editorで実行する。

## 公開予約フロー

既存ユーザーが予約できなくなっていないことを最優先で確認する。

- [ ] `https://localhost:3000/` を開く
- [ ] 日付・プラン・サイト・人数を選んで予約フローを進める
- [ ] 予約者情報を入力する
- [ ] 確認画面で予約を確定できる
- [ ] 予約完了後、予約番号または予約詳細が表示される
- [ ] 予約詳細ページを開ける
- [ ] QRコード表示ページを開ける
- [ ] 予約後、同じ日程の空き状況が減っている、または重複予約チェックが効いている
- [ ] 公開の空き状況カレンダーを開ける

## 管理ログイン

- [ ] `https://localhost:3000/admin` を開く
- [ ] 未ログインならログイン画面に遷移する
- [ ] `ADMIN_PASSWORD` でログインできる
- [ ] ダッシュボードが表示される
- [ ] 最近の取込履歴・操作ログ・通知ログが表示される

## 管理マスタ保存

各画面で大きな変更を入れる必要はない。1項目だけ軽く編集して保存し、戻せる内容で確認する。

- [ ] サイト管理で保存できる
- [ ] プラン管理で保存できる
- [ ] オプション管理で保存できる
- [ ] イベント管理で保存できる
- [ ] 販売ルール管理で保存できる
- [ ] 料金設定を保存できる
- [ ] ポリシー設定を保存できる
- [ ] QR画面設定を保存できる
- [ ] サイトマップ設定を保存できる
- [ ] QR閲覧用パスワード設定を保存できる

## 管理予約操作

- [ ] 管理画面から新規予約を作成できる
- [ ] 作成した予約を編集できる
- [ ] 予約詳細画面で通知履歴・操作履歴が表示される
- [ ] 予約一覧で料金再計算を実行できる
- [ ] 予約をキャンセルできる
- [ ] QRスキャン画面で対象予約をチェックイン済みに更新できる

## 取込機能

- [ ] 顧客データ一括登録画面を開ける
- [ ] テスト用の少数行を貼り付けて検証できる
- [ ] インポートを実行できる
- [ ] 取込履歴一覧に結果が表示される
- [ ] 取込履歴詳細で行ごとの成功・失敗が表示される

## RLS セキュリティ確認

以下はブラウザに公開されるanon keyだけでは管理系テーブルを書き換えられないことを確認するためのテスト。

```bash
source .env.local
curl -i -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/sites" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"site_number":"RLS_TEST_SHOULD_FAIL","site_name":"RLS Test","capacity":1,"price_per_night":1}'
```

期待結果:

- [ ] `401`, `403`, またはRLS policy違反のエラーになり、`sites` に行が作成されない

`app_settings.admin_account` がanon keyで読めないことも確認する。

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/app_settings?key=eq.admin_account&select=key" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

期待結果:

- [ ] `[]` が返る

公開に必要な設定は読めることを確認する。

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/app_settings?key=eq.pricing_settings&select=key" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

期待結果:

- [ ] `pricing_settings` が存在する場合はそのkeyが返る
- [ ] 未作成の場合は `[]` でもよい

## 問題が出た場合に控える情報

- [ ] どの画面で起きたか
- [ ] どの操作で起きたか
- [ ] 画面上のエラーメッセージ
- [ ] dev serverのターミナルログ
- [ ] Supabase Studioの該当テーブルに行が作成・更新されたか
