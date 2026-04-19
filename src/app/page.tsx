'use client';

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { fetchEvents } from '@/lib/admin/fetchData';
import { getPlanAvailabilityForStay, getStayDates } from '@/lib/bookingAvailability';
import { useBookingDraftStore } from '@/stores/bookingDraftStore';
import { useLiff } from '@/contexts/LiffContext';
import type { AdminEvent } from '@/types/admin';

function calcNights(checkIn: string, checkOut: string) {
  const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
}

function todayISO() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
  }, []);

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
