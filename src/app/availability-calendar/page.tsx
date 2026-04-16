'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchPlans, fetchSites } from '@/lib/admin/fetchData';
import { fetchReservations } from '@/lib/admin/fetchReservations';
import { buildAvailabilityCells, getCurrentMonthKey, getMonthDates, getMonthLabel } from '@/lib/admin/availabilityCalendar';
import type { Database } from '@/types/database';
import type { AdminPlan, AdminSite } from '@/types/admin';

type ReservationRow = Database['public']['Tables']['guest_reservations']['Row'];

export default function PublicAvailabilityCalendarPage() {
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey());
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [sites, setSites] = useState<AdminSite[]>([]);

  const loadReservations = useCallback(async () => {
    const result = await fetchReservations();
    if (!result.error) setReservations(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryMonth = params.get('month');
    if (queryMonth && /^\d{4}-\d{2}$/.test(queryMonth)) setMonthKey(queryMonth);
    fetchPlans().then(setPlans);
    fetchSites().then(setSites);
    loadReservations();
  }, [loadReservations]);

  const dates = useMemo(() => getMonthDates(monthKey), [monthKey]);
  const cells = useMemo(() => buildAvailabilityCells(reservations, dates, plans, sites), [reservations, dates, plans, sites]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">空き状況カレンダー</h1>
          <p className="mt-2 text-sm text-slate-500">{getMonthLabel(monthKey)} のプラン別空き状況を 〇 / △ / × で確認できます。</p>
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
                      const styles = cell?.mark === '×' ? 'bg-red-100 text-red-700' : cell?.mark === '△' ? 'bg-yellow-100 text-yellow-800' : 'bg-emerald-100 text-emerald-700';
                      return (
                        <td key={date} className="px-3 py-3 text-center">
                          <div className={`mx-auto w-16 rounded-full px-2 py-2 text-xs font-semibold ${styles}`}>{cell?.mark ?? '〇'}</div>
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
