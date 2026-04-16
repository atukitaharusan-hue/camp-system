'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { calendarDisplaySettings, dummyPlans } from '@/data/adminDummyData';
import { fetchReservations } from '@/lib/admin/fetchReservations';
import {
  buildAvailabilityCells,
  getCurrentMonthKey,
  getMonthDates,
  getMonthLabel,
} from '@/lib/admin/availabilityCalendar';
import type { Database } from '@/types/database';

type ReservationRow = Database['public']['Tables']['guest_reservations']['Row'];

function monthShift(monthKey: string, diff: number) {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1 + diff, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default function AdminReservationAvailabilityPage() {
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey());
  const [warningRatio, setWarningRatio] = useState(calendarDisplaySettings.thresholds.warningRatio);

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
  }, [loadReservations]);

  const dates = useMemo(() => getMonthDates(monthKey), [monthKey]);
  const cells = useMemo(() => buildAvailabilityCells(reservations, dates), [reservations, dates]);

  const publicLink = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}${calendarDisplaySettings.publicBaseUrl}?month=${monthKey}`;
  }, [monthKey]);

  const copyLink = async () => {
    if (!publicLink) return;
    await navigator.clipboard.writeText(publicLink);
    alert('公開リンクをコピーしました。');
  };

  return (
    <div className="max-w-7xl">
      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/admin/reservations"
          className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
        >
          予約一覧
        </Link>
        <Link
          href="/admin/reservations/availability"
          className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white"
        >
          空き状況カレンダー
        </Link>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">空き状況カレンダー</h1>
          <p className="mt-1 text-sm text-gray-500">
            プランごとに、各日の空き状況を `〇 / △ / ×` で確認できます。
          </p>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
        <div className="grid gap-4 lg:grid-cols-[auto,1fr]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMonthKey((prev) => monthShift(prev, -1))}
              className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
            >
              前月
            </button>
            <input
              type="month"
              value={monthKey}
              onChange={(event) => setMonthKey(event.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => setMonthKey((prev) => monthShift(prev, 1))}
              className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
            >
              翌月
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr,auto]">
            <div>
              <label className="mb-1 block text-xs text-gray-500">公開リンク</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={publicLink}
                  className="w-full rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={copyLink}
                  className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  リンク発行
                </button>
              </div>
            </div>

            <div className="min-w-[240px] rounded-lg border border-gray-200 bg-gray-50 p-3">
              <label className="mb-1 block text-xs text-gray-500">△ に切り替える閾値</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0.1}
                  max={0.5}
                  step={0.05}
                  value={warningRatio}
                  onChange={(event) => setWarningRatio(Number(event.target.value))}
                  className="w-full"
                />
                <span className="min-w-12 text-sm font-medium text-gray-700">
                  {Math.round(warningRatio * 100)}%
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                30% 以下で `△`、0 で `×`、それ以上は `〇` になる想定です。
              </p>
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
          読み込み中...
        </div>
      )}
      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          空き状況の取得に失敗しました: {error}
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3 text-sm font-medium text-gray-700">
            {getMonthLabel(monthKey)}
          </div>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  プラン
                </th>
                {dates.map((date) => (
                  <th key={date} className="px-3 py-3 text-center text-xs font-medium text-gray-500">
                    {date.slice(8)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dummyPlans.map((plan) => (
                <tr key={plan.id} className="border-b border-gray-100 last:border-b-0">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">{plan.name}</td>
                  {dates.map((date) => {
                    const cell = cells.find((item) => item.planId === plan.id && item.date === date);
                    const available = cell?.available ?? plan.capacity;
                    const reserved = cell?.reserved ?? 0;
                    const ratio = plan.capacity > 0 ? available / plan.capacity : 0;
                    const mark = available <= 0 ? '×' : ratio <= warningRatio ? '△' : '〇';
                    const styles =
                      mark === '×'
                        ? 'bg-red-100 text-red-700'
                        : mark === '△'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-emerald-100 text-emerald-700';

                    return (
                      <td key={date} className="px-3 py-3 text-center">
                        <div className={`mx-auto w-20 rounded-lg px-2 py-2 ${styles}`}>
                          <p className="text-base font-bold">{mark}</p>
                          <p className="text-[11px] text-gray-600">空き {available}</p>
                          <p className="text-[11px] text-gray-500">予約 {reserved}</p>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
