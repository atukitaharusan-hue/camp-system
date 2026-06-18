'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReservationCard from '@/components/easy-mode/shared/ReservationCard';
import { fetchReservations } from '@/lib/admin/fetchReservations';
import { fetchPlans } from '@/lib/admin/fetchData';
import { todayIsoJst } from '@/lib/easyMode';
import type { Database } from '@/types/database';

type ReservationRow = Database['public']['Tables']['guest_reservations']['Row'];

function statusLabel(status: ReservationRow['status']) {
  switch (status) {
    case 'confirmed':
      return '予約確定';
    case 'checked_in':
      return 'チェックイン済み';
    case 'completed':
      return '完了';
    case 'cancelled':
      return 'キャンセル';
    case 'pending':
      return '未到着';
    default:
      return '予約中';
  }
}

export default function ReservationList({
  onGoToAccounting,
}: {
  onGoToAccounting: (reservationId: string) => void;
}) {
  const router = useRouter();
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [planNames, setPlanNames] = useState<Record<string, string>>({});
  const [selectedReservation, setSelectedReservation] = useState<ReservationRow | null>(null);
  const [filter, setFilter] = useState<'today' | 'tomorrow' | 'all'>('today');
  const [nameFilter, setNameFilter] = useState('');
  const [phoneFilter, setPhoneFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const [{ data }, plans] = await Promise.all([fetchReservations(), fetchPlans()]);
      if (!mounted) return;
      setReservations(data);
      setPlanNames(Object.fromEntries(plans.map((plan) => [plan.id, plan.name])));
      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredReservations = useMemo(() => {
    const targetDate = filter === 'today' ? todayIsoJst() : filter === 'tomorrow' ? todayIsoJst(1) : null;

    return reservations.filter((reservation) => {
      if (targetDate && reservation.check_in_date !== targetDate) return false;
      if (nameFilter && !(reservation.user_name ?? '').includes(nameFilter)) return false;
      if (phoneFilter && !(reservation.user_phone ?? '').includes(phoneFilter)) return false;
      return true;
    });
  }, [filter, nameFilter, phoneFilter, reservations]);

  const handleCancel = async (reservationId: string) => {
    const confirmed = window.confirm('この予約をキャンセルしますか。');
    if (!confirmed) return;

    const response = await fetch('/api/admin/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel', id: reservationId }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      window.alert(typeof payload.error === 'string' ? payload.error : 'キャンセルに失敗しました。');
      return;
    }

    setReservations((current) =>
      current.map((reservation) =>
        reservation.id === reservationId ? { ...reservation, status: 'cancelled' } : reservation,
      ),
    );
    setSelectedReservation(null);
  };

  return (
    <section className="easy-mode-panel-card">
      <div className="space-y-5">
        <div>
          <p className="text-[1.05em] font-extrabold text-slate-900">予約一覧</p>
          <p className="mt-2 text-[0.86em] leading-relaxed text-slate-600">
            今日・明日・名前・電話番号で絞り込みながら、大きなカードで確認できます。
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <FilterButton active={filter === 'today'} onClick={() => setFilter('today')} label="今日の予約" />
          <FilterButton active={filter === 'tomorrow'} onClick={() => setFilter('tomorrow')} label="明日の予約" />
          <FilterButton active={filter === 'all'} onClick={() => setFilter('all')} label="すべて" />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="min-h-16 rounded-2xl border-2 border-slate-200 px-4 text-[0.84em]"
            placeholder="名前で探す"
            value={nameFilter}
            onChange={(event) => setNameFilter(event.target.value)}
          />
          <input
            className="min-h-16 rounded-2xl border-2 border-slate-200 px-4 text-[0.84em]"
            placeholder="電話番号で探す"
            value={phoneFilter}
            onChange={(event) => setPhoneFilter(event.target.value)}
          />
        </div>

        {loading ? (
          <p className="rounded-2xl bg-slate-50 px-4 py-5 text-[0.84em] text-slate-500">読み込み中です。</p>
        ) : filteredReservations.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 px-4 py-5 text-[0.84em] text-slate-500">
            条件に合う予約がありません。
          </p>
        ) : (
          <div className="space-y-4">
            {filteredReservations.map((reservation) => (
              <ReservationCard
                key={reservation.id}
                title={`${reservation.user_name || '予約者'} 様`}
                statusLabel={statusLabel(reservation.status)}
                lines={[
                  `${reservation.check_in_date} 〜 ${reservation.check_out_date}`,
                  `人数: 大人${reservation.adults} / 子ども${reservation.children} / 幼児${reservation.infants}`,
                  `電話: ${reservation.user_phone ?? '未登録'}`,
                  `プラン: ${reservation.plan_id ? planNames[reservation.plan_id] ?? '未設定' : '未設定'}`,
                  `サイト: ${reservation.site_number ?? '指定なし'}`,
                ]}
                onClick={() => setSelectedReservation(reservation)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedReservation ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-3xl rounded-[32px] bg-white p-6 shadow-2xl">
            <div className="space-y-3">
              <p className="text-[1.05em] font-extrabold text-slate-900">{selectedReservation.user_name || '予約者情報'}</p>
              <p className="text-[0.86em] leading-relaxed text-slate-700">
                電話番号: {selectedReservation.user_phone ?? '未登録'}
              </p>
              <p className="text-[0.86em] leading-relaxed text-slate-700">
                メール: {selectedReservation.user_email ?? '未登録'}
              </p>
              <p className="text-[0.86em] leading-relaxed text-slate-700">
                住所: {selectedReservation.user_address ?? '未登録'}
              </p>
              <p className="text-[0.86em] leading-relaxed text-slate-700">
                日程: {selectedReservation.check_in_date} 〜 {selectedReservation.check_out_date}
              </p>
              <p className="text-[0.86em] leading-relaxed text-slate-700">
                プラン: {selectedReservation.plan_id ? planNames[selectedReservation.plan_id] ?? '未設定' : '未設定'}
              </p>
              <p className="text-[0.86em] leading-relaxed text-slate-700">
                サイト: {selectedReservation.site_number ?? '指定なし'}
              </p>
              {selectedReservation.special_requests ? (
                <p className="rounded-2xl bg-amber-50 px-4 py-4 text-[0.84em] leading-relaxed text-amber-900">
                  備考: {selectedReservation.special_requests}
                </p>
              ) : null}
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <button
                type="button"
                className="min-h-16 rounded-2xl bg-blue-600 px-5 py-4 text-[0.9em] font-bold text-white"
                onClick={() => router.push(`/admin/reservations/${selectedReservation.id}/edit`)}
              >
                編集する
              </button>
              <button
                type="button"
                className="min-h-16 rounded-2xl bg-amber-500 px-5 py-4 text-[0.9em] font-bold text-white"
                onClick={() => onGoToAccounting(selectedReservation.id)}
              >
                会計する
              </button>
              <button
                type="button"
                className="min-h-16 rounded-2xl bg-emerald-600 px-5 py-4 text-[0.9em] font-bold text-white"
                onClick={() => router.push('/admin/qr-scan')}
              >
                チェックインへ
              </button>
              <button
                type="button"
                className="min-h-16 rounded-2xl bg-red-100 px-5 py-4 text-[0.9em] font-bold text-red-700"
                onClick={() => void handleCancel(selectedReservation.id)}
              >
                キャンセルする
              </button>
              <button
                type="button"
                className="min-h-16 rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-4 text-[0.9em] font-bold text-slate-800 md:col-span-2"
                onClick={() => setSelectedReservation(null)}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function FilterButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`min-h-16 rounded-2xl border-2 px-4 py-3 text-[0.84em] font-bold ${
        active ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
