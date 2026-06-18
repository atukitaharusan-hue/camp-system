'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchPlans } from '@/lib/admin/fetchData';
import { fetchReservations } from '@/lib/admin/fetchReservations';
import { getPlanAvailabilityDays, getSiteAvailabilityForStay, type PlanAvailabilityDay } from '@/lib/bookingAvailability';
import type { AdminPlan } from '@/types/admin';
import type { Database } from '@/types/database';

type GuestReservationRow = Database['public']['Tables']['guest_reservations']['Row'];

type AvailabilityModalState = {
  plan: AdminPlan;
  date: string;
  cell: PlanAvailabilityDay;
  occupiedSpecifiedSites: string[];
  reservableSiteNumbers: string[];
};

function getCurrentMonthKey(baseDate = new Date()) {
  return `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthDates(monthKey: string) {
  const start = new Date(`${monthKey}-01T00:00:00`);
  const month = start.getMonth();
  const dates: string[] = [];
  const cursor = new Date(start);

  while (cursor.getMonth() === month) {
    dates.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`);
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function monthShift(monthKey: string, diff: number) {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1 + diff, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default function AdminReservationAvailabilityPage() {
  const router = useRouter();
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey());
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [cells, setCells] = useState<Awaited<ReturnType<typeof getPlanAvailabilityDays>>>([]);
  const [reservations, setReservations] = useState<GuestReservationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedCell, setSelectedCell] = useState<AvailabilityModalState | null>(null);

  useEffect(() => {
    fetchPlans().then(setPlans);
    fetchReservations().then((result) => setReservations(result.data));
  }, []);

  useEffect(() => {
    const dates = getMonthDates(monthKey);
    getPlanAvailabilityDays(dates)
      .then(setCells)
      .finally(() => setLoading(false));
  }, [monthKey]);

  const dates = useMemo(() => getMonthDates(monthKey), [monthKey]);

  const getOriginalSpecifiedSiteNumbers = useCallback((reservation: GuestReservationRow) => {
    const memo = reservation.special_requests ?? '';
    const match = memo.match(/^SELECTED_SITE_NUMBERS:\s*(.*)$/m);
    if (!match) {
      if (Array.isArray(reservation.selected_site_numbers)) {
        return reservation.selected_site_numbers.filter(
          (value): value is string => typeof value === 'string' && value.length > 0,
        );
      }
      return reservation.site_number ? [reservation.site_number] : [];
    }

    return match[1]
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }, []);

  const getReservationPlanId = useCallback((reservation: GuestReservationRow) => {
    if (reservation.plan_id) return reservation.plan_id;
    const memo = reservation.special_requests ?? '';
    const directMatch = memo.match(/PLAN_ID:\s*([A-Za-z0-9-]+)/);
    if (directMatch?.[1]) return directMatch[1];
    return null;
  }, []);

  const handleOpenAvailabilityDetail = useCallback(
    async (plan: AdminPlan, date: string, cell: PlanAvailabilityDay) => {
      if (cell.availableSites <= 0 || !cell.isBookable) return;

      setDetailLoading(true);
      const nextDate = new Date(`${date}T00:00:00`);
      nextDate.setDate(nextDate.getDate() + 1);
      const checkOutDate = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(
        nextDate.getDate(),
      ).padStart(2, '0')}`;

      const [siteAvailability] = await Promise.all([getSiteAvailabilityForStay(date, checkOutDate, plan.id)]);

      const occupiedSpecifiedSites = reservations
        .filter(
          (reservation) =>
            reservation.status !== 'cancelled' &&
            reservation.check_in_date <= date &&
            reservation.check_out_date > date &&
            getReservationPlanId(reservation) === plan.id,
        )
        .flatMap((reservation) => getOriginalSpecifiedSiteNumbers(reservation))
        .filter((siteNumber, index, array) => array.indexOf(siteNumber) === index)
        .sort((a, b) => a.localeCompare(b, 'ja'));

      const reservableSiteNumbers =
        cell.availableSites > 0
          ? siteAvailability
              .filter((site) => site.isAvailable)
              .map((site) => site.siteNumber)
              .sort((a, b) => a.localeCompare(b, 'ja'))
          : [];

      setSelectedCell({
        plan,
        date,
        cell,
        occupiedSpecifiedSites,
        reservableSiteNumbers,
      });
      setDetailLoading(false);
    },
    [getOriginalSpecifiedSiteNumbers, getReservationPlanId, reservations],
  );

  const handleStartReservation = useCallback(
    (mode: 'site' | 'unspecified', siteNumber?: string) => {
      if (!selectedCell) return;
      const nextDate = new Date(`${selectedCell.date}T00:00:00`);
      nextDate.setDate(nextDate.getDate() + 1);
      const checkOutDate = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(
        nextDate.getDate(),
      ).padStart(2, '0')}`;

      const params = new URLSearchParams({
        from: 'availability',
        planId: selectedCell.plan.id,
        checkInDate: selectedCell.date,
        checkOutDate,
      });

      if (mode === 'site' && siteNumber) {
        params.set('siteNumber', siteNumber);
      } else {
        params.set('siteMode', 'unspecified');
      }

      router.push(`/admin/reservations/new?${params.toString()}`);
    },
    [router, selectedCell],
  );

  return (
    <div className="max-w-7xl space-y-4">
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/reservations" className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700">
          予約一覧
        </Link>
        <Link href="/admin/reservations/availability" className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white">
          空き状況カレンダー
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setMonthKey((prev) => monthShift(prev, -1));
          }}
          className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
        >
          前月
        </button>
        <input
          type="month"
          value={monthKey}
          onChange={(event) => {
            setLoading(true);
            setMonthKey(event.target.value);
          }}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setMonthKey((prev) => monthShift(prev, 1));
          }}
          className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
        >
          次月
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">読み込み中...</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">プラン</th>
                {dates.map((date) => (
                  <th key={date} className="px-3 py-3 text-center text-xs font-medium text-gray-500">
                    {date.slice(8)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id} className="border-b border-gray-100 last:border-b-0">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">{plan.name}</td>
                  {dates.map((date) => {
                    const cell = cells.find((item) => item.planId === plan.id && item.date === date);
                    const styles =
                      cell?.mark === 'full'
                        ? 'bg-gray-200 text-gray-700'
                        : cell?.mark === 'triangle'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-700';
                    const mark = cell?.mark === 'full' ? '×' : cell?.mark === 'triangle' ? '△' : '○';

                    const canOpen = Boolean(cell && cell.isBookable && cell.availableSites > 0);

                    return (
                      <td key={date} className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (!cell) return;
                            void handleOpenAvailabilityDetail(plan, date, cell);
                          }}
                          disabled={!canOpen}
                          className={`mx-auto w-20 rounded-lg px-2 py-2 text-center ${styles} ${
                            canOpen ? 'cursor-pointer transition hover:scale-[1.02]' : 'cursor-default'
                          }`}
                        >
                          <p className="text-base font-bold">{mark}</p>
                          <p className="text-[11px]">残 {cell?.availableSites ?? 0}</p>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(selectedCell || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">空き状況の詳細</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedCell ? `${selectedCell.plan.name} / ${selectedCell.date}` : '読み込み中'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (detailLoading) return;
                  setSelectedCell(null);
                }}
                className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                閉じる
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              {detailLoading || !selectedCell ? (
                <div className="rounded-xl border border-gray-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  読み込み中...
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs text-slate-500">残り予約枠</p>
                      <p className="mt-1 text-xl font-bold text-slate-900">残 {selectedCell.cell.availableSites}枠</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs text-slate-500">予約可能上限</p>
                      <p className="mt-1 text-xl font-bold text-slate-900">{selectedCell.cell.capacity}枠</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs text-slate-500">現在の使用枠</p>
                      <p className="mt-1 text-xl font-bold text-slate-900">{selectedCell.cell.reservedSites}枠</p>
                    </div>
                  </div>

                  <section className="rounded-2xl border border-gray-200 p-4">
                    <h3 className="text-base font-semibold text-gray-900">指定で埋まっているサイト</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      指定予約で埋まっている場所です。指定なし予約は残り枠にだけ反映しています。
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedCell.occupiedSpecifiedSites.length > 0 ? (
                        selectedCell.occupiedSpecifiedSites.map((siteNumber) => (
                          <span
                            key={siteNumber}
                            className="rounded-full bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800"
                          >
                            {siteNumber}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">指定で埋まっているサイトはありません。</p>
                      )}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-gray-200 p-4">
                    <h3 className="text-base font-semibold text-gray-900">新たに予約を取れる場所</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      空いているサイト番号、または指定なしを選んでそのまま予約登録へ進めます。
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedCell.cell.availableSites > 0 && selectedCell.reservableSiteNumbers.length > 0 ? (
                        selectedCell.reservableSiteNumbers.map((siteNumber) => (
                          <button
                            key={siteNumber}
                            type="button"
                            onClick={() => handleStartReservation('site', siteNumber)}
                            className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
                          >
                            {siteNumber} で予約登録
                          </button>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">新たに指定予約を取れるサイトはありません。</p>
                      )}
                    </div>

                    <div className="mt-4 border-t border-gray-100 pt-4">
                      <button
                        type="button"
                        onClick={() => handleStartReservation('unspecified')}
                        disabled={selectedCell.cell.availableSites <= 0}
                        className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        指定なしで予約登録を行う
                      </button>
                    </div>
                  </section>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
