'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchPlans } from '@/lib/admin/fetchData';
import { getPlanAvailabilityDays, type PlanAvailabilityDay } from '@/lib/bookingAvailability';
import type { AdminPlan } from '@/types/admin';

function monthRange(baseDate: Date) {
  const firstDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const lastDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
  const dates: string[] = [];

  for (let cursor = new Date(firstDate); cursor <= lastDate; cursor.setDate(cursor.getDate() + 1)) {
    const yyyy = cursor.getFullYear();
    const mm = String(cursor.getMonth() + 1).padStart(2, '0');
    const dd = String(cursor.getDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
  }

  return dates;
}

function addOneDay(isoDate: string) {
  const current = new Date(`${isoDate}T00:00:00`);
  current.setDate(current.getDate() + 1);
  const yyyy = current.getFullYear();
  const mm = String(current.getMonth() + 1).padStart(2, '0');
  const dd = String(current.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function AvailabilityCategory() {
  const router = useRouter();
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string>('');
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [days, setDays] = useState<PlanAvailabilityDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadPlans() {
      const planRows = await fetchPlans();
      if (!mounted) return;
      setPlans(planRows);
      if (!activePlanId && planRows[0]) {
        setActivePlanId(planRows[0].id);
      }
    }

    void loadPlans();

    return () => {
      mounted = false;
    };
  }, [activePlanId]);

  useEffect(() => {
    let mounted = true;

    async function loadDays() {
      setLoading(true);
      const nextDays = await getPlanAvailabilityDays(monthRange(monthDate));
      if (!mounted) return;
      setDays(nextDays);
      setLoading(false);
    }

    void loadDays();

    return () => {
      mounted = false;
    };
  }, [monthDate]);

  const activePlan = plans.find((plan) => plan.id === activePlanId) ?? null;
  const activeDays = useMemo(
    () => days.filter((day) => day.planId === activePlanId),
    [days, activePlanId],
  );

  const monthLabel = `${monthDate.getFullYear()}年${monthDate.getMonth() + 1}月`;

  return (
    <section className="easy-mode-panel-card">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[1.05em] font-extrabold text-slate-900">空き状況</p>
            <p className="mt-2 text-[0.86em] leading-relaxed text-slate-600">
              空いている日を押すと、そのまま予約登録へ進めます。
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="min-h-14 rounded-2xl border-2 border-slate-200 bg-white px-4 text-[0.84em] font-bold text-slate-800"
              onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}
            >
              前の月
            </button>
            <button
              type="button"
              className="min-h-14 rounded-2xl border-2 border-slate-200 bg-white px-4 text-[0.84em] font-bold text-slate-800"
              onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}
            >
              次の月
            </button>
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2">
          {plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              className={`min-h-16 whitespace-nowrap rounded-2xl border-2 px-5 py-3 text-[0.84em] font-bold ${
                plan.id === activePlanId
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
              onClick={() => setActivePlanId(plan.id)}
            >
              {plan.name}
            </button>
          ))}
        </div>

        <p className="text-[0.92em] font-bold text-slate-800">{monthLabel}</p>

        {loading ? (
          <p className="rounded-2xl bg-slate-50 px-4 py-5 text-[0.84em] text-slate-500">読み込み中です。</p>
        ) : !activePlan ? (
          <p className="rounded-2xl bg-slate-50 px-4 py-5 text-[0.84em] text-slate-500">プランがありません。</p>
        ) : (
          <div className="space-y-3">
            {activeDays.map((day) => {
              const disabled = !day.isBookable || day.availableSites <= 0;
              const mark = day.mark === 'circle' ? '○' : day.mark === 'triangle' ? '△' : '×';

              return (
                <button
                  key={`${day.planId}-${day.date}`}
                  type="button"
                  disabled={disabled}
                  className={`flex w-full items-center justify-between rounded-3xl border p-5 text-left ${
                    disabled
                      ? 'border-slate-200 bg-slate-50 text-slate-400'
                      : 'border-blue-200 bg-blue-50 text-slate-900 hover:shadow-md'
                  }`}
                  onClick={() =>
                    router.push(
                      `/admin/reservations/new?from=easy-mode&planId=${day.planId}&checkInDate=${day.date}&checkOutDate=${addOneDay(
                        day.date,
                      )}&siteMode=unspecified`,
                    )
                  }
                >
                  <div>
                    <p className="text-[0.95em] font-extrabold">{day.date}</p>
                    <p className="mt-2 text-[0.82em] leading-relaxed">
                      残り {day.availableSites} 区画 / 上限 {activePlan.maxSiteCount} 区画
                    </p>
                  </div>
                  <span className="text-[1.3em] font-black">{mark}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
