'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { fetchPlans } from '@/lib/admin/fetchData';
import { getPlanAvailabilityDays } from '@/lib/bookingAvailability';
import type { AdminPlan } from '@/types/admin';

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
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey());
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [cells, setCells] = useState<Awaited<ReturnType<typeof getPlanAvailabilityDays>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlans().then(setPlans);
  }, []);

  useEffect(() => {
    const dates = getMonthDates(monthKey);
    setLoading(true);
    getPlanAvailabilityDays(dates)
      .then(setCells)
      .finally(() => setLoading(false));
  }, [monthKey]);

  const dates = useMemo(() => getMonthDates(monthKey), [monthKey]);

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
        <button type="button" onClick={() => setMonthKey((prev) => monthShift(prev, -1))} className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
          前月
        </button>
        <input type="month" value={monthKey} onChange={(event) => setMonthKey(event.target.value)} className="rounded border border-gray-300 px-3 py-2 text-sm" />
        <button type="button" onClick={() => setMonthKey((prev) => monthShift(prev, 1))} className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
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

                    return (
                      <td key={date} className="px-3 py-3 text-center">
                        <div className={`mx-auto w-20 rounded-lg px-2 py-2 ${styles}`}>
                          <p className="text-base font-bold">{mark}</p>
                          <p className="text-[11px]">残 {cell?.availableSites ?? 0}</p>
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
