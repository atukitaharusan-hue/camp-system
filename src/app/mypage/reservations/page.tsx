'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLiff } from '@/contexts/LiffContext';
import ReservationStatusBadge from '@/components/reservation/ReservationStatusBadge';
import { generateReceptionCode } from '@/types/reservation';
import type { Database } from '@/types/database';
import {
  addMyPageLinkedReservationId,
  readLastReservationId,
  readMyPageLinkedReservationIds,
  readPersistedBookingDraft,
} from '@/lib/bookingStorage';

type GuestRow = Database['public']['Tables']['guest_reservations']['Row'];
type ReservationLookupRow = Pick<
  GuestRow,
  | 'id'
  | 'status'
  | 'checkin_flow_status'
  | 'check_in_date'
  | 'check_out_date'
  | 'nights'
  | 'guests'
  | 'site_number'
  | 'total_amount'
  | 'created_at'
  | 'user_phone'
>;

type ReservationSummary = {
  id: string;
  status: GuestRow['status'];
  checkinFlowStatus: string | null;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  guests: number;
  siteNumber: string | null;
  totalAmount: number;
  createdAt: string;
};

const STATUS_ORDER: Record<string, number> = {
  confirmed: 0,
  pending: 1,
  checked_in: 2,
  completed: 3,
  cancelled: 4,
};

function getTodayJst() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function formatDate(iso: string) {
  const date = new Date(iso);
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  return `${date.getMonth() + 1}/${date.getDate()} (${weekdays[date.getDay()]})`;
}

function normalizePhone(value: string | null | undefined) {
  return (value ?? '').replace(/\D/g, '');
}

function normalizeEmail(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function toSummary(reservation: ReservationLookupRow): ReservationSummary {
  return {
    id: reservation.id,
    status: reservation.status,
    checkinFlowStatus: reservation.checkin_flow_status,
    checkInDate: reservation.check_in_date,
    checkOutDate: reservation.check_out_date,
    nights: reservation.nights,
    guests: reservation.guests,
    siteNumber: reservation.site_number,
    totalAmount: Number(reservation.total_amount),
    createdAt: reservation.created_at,
  };
}

function sortReservations(reservations: ReservationSummary[]) {
  return [...reservations].sort((a, b) => {
    const statusDiff = (STATUS_ORDER[a.status ?? ''] ?? 9) - (STATUS_ORDER[b.status ?? ''] ?? 9);
    if (statusDiff !== 0) return statusDiff;
    return new Date(b.checkInDate).getTime() - new Date(a.checkInDate).getTime();
  });
}

export default function MyReservationsPage() {
  const router = useRouter();
  const { isReady, isLoggedIn, profile } = useLiff();
  const [reservations, setReservations] = useState<ReservationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [manualReservationCode, setManualReservationCode] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualLoading, setManualLoading] = useState(false);

  const today = useMemo(() => getTodayJst(), []);

  useEffect(() => {
    if (!isReady) return;
    if (!isLoggedIn || !profile?.userId) return;

    (async () => {
      const persistedDraft = readPersistedBookingDraft();
      const lastReservationId = readLastReservationId();
      const linkedReservationIds = readMyPageLinkedReservationIds();
      const fallbackPhone = normalizePhone(persistedDraft?.userInfo?.phone);
      const fallbackEmail = normalizeEmail(persistedDraft?.userInfo?.email);
      const response = await fetch('/api/mypage/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'list',
          userId: profile.userId,
          phone: fallbackPhone,
          email: fallbackEmail,
          lastReservationId,
          linkedReservationIds,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            reservations?: ReservationLookupRow[];
            error?: string;
          }
        | null;

      if (!response.ok) {
        setError(payload?.error ?? '予約情報の確認に失敗しました。');
        setReservations([]);
        setLoading(false);
        return;
      }

      setReservations(sortReservations((payload?.reservations ?? []).map(toSummary)));
      setLoading(false);
    })();
  }, [isReady, isLoggedIn, profile]);

  const canOpenSameDayCheckin = (reservation: ReservationSummary) =>
    reservation.checkInDate === today &&
    reservation.status !== 'cancelled' &&
    reservation.status !== 'checked_in' &&
    reservation.status !== 'completed';

  const startCustomerCheckin = async (reservationId: string) => {
    if (!profile?.userId) return;
    const persistedDraft = readPersistedBookingDraft();
    setStartingId(reservationId);
    setError('');

    const response = await fetch('/api/checkin/customer-entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'line-select',
        reservationId,
        userId: profile.userId,
        phone: persistedDraft?.userInfo?.phone ?? null,
        email: persistedDraft?.userInfo?.email ?? null,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setStartingId(null);

    if (!response.ok) {
      setError(payload.error ?? 'チェックイン画面の表示に失敗しました。');
      return;
    }

    const entryToken =
      typeof payload.entryToken === 'string' && payload.entryToken.length > 0
        ? `&entryToken=${encodeURIComponent(payload.entryToken)}`
        : '';
    router.push(`/checkin?id=${reservationId}${entryToken}`);
  };

  const handleManualLink = async () => {
    const normalizedCode = manualReservationCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const normalizedPhone = normalizePhone(manualPhone);

    if (!normalizedCode || !normalizedPhone) {
      setError('予約番号と電話番号を入力してください。');
      return;
    }

    setManualLoading(true);
    setError('');

    const response = await fetch('/api/mypage/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'manual-link',
        receptionCode: normalizedCode,
        phone: normalizedPhone,
        userId: profile?.userId,
      }),
    });
    const payload = (await response.json().catch(() => null)) as
      | {
          reservation?: ReservationLookupRow;
          error?: string;
        }
      | null;

    setManualLoading(false);

    if (!response.ok) {
      setError(payload?.error ?? '予約情報の確認に失敗しました。');
      return;
    }

    const matched = payload?.reservation;
    if (!matched) {
      setError('一致する予約が見つかりませんでした。');
      return;
    }

    addMyPageLinkedReservationId(matched.id);
    setReservations((current) => {
      const next = new Map(current.map((reservation) => [reservation.id, reservation]));
      next.set(matched.id, toSummary(matched));
      return sortReservations(Array.from(next.values()));
    });
    setManualReservationCode('');
    setManualPhone('');
  };

  if (isReady && !isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-stone-50 to-emerald-50/30 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <p className="mb-2 font-semibold text-gray-700">LINEログインが必要です</p>
          <p className="mb-6 text-sm text-gray-500">予約一覧を表示するにはLINEアプリからアクセスしてください。</p>
          <Link href="/" className="inline-block rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
            TOPへ戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-emerald-50/30 py-8 pb-20">
      <div className="mx-auto max-w-2xl px-4">
        <div className="mb-8 text-center">
          <Link href="/mypage" className="inline-block text-sm text-emerald-700 transition-colors hover:text-emerald-800">
            マイページに戻る
          </Link>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900">予約一覧</h1>
          <p className="mt-2 text-sm text-gray-500">あなたの予約内容を確認できます。</p>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="py-20 text-center text-sm text-gray-400">読み込み中...</div>
        ) : reservations.length === 0 ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
              <p className="mb-2 font-semibold text-gray-600">予約が見つかりません</p>
              <p className="mb-6 text-sm text-gray-400">予約番号と電話番号で、ご自身の予約を表示できます。</p>
              <Link href="/" className="inline-block rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
                新しい予約をする
              </Link>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-bold text-gray-800">予約番号で表示する</h2>
              <p className="mt-1 text-xs text-gray-500">予約完了画面やQR画面にある予約番号と、予約時の電話番号を入力してください。</p>
              <div className="mt-4 space-y-3">
                <input
                  value={manualReservationCode}
                  onChange={(event) => setManualReservationCode(event.target.value)}
                  placeholder="予約番号"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
                <input
                  value={manualPhone}
                  onChange={(event) => setManualPhone(event.target.value)}
                  placeholder="電話番号"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
                <button
                  type="button"
                  onClick={() => void handleManualLink()}
                  disabled={manualLoading}
                  className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {manualLoading ? '確認中...' : '予約を表示する'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {reservations.map((reservation) => {
              const canCheckinToday = canOpenSameDayCheckin(reservation);
              return (
                <div key={reservation.id} className="rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm">
                  <button type="button" onClick={() => router.push(`/reservation/${reservation.id}/qr`)} className="w-full text-left">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-gray-800">
                            {formatDate(reservation.checkInDate)} - {formatDate(reservation.checkOutDate)}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                          <span>{reservation.nights}泊</span>
                          <span>{reservation.guests}名</span>
                          {reservation.siteNumber ? <span>サイト {reservation.siteNumber}</span> : null}
                          <span>¥{reservation.totalAmount.toLocaleString('ja-JP')}</span>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <ReservationStatusBadge status={reservation.status ?? 'pending'} />
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[11px] text-gray-400">予約番号: {generateReceptionCode(reservation.id)}</span>
                      <span className="text-xs font-medium text-emerald-600">詳細を見る</span>
                    </div>
                  </button>

                  {canCheckinToday ? (
                    <button
                      type="button"
                      onClick={() => void startCustomerCheckin(reservation.id)}
                      disabled={startingId === reservation.id}
                      className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {startingId === reservation.id ? 'チェックイン画面を開いています...' : '情報の確認・チェックインを行う'}
                    </button>
                  ) : null}

                  {reservation.checkinFlowStatus === 'arrived_pending' ? (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      チェックイン内容は確認済みです。レジで最終確認をしてください。
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
