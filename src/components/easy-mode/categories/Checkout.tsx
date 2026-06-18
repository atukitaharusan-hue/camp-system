'use client';

export default function CheckoutCategory({ selectedReservationId }: { selectedReservationId?: string | null }) {
  return (
    <section className="easy-mode-panel-card">
      <div className="space-y-4">
        <p className="text-[1.05em] font-extrabold text-slate-900">会計</p>
        <p className="text-[0.86em] leading-relaxed text-slate-700">
          会計の本実装は次の段階で追加します。今回はかんたんモードの導線だけを先に整えています。
        </p>
        {selectedReservationId ? (
          <p className="rounded-2xl bg-slate-100 px-4 py-3 text-[0.82em] font-semibold text-slate-700">
            選択中の予約: {selectedReservationId}
          </p>
        ) : (
          <p className="rounded-2xl bg-slate-100 px-4 py-3 text-[0.82em] font-semibold text-slate-700">
            今日のお客様や予約一覧から会計対象を選べるようにしてあります。
          </p>
        )}
      </div>
    </section>
  );
}
