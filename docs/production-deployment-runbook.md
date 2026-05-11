# 本番反映手順書

この手順書は、`security/admin-api-hardening` で実装したセキュリティ修正を本番環境へ反映するためのrunbookです。

対象作業:

- Vercel Production へのデプロイ
- Supabase Production project への migration 適用
- 本番反映後の動作確認

## 重要な前提

- 本番Supabaseの project ref はこの手順書では `<PROD_PROJECT_REF>` と表記する。
- Preview Supabase project ref `clbxowsktojkkyolxzsr` には本番反映作業ではリンクしない。
- 本番DBに対して `supabase db reset` は実行しない。
- 本番DBに対して原則 `--include-seed` は使わない。`seed.sql` は初期データ投入用であり、本番既存データを上書き・重複させる可能性がある。
- `NEXT_PUBLIC_ENABLE_DEV_LIFF_PROFILE=true` は本番に入れない。
- 本番反映後、マージ済みPRのブランチへ追加pushしない。追加修正が必要な場合は新しいブランチとPRで対応する。

## 0. 作業前チェック

作業前に、対象ブランチと差分を確認する。

```bash
git status --short --branch
git log --oneline main..HEAD
```

確認すること:

- [ ] 作業ブランチが `security/admin-api-hardening` である
- [ ] 不要な未コミット差分がない
- [ ] PR #1 が open である
- [ ] Preview環境で主要導線の検証が終わっている
- [ ] [RLS 変更後の手動テストチェックリスト](rls-manual-test-checklist.md) の公開予約フロー、管理ログイン、RLS確認が完了している

ローカルでも最低限の検証を行う。

```bash
npm install
npm run lint
npm run build
```

## 1. 本番環境変数の確認

Vercelの環境変数を確認する。

```bash
vercel env ls
```

Productionに必要な値:

- [ ] `NEXT_PUBLIC_SUPABASE_URL`: 本番Supabase URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`: 本番Supabase anon key
- [ ] `SUPABASE_SERVICE_ROLE_KEY`: 本番Supabase service_role JWT。`sb_secret_...` 形式ではなく、通常は `eyJ...` で始まるJWT形式を使う
- [ ] `ADMIN_PASSWORD`: 本番管理画面用の強いパスワード
- [ ] `ADMIN_SESSION_SECRET`: `ADMIN_PASSWORD` とは別のランダム文字列
- [ ] `NEXT_PUBLIC_LINE_LIFF_ID`: 本番LIFF ID
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: 本番または本番運用で使うStripe publishable key
- [ ] `STRIPE_SECRET_KEY`: 上記に対応するStripe secret key
- [ ] その他、既存本番運用で必要な環境変数

Productionに入れない値:

- [ ] `NEXT_PUBLIC_ENABLE_DEV_LIFF_PROFILE=true` がProductionに存在しない
- [ ] Preview用Supabase URL/keyがProductionに入っていない
- [ ] Preview用Stripe keyを本番決済に使っていない

`ADMIN_SESSION_SECRET` を新規作成する場合:

```bash
openssl rand -base64 32
vercel env add ADMIN_SESSION_SECRET production
```

既存のProduction値を変更した場合は、変更後に必ずProductionを再デプロイする。

## 2. Supabase本番projectの確認

Supabase CLIでログイン済みか確認する。

```bash
supabase projects list
```

本番project refが `<PROD_PROJECT_REF>` であることを確認してからリンクする。

```bash
supabase link --project-ref <PROD_PROJECT_REF>
```

リンク先が本番projectになっていることを確認する。

```bash
supabase migration list --linked
```

確認すること:

- [ ] Remote側のproject refが本番projectである
- [ ] Preview project `clbxowsktojkkyolxzsr` ではない
- [ ] 誤って別project `snhyuoljeaebjkkzfdte` などにリンクしていない
- [ ] 未適用migrationが今回追加したセキュリティ修正分である

## 3. デプロイ順序

推奨順序は以下。

1. Vercel Productionへ新コードをデプロイする
2. Supabase Productionへmigrationを適用する
3. 本番で動作確認する

理由:

- 今回のRLS強化は、管理画面の保存処理を認証済みサーバーAPI経由に寄せる変更とセットになっている。
- migrationを先に適用すると、古いProductionコードの管理画面保存処理がRLSで止まる可能性がある。
- 公開予約フローは止めない前提だが、作業中は管理画面でのマスタ編集や予約操作を控える。

## 4. Vercel Productionへデプロイ

GitHub連携でProductionデプロイする場合は、PRをmainへmergeする。

```bash
git push origin security/admin-api-hardening
```

GitHub上でPR #1を確認する。

- [ ] CIまたはVercel Previewが成功している
- [ ] base branchが `main` である
- [ ] head branchが `security/admin-api-hardening` である
- [ ] 差分に不要な秘密情報や `.env.local` が含まれていない

問題なければPRをmergeする。merge後、VercelのProduction deploymentが開始されることを確認する。

CLIで明示的にProductionデプロイする場合:

```bash
vercel --prod
```

デプロイ後に確認すること:

- [ ] VercelのProduction URLが `campsite-booking-lovat.vercel.app` または現在の本番ドメインである
- [ ] Production deploymentが成功している
- [ ] Build logに環境変数不足によるエラーがない

## 5. Supabase Productionへmigrationを適用

必ずdry-runから実行する。

```bash
supabase db push --dry-run --linked
```

確認すること:

- [ ] 接続先が本番projectである
- [ ] 適用予定migrationが想定通りである
- [ ] `seed.sql` は適用予定に含まれていない
- [ ] `db reset` や destructive な操作ではない

問題なければmigrationを適用する。

```bash
supabase db push --linked --yes
```

適用後にmigration状態を確認する。

```bash
supabase migration list --linked
```

確認すること:

- [ ] LocalとRemoteのmigration一覧が一致している
- [ ] `20260501090000_restrict_anon_admin_writes.sql` がRemoteに適用済み
- [ ] `20260501100000_remove_admin_account_plain_password.sql` がRemoteに適用済み

## 6. 本番反映後の確認

公開予約フローを最優先で確認する。

- [ ] 本番トップページを開ける
- [ ] 日付、プラン、サイト、人数を選択できる
- [ ] 予約者情報を入力して予約作成できる
- [ ] 予約完了後、予約詳細または予約番号が表示される
- [ ] 予約詳細ページを開ける
- [ ] QRコード表示ページを開ける
- [ ] 空き状況カレンダーを開ける

管理画面を確認する。

- [ ] `/admin` が未ログイン状態で保護されている
- [ ] `ADMIN_PASSWORD` でログインできる
- [ ] ダッシュボードが表示される
- [ ] サイト、プラン、オプションなどの管理画面を開ける
- [ ] 小さな編集を1件保存し、必要なら元に戻せる
- [ ] 取込履歴、操作ログ、通知ログが表示される

決済とQRを確認する。

- [ ] Stripe PaymentIntentの金額が予約金額と一致する
- [ ] クライアントから任意金額を送っても不正な金額で決済Intentが作られない
- [ ] 正規のQRでチェックインできる
- [ ] 別顧客の予約IDを使ったチェックインが拒否される

RLSを確認する。

```bash
NEXT_PUBLIC_SUPABASE_URL=<本番Supabase URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<本番anon key>

curl -i -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/sites" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"site_number":"RLS_TEST_SHOULD_FAIL","site_name":"RLS Test","capacity":1,"price_per_night":1}'
```

期待結果:

- [ ] `401`, `403`, またはRLS policy違反になり、`sites` に行が作成されない

`app_settings.admin_account` がanon keyで読めないことも確認する。

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/app_settings?key=eq.admin_account&select=key" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

期待結果:

- [ ] `[]` が返る

## 7. 問題が出た場合

まず影響範囲を切り分ける。

- 公開予約が失敗する: Vercel Productionログ、Supabase APIログ、予約作成APIのレスポンスを確認する
- 管理画面だけ失敗する: `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` のProduction設定を確認する
- LIFFが失敗する: `NEXT_PUBLIC_LINE_LIFF_ID` とLINE Developers側のEndpoint URLを確認する
- 決済が失敗する: Stripe keyの環境、PaymentIntent APIログ、予約金額計算を確認する
- RLSで失敗する: Supabase SQL Editorで対象table policyとAPI roleを確認する

Vercelだけ戻す場合:

- Vercel dashboardから直前の安定Production deploymentへRollbackする。
- CLIを使う場合はVercelの対象deploymentを確認してからrollbackする。

Supabase migrationを戻す場合:

- 事前にDB backupを取得している場合は、Supabase dashboardのバックアップ・リストア方針に従う。
- RLS policyの戻しは、逆向きmigrationを新規作成して適用する。
- 本番DBに対して `db reset` は使わない。

## 8. 作業完了条件

- [ ] Vercel Production deploymentが成功している
- [ ] Supabase Production migrationがLocal/Remote一致している
- [ ] 公開予約フローが本番で成功している
- [ ] 管理ログインと管理API経由の保存が本番で成功している
- [ ] RLSのanon書き込み拒否を確認できている
- [ ] `app_settings.admin_account.password` が本番で残っていない
- [ ] Preview用LIFFダミーがProductionで有効になっていない
- [ ] 問題がないことを確認したら、マージ済みブランチには追加pushしない
