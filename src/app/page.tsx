'use client';

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { fetchEvents, fetchPlans } from '@/lib/admin/fetchData';
import {
  getPlanAvailabilityDays,
  getPlanAvailabilityForStay,
  getStayDates,
  type PlanAvailabilityDay,
} from '@/lib/bookingAvailability';
import { useBookingDraftStore } from '@/stores/bookingDraftStore';
import { useLiff } from '@/contexts/LiffContext';
import type { AdminEvent, AdminPlan } from '@/types/admin';

function calcNights(checkIn: string, checkOut: string) {
  const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
}

function todayISO() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toISODate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr: string, days: number) {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, count: number) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getCalendarGridDates(monthDate: Date) {
  const first = monthStart(monthDate);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function isSameMonth(date: Date, monthDate: Date) {
  return date.getFullYear() === monthDate.getFullYear() && date.getMonth() === monthDate.getMonth();
}

function isMonthBefore(a: Date, b: Date) {
  return a.getFullYear() < b.getFullYear() || (a.getFullYear() === b.getFullYear() && a.getMonth() < b.getMonth());
}

function isMonthAfter(a: Date, b: Date) {
  return a.getFullYear() > b.getFullYear() || (a.getFullYear() === b.getFullYear() && a.getMonth() > b.getMonth());
}

function getPlanBookableBounds(plan: AdminPlan | undefined, today: string) {
  const start = plan?.salesStartDate && plan.salesStartDate > today ? plan.salesStartDate : today;
  const fallbackEnd = addMonths(new Date(`${start}T00:00:00`), 12);
  const end = plan?.salesEndDate ?? toISODate(fallbackEnd);
  return { start, end };
}

function isEventActiveOnDate(event: AdminEvent, date: string) {
  const start = event.startAt.slice(0, 10);
  const end = event.endAt.slice(0, 10);
  return start <= date && end >= date;
}

function getDisabledReason({
  checkIn,
  checkOut,
  nights,
}: {
  checkIn: string | null;
  checkOut: string | null;
  nights: number;
}) {
  if (!checkIn) return 'チェックイン日を選ぶと次へ進めます。';
  if (!checkOut) return 'チェックアウト日を選ぶと次へ進めます。';
  if (nights <= 0) return 'チェックアウト日はチェックイン日の後の日付を選んでください。';
  return '';
}

export default function Home() {
  const router = useRouter();
  const { stay, setStay, setLineProfile } = useBookingDraftStore();
  const { isReady, profile } = useLiff();
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [selectedCalendarPlanId, setSelectedCalendarPlanId] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => monthStart(new Date()));
  const [availabilityDays, setAvailabilityDays] = useState<PlanAvailabilityDay[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [availabilityMessage, setAvailabilityMessage] = useState('');

  useEffect(() => {
    if (isReady && profile) {
      setLineProfile({
        userId: profile.userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl ?? null,
      });
    }
  }, [isReady, profile, setLineProfile]);

  useEffect(() => {
    fetchEvents().then(setEvents);
    fetchPlans().then((items) => {
      const publishedPlans = items.filter((plan) => plan.isPublished);
      setPlans(publishedPlans);
      setSelectedCalendarPlanId((current) => current || publishedPlans[0]?.id || '');
    });
  }, []);

  useEffect(() => {
    const monthDates = getCalendarGridDates(calendarMonth).map(toISODate);
    let active = true;
    setCalendarLoading(true);

    getPlanAvailabilityDays(monthDates)
      .then((items) => {
        if (!active) return;
        setAvailabilityDays(items);
      })
      .catch(() => {
        if (!active) return;
        setAvailabilityDays([]);
      })
      .finally(() => {
        if (!active) return;
        setCalendarLoading(false);
      });

    return () => {
      active = false;
    };
  }, [calendarMonth]);

  useEffect(() => {
    if (!stay.checkIn || !stay.checkOut) {
      setAvailabilityMessage('');
      return;
    }

    getPlanAvailabilityForStay(stay.checkIn, stay.checkOut).then((items) => {
      const totalAvailable = items.reduce((sum, item) => sum + item.availableSites, 0);
      setAvailabilityMessage(
        totalAvailable > 0
          ? `選択日程で予約可能な残サイト数: ${totalAvailable}`
          : '選択日程は満枠です。日程を変更してご確認ください。',
      );
    });
  }, [stay.checkIn, stay.checkOut]);

  const today = useMemo(() => todayISO(), []);
  const selectedCalendarPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedCalendarPlanId),
    [plans, selectedCalendarPlanId],
  );
  const calendarBounds = useMemo(
    () => getPlanBookableBounds(selectedCalendarPlan, today),
    [selectedCalendarPlan, today],
  );
  const minCalendarMonth = useMemo(() => monthStart(new Date(`${calendarBounds.start}T00:00:00`)), [calendarBounds.start]);
  const maxCalendarMonth = useMemo(() => monthStart(new Date(`${calendarBounds.end}T00:00:00`)), [calendarBounds.end]);
  const canGoPrevMonth = !isMonthBefore(addMonths(calendarMonth, -1), minCalendarMonth);
  const canGoNextMonth = !isMonthAfter(addMonths(calendarMonth, 1), maxCalendarMonth);
  const calendarGridDates = useMemo(() => getCalendarGridDates(calendarMonth), [calendarMonth]);
  const availabilityByDate = useMemo(
    () =>
      new Map(
        availabilityDays
          .filter((item) => item.planId === selectedCalendarPlanId)
          .map((item) => [item.date, item]),
      ),
    [availabilityDays, selectedCalendarPlanId],
  );

  useEffect(() => {
    if (!selectedCalendarPlan) return;
    if (isMonthBefore(calendarMonth, minCalendarMonth)) {
      setCalendarMonth(minCalendarMonth);
    } else if (isMonthAfter(calendarMonth, maxCalendarMonth)) {
      setCalendarMonth(maxCalendarMonth);
    }
  }, [calendarMonth, maxCalendarMonth, minCalendarMonth, selectedCalendarPlan]);

  const nights = useMemo(
    () => (stay.checkIn && stay.checkOut ? calcNights(stay.checkIn, stay.checkOut) : 0),
    [stay.checkIn, stay.checkOut],
  );
  const stayDates = useMemo(
    () => (stay.checkIn && stay.checkOut ? getStayDates(stay.checkIn, stay.checkOut) : []),
    [stay.checkIn, stay.checkOut],
  );

  const eventsByDate = useMemo(
    () =>
      stayDates.map((date) => ({
        date,
        items: events.filter((event) => event.isPublished && isEventActiveOnDate(event, date)),
      })),
    [events, stayDates],
  );

  const handleCheckInChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextCheckIn = event.target.value;
      const updates: { checkIn: string; checkOut?: string; nights?: number } = { checkIn: nextCheckIn };

      if (stay.checkOut && nextCheckIn >= stay.checkOut) {
        updates.checkOut = '';
        updates.nights = 0;
      } else if (stay.checkOut) {
        updates.nights = calcNights(nextCheckIn, stay.checkOut);
      }

      setStay(updates);
    },
    [setStay, stay.checkOut],
  );

  const handleCheckOutChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextCheckOut = event.target.value;
      setStay({
        checkOut: nextCheckOut,
        nights: stay.checkIn ? calcNights(stay.checkIn, nextCheckOut) : 0,
      });
    },
    [setStay, stay.checkIn],
  );

  const canProceed = Boolean(stay.checkIn && stay.checkOut && nights > 0);
  const disabledReason = getDisabledReason({
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    nights,
  });

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_30%,#f7fbf7_100%)]">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <section className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm leading-7 text-red-700">
          <p>この度はほたるの里オートキャンプ場へのご予約をご検討いただき、ありがとうございます。</p>
          <p>本システムは現在プロトタイプ版のため、誤作動が発生する場合があります。</p>
          <p>
            万が一予約ができない場合や、操作が難しい場合は、お手数をおかけしますが、公式LINEのチャット欄に予約希望内容をご記入のうえ送信してください。
          </p>
        </section>

        <header className="mb-8 rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Booking</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">キャンプ場予約</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            宿泊日と人数を選ぶと、次の画面で予約可能なプランを確認できます。
          </p>
        </header>

        <AvailabilityCalendarSection
          plans={plans}
          selectedPlanId={selectedCalendarPlanId}
          onSelectPlan={(planId) => setSelectedCalendarPlanId(planId)}
          calendarMonth={calendarMonth}
          onChangeMonth={setCalendarMonth}
          canGoPrevMonth={canGoPrevMonth}
          canGoNextMonth={canGoNextMonth}
          gridDates={calendarGridDates}
          availabilityByDate={availabilityByDate}
          loading={calendarLoading}
          currentMonthKey={getMonthKey(calendarMonth)}
          today={today}
          bookingStart={calendarBounds.start}
          bookingEnd={calendarBounds.end}
          selectedCheckIn={stay.checkIn}
          onSelectDate={(date) => {
            setStay({
              checkIn: date,
              checkOut: addDays(date, 1),
              nights: 1,
            });
          }}
        />

        <section className="mb-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-slate-800">宿泊日を選ぶ</h2>
          <div className="mb-4 grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
            <div className="min-w-0">
              <label htmlFor="checkIn" className="mb-1 block text-xs font-medium text-slate-500">
                チェックイン
              </label>
              <input
                id="checkIn"
                type="date"
                min={today}
                value={stay.checkIn ?? ''}
                onChange={handleCheckInChange}
                className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="checkOut" className="mb-1 block text-xs font-medium text-slate-500">
                チェックアウト
              </label>
              <input
                id="checkOut"
                type="date"
                min={stay.checkIn || today}
                value={stay.checkOut ?? ''}
                onChange={handleCheckOutChange}
                disabled={!stay.checkIn}
                className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center text-sm text-slate-600">
            {nights > 0
              ? `${stay.checkIn} - ${stay.checkOut} / ${nights}泊`
              : '宿泊日を選択してください'}
          </div>

          {availabilityMessage && (
            <p className="mt-3 text-sm font-medium text-emerald-700">{availabilityMessage}</p>
          )}
        </section>

        <section className="mb-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-slate-800">利用人数</h2>
          <div className="space-y-3">
            <Counter
              label="大人(中学生以上)"
              value={stay.adults}
              onChange={(value) => setStay({ adults: value })}
              min={1}
              max={20}
            />
            <Counter
              label="子ども"
              value={stay.children}
              onChange={(value) => setStay({ children: value })}
              min={0}
              max={20}
            />
            <Counter
              label="幼児"
              value={stay.infants}
              onChange={(value) => setStay({ infants: value })}
              min={0}
              max={20}
            />
          </div>
        </section>

        {stayDates.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-base font-semibold text-slate-800">宿泊日ごとのイベント</h2>
            <div className="space-y-4">
              {eventsByDate.map(({ date, items }) => (
                <div key={date} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 text-sm font-semibold text-slate-800">{date}</div>
                  {items.length === 0 ? (
                    <p className="text-sm text-slate-500">イベントなし</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {items.map((event) => (
                        <article
                          key={event.id}
                          className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                        >
                          <img
                            src={event.imageUrl || '/site-map-placeholder.svg'}
                            alt={event.title}
                            className="h-36 w-full object-cover"
                          />
                          <div className="p-3">
                            <h3 className="text-sm font-semibold text-slate-900">{event.title}</h3>
                            <p className="mt-1 text-xs leading-5 text-slate-500">{event.description}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mb-8">
          <button
            type="button"
            disabled={!canProceed}
            onClick={() => {
              setStay({ nights });
              router.push('/booking/plans');
            }}
            className="w-full rounded-2xl bg-slate-900 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            プラン選択へ進む
          </button>
          {!canProceed && (
            <p className="mt-2 text-center text-xs text-slate-500">{disabledReason}</p>
          )}
        </section>
      </div>
    </div>
  );
}

function Counter({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-600 transition hover:bg-white disabled:opacity-40"
        >
          -
        </button>
        <span className="w-6 text-center text-sm font-semibold text-slate-800">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-600 transition hover:bg-white"
        >
          +
        </button>
      </div>
    </div>
  );
}

function AvailabilityCalendarSection({
  plans,
  selectedPlanId,
  onSelectPlan,
  calendarMonth,
  onChangeMonth,
  canGoPrevMonth,
  canGoNextMonth,
  gridDates,
  availabilityByDate,
  loading,
  currentMonthKey,
  today,
  bookingStart,
  bookingEnd,
  selectedCheckIn,
  onSelectDate,
}: {
  plans: AdminPlan[];
  selectedPlanId: string;
  onSelectPlan: (planId: string) => void;
  calendarMonth: Date;
  onChangeMonth: (date: Date) => void;
  canGoPrevMonth: boolean;
  canGoNextMonth: boolean;
  gridDates: Date[];
  availabilityByDate: Map<string, PlanAvailabilityDay>;
  loading: boolean;
  currentMonthKey: string;
  today: string;
  bookingStart: string;
  bookingEnd: string;
  selectedCheckIn: string | null;
  onSelectDate: (date: string) => void;
}) {
  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

  return (
    <section className="mb-6 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">プランごとの空き状況</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              空き数はプランの同時予約上限数から、有効予約数を差し引いて表示しています。
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <button
              type="button"
              onClick={() => onChangeMonth(addMonths(calendarMonth, -1))}
              disabled={!canGoPrevMonth}
              aria-label="前月へ"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
            >
              ‹
            </button>
            <span className="min-w-28 text-center">
              {calendarMonth.getFullYear()}年{calendarMonth.getMonth() + 1}月
            </span>
            <button
              type="button"
              onClick={() => onChangeMonth(addMonths(calendarMonth, 1))}
              disabled={!canGoNextMonth}
              aria-label="翌月へ"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
            >
              ›
            </button>
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {plans.length === 0 ? (
            <span className="rounded-full bg-slate-100 px-4 py-2 text-xs text-slate-500">公開中のプランがありません</span>
          ) : (
            plans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => onSelectPlan(plan.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${
                  selectedPlanId === plan.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {plan.name}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="px-3 py-4 sm:px-5">
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500">
          {weekDays.map((day) => (
            <div key={day} className="py-2">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {gridDates.map((date) => {
            const isoDate = toISODate(date);
            const day = availabilityByDate.get(isoDate);
            const inCurrentMonth = getMonthKey(date) === currentMonthKey;
            const outOfRange = isoDate < today || isoDate < bookingStart || isoDate > bookingEnd;
            const bookable = Boolean(day?.isBookable) && !outOfRange && (day?.remainingConcurrentReservations ?? 0) > 0;
            const isSelected = selectedCheckIn === isoDate;
            const isLowStock =
              bookable &&
              (day?.capacity ?? 0) > 0 &&
              (day?.availableSites ?? 0) / (day?.capacity ?? 1) < 0.1;
            const statusLabel = outOfRange || !day?.isBookable ? '不可' : !bookable ? '満枠' : isLowStock ? '残少' : `残${day.remainingConcurrentReservations}`;

            return (
              <button
                key={isoDate}
                type="button"
                onClick={() => {
                  if (bookable) onSelectDate(isoDate);
                }}
                disabled={!bookable}
                className={`min-h-20 rounded-2xl border p-1.5 text-left transition sm:min-h-24 sm:p-2 ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : bookable
                      ? 'border-emerald-100 bg-emerald-50/60 hover:border-emerald-300 hover:bg-emerald-50'
                      : 'border-slate-100 bg-slate-50 text-slate-300 grayscale'
                } ${!inCurrentMonth ? 'opacity-45' : ''}`}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className={`text-sm font-semibold ${bookable ? 'text-slate-800' : 'text-slate-400'}`}>
                    {date.getDate()}
                  </span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      bookable
                        ? isLowStock
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {outOfRange || !day?.isBookable ? '×' : !bookable ? '×' : isLowStock ? '△' : '○'}
                  </span>
                </div>
                <div className={`mt-2 text-[11px] font-medium ${bookable ? 'text-slate-600' : 'text-slate-400'}`}>
                  {loading ? '確認中' : statusLabel}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-slate-500">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">○ 空きあり</span>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">△ 残りわずか</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-500">× 満枠・予約不可</span>
        </div>

        <p className="mt-3 text-xs leading-5 text-slate-500">
          日付を押すとチェックイン日として反映され、チェックアウト日は翌日に仮設定されます。連泊の場合は下の宿泊日入力で調整してください。
        </p>
      </div>
    </section>
  );
}
