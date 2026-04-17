'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchReservationById } from '@/lib/fetchReservationById';
import QrDisplayCard from '@/components/reservation/QrDisplayCard';
import ReservationSummaryCard from '@/components/reservation/ReservationSummaryCard';
import ReservationStatusBadge from '@/components/reservation/ReservationStatusBadge';
import { fetchQrScreenSettings } from '@/lib/admin/fetchData';
import type { AdminQrScreenSettings } from '@/types/admin';
import type { ReservationDetail } from '@/types/reservation';

type PageState =
  | { type: 'loading' }
  | { type: 'error'; message: string }
  | { type: 'not-found' }
  | { type: 'loaded'; reservation: ReservationDetail };

export default function ReservationQrPage() {
  const params = useParams();
  const router = useRouter();
  const reservationId = params.id as string;

  const [state, setState] = useState<PageState>({ type: 'loading' });
  const [screenSettings, setScreenSettings] = useState<AdminQrScreenSettings>({ title: '', description: '', supportText: '', externalLinkLabel: '', externalLinkUrl: '', footerNote: '' });

  useEffect(() => {
    fetchQrScreenSettings().then(setScreenSettings);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchReservationById(reservationId);
        if (cancelled) return;
        if (!data) setState({ type: 'not-found' });
        else setState({ type: 'loaded', reservation: data });
      } catch {
        if (!cancelled) {
          setState({ type: 'error', message: '予約情報の取得に失敗しました。' });
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [reservationId]);

  if (state.type === 'loading') {
    return <div className="mx-auto flex min-h-screen max-w-md items-center justify-center bg-gray-50 px-4">読み込み中...</div>;
  }

  if (state.type === 'error') {
    return <div className="mx-auto flex min-h-screen max-w-md items-center justify-center bg-gray-50 px-4 text-center text-sm text-red-600">{state.message}</div>;
  }

  if (state.type === 'not-found') {
    return <div className="mx-auto flex min-h-screen max-w-md items-center justify-center bg-gray-50 px-4 text-center text-sm text-gray-500">対象の予約が見つかりません。</div>;
  }

  const reservation = state.reservation;
  const showQr = reservation.status === 'confirmed' || reservation.status === 'checked_in' || reservation.status === 'completed';

  return (
    <div className="mx-auto min-h-screen max-w-md bg-gray-50">
      <div className="bg-white px-4 pb-5 pt-8 text-center shadow-sm">
        <h1 className="text-lg font-bold text-gray-800">{screenSettings.title}</h1>
        <p className="mt-1 text-sm text-gray-500">{screenSettings.description}</p>
      </div>

      <div className="space-y-5 px-4 py-6">
        {reservation.status === 'cancelled' && (
          <div className="rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm">
            <ReservationStatusBadge status="cancelled" />
            <p className="mt-4 text-sm text-gray-700">この予約はキャンセルされています。</p>
          </div>
        )}

        {reservation.status === 'pending' && (
          <div className="rounded-xl border border-yellow-200 bg-white p-6 text-center shadow-sm">
            <ReservationStatusBadge status="pending" />
            <p className="mt-4 text-sm text-gray-700">確認が完了するとQRコードが表示されます。</p>
          </div>
        )}

        {showQr && (
          <>
            <QrDisplayCard qrToken={reservation.qrToken} reservationId={reservation.id} />
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
              <p>{screenSettings.supportText}</p>
              {screenSettings.externalLinkUrl && (
                <a href={screenSettings.externalLinkUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-blue-600 hover:underline">
                  {screenSettings.externalLinkLabel}
                </a>
              )}
              <p className="mt-4 text-xs text-gray-500">{screenSettings.footerNote}</p>
            </div>
          </>
        )}

        <ReservationSummaryCard reservation={reservation} />

        <div className="space-y-3 pb-8">
          {/* <button onClick={() => router.push(`/reservation/${reservation.id}`)} className="w-full rounded-lg bg-gray-800 px-6 py-3.5 text-sm font-medium text-white transition-colors hover:bg-gray-700">
            予約詳細を確認する
          </button> */}
          <button onClick={() => router.push('/')} className="w-full rounded-lg border border-gray-300 bg-white px-6 py-3.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
            TOPへ戻る
          </button>
        </div>
      </div>
    </div>
  );
}
