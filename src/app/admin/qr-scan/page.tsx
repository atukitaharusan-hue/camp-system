'use client';

export default function AdminQrScanPage() {
  const publicCheckinLink =
    typeof window === 'undefined' ? '/checkin' : `${window.location.origin}/checkin`;

  return (
    <div className="max-w-4xl">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">QRコード読み取り</h1>
        <p className="mt-1 text-sm text-gray-500">
          チェックイン用 QR の読み取り導線を確認するための管理タブです。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-gray-900">スマホカメラでの導線</h2>
          <p className="mb-3 text-sm leading-6 text-gray-600">
            通常のスマホカメラで QR コードを読み取った場合は、公開側のチェックインページへ遷移させる想定です。
          </p>
          <code className="block rounded bg-gray-50 px-3 py-2 text-sm text-gray-700">{publicCheckinLink}</code>
          <a
            href={publicCheckinLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            チェックインページを開く
          </a>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-gray-900">運用メモ</h2>
          <ul className="space-y-2 text-sm leading-6 text-gray-600">
            <li>・予約ごとの QR は `/reservation/[id]/qr` から表示できます。</li>
            <li>・受付端末で読み取りたい場合は、このタブをショートカット化すると便利です。</li>
            <li>・実装を広げる場合はここにカメラ読み取り UI を追加できます。</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
