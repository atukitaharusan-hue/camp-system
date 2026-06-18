'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { InputHTMLAttributes } from 'react';
import type { Database } from '@/types/database';

type GuestReservationRow = Database['public']['Tables']['guest_reservations']['Row'];

type SessionOption = {
  id: string;
  name: string;
  category: string | null;
  price: number;
  priceType: string | null;
  eventDate?: string | null;
};

type DraftOption = {
  type?: string;
  optionId?: string;
  name?: string;
  quantity?: number;
  people?: number;
  days?: number;
  subtotal?: number;
};

type SessionDraft = {
  id?: string;
  status?: string;
  counter_token?: string;
  user_name?: string | null;
  user_phone?: string | null;
  user_email?: string | null;
  user_gender?: string | null;
  user_occupation?: string | null;
  user_address?: string | null;
  user_referral_source?: string | null;
  adults?: number;
  children?: number;
  infants?: number;
  guests?: number;
  special_requests?: string | null;
  selected_site_numbers?: string[];
  requested_site_count?: number;
  options_json?: DraftOption[];
  estimated_total_amount?: number;
  customer_note?: string | null;
  userName?: string;
  userPhone?: string | null;
  userEmail?: string | null;
  userGender?: string | null;
  userOccupation?: string | null;
  userAddress?: string | null;
  userReferralSource?: string | null;
  specialRequests?: string | null;
  selectedSiteNumbers?: string[];
  requestedSiteCount?: number;
  optionsJson?: DraftOption[];
  estimatedTotalAmount?: number;
  customerNote?: string | null;
};

function normalizeDraft(
  draft: SessionDraft | null,
): Required<
  Pick<
    SessionDraft,
    | 'userName'
    | 'userPhone'
    | 'userEmail'
    | 'adults'
    | 'children'
    | 'infants'
    | 'guests'
    | 'userGender'
    | 'userOccupation'
    | 'userAddress'
    | 'userReferralSource'
    | 'specialRequests'
    | 'selectedSiteNumbers'
    | 'requestedSiteCount'
    | 'optionsJson'
    | 'estimatedTotalAmount'
    | 'customerNote'
  >
> & { id?: string; status?: string; counterToken?: string } {
  return {
    id: draft?.id,
    status: draft?.status,
    counterToken: draft?.counter_token,
    userName: draft?.userName ?? draft?.user_name ?? '',
    userPhone: draft?.userPhone ?? draft?.user_phone ?? null,
    userEmail: draft?.userEmail ?? draft?.user_email ?? null,
    userGender: draft?.userGender ?? draft?.user_gender ?? null,
    userOccupation: draft?.userOccupation ?? draft?.user_occupation ?? null,
    userAddress: draft?.userAddress ?? draft?.user_address ?? null,
    userReferralSource: draft?.userReferralSource ?? draft?.user_referral_source ?? null,
    adults: draft?.adults ?? 1,
    children: draft?.children ?? 0,
    infants: draft?.infants ?? 0,
    guests:
      draft?.guests ??
      (draft?.adults ?? 1) + (draft?.children ?? 0) + (draft?.infants ?? 0),
    specialRequests: draft?.specialRequests ?? draft?.special_requests ?? null,
    selectedSiteNumbers:
      draft?.selectedSiteNumbers ?? draft?.selected_site_numbers ?? [],
    requestedSiteCount: draft?.requestedSiteCount ?? draft?.requested_site_count ?? 1,
    optionsJson: draft?.optionsJson ?? draft?.options_json ?? [],
    estimatedTotalAmount:
      draft?.estimatedTotalAmount ?? draft?.estimated_total_amount ?? 0,
    customerNote: draft?.customerNote ?? draft?.customer_note ?? null,
  };
}

function getSubtotal(
  option: SessionOption,
  quantity: number,
  days: number,
  people: number,
) {
  if (option.priceType === 'per_day') return option.price * quantity * days;
  if (option.priceType === 'per_person') return option.price * people;
  if (option.priceType === 'fixed') return quantity > 0 ? option.price : 0;
  return option.price * quantity;
}

export default function AdminCheckinSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
          チェックイン情報を読み込んでいます...
        </div>
      }
    >
      <AdminCheckinSessionContent />
    </Suspense>
  );
}

function AdminCheckinSessionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const reservationId = searchParams.get('reservationId');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<'choice' | 'cashier' | 'edit' | 'checkin'>(
    'choice',
  );
  const [reservation, setReservation] = useState<GuestReservationRow | null>(null);
  const [draft, setDraft] = useState<ReturnType<typeof normalizeDraft> | null>(
    null,
  );
  const [availableOptions, setAvailableOptions] = useState<SessionOption[]>([]);
  const [receivedAmount, setReceivedAmount] = useState('');

  const optionTotal = useMemo(
    () =>
      (draft?.optionsJson ?? []).reduce(
        (sum, item) => sum + Number(item.subtotal ?? 0),
        0,
      ),
    [draft],
  );

  const changeAmount = useMemo(() => {
    const received = Number(receivedAmount || 0);
    const total = Number(draft?.estimatedTotalAmount ?? 0);
    return Math.max(0, received - total);
  }, [draft?.estimatedTotalAmount, receivedAmount]);

  const loadSession = useCallback(async () => {
    if (!token && !reservationId) {
      setError('対象のチェックイン情報が見つかりません。');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (token) params.set('token', token);
    if (reservationId) params.set('reservationId', reservationId);

    const response = await fetch(`/api/admin/checkin-sessions?${params.toString()}`, {
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(payload.error ?? 'チェックイン情報の取得に失敗しました。');
      return;
    }

    setReservation(payload.reservation ?? null);
    setDraft(normalizeDraft(payload.session ?? null));
    setAvailableOptions(Array.isArray(payload.options) ? payload.options : []);
  }, [reservationId, token]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadSession();
    });
  }, [loadSession]);

  const updateDraft = <
    K extends keyof NonNullable<typeof draft>,
  >(
    key: K,
    value: NonNullable<typeof draft>[K],
  ) => {
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current, [key]: value };
      next.guests = next.adults + next.children + next.infants;
      return next;
    });
  };

  const addOption = (option: SessionOption) => {
    setDraft((current) => {
      if (!current) return current;
      const quantity = 1;
      const days =
        option.priceType === 'per_day'
          ? Math.max(reservation?.nights ?? 1, 1)
          : 1;
      const people =
        option.category === 'event' || option.priceType === 'per_person'
          ? current.guests
          : quantity;
      const subtotal = getSubtotal(option, quantity, days, people);
      const nextOptions = [
        ...current.optionsJson,
        {
          type: option.category === 'event' ? 'event' : 'rental',
          optionId: option.id,
          name: option.name,
          quantity,
          days: option.priceType === 'per_day' ? days : undefined,
          people:
            option.category === 'event' || option.priceType === 'per_person'
              ? people
              : undefined,
          subtotal,
        },
      ];
      return {
        ...current,
        optionsJson: nextOptions,
        estimatedTotalAmount: Math.max(
          0,
          Number(current.estimatedTotalAmount ?? 0) + subtotal,
        ),
      };
    });
  };

  const removeOption = (index: number) => {
    setDraft((current) => {
      if (!current) return current;
      const target = current.optionsJson[index];
      const nextOptions = current.optionsJson.filter(
        (_, optionIndex) => optionIndex !== index,
      );
      return {
        ...current,
        optionsJson: nextOptions,
        estimatedTotalAmount: Math.max(
          0,
          Number(current.estimatedTotalAmount ?? 0) -
            Number(target?.subtotal ?? 0),
        ),
      };
    });
  };

  const saveDraft = useCallback(
    async (status: 'arrived_pending' | 'counter_processing' = 'counter_processing') => {
      if (!reservation || !draft) return null;
      setSaving(true);
      setError('');
      setMessage('');
      const response = await fetch('/api/admin/checkin-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          reservationId: reservation.id,
          status,
          userName: draft.userName,
          userPhone: draft.userPhone,
          userEmail: draft.userEmail,
          userGender: draft.userGender,
          userOccupation: draft.userOccupation,
          userAddress: draft.userAddress,
          userReferralSource: draft.userReferralSource,
          adults: draft.adults,
          children: draft.children,
          infants: draft.infants,
          specialRequests: draft.specialRequests,
          customerNote: draft.customerNote,
          selectedSiteNumbers: draft.selectedSiteNumbers,
          requestedSiteCount: draft.requestedSiteCount,
          optionsJson: draft.optionsJson,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      setSaving(false);

      if (!response.ok) {
        setError(payload.error ?? '内容の保存に失敗しました。');
        return null;
      }

      const normalized = normalizeDraft(payload.session ?? null);
      setDraft(normalized);
      setMessage('内容を保存しました。');
      return normalized.id ?? null;
    },
    [draft, reservation],
  );

  const finalize = async () => {
    if (!draft) return;
    setFinalizing(true);
    setError('');
    setMessage('');

    let sessionId = draft.id ?? null;
    if (!sessionId) {
      sessionId = await saveDraft('counter_processing');
    }

    if (!sessionId) {
      setFinalizing(false);
      return;
    }

    const response = await fetch('/api/admin/checkin-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'finalize', sessionId }),
    });
    const payload = await response.json().catch(() => ({}));
    setFinalizing(false);

    if (!response.ok) {
      setError(payload.error ?? '最終確定に失敗しました。');
      return;
    }

    setMessage('チェックインを最終確定しました。');
    await loadSession();
  };

  const cancelReservation = async () => {
    if (!reservation) return;
    const confirmed = window.confirm(
      'この予約をキャンセルします。よろしいですか？',
    );
    if (!confirmed) return;

    setCancelling(true);
    setError('');
    setMessage('');
    const response = await fetch('/api/admin/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'cancel',
        id: reservation.id,
        adminEmail: 'admin',
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setCancelling(false);

    if (!response.ok || payload.success === false) {
      setError(payload.error ?? 'キャンセルに失敗しました。');
      return;
    }

    setMessage('予約をキャンセルしました。');
    await loadSession();
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
        チェックイン情報を読み込んでいます...
      </div>
    );
  }

  if (error && !reservation) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            受付操作メニュー
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            お客様情報を確認し、必要な受付処理を選択してください。
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/admin/qr-scan')}
          className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          QR読取へ戻る
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      {reservation && draft ? (
        <>
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {draft.userName || reservation.user_name || '予約者名未設定'}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  受付コード: {reservation.id.replace(/-/g, '').slice(0, 8).toUpperCase()}
                </p>
              </div>
              <div className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                現在ステータス: {String(reservation.status ?? '-')}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <InfoItem
                label="宿泊日"
                value={`${reservation.check_in_date} - ${reservation.check_out_date}`}
              />
              <InfoItem
                label="人数"
                value={`大人 ${draft.adults} / 子ども ${draft.children} / 幼児 ${draft.infants}`}
              />
              <InfoItem
                label="予定合計"
                value={`¥${Number(draft.estimatedTotalAmount ?? 0).toLocaleString()}`}
              />
              <InfoItem
                label="電話番号"
                value={draft.userPhone || reservation.user_phone || '-'}
              />
              <InfoItem
                label="メール"
                value={draft.userEmail || reservation.user_email || '-'}
              />
              <InfoItem
                label="サイト"
                value={
                  draft.selectedSiteNumbers.length > 0
                    ? draft.selectedSiteNumbers.join(', ')
                    : reservation.site_number || '指定なし'
                }
              />
              <InfoItem label="性別" value={draft.userGender || reservation.user_gender || '-'} />
              <InfoItem
                label="職業"
                value={draft.userOccupation || reservation.user_occupation || '-'}
              />
              <InfoItem
                label="紹介元"
                value={draft.userReferralSource || reservation.user_referral_source || '-'}
              />
            </div>

            {(draft.userAddress || draft.specialRequests || draft.customerNote) && (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <TextPanel label="住所" value={draft.userAddress || reservation.user_address || '-'} />
                <TextPanel label="備考" value={draft.specialRequests || reservation.special_requests || '-'} />
                <TextPanel label="受付メモ" value={draft.customerNote || '-'} />
              </div>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-3 text-sm font-semibold text-gray-700">
              受付で行う操作を選択してください
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <ActionButton
                active={mode === 'checkin'}
                label="チェックイン"
                description="会計不要または確認後に、そのまま受付完了に進みます。"
                onClick={() => setMode('checkin')}
              />
              <ActionButton
                active={mode === 'cashier'}
                label="会計の追加/修正"
                description="追加購入や金額確認を行い、レジ会計へ進みます。"
                onClick={() => setMode('cashier')}
              />
              <ActionButton
                active={mode === 'edit'}
                label="予約情報の変更"
                description="人数、連絡先、備考、追加オプションを修正します。"
                onClick={() => setMode('edit')}
              />
              <ActionButton
                active={false}
                label={cancelling ? 'キャンセル中...' : 'キャンセル'}
                description="危険操作です。確認後に予約をキャンセルします。"
                danger
                onClick={() => {
                  void cancelReservation();
                }}
              />
            </div>
          </section>

          {(mode === 'edit' || mode === 'cashier') && (
            <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="text-base font-semibold text-gray-900">
                内容の確認と修正
              </h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <LabeledNumber
                  label="大人"
                  value={draft.adults}
                  onChange={(value) => updateDraft('adults', Math.max(1, value))}
                  min={1}
                />
                <LabeledNumber
                  label="子ども"
                  value={draft.children}
                  onChange={(value) => updateDraft('children', Math.max(0, value))}
                  min={0}
                />
                <LabeledNumber
                  label="幼児"
                  value={draft.infants}
                  onChange={(value) => updateDraft('infants', Math.max(0, value))}
                  min={0}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <LabeledField
                  label="予約者名"
                  value={draft.userName}
                  onChange={(value) => updateDraft('userName', value)}
                />
                <LabeledField
                  label="電話番号"
                  value={draft.userPhone ?? ''}
                  onChange={(value) => updateDraft('userPhone', value || null)}
                />
                <LabeledField
                  label="メールアドレス"
                  value={draft.userEmail ?? ''}
                  onChange={(value) => updateDraft('userEmail', value || null)}
                />
                <LabeledField
                  label="性別"
                  value={draft.userGender ?? ''}
                  onChange={(value) => updateDraft('userGender', value || null)}
                />
                <LabeledField
                  label="職業"
                  value={draft.userOccupation ?? ''}
                  onChange={(value) => updateDraft('userOccupation', value || null)}
                />
                <LabeledField
                  label="紹介元"
                  value={draft.userReferralSource ?? ''}
                  onChange={(value) =>
                    updateDraft('userReferralSource', value || null)
                  }
                />
              </div>
              <LabeledTextarea
                label="住所"
                value={draft.userAddress ?? ''}
                onChange={(value) => updateDraft('userAddress', value || null)}
                rows={2}
              />
              <LabeledTextarea
                label="備考"
                value={draft.specialRequests ?? ''}
                onChange={(value) =>
                  updateDraft('specialRequests', value || null)
                }
                rows={3}
              />
              <LabeledTextarea
                label="受付メモ"
                value={draft.customerNote ?? ''}
                onChange={(value) => updateDraft('customerNote', value || null)}
                rows={3}
              />

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <h3 className="text-sm font-semibold text-gray-900">
                  追加できるオプション・イベント
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {availableOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => addOption(option)}
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                    >
                      {option.name} / ¥{option.price.toLocaleString()}
                    </button>
                  ))}
                </div>
                <div className="mt-4 space-y-2">
                  {draft.optionsJson.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      追加項目はまだありません。
                    </p>
                  ) : (
                    draft.optionsJson.map((option, index) => (
                      <div
                        key={`${option.optionId ?? option.name ?? 'option'}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-3"
                      >
                        <div>
                          <div className="font-medium text-gray-900">
                            {option.name ?? '追加項目'}
                          </div>
                          <div className="text-sm text-gray-500">
                            数量 {option.quantity ?? 1} / 小計 ¥
                            {Number(option.subtotal ?? 0).toLocaleString()}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeOption(index)}
                          className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                        >
                          削除
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-3 text-right text-sm font-semibold text-gray-900">
                  追加項目合計 ¥{optionTotal.toLocaleString()}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    void saveDraft('counter_processing');
                  }}
                  disabled={saving}
                  className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? '保存中...' : '内容を保存する'}
                </button>
              </div>
            </section>
          )}

          {mode === 'cashier' && (
            <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="text-base font-semibold text-gray-900">
                レジ会計
              </h2>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="text-sm text-amber-900">お支払い金額</div>
                <div className="mt-1 text-3xl font-bold text-amber-950">
                  ¥{Number(draft.estimatedTotalAmount ?? 0).toLocaleString()}
                </div>
              </div>
              <LabeledField
                label="預かり金"
                value={receivedAmount}
                onChange={setReceivedAmount}
                inputMode="numeric"
              />
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                お釣り{' '}
                <span className="font-semibold text-gray-900">
                  ¥{changeAmount.toLocaleString()}
                </span>
              </div>
              <button
                type="button"
                onClick={finalize}
                disabled={finalizing}
                className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-base font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {finalizing ? '最終確定中...' : '会計を完了してチェックイン確定'}
              </button>
            </section>
          )}

          {mode === 'checkin' && (
            <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="text-base font-semibold text-gray-900">
                チェックイン確定
              </h2>
              <p className="text-sm text-gray-600">
                会計が不要な場合や確認のみで完了する場合は、そのまま最終確定できます。
              </p>
              <button
                type="button"
                onClick={finalize}
                disabled={finalizing}
                className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-base font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {finalizing ? '最終確定中...' : 'チェックインを最終確定する'}
              </button>
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}

function ActionButton({
  active,
  label,
  description,
  onClick,
  danger = false,
}: {
  active: boolean;
  label: string;
  description: string;
  onClick: () => void;
  danger?: boolean;
}) {
  const base = danger
    ? 'border-red-200 bg-red-50 hover:border-red-300'
    : active
      ? 'border-blue-500 bg-blue-50 shadow-sm'
      : 'border-gray-200 bg-white hover:border-gray-300';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${base}`}
    >
      <div className={`font-semibold ${danger ? 'text-red-700' : 'text-gray-900'}`}>
        {label}
      </div>
      <div className="mt-1 text-xs leading-5 text-gray-500">{description}</div>
    </button>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-3">
      <div className="text-xs font-semibold text-gray-500">{label}</div>
      <div className="mt-1 break-words text-sm font-medium text-gray-900">
        {value}
      </div>
    </div>
  );
}

function TextPanel({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
      <div className="text-xs font-semibold text-gray-500">{label}</div>
      <div className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-900">
        {value}
      </div>
    </div>
  );
}

function LabeledField({
  label,
  value,
  onChange,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  return (
    <label className="block text-sm font-semibold text-gray-700">
      <span className="mb-2 block">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode={inputMode}
        className="w-full rounded-xl border border-gray-300 px-3 py-3 text-base"
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
    <label className="block text-sm font-semibold text-gray-700">
      <span className="mb-2 block">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="w-full rounded-xl border border-gray-300 px-3 py-3 text-base"
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
    <label className="block text-sm font-semibold text-gray-700">
      <span className="mb-2 block">{label}</span>
      <input
        type="number"
        min={min}
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || min)}
        className="w-full rounded-xl border border-gray-300 px-3 py-3 text-base"
      />
    </label>
  );
}
