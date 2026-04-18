'use client';

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { fetchEvents, fetchSiteDetails } from '@/lib/admin/fetchData';
import { siteTypeLabels, type SiteType } from '@/types/site';
import { useBookingDraftStore } from '@/stores/bookingDraftStore';
import { useLiff } from '@/contexts/LiffContext';
import type { AdminEvent } from '@/types/admin';
import type { SiteDetail } from '@/types/site';

function formatDate(iso: string) {
  return iso.replace(/-/g, '/');
}

function calcNights(checkIn: string, checkOut: string) {
  const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
}

function todayISO() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatEventDateTime(value: string) {
  return new Date(value).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function siteMark(available: boolean) {
  return available ? '〇' : '×';
}

export default function Home() {
  const router = useRouter();
  const { stay, setStay, setLineProfile } = useBookingDraftStore();
  const { isReady, profile } = useLiff();
  const [activeAvailabilityType, setActiveAvailabilityType] = useState<SiteType>('auto');
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [sites, setSites] = useState<SiteDetail[]>([]);

  // LIFF ログイン済みならプロフィールをストアに保存
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
    fetchSiteDetails().then(setSites);
  }, []);

  const today = useMemo(() => todayISO(), []);
  const nights = useMemo(() => (stay.checkIn && stay.checkOut ? calcNights(stay.checkIn, stay.checkOut) : 0), [stay.checkIn, stay.checkOut]);

  const availabilityTabs = useMemo(
    () =>
      (Object.keys(siteTypeLabels) as SiteType[]).map((type) => {
        const filtered = sites.filter((site) => site.type === type);
        return { id: type, label: siteTypeLabels[type], total: filtered.length, available: filtered.filter((site) => site.available).length };
      }),
    [sites],
  );

  const visibleSites = useMemo(() => sites.filter((site) => site.type === activeAvailabilityType), [sites, activeAvailabilityType]);

  const handleCheckInChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const newCheckIn = event.target.value;
    const updates: { checkIn: string; checkOut?: string; nights?: number } = { checkIn: newCheckIn };
    if (stay.checkOut && newCheckIn >= stay.checkOut) {
      updates.checkOut = '';
      updates.nights = 0;
    } else if (stay.checkOut) {
      updates.nights = calcNights(newCheckIn, stay.checkOut);
    }
    setStay(updates);
  }, [stay.checkOut, setStay]);

  const handleCheckOutChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const newCheckOut = event.target.value;
    setStay({ checkOut: newCheckOut, nights: stay.checkIn ? calcNights(stay.checkIn, newCheckOut) : 0 });
  }, [stay.checkIn, setStay]);

  const canProceed = !!(stay.checkIn && stay.checkOut && nights > 0 && profile);

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-md px-4 py-6 md:max-w-2xl">
        <header className="mb-8">
          <h1 className="text-xl font-bold text-gray-800">キャンプ場予約</h1>
          <p className="mt-2 text-sm text-gray-500">空き状況を確認してから宿泊日とプランを選べます。</p>
          {profile && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
              {profile.pictureUrl && (
                <img src={profile.pictureUrl} alt="" className="h-8 w-8 rounded-full" />
              )}
              <span className="text-sm font-medium text-green-800">{profile.displayName} でログイン中</span>
            </div>
          )}
        </header>

        <section className="mb-6">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-base font-semibold text-gray-700">空き状況カレンダー</h2>
            <a href="/availability-calendar" className="text-xs text-blue-600 hover:underline">月間カレンダーを見る</a>
          </div>
          <div className="mb-3 flex gap-2 overflow-x-auto pb-2">
            {availabilityTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveAvailabilityType(tab.id)}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab.id === activeAvailabilityType ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="rounded-lg border border-gray-300 bg-gray-50 p-4">
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {visibleSites.map((site) => (
                <div key={site.id} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-800">{site.siteNumber}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${site.available ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {siteMark(site.available)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{site.areaName} / {site.subAreaName}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-lg border border-gray-300 p-4">
          <h2 className="mb-3 text-base font-semibold text-gray-700">宿泊日を選択</h2>
          <div className="mb-3 grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
            <div>
              <label htmlFor="checkIn" className="mb-1 block text-xs text-gray-500">チェックイン</label>
              <input id="checkIn" type="date" min={today} value={stay.checkIn ?? ''} onChange={handleCheckInChange} className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-base text-gray-700" />
            </div>
            <div>
              <label htmlFor="checkOut" className="mb-1 block text-xs text-gray-500">チェックアウト</label>
              <input id="checkOut" type="date" min={stay.checkIn || today} value={stay.checkOut ?? ''} onChange={handleCheckOutChange} disabled={!stay.checkIn} className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-base text-gray-700 disabled:bg-gray-100 disabled:text-gray-400" />
            </div>
          </div>
          <div className="rounded bg-gray-50 px-3 py-2 text-center text-sm text-gray-600">
            {nights > 0 ? <span className="font-medium">{stay.checkIn && formatDate(stay.checkIn)} - {stay.checkOut && formatDate(stay.checkOut)} / {nights}泊</span> : <span className="text-gray-400">宿泊日を選択してください</span>}
          </div>
        </section>

        <section className="mb-6 rounded-lg border border-gray-300 p-4">
          <h2 className="mb-3 text-base font-semibold text-gray-700">利用人数</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">大人</p>
                <p className="text-xs text-gray-400">中学生以上</p>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setStay({ adults: Math.max(1, stay.adults - 1) })} disabled={stay.adults <= 1} className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-300">
                  −
                </button>
                <span className="w-6 text-center text-sm font-semibold text-gray-800">{stay.adults}</span>
                <button type="button" onClick={() => setStay({ adults: Math.min(20, stay.adults + 1) })} className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-gray-600 transition-colors hover:bg-gray-100">
                  ＋
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">子ども</p>
                <p className="text-xs text-gray-400">小学生以下</p>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setStay({ children: Math.max(0, stay.children - 1) })} disabled={stay.children <= 0} className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-300">
                  −
                </button>
                <span className="w-6 text-center text-sm font-semibold text-gray-800">{stay.children}</span>
                <button type="button" onClick={() => setStay({ children: Math.min(20, stay.children + 1) })} className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-gray-600 transition-colors hover:bg-gray-100">
                  ＋
                </button>
              </div>
            </div>
          </div>
          <div className="mt-3 rounded bg-gray-50 px-3 py-2 text-center text-sm text-gray-600">
            合計 <span className="font-semibold text-gray-800">{stay.adults + stay.children}名</span>（大人{stay.adults}名{stay.children > 0 ? ` / 子ども${stay.children}名` : ''}）
          </div>
        </section>

        <section className="mb-6">
          <h2 className="mb-1 text-base font-semibold text-gray-700">イベント</h2>
          <p className="mb-3 text-xs text-gray-400">宿泊日に合わせて参加できる開催予定イベントを確認できます。イベントの参加申し込みはオプション選択画面でお選びください。</p>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
            {events.filter((event) => event.isPublished).map((event) => (
              <div key={event.id} className="w-56 flex-shrink-0 rounded-lg border border-gray-300 bg-white">
                <div className="flex h-28 items-center justify-center rounded-t-lg bg-gray-100">
                  <span className="text-xs text-gray-400">イベント画像</span>
                </div>
                <div className="space-y-1.5 p-3">
                  <p className="text-sm font-semibold text-gray-800">{event.title}</p>
                  <p className="text-xs leading-relaxed text-gray-500">{event.description}</p>
                  <div className="space-y-0.5 border-t border-gray-100 pt-1">
                    <p className="text-xs text-gray-400"><span className="inline-block w-10 font-medium text-gray-500">開始</span>{formatEventDateTime(event.startAt)}</p>
                    <p className="text-xs text-gray-400"><span className="inline-block w-10 font-medium text-gray-500">終了</span>{formatEventDateTime(event.endAt)}</p>
                    <p className="text-xs text-gray-400"><span className="inline-block w-10 font-medium text-gray-500">場所</span>{event.location}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8">
          {isReady && !profile && (
            <p className="mb-2 text-center text-sm text-amber-600">予約にはLINEログインが必要です。LINEアプリからアクセスしてください。</p>
          )}
          <button type="button" disabled={!canProceed} onClick={() => { setStay({ nights }); router.push('/booking/plans'); }} className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400">
            プラン選択へ
          </button>
        </section>
      </div>
    </div>
  );
}
