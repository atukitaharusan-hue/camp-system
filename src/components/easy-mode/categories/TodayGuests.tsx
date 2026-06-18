'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import SiteCard from '@/components/easy-mode/shared/SiteCard';
import { fetchReservations } from '@/lib/admin/fetchReservations';
import { fetchSites } from '@/lib/admin/fetchData';
import type { Database } from '@/types/database';

type ReservationRow = Database['public']['Tables']['guest_reservations']['Row'];

function todayIso() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getStatusLabel(status: ReservationRow['status']) {
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
      return '確認待ち';
    default:
      return '予約中';
  }
}

function getAccent(status: ReservationRow['status']) {
  switch (status) {
    case 'checked_in':
      return 'green' as const;
    case 'completed':
      return 'blue' as const;
    case 'cancelled':
      return 'red' as const;
    default:
      return 'amber' as const;
  }
}

export default function TodayGuests({
  onGoToAccounting,
}: {
  onGoToAccounting: (reservationId: string) => void;
}) {
  const router = useRouter();
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReservation, setSelectedReservation] = useState<ReservationRow | null>(null);
  const [busyAction, setBusyAction] = useState<'checkin' | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const [{ data }, sites] = await Promise.all([fetchReservations(), fetchSites()]);
      if (!mounted) return;

      const siteNameMap = new Map(sites.map((site) => [site.siteNumber, site.siteName ?? site.siteNumber]));
      const today = todayIso();
      const rows = data
        .filter((reservation) => reservation.check_in_date === today && reservation.status !== 'cancelled')
        .map((reservation) => ({
          ...reservation,
          site_name:
            reservation.site_name ??
            (reservation.site_number ? siteNameMap.get(reservation.site_number) ?? reservation.site_number : null),
        }));

      setReservations(rows);
      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const summaryText = useMemo(() => {
    if (loading) return '読み込み中です。';
    if (reservations.length === 0) return '今日チェックインのお客様はいません。';
    return `今日のお客様は ${reservations.length} 件です。`;
  }, [loading, reservations.length]);

  const handleCheckIn = async () => {
    if (!selectedReservation?.id) return;
    setBusyAction('checkin');

    try {
      const response = await fetch('/api/admin/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'checkIn', id: selectedReservation.id }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(typeof payload.error === 'string' ? payload.error : 'チェックイン更新に失敗しました。');
      }

      setReservations((current) =>
        current.map((reservation) =>
          reservation.id === selectedReservation.id
            ? { ...reservation, status: 'checked_in', checked_in_at: new Date().toISOString() }
            : reservation,
        ),
      );
      setSelectedReservation((current) =>
        current ? { ...current, status: 'checked_in', checked_in_at: new Date().toISOString() } : current,
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'チェックイン更新に失敗しました。');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <section className="easy-mode-panel-card">
      <div className="space-y-5">
        <div>
          <p className="text-[1.05em] font-extrabold text-slate-900">今日のお客様</p>
          <p className="mt-2 text-[0.86em] leading-relaxed text-slate-600">{summaryText}</p>
        </div>

        {loading ? (
          <p className="rounded-2xl bg-slate-50 px-4 py-5 text-[0.84em] text-slate-500">読み込み中です。</p>
        ) : reservations.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 px-4 py-5 text-[0.84em] text-slate-500">
            今日チェックインのお客様はまだいません。
          </p>
        ) : (
          <div className="space-y-4">
            {reservations.map((reservation) => (
              <SiteCard
                key={reservation.id}
                title={`${reservation.user_name || 'お名前未登録'} さん`}
                subtitle={`${reservation.site_name ?? reservation.site_number ?? '指定なし'} / ${reservation.check_in_date} から`}
                statusText={getStatusLabel(reservation.status)}
                accent={getAccent(reservation.status)}
                onClick={() => setSelectedReservation(reservation)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedReservation ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-2xl rounded-[32px] bg-white p-6 shadow-2xl">
            <div className="space-y-3">
              <p className="text-[1.05em] font-extrabold text-slate-900">{selectedReservation.user_name || 'お客様情報'}</p>
              <p className="text-[0.86em] leading-relaxed text-slate-700">
                サイト: {selectedReservation.site_name ?? selectedReservation.site_number ?? '指定なし'}
              </p>
              <p className="text-[0.86em] leading-relaxed text-slate-700">
                日程: {selectedReservation.check_in_date} 〜 {selectedReservation.check_out_date}
              </p>
              <p className="text-[0.86em] leading-relaxed text-slate-700">
                電話番号: {selectedReservation.user_phone ?? '未登録'}
              </p>
              <p className="text-[0.86em] leading-relaxed text-slate-700">
                状態: {getStatusLabel(selectedReservation.status)}
              </p>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <button
                type="button"
                className="min-h-16 rounded-2xl bg-emerald-600 px-5 py-4 text-[0.9em] font-bold text-white"
                onClick={() => void handleCheckIn()}
                disabled={busyAction === 'checkin'}
              >
                {busyAction === 'checkin' ? '更新中...' : 'チェックインする'}
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
                className="min-h-16 rounded-2xl border-2 border-slate-200 bg-white px-5 py-4 text-[0.9em] font-bold text-slate-800"
                onClick={() => router.push(`/admin/reservations/${selectedReservation.id}/edit`)}
              >
                予約を編集する
              </button>
              <button
                type="button"
                className="min-h-16 rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-4 text-[0.9em] font-bold text-slate-800"
                onClick={() => setSelectedReservation(null)}
              >
                戻る
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
