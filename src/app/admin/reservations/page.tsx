'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fetchPlans } from '@/lib/admin/fetchData';
import { fetchReservations } from '@/lib/admin/fetchReservations';
import { cancelReservation } from '@/lib/admin/updateReservation';
import { getSiteSelectionLabel } from '@/lib/siteSelectionLabel';
import { generateReceptionCode, getPaymentMethodLabel, getPaymentStatusLabel } from '@/types/reservation';
import type { Database } from '@/types/database';
import type { AdminPlan } from '@/types/admin';

type GuestReservationRow = Database['public']['Tables']['guest_reservations']['Row'];
type ReservationStatus = Database['public']['Enums']['reservation_status'];

const STATUS_OPTIONS: Array<{ value: ReservationStatus | 'all'; label: string }> = [
  { value: 'all', label: 'すべて' },
  { value: 'pending', label: '予約待ち' },
  { value: 'confirmed', label: '予約確定' },
  { value: 'checked_in', label: 'チェックイン済み' },
  { value: 'completed', label: '利用完了' },
  { value: 'cancelled', label: 'キャンセル' },
];

const STATUS_BADGES: Record<ReservationStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-emerald-100 text-emerald-700',
  checked_in: 'bg-blue-100 text-blue-700',
  completed: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-700',
};

function getSelectedSiteNumbers(value: Database['public']['Tables']['guest_reservations']['Row']['selected_site_numbers']) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function getGuestBreakdown(reservation: GuestReservationRow) {
  const adults = reservation.adults ?? Math.max((reservation.guests ?? 1) - (reservation.children ?? 0) - (reservation.infants ?? 0), 1);
  const children = reservation.children ?? 0;
  const infants = reservation.infants ?? 0;
  return { adults, children, infants };
}

export default function AdminReservationsPage() {
  const [reservations, setReservations] = useState<GuestReservationRow[]>([]);
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | 'all'>('all');
  const [keyword, setKeyword] = useState('');

  const loadReservations = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchReservations();
    if (result.error) {
      setError(result.error);
    } else {
      setReservations(result.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadReservations();
    fetchPlans().then(setPlans);
  }, [loadReservations]);

  const filteredReservations = useMemo(
    () =>
      reservations.filter((reservation) => {
        if (statusFilter !== 'all' && reservation.status !== statusFilter) return false;
        if (!keyword) return true;

        const lowerKeyword = keyword.toLowerCase();
        const searchable = [
          reservation.user_name,
          reservation.user_email,
          reservation.user_phone,
          reservation.site_number,
          reservation.site_name,
          reservation.plan_id,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchable.includes(lowerKeyword);
      }),
    [keyword, reservations, statusFilter],
  );

  const handleDelete = useCallback(
    async (reservationId: string) => {
      if (!window.confirm('この予約をキャンセル扱いにします。よろしいですか？')) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const result = await cancelReservation(reservationId, user?.email ?? 'admin');
      if (!result.success) {
        window.alert(result.error ?? 'キャンセルに失敗しました。');
        return;
      }

      await loadReservations();
    },
    [loadReservations],
  );

  const getPlanName = (planId: string | null) => plans.find((plan) => plan.id === planId)?.name ?? '未設定';

  return (
    <div className="max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">予約一覧</h1>
          <p className="mt-1 text-sm text-gray-500">
            予約状況の確認、編集、キャンセルができます。人数内訳とサイト指定状況もここで確認できます。
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/reservations/availability"
            className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
          >
            空き状況カレンダー
          </Link>
          <Link href="/admin/reservations/new" className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white">
            新規予約登録
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="grid gap-4 md:grid-cols-[220px,1fr]">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as ReservationStatus | 'all')}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="予約者名 / メール / 電話番号 / サイト番号で検索"
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {loading && <div className="rounded border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">読み込み中...</div>}
      {!loading && error && <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">受付コード</th>
                <th className="px-4 py-3">予約者</th>
                <th className="px-4 py-3">宿泊情報</th>
                <th className="px-4 py-3">プラン / サイト</th>
                <th className="px-4 py-3">支払い</th>
                <th className="px-4 py-3">状態</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredReservations.map((reservation) => {
                const { adults, children, infants } = getGuestBreakdown(reservation);
                const siteLabel = getSiteSelectionLabel({
                  siteNumber: reservation.site_number,
                  siteName: reservation.site_name,
                  selectedSiteNumbers: getSelectedSiteNumbers(reservation.selected_site_numbers),
                });

                return (
                  <tr key={reservation.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-blue-600">
                      <Link href={`/admin/reservations/${reservation.id}`}>{generateReceptionCode(reservation.id)}</Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{reservation.user_name}</div>
                      <div className="text-xs text-gray-500">{reservation.user_email || '-'}</div>
                      <div className="text-xs text-gray-500">{reservation.user_phone || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-xs leading-5 text-gray-600">
                      <div>
                        {reservation.check_in_date} - {reservation.check_out_date}
                      </div>
                      <div>
                        合計 {reservation.guests}名 / {reservation.reserved_site_count ?? 1}サイト
                      </div>
                    <div>大人(中学生以上) {adults} / 子ども {children} / 幼児 {infants}</div>
                    </td>
                    <td className="px-4 py-3 text-xs leading-5 text-gray-600">
                      <div>{getPlanName(reservation.plan_id)}</div>
                      <div>{siteLabel}</div>
                    </td>
                    <td className="px-4 py-3 text-xs leading-5 text-gray-600">
                      <div>{getPaymentMethodLabel(reservation.payment_method)}</div>
                      <div>{getPaymentStatusLabel(reservation.payment_status)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGES[reservation.status ?? 'pending']}`}>
                        {STATUS_OPTIONS.find((option) => option.value === reservation.status)?.label ?? reservation.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link
                          href={`/admin/reservations/${reservation.id}/edit`}
                          className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          編集
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(reservation.id)}
                          className="rounded border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                          キャンセル
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
