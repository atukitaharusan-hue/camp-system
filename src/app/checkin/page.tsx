'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import QrDisplayCard from '@/components/reservation/QrDisplayCard';
import { useLiff } from '@/contexts/LiffContext';
import { supabase } from '@/lib/supabase';
import { buildCounterSessionQrValue } from '@/lib/reservationQr';

type QrReservationOption = {
  optionId?: string;
  name: string;
  quantity: number;
  people?: number;
  days?: number;
  subtotal: number;
  type?: string;
};

type QrReservation = {
  id: string;
  receptionCode: string;
  status: string | null;
  checkinFlowStatus?: string | null;
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

type SessionOption = {
  id: string;
  name: string;
  category: string | null;
  price: number;
  priceType: string | null;
  eventDate?: string | null;
};

type SessionDraft = {
  id?: string;
  status?: string;
  counter_token?: string;
  userName: string;
  userPhone: string | null;
  userEmail: string | null;
  userGender: string | null;
  userOccupation: string | null;
  userAddress: string | null;
  userReferralSource: string | null;
  adults: number;
  children: number;
  infants: number;
  guests: number;
  specialRequests: string | null;
  selectedSiteNumbers: string[];
  requestedSiteCount: number;
  optionsJson: QrReservationOption[];
  estimatedTotalAmount: number;
  customerNote: string | null;
};

type SessionDraftSource = Partial<SessionDraft> & {
  user_name?: string | null;
  user_phone?: string | null;
  user_email?: string | null;
  user_gender?: string | null;
  user_occupation?: string | null;
  user_address?: string | null;
  user_referral_source?: string | null;
  special_requests?: string | null;
  selected_site_numbers?: string[];
  requested_site_count?: number;
  options_json?: QrReservationOption[];
  estimated_total_amount?: number;
  customer_note?: string | null;
};

type MyPageReservation = {
  id: string;
  planName: string;
  checkInDate: string;
  checkOutDate: string;
  siteNumber: string | null;
  guests: number;
};

function normalizeDraft(source: SessionDraftSource | null | undefined): SessionDraft | null {
  if (!source) return null;
  return {
    id: source.id,
    status: source.status,
    counter_token: source.counter_token,
    userName: source.userName ?? source.user_name ?? '',
    userPhone: source.userPhone ?? source.user_phone ?? null,
    userEmail: source.userEmail ?? source.user_email ?? null,
    userGender: source.userGender ?? source.user_gender ?? null,
    userOccupation: source.userOccupation ?? source.user_occupation ?? null,
    userAddress: source.userAddress ?? source.user_address ?? null,
    userReferralSource: source.userReferralSource ?? source.user_referral_source ?? null,
    adults: source.adults ?? 1,
    children: source.children ?? 0,
    infants: source.infants ?? 0,
    guests: source.guests ?? (source.adults ?? 1) + (source.children ?? 0) + (source.infants ?? 0),
    specialRequests: source.specialRequests ?? source.special_requests ?? null,
    selectedSiteNumbers: source.selectedSiteNumbers ?? source.selected_site_numbers ?? [],
    requestedSiteCount: source.requestedSiteCount ?? source.requested_site_count ?? 1,
    optionsJson: source.optionsJson ?? source.options_json ?? [],
    estimatedTotalAmount: source.estimatedTotalAmount ?? source.estimated_total_amount ?? 0,
    customerNote: source.customerNote ?? source.customer_note ?? null,
  };
}

function getTodayJst() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export default function CheckInPage() {
  return (
    <Suspense fallback={<CenteredCard title="読み込み中です" message="チェックイン情報を準備しています。" />}>
      <CheckInContent />
    </Suspense>
  );
}

function CheckInContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isReady, isLoggedIn, profile } = useLiff();
  const reservationId = searchParams.get('id');
  const qrToken = searchParams.get('token');
  const entryToken = searchParams.get('entryToken');

  const [password, setPassword] = useState('');
  const [member, setMember] = useState<QrMember | null>(null);
  const [reservations, setReservations] = useState<QrReservation[]>([]);
  const [loading, setLoading] = useState(!(searchParams.get('id') === null && searchParams.get('token') === null));
  const [authenticating, setAuthenticating] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState<SessionDraft | null>(null);
  const [availableOptions, setAvailableOptions] = useState<SessionOption[]>([]);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmedCounterToken, setConfirmedCounterToken] = useState<string | null>(null);
  const [todayReservations, setTodayReservations] = useState<MyPageReservation[]>([]);
  const [startingReservationId, setStartingReservationId] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [manualPhone, setManualPhone] = useState('');

  const today = useMemo(() => getTodayJst(), []);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (reservationId) params.set('id', reservationId);
    if (qrToken) params.set('token', qrToken);
    if (entryToken) params.set('entryToken', entryToken);
    return params.toString();
  }, [entryToken, qrToken, reservationId]);

  const targetReservation = useMemo(
    () => reservations.find((reservation) => reservation.id === reservationId) ?? reservations[0] ?? null,
    [reservationId, reservations],
  );

  const isEntryMode = !reservationId && !qrToken;

  useEffect(() => {
    if (!isEntryMode || !isReady || !isLoggedIn || !profile?.userId) return;

    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('guest_reservations')
        .select('id, check_in_date, check_out_date, site_number, guests, plan_id')
        .eq('user_identifier', profile.userId)
        .eq('check_in_date', today)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      let planNameMap = new Map<string, string>();
      const planIds = Array.from(new Set((data ?? []).map((row) => row.plan_id).filter((value): value is string => Boolean(value))));
      if (planIds.length > 0) {
        const { data: plans } = await supabase.from('plans').select('id, name').in('id', planIds);
        planNameMap = new Map((plans ?? []).map((plan) => [plan.id, plan.name]));
      }

      setTodayReservations(
        (data ?? []).map((row) => ({
          id: row.id,
          planName: row.plan_id ? planNameMap.get(row.plan_id) ?? 'プラン未設定' : 'プラン未設定',
          checkInDate: row.check_in_date,
          checkOutDate: row.check_out_date,
          siteNumber: row.site_number,
          guests: row.guests,
        })),
      );
      setLoading(false);
    })();
  }, [isEntryMode, isLoggedIn, isReady, profile, today]);

  const loadReservations = useCallback(async () => {
    if (!reservationId && !qrToken) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    const response = await fetch(`/api/qr-access/reservations?${queryString}`, { cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));

    if (response.status === 401) {
      setNeedsPassword(true);
      setMember(null);
      setReservations([]);
      setLoading(false);
      return;
    }

    if (!response.ok) {
      setError(payload.error ?? '予約情報の確認に失敗しました。');
      setLoading(false);
      return;
    }

    setNeedsPassword(false);
    setMember(payload.member ?? null);
    setReservations(payload.reservations ?? []);
    setLoading(false);
  }, [queryString, qrToken, reservationId]);

  useEffect(() => {
    if (isEntryMode) return;
    queueMicrotask(() => {
      void loadReservations();
    });
  }, [isEntryMode, loadReservations]);

  const loadSessionDraft = useCallback(async () => {
    if (!reservationId && !qrToken) return;
    setSessionLoading(true);
    setError('');
    const response = await fetch(`/api/qr-access/session?${queryString}`, { cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    setSessionLoading(false);

    if (!response.ok) {
      setError(payload.error ?? 'チェックイン内容の確認に失敗しました。');
      return;
    }

    setDraft(normalizeDraft(payload.session ?? payload.preview));
    setAvailableOptions(payload.options ?? []);
    if (payload.session?.counter_token) {
      setConfirmedCounterToken(payload.session.counter_token);
    }
  }, [queryString, qrToken, reservationId]);

  useEffect(() => {
    if (isEntryMode || loading || needsPassword) return;
    if (targetReservation) {
      queueMicrotask(() => {
        void loadSessionDraft();
      });
    }
  }, [isEntryMode, loadSessionDraft, loading, needsPassword, targetReservation]);

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

  const startFromLineReservation = async (selectedReservationId: string) => {
    if (!profile?.userId) return;
    setStartingReservationId(selectedReservationId);
    setError('');
    const response = await fetch('/api/checkin/customer-entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'line-select',
        reservationId: selectedReservationId,
        userId: profile.userId,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setStartingReservationId(null);

    if (!response.ok) {
      setError(payload.error ?? 'チェックイン受付を開始できませんでした。');
      return;
    }

    const nextEntryToken =
      typeof payload.entryToken === 'string' && payload.entryToken.length > 0
        ? `&entryToken=${encodeURIComponent(payload.entryToken)}`
        : '';
    router.push(`/checkin?id=${selectedReservationId}${nextEntryToken}`);
  };

  const handleManualLookup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStartingReservationId('manual');
    setError('');

    const response = await fetch('/api/checkin/customer-entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'manual-lookup',
        receptionCode: manualCode,
        phone: manualPhone,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setStartingReservationId(null);

    if (!response.ok) {
      setError(payload.error ?? '本日の予約が見つかりませんでした。');
      return;
    }

    const nextEntryToken =
      typeof payload.entryToken === 'string' && payload.entryToken.length > 0
        ? `&entryToken=${encodeURIComponent(payload.entryToken)}`
        : '';
    router.push(`/checkin?id=${payload.reservationId}${nextEntryToken}`);
  };

  const updateDraft = <K extends keyof SessionDraft>(key: K, value: SessionDraft[K]) => {
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current, [key]: value };
      next.guests = Math.max(1, next.adults + next.children + next.infants);
      return next;
    });
  };

  const addOption = (option: SessionOption) => {
    setDraft((current) => {
      if (!current) return current;
      const quantity = 1;
      const days = option.priceType === 'per_day' ? Math.max(targetReservation?.nights ?? 1, 1) : 1;
      const people = option.category === 'event' || option.priceType === 'per_person' ? current.guests : quantity;
      const subtotal =
        option.priceType === 'per_day'
          ? option.price * quantity * days
          : option.priceType === 'per_person'
            ? option.price * people
            : option.priceType === 'fixed'
              ? option.price
              : option.price * quantity;

      const nextOptions = [
        ...current.optionsJson,
        {
          optionId: option.id,
          name: option.name,
          quantity,
          days: option.priceType === 'per_day' ? days : undefined,
          people: option.category === 'event' || option.priceType === 'per_person' ? people : undefined,
          subtotal,
          type: option.category === 'event' ? 'event' : 'rental',
        },
      ];

      const baseAmount = Math.max(0, Number(targetReservation?.totalAmount ?? 0) - Number(targetReservation?.optionTotal ?? 0));
      const optionTotal = nextOptions.reduce((sum, item) => sum + Number(item.subtotal ?? 0), 0);
      return { ...current, optionsJson: nextOptions, estimatedTotalAmount: baseAmount + optionTotal };
    });
  };

  const removeOption = (index: number) => {
    setDraft((current) => {
      if (!current) return current;
      const nextOptions = current.optionsJson.filter((_, optionIndex) => optionIndex !== index);
      const baseAmount = Math.max(0, Number(targetReservation?.totalAmount ?? 0) - Number(targetReservation?.optionTotal ?? 0));
      const optionTotal = nextOptions.reduce((sum, item) => sum + Number(item.subtotal ?? 0), 0);
      return { ...current, optionsJson: nextOptions, estimatedTotalAmount: baseAmount + optionTotal };
    });
  };

  const handleConfirm = async () => {
    if (!draft || !targetReservation) return;
    setConfirming(true);
    setError('');
    setMessage('');

    const response = await fetch('/api/qr-access/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reservationId: targetReservation.id,
        qrReservationId: reservationId,
        qrToken,
        entryToken,
        lineUserId: profile?.userId ?? null,
        ...draft,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setConfirming(false);

    if (!response.ok) {
      setError(payload.error ?? 'チェックイン内容の確定に失敗しました。');
      return;
    }

    if (payload.session) {
      setDraft(normalizeDraft(payload.session));
      setConfirmedCounterToken(payload.session.counter_token ?? null);
    }
    setMessage('内容を仮予約として確定しました。表示されたQRをレジでご提示ください。');
    await loadReservations();
  };

  if (isEntryMode) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-bold text-slate-950">本日のチェックイン</h1>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              本日ご来場のお客様は、ここから人数や追加項目を確認し、レジでの最終受付へ進めます。
            </p>
          </section>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">LINEから当日の予約を開く</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              LINEログイン済みの場合は、本日チェックイン予定の予約をそのまま選べます。
            </p>

            {!isReady ? (
              <p className="mt-4 text-sm text-slate-500">LINE情報を確認しています...</p>
            ) : !isLoggedIn ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                LINEログイン後に当日の予約一覧が表示されます。ログインしていない場合は下の予約番号入力をご利用ください。
              </div>
            ) : todayReservations.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                本日チェックイン予定の予約は見つかりませんでした。
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {todayReservations.map((reservation) => (
                  <button
                    key={reservation.id}
                    type="button"
                    onClick={() => void startFromLineReservation(reservation.id)}
                    disabled={startingReservationId === reservation.id}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-60"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-base font-bold text-slate-900">{reservation.planName}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          {reservation.checkInDate} - {reservation.checkOutDate}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {reservation.siteNumber ? `サイト ${reservation.siteNumber}` : 'サイト指定なし'} / {reservation.guests}名
                        </p>
                      </div>
                      <span className="text-sm font-bold text-emerald-700">
                        {startingReservationId === reservation.id ? '準備中...' : 'この予約を開く'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">予約番号から開く</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              LINEログインを使わない場合は、予約番号と電話番号で本日の予約を確認できます。
            </p>
            <form onSubmit={handleManualLookup} className="mt-4 space-y-4">
              <label className="block text-sm font-semibold text-slate-700">
                予約番号
                <input
                  type="text"
                  value={manualCode}
                  onChange={(event) => setManualCode(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="例: 09D0F2D3"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                電話番号
                <input
                  type="tel"
                  value={manualPhone}
                  onChange={(event) => setManualPhone(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="例: 09012345678"
                />
              </label>
              <button
                type="submit"
                disabled={startingReservationId === 'manual'}
                className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-base font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {startingReservationId === 'manual' ? '確認しています...' : '予約を開く'}
              </button>
            </form>
          </section>
        </div>
      </main>
    );
  }

  if (loading) {
    return <CenteredCard title="予約情報を確認しています" message="チェックイン情報を読み込んでいます。しばらくお待ちください。" />;
  }

  if (needsPassword) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-xl text-amber-700">!</div>
          <h1 className="mt-4 text-center text-xl font-bold text-slate-950">確認用パスワードが必要です</h1>
          <p className="mt-2 text-center text-sm leading-6 text-slate-600">予約QRから開いた場合は、管理棟で案内されたパスワードを入力してください。</p>
          <form onSubmit={handleAuthenticate} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold text-slate-700">
              パスワード
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                autoComplete="current-password"
              />
            </label>
            {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <button type="submit" disabled={authenticating} className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
              {authenticating ? '認証中...' : '認証して表示する'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  if (!targetReservation || !draft) {
    return <CenteredCard title="予約情報が見つかりません" message={error || '対象の予約を確認できませんでした。'} />;
  }

  const optionTotal = draft.optionsJson.reduce((sum, item) => sum + Number(item.subtotal ?? 0), 0);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-950">チェックイン内容の確認</h1>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                内容を確認し、必要な変更や追加があればこの画面で修正してください。
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
              合計見込み ¥{Number(draft.estimatedTotalAmount ?? 0).toLocaleString('ja-JP')}
            </span>
          </div>
          {message ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {message}
            </div>
          ) : null}
          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">ご予約内容</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <InfoItem label="予約番号" value={targetReservation.receptionCode} />
            <InfoItem label="プラン" value={targetReservation.planName} />
            <InfoItem label="宿泊日" value={`${targetReservation.checkInDate} - ${targetReservation.checkOutDate}`} />
            <InfoItem label="サイト" value={targetReservation.selectedSiteNumbers.join(' / ') || targetReservation.siteNumber || '指定なし'} />
            <InfoItem label="泊数" value={`${targetReservation.nights}泊`} />
            <InfoItem label="決済方法" value={targetReservation.paymentMethod ?? '未設定'} />
          </div>
          <p className="mt-4 text-sm text-slate-500">プラン・サイト番号・宿泊日の変更はこの画面ではできません。変更が必要な場合はスタッフへお声がけください。</p>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">お客様情報</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <LabeledField label="お名前" value={draft.userName} onChange={(value) => updateDraft('userName', value)} />
            <LabeledField label="電話番号" value={draft.userPhone ?? ''} onChange={(value) => updateDraft('userPhone', value || null)} />
            <LabeledField label="メールアドレス" value={draft.userEmail ?? ''} onChange={(value) => updateDraft('userEmail', value || null)} />
            <LabeledField label="性別" value={draft.userGender ?? ''} onChange={(value) => updateDraft('userGender', value || null)} />
            <LabeledField label="ご職業" value={draft.userOccupation ?? ''} onChange={(value) => updateDraft('userOccupation', value || null)} />
            <LabeledField label="来場のきっかけ" value={draft.userReferralSource ?? ''} onChange={(value) => updateDraft('userReferralSource', value || null)} />
          </div>
          <div className="mt-4">
            <LabeledTextarea label="ご住所" value={draft.userAddress ?? ''} onChange={(value) => updateDraft('userAddress', value || null)} rows={3} />
          </div>
          {member ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              予約時情報: {member.name || '-'} / {member.phone || '-'} / {member.email || '-'}
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">人数の確認</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <LabeledNumber label="大人" value={draft.adults} onChange={(value) => updateDraft('adults', Math.max(1, value))} min={1} />
            <LabeledNumber label="子ども" value={draft.children} onChange={(value) => updateDraft('children', Math.max(0, value))} min={0} />
            <LabeledNumber label="幼児" value={draft.infants} onChange={(value) => updateDraft('infants', Math.max(0, value))} min={0} />
            <InfoItem label="合計人数" value={`${draft.guests}名`} />
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">追加項目</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">レンタル、オプション、イベント参加を必要に応じて追加してください。</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {availableOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => addOption(option)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50"
              >
                <div className="text-base font-bold text-slate-900">{option.name}</div>
                <div className="mt-1 text-sm text-slate-600">
                  ¥{option.price.toLocaleString('ja-JP')}
                  {option.priceType === 'per_day' ? ' / 日' : option.priceType === 'per_person' ? ' / 人' : ''}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-3">
            {draft.optionsJson.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                追加項目はまだありません。
              </div>
            ) : (
              draft.optionsJson.map((option, index) => (
                <div key={`${option.optionId ?? option.name}-${index}`} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <div>
                    <p className="text-base font-bold text-slate-900">{option.name}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      数量 {option.quantity}
                      {option.people ? ` / 人数 ${option.people}` : ''}
                      {option.days ? ` / 日数 ${option.days}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-emerald-700">¥{Number(option.subtotal ?? 0).toLocaleString('ja-JP')}</span>
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-100"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">ご要望・メモ</h2>
          <div className="mt-4 space-y-4">
            <LabeledTextarea label="ご要望・備考" value={draft.specialRequests ?? ''} onChange={(value) => updateDraft('specialRequests', value || null)} rows={4} />
            <LabeledTextarea label="当日メモ" value={draft.customerNote ?? ''} onChange={(value) => updateDraft('customerNote', value || null)} rows={4} />
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">金額の確認</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <InfoItem label="追加項目合計" value={`¥${optionTotal.toLocaleString('ja-JP')}`} />
            <InfoItem label="予約合計見込み" value={`¥${Number(draft.estimatedTotalAmount ?? 0).toLocaleString('ja-JP')}`} />
            <InfoItem label="受付状態" value={confirmedCounterToken ? '仮予約内容を確定済み' : '未確定'} />
          </div>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirming || sessionLoading}
            className="mt-6 w-full rounded-2xl bg-emerald-600 px-4 py-4 text-lg font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {confirming ? '内容を確定しています...' : 'チェックインする'}
          </button>
        </section>

        {confirmedCounterToken ? (
          <section className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-emerald-800">レジへお進みください</h2>
            <p className="mt-3 text-base leading-8 text-slate-700">
              内容の確認ありがとうございます。下の会計用QRをスタッフへご提示ください。
            </p>
            <div className="mt-6">
              <QrDisplayCard
                rawValue={buildCounterSessionQrValue(confirmedCounterToken)}
                codeLabel="会計用QR"
                title="スタッフ用 会計確認QR"
              />
            </div>
          </section>
        ) : null}

        <div className="pb-8 text-center">
          <Link href="/mypage" className="inline-flex rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            マイページへ戻る
          </Link>
        </div>
      </div>
    </main>
  );
}

function CenteredCard({ title, message, children }: { title: string; message: string; children?: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-950">{title}</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">{message}</p>
        {children}
      </div>
    </main>
  );
}

function InfoItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="text-xs font-semibold tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-base font-bold text-slate-900">{value && value.length > 0 ? value : '未入力'}</div>
    </div>
  );
}

function LabeledField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

function LabeledTextarea({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

function LabeledNumber({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="text-xs font-semibold tracking-wide text-slate-500">{label}</div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="h-12 w-12 rounded-full border border-slate-300 bg-white text-xl font-bold text-slate-700 hover:bg-slate-100"
        >
          −
        </button>
        <span className="text-2xl font-bold text-slate-900">{value}</span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="h-12 w-12 rounded-full border border-slate-300 bg-white text-xl font-bold text-slate-700 hover:bg-slate-100"
        >
          ＋
        </button>
      </div>
    </div>
  );
}
