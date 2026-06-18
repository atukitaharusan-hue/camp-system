import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_NAME, verifySessionToken } from '@/lib/admin/session';

export default async function CheckinCounterEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ reservationId?: string; error?: string }>;
}) {
  const params = await searchParams;
  const reservationId = typeof params.reservationId === 'string' ? params.reservationId : '';
  const errorMessage = typeof params.error === 'string' ? params.error : '';

  if (!reservationId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-bold text-gray-900">チェックインQRを開けませんでした</h1>
          <p className="mt-3 text-sm leading-7 text-gray-600">
            予約情報が見つからないため、このQRは利用できません。
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            TOPへ戻る
          </Link>
        </div>
      </div>
    );
  }

  const nextPath = `/admin/checkin-session?reservationId=${encodeURIComponent(reservationId)}`;
  const sessionCookie = (await cookies()).get(COOKIE_NAME)?.value;

  if (sessionCookie && (await verifySessionToken(sessionCookie))) {
    redirect(nextPath);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-7 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <svg
            className="h-7 w-7 text-emerald-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <h1 className="mt-5 text-xl font-bold text-gray-900">管理人用チェックイン入口</h1>
        <p className="mt-3 text-sm leading-7 text-gray-600">
          お客様の予約情報を確認し、チェックイン・会計・キャンセル・予約内容の変更へ進むための管理人用画面です。
        </p>
        <p className="mt-2 text-sm leading-7 text-gray-500">
          お客様には操作してもらわず、管理人が読み取って対応してください。
        </p>

        <form action="/api/checkin-counter/auth" method="post" className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-left">
          <h2 className="text-base font-bold text-amber-950">管理人専用パスワード</h2>
          <p className="mt-2 text-sm leading-7 text-amber-900">
            管理画面の「チェックインQR画面の編集」で設定した管理人専用パスワードを入力してください。
          </p>
          <input type="hidden" name="reservationId" value={reservationId} />
          <label className="mt-4 block text-sm font-semibold text-gray-700">
            パスワード
            <input
              type="password"
              name="password"
              className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-base"
              autoComplete="current-password"
            />
          </label>
          {errorMessage ? <p className="mt-3 text-sm font-medium text-red-700">{errorMessage}</p> : null}
          <button
            type="submit"
            className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            チェックイン対応を始める
          </button>
        </form>

        <div className="mt-4 flex flex-col gap-3">
          <Link
            href="/mypage/reservations"
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            予約一覧へ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
