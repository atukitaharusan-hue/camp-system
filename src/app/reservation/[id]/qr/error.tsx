'use client';

import Link from 'next/link';

export default function ReservationQrError({
  reset,
}: {
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center justify-center bg-gray-50 px-4">
      <div className="w-full rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-semibold text-red-700">予約完了画面の表示でエラーが発生しました</p>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          予約自体は完了している可能性があります。再読み込みを試すか、うまく表示されない場合は管理画面またはマイページで予約状況をご確認ください。
        </p>
        <div className="mt-5 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            もう一度読み込む
          </button>
          <Link
            href="/"
            className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            TOPへ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
