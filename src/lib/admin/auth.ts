/**
 * 管理者判定ヘルパー
 *
 * 現在は環境変数 ADMIN_EMAILS による allowlist 方式。
 * 将来 admin_users テーブルに移行する場合は
 * isAdminEmail() の中身を DB ルックアップに差し替えるだけでよい。
 */

function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? ''
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * メールアドレスが管理者 allowlist に含まれるかを判定する。
 */
export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false
  const allowlist = getAdminEmails()
  if (allowlist.length === 0) return false
  return allowlist.includes(email.toLowerCase())
}
