'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';

type QrReservationOption = {
  name: string;
  quantity: number;
  people?: number;
  days?: number;
  subtotal: number;
};

type QrReservation = {
  id: string;
  receptionCode: string;
  status: string | null;
  planName: string;
  siteNumber: string | null;
  siteName: string | null;
  selectedSiteNumbers: string[];
  checkInDate: string;
  checkOutDate: string;
  checkedInAt: string | null;
  nights: number;
  adults: number;
  children: number;
  infants: number;
  guests: number;
  options: QrReservationOption[];
  optionTotal: number;
  totalAmount: number;
  paymentMethod: string | null;
  createdAt: string;
};

type QrMember = {
  name: string;
  phone: string | null;
  email: string | null;
  identifier: string | null;
  gender: string | null;
  occupation: string | null;
  address: string | null;
  referralSource: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  pending: '仮予約',
  confirmed: '予約確定',
  checked_in: 'チェックイン済み',
  completed: '利用完了',
  cancelled: 'キャンセル',
};

const PAYMENT_LABELS: Record<string, string> = {
  credit_card: 'クレジットカード',
  cash: '現地払い(現金のみ)',
  bank_transfer: '銀行振込',
};

export default function CheckInPage() {
  return (
    <Suspense fallback={<CenteredCard title="読み込み中です" message="QR情報を確認しています。" />}>
      <CheckInContent />
    </Suspense>
  );
}

function CheckInContent() {
  const searchParams = useSearchParams();
  const reservationId = searchParams.get('id');
  const qrToken = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [member, setMember] = useState<QrMember | null>(null);
  const [reservations, setReservations] = useState<QrReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (reservationId) params.set('id', reservationId);
    if (qrToken) params.set('token', qrToken);
    return params.toString();
  }, [reservationId, qrToken]);

  const loadReservations = useCallback(async () => {
    if (!reservationId && !qrToken) {
      setError('QRコードに予約情報が含まれていません。');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    const response = await fetch(`/api/qr-access/reservations?${queryString}`, {
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));

    if (response.status === 401) {
      setNeedsPassword(true);
      setMember(null);
      setReservations([]);
      setLoading(false);
      return;
    }

    if (!response.ok) {
      setError(payload.error ?? 'QR情報の取得に失敗しました。');
      setLoading(false);
      return;
    }

    setNeedsPassword(false);
    setMember(payload.member ?? null);
    setReservations(payload.reservations ?? []);
    setLoading(false);
  }, [queryString, qrToken, reservationId]);

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  const handleAuthenticate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password.trim()) {
      setError('パスワードを入力してください。');
      return;
    }

    setAuthenticating(true);
    setError('');

    const response = await fetch('/api/qr-access/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, reservationId, qrToken }),
    });
    const payload = await response.json().catch(() => ({}));

    setAuthenticating(false);
    if (!response.ok) {
      setError(payload.error ?? '認証に失敗しました。');
      return;
    }

    setPassword('');
    await loadReservations();
  };

  const handleCheckIn = async (target: QrReservation) => {
    if (target.status === 'checked_in') return;
    if (!window.confirm(`${target.receptionCode} をチェックイン済みに変更しますか？`)) return;

    setUpdatingId(target.id);
    setError('');
    setMessage('');

    const response = await fetch('/api/qr-access/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reservationId: target.id,
        qrReservationId: reservationId,
        qrToken,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setUpdatingId(null);

    if (!response.ok) {
      setError(payload.error ?? 'チェックイン更新に失敗しました。');
      return;
    }

    const checkedInAt = payload.reservation?.checked_in_at ?? new Date().toISOString();
    setReservations((current) =>
      current.map((reservation) =>
        reservation.id === target.id
          ? { ...reservation, status: 'checked_in', checkedInAt }
          : reservation,
      ),
    );
    setMessage('チェックイン済みに更新しました。');
  };

  if (loading) {
    return <CenteredCard title="確認画面を準備しています" message="QR情報を確認しています。そのままお待ちください。" />;
  }

  if (needsPassword) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-xl text-amber-700">
            !
          </div>
          <h1 className="mt-4 text-center text-xl font-bold text-slate-950">管理人パスワードが必要です</h1>
          <p className="mt-2 text-center text-sm leading-6 text-slate-600">
            個人情報と予約情報を保護するため、QR閲覧用パスワードを入力してください。
          </p>
          <form onSubmit={handleAuthenticate} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold text-slate-700">
              QR閲覧用パスワード
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                autoComplete="current-password"
              />
            </label>
            {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <button
              type="submit"
              disabled={authenticating}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {authenticating ? '確認中...' : '認証して表示する'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header>
          <h1 className="text-2xl font-bold text-slate-950">QRチェックイン確認</h1>
          <p className="mt-1 text-sm text-slate-600">会員情報と予約情報を確認し、予約ごとにチェックイン済みへ更新できます。</p>
        </header>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div>}

        {member ? <MemberCard member={member} reservationCount={reservations.length} /> : null}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-950">予約情報一覧</h2>
              <p className="mt-1 text-sm text-slate-500">この会員に紐づく予約を表示しています。</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{reservations.length}件</span>
          </div>

          {reservations.length === 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              紐づく予約が見つかりませんでした。
            </div>
          ) : (
            <div className="space-y-4">
              {reservations.map((reservation) => (
                <ReservationCard
                  key={reservation.id}
                  reservation={reservation}
                  updating={updatingId === reservation.id}
                  onCheckIn={() => handleCheckIn(reservation)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function CenteredCard({ title, message }: { title: string; message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-xl text-amber-700">!</div>
        <h1 className="mt-5 text-xl font-bold text-slate-950">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
      </div>
    </main>
  );
}

function MemberCard({ member, reservationCount }: { member: QrMember; reservationCount: number }) {
  return (
    <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-emerald-950">会員情報</h2>
          <p className="mt-1 text-sm text-emerald-700">読み取り後、まず本人確認用の情報を表示しています。</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-700">関連予約 {reservationCount}件</span>
      </div>
      <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <InfoItem label="氏名" value={member.name} />
        <InfoItem label="電話番号" value={member.phone} />
        <InfoItem label="メールアドレス" value={member.email} />
        <InfoItem label="会員番号 / 顧客識別情報" value={member.identifier} />
        <InfoItem label="性別" value={member.gender} />
        <InfoItem label="職業" value={member.occupation} />
        <InfoItem label="住所" value={member.address} wide />
        <InfoItem label="きっかけ" value={member.referralSource} />
      </div>
    </section>
  );
}

function ReservationCard({
  reservation,
  updating,
  onCheckIn,
}: {
  reservation: QrReservation;
  updating: boolean;
  onCheckIn: () => void;
}) {
  const isCheckedIn = reservation.status === 'checked_in';
  const siteLabel =
    reservation.selectedSiteNumbers.length > 0
      ? reservation.selectedSiteNumbers.join(' / ')
      : reservation.siteNumber
        ? `${reservation.siteNumber}${reservation.siteName ? `（${reservation.siteName}）` : ''}`
        : 'サイト指定なし';

  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-sm font-bold text-slate-950">{reservation.receptionCode}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${isCheckedIn ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {STATUS_LABELS[reservation.status ?? 'pending'] ?? reservation.status ?? '未設定'}
            </span>
            {reservation.checkedInAt && (
              <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500">
                {new Date(reservation.checkedInAt).toLocaleString('ja-JP')}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onCheckIn}
          disabled={isCheckedIn || updating || reservation.status === 'cancelled'}
          className="rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isCheckedIn ? 'チェックイン済み' : updating ? '更新中...' : 'チェックイン済みにする'}
        </button>
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <InfoItem label="プラン名" value={reservation.planName} />
        <InfoItem label="サイト番号 / サイト名" value={siteLabel} />
        <InfoItem label="宿泊日" value={`${reservation.checkInDate} - ${reservation.checkOutDate}`} />
        <InfoItem label="泊数" value={`${reservation.nights}泊`} />
        <InfoItem label="人数" value={`大人(中学生以上) ${reservation.adults} / 子供 ${reservation.children} / 幼児 ${reservation.infants} / 合計 ${reservation.guests}`} />
        <InfoItem label="支払い方法" value={reservation.paymentMethod ? PAYMENT_LABELS[reservation.paymentMethod] ?? reservation.paymentMethod : '未設定'} />
        <InfoItem label="合計金額" value={`¥${Number(reservation.totalAmount ?? 0).toLocaleString()}`} />
      </div>

      <div className="mt-4 rounded-2xl bg-white p-3 text-sm">
        <div className="mb-2 font-bold text-slate-800">オプション内容</div>
        {reservation.options.length === 0 ? (
          <p className="text-slate-500">オプションなし</p>
        ) : (
          <div className="space-y-2">
            {reservation.options.map((option, index) => (
              <div key={`${option.name}-${index}`} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
                <span>
                  {option.name} × {option.people ?? option.quantity}
                  {option.days && option.days > 1 ? ` / ${option.days}日` : ''}
                </span>
                <span>¥{Number(option.subtotal ?? 0).toLocaleString()}</span>
              </div>
            ))}
            <div className="border-t border-slate-100 pt-2 text-right font-bold text-slate-950">
              オプション合計 ¥{Number(reservation.optionTotal ?? 0).toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function InfoItem({ label, value, wide = false }: { label: string; value: string | number | null | undefined; wide?: boolean }) {
  return (
    <div className={`rounded-2xl bg-white px-3 py-2 ${wide ? 'sm:col-span-2' : ''}`}>
      <div className="text-xs font-bold text-slate-500">{label}</div>
      <div className="mt-1 break-words text-sm font-semibold text-slate-950">{value || '-'}</div>
    </div>
  );
}
