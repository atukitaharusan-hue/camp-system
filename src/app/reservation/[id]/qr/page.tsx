'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import QrDisplayCard from '@/components/reservation/QrDisplayCard';
import ReservationStatusBadge from '@/components/reservation/ReservationStatusBadge';
import ReservationSummaryCard from '@/components/reservation/ReservationSummaryCard';
import { fetchQrScreenSettings } from '@/lib/admin/fetchData';
import { fetchReservationById } from '@/lib/fetchReservationById';
import type { AdminQrScreenSettings } from '@/types/admin';
import type { ReservationDetail } from '@/types/reservation';

type PageState =
  | { type: 'loading' }
  | { type: 'error'; message: string }
  | { type: 'not-found' }
  | { type: 'loaded'; reservation: ReservationDetail };

const defaultScreenSettings: AdminQrScreenSettings = {
  title: '',
  description: '',
  supportText: '',
  externalLinkLabel: '',
  externalLinkUrl: '',
  footerNote: '',
};

export default function ReservationQrPage() {
  const params = useParams();
  const router = useRouter();
  const reservationId = params.id as string;

  const [state, setState] = useState<PageState>({ type: 'loading' });
  const [screenSettings, setScreenSettings] =
    useState<AdminQrScreenSettings>(defaultScreenSettings);

  useEffect(() => {
    let active = true;

    fetchQrScreenSettings()
      .then((settings) => {
        if (!active) return;
        setScreenSettings(settings);
      })
      .catch(() => {
        if (!active) return;
        setScreenSettings(defaultScreenSettings);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadReservation() {
      try {
        const data = await fetchReservationById(reservationId);
        if (!active) return;

        if (!data) {
          setState({ type: 'not-found' });
          return;
        }

        setState({ type: 'loaded', reservation: data });
      } catch {
        if (!active) return;
        setState({
          type: 'error',
          message:
            '予約情報の読み込みに失敗しました。時間をおいて再読み込みしてください。',
        });
      }
    }

    loadReservation();

    return () => {
      active = false;
    };
  }, [reservationId]);

  if (state.type === 'loading') {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center justify-center bg-gray-50 px-4 text-sm text-gray-500">
        読み込み中...
      </div>
    );
  }

  if (state.type === 'error') {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center justify-center bg-gray-50 px-4">
        <div className="w-full rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-red-700">表示エラー</p>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            {state.message}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  if (state.type === 'not-found') {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center justify-center bg-gray-50 px-4">
        <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-gray-700">
            対象の予約が見つかりません。
          </p>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="mt-5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            TOPへ戻る
          </button>
        </div>
      </div>
    );
  }

  const reservation = state.reservation;
  const showQr =
    reservation.status === 'confirmed' ||
    reservation.status === 'checked_in' ||
    reservation.status === 'completed';

  return (
    <div className="mx-auto min-h-screen max-w-md bg-gray-50">
      <div className="bg-white px-4 pb-5 pt-8 text-center shadow-sm">
        <h1 className="text-lg font-bold text-gray-800">
          {screenSettings.title || 'ご予約ありがとうございます'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {screenSettings.description || 'チェックイン時に受付用QRコードをご提示ください。'}
        </p>
      </div>

      <div className="space-y-5 px-4 py-6">
        {reservation.status === 'cancelled' && (
          <div className="rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm">
            <ReservationStatusBadge status="cancelled" />
            <p className="mt-4 text-sm text-gray-700">
              この予約はキャンセルされています。
            </p>
          </div>
        )}

        {reservation.status === 'pending' && (
          <div className="rounded-xl border border-yellow-200 bg-white p-6 text-center shadow-sm">
            <ReservationStatusBadge status="pending" />
            <p className="mt-4 text-sm text-gray-700">
              確認が完了するとQRコードが表示されます。
            </p>
          </div>
        )}

        {showQr && (
          <>
            <QrDisplayCard
              qrToken={reservation.qrToken}
              reservationId={reservation.id}
            />
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
              <p>
                {screenSettings.supportText ||
                  'チェックイン時にスタッフへこの画面をご提示ください。'}
              </p>
              {screenSettings.externalLinkUrl && (
                <a
                  href={screenSettings.externalLinkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex text-blue-600 hover:underline"
                >
                  {screenSettings.externalLinkLabel || '詳細を見る'}
                </a>
              )}
              {screenSettings.footerNote && (
                <p className="mt-4 text-xs text-gray-500">
                  {screenSettings.footerNote}
                </p>
              )}
            </div>
          </>
        )}

        <ReservationSummaryCard reservation={reservation} />

        <div className="space-y-3 pb-8">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="w-full rounded-lg border border-gray-300 bg-white px-6 py-3.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            TOPへ戻る
          </button>
        </div>
      </div>
    </div>
  );
}
