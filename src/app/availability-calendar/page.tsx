'use client';

import { useEffect, useMemo, useState } from 'react';
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

export default function PublicAvailabilityCalendarPage() {
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey());
  const [cells, setCells] = useState<Awaited<ReturnType<typeof getPlanAvailabilityDays>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryMonth = params.get('month');
    if (queryMonth && /^\d{4}-\d{2}$/.test(queryMonth)) {
      setMonthKey(queryMonth);
    }

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
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">空き状況カレンダー</h1>
          <p className="mt-2 text-sm text-slate-500">○ / △ / × の表示と残サイト数を同じ在庫ロジックで判定しています。</p>
        </header>

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">読み込み中...</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">プラン</th>
                  {dates.map((date) => (
                    <th key={date} className="px-3 py-3 text-center text-xs font-medium text-slate-500">{date.slice(8)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{plan.name}</td>
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
                          <div className={`mx-auto w-16 rounded-full px-2 py-2 text-xs font-semibold ${styles}`}>{mark}</div>
                          <div className="mt-1 text-[11px] text-slate-500">残 {cell?.availableSites ?? 0}</div>
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
    </main>
  );
}
