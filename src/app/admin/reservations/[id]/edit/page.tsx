'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { fetchReservationByIdAdmin } from '@/lib/admin/fetchReservations';
import { updateReservation } from '@/lib/admin/updateReservation';
import { fetchOptions, fetchPlans, fetchSiteDetails } from '@/lib/admin/fetchData';
import { getSiteAvailabilityForStay } from '@/lib/bookingAvailability';
import {
  ReservationOptionEditor,
  buildReservationOptionsJson,
  parseReservationOptions,
  type ReservationOptionDraft,
} from '@/components/admin/ReservationOptionEditor';
import { generateReceptionCode } from '@/types/reservation';
import type { Database } from '@/types/database';
import type { AdminPlan } from '@/types/admin';
import type { OptionItem } from '@/types/options';
import type { SiteDetail } from '@/types/site';

type GuestReservationRow = Database['public']['Tables']['guest_reservations']['Row'];
type PaymentMethod = Database['public']['Enums']['payment_method'];
type PaymentStatus = Database['public']['Enums']['payment_status'];
type ReservationStatus = Database['public']['Enums']['reservation_status'];

type PlanReservationBlock = {
  id: string;
  planId: string;
  siteCount: number;
  siteNumbers: string[];
};

type SiteAvailabilityMap = Record<string, Record<string, boolean>>;

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: '現地払い(現金のみ)' },
  { value: 'credit_card', label: 'クレジットカード' },
  { value: 'bank_transfer', label: '銀行振込' },
];

const PAYMENT_STATUS_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: 'pending', label: '未入金' },
  { value: 'paid', label: '入金済み' },
  { value: 'refunded', label: '返金済み' },
  { value: 'failed', label: '決済失敗' },
];

const RESERVATION_STATUS_OPTIONS: { value: ReservationStatus; label: string }[] = [
  { value: 'pending', label: '仮予約' },
  { value: 'confirmed', label: '予約確定' },
  { value: 'checked_in', label: 'チェックイン済み' },
  { value: 'completed', label: '完了' },
  { value: 'cancelled', label: 'キャンセル' },
];

const SYSTEM_MEMO_PREFIXES = [
  'PLAN_ID:',
  'REQUESTED_SITE_COUNT:',
  'SELECTED_SITE_NUMBERS:',
  'MULTI_PLAN_ITEMS:',
  'GENDER:',
  'OCCUPATION:',
  'POSTAL_CODE:',
  'PREFECTURE:',
  'CITY:',
  'ADDRESS_LINE:',
  'BUILDING:',
  'LINE_NAME:',
  'LINE_ID:',
  'REFERRAL_SOURCE:',
];

function createPlanBlock(overrides: Partial<PlanReservationBlock> = {}): PlanReservationBlock {
  const siteCount = Math.max(1, Number(overrides.siteCount ?? 1));
  const siteNumbers = Array.from({ length: siteCount }, (_, index) => overrides.siteNumbers?.[index] ?? '');

  return {
    id: overrides.id ?? `plan-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    planId: overrides.planId ?? '',
    siteCount,
    siteNumbers,
  };
}

function addDays(dateStr: string, days: number) {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getSelectedSiteNumbers(value: GuestReservationRow['selected_site_numbers'], fallback?: string | null) {
  if (Array.isArray(value)) {
    return value.filter((siteNumber): siteNumber is string => typeof siteNumber === 'string' && siteNumber.trim().length > 0);
  }
  return fallback ? [fallback] : [];
}

function parseMultiPlanItems(value: string | null | undefined): Array<{ planId: string; siteCount: number; siteNumbers: string[] }> {
  const match = (value ?? '').match(/^MULTI_PLAN_ITEMS:\s*(.+)$/m);
  if (!match) return [];

  try {
    const parsed = JSON.parse(match[1]) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const source = item as { planId?: unknown; siteCount?: unknown; siteNumbers?: unknown };
        const planId = typeof source.planId === 'string' ? source.planId : '';
        const siteCount = Math.max(1, Number(source.siteCount ?? 1));
        const siteNumbers = Array.isArray(source.siteNumbers)
          ? source.siteNumbers.filter((siteNumber): siteNumber is string => typeof siteNumber === 'string')
          : [];
        return planId ? { planId, siteCount, siteNumbers } : null;
      })
      .filter((item): item is { planId: string; siteCount: number; siteNumbers: string[] } => Boolean(item));
  } catch {
    return [];
  }
}

function stripSystemMemo(value: string | null | undefined) {
  return (value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => !SYSTEM_MEMO_PREFIXES.some((prefix) => line.startsWith(prefix)))
    .map((line) => (line.startsWith('NOTE:') ? line.slice(5).trim() : line))
    .filter(Boolean)
    .join('\n');
}

function buildInitialPlanBlocks(reservation: GuestReservationRow): PlanReservationBlock[] {
  const multiPlanItems = parseMultiPlanItems(reservation.special_requests);
  if (multiPlanItems.length > 0) {
    return multiPlanItems.map((item) => createPlanBlock(item));
  }

  const siteNumbers = getSelectedSiteNumbers(reservation.selected_site_numbers, reservation.site_number);
  const siteCount = Math.max(1, reservation.reserved_site_count ?? (siteNumbers.length || 1));

  return [
    createPlanBlock({
      planId: reservation.plan_id ?? '',
      siteCount,
      siteNumbers,
    }),
  ];
}

function Field({ label, children, required }: { label: string; children: ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function EditReservationPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [reservation, setReservation] = useState<GuestReservationRow | null>(null);
  const [allPlans, setAllPlans] = useState<AdminPlan[]>([]);
  const [allSiteDetails, setAllSiteDetails] = useState<SiteDetail[]>([]);
  const [allOptions, setAllOptions] = useState<OptionItem[]>([]);
  const [planBlocks, setPlanBlocks] = useState<PlanReservationBlock[]>([createPlanBlock()]);
  const [siteAvailability, setSiteAvailability] = useState<SiteAvailabilityMap>({});
  const [reservationOptions, setReservationOptions] = useState<ReservationOptionDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [pets, setPets] = useState(0);
  const [cars, setCars] = useState(0);
  const [specialRequests, setSpecialRequests] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('pending');
  const [reservationStatus, setReservationStatus] = useState<ReservationStatus>('confirmed');
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      const [reservationResult, plans, sites, options] = await Promise.all([
        fetchReservationByIdAdmin(id),
        fetchPlans(),
        fetchSiteDetails(),
        fetchOptions(),
      ]);

      if (!active) return;

      if (reservationResult.error || !reservationResult.data) {
        setError(reservationResult.error ?? '予約が見つかりません。');
        setLoading(false);
        return;
      }

      const row = reservationResult.data;
      setReservation(row);
      setAllPlans(plans);
      setAllSiteDetails(sites);
      setAllOptions(options);
      setPlanBlocks(buildInitialPlanBlocks(row));
      setReservationOptions(parseReservationOptions(row.options_json));
      setCheckInDate(row.check_in_date);
      setCheckOutDate(row.check_out_date);
      setAdults(row.adults ?? row.guests ?? 1);
      setChildren(row.children ?? 0);
      setInfants(row.infants ?? 0);
      setPets(row.pets ?? 0);
      setCars(row.cars ?? 0);
      setSpecialRequests(stripSystemMemo(row.special_requests));
      setPaymentMethod(row.payment_method ?? 'cash');
      setPaymentStatus(row.payment_status ?? 'pending');
      setReservationStatus((row.status ?? 'confirmed') as ReservationStatus);
      setTotalAmount(Number(row.total_amount ?? 0));
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!checkInDate || !checkOutDate) return;

    let active = true;
    Promise.all(
      planBlocks
        .filter((block) => block.planId)
        .map(async (block) => {
          const items = await getSiteAvailabilityForStay(checkInDate, checkOutDate, block.planId);
          return [
            block.id,
            Object.fromEntries(items.map((item) => [item.siteNumber, item.isAvailable])),
          ] as const;
        }),
    ).then((entries) => {
      if (!active) return;
      setSiteAvailability(Object.fromEntries(entries));
    });

    return () => {
      active = false;
    };
  }, [checkInDate, checkOutDate, planBlocks]);

  const effectiveSiteAvailability = checkInDate && checkOutDate ? siteAvailability : {};

  const totalGuests = adults + children + infants;
  const checkOutMin = checkInDate ? addDays(checkInDate, 1) : '';
  const nights = useMemo(() => {
    if (!checkInDate || !checkOutDate || checkOutDate <= checkInDate) return 0;
    return Math.ceil((new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / (1000 * 60 * 60 * 24));
  }, [checkInDate, checkOutDate]);

  const getSitesForPlan = useCallback(
    (planId: string) => {
      const selectedPlan = allPlans.find((plan) => plan.id === planId);
      if (!selectedPlan) return [];
      return allSiteDetails.filter((site) => selectedPlan.targetSiteIds.includes(site.id));
    },
    [allPlans, allSiteDetails],
  );

  const editableOptions = useMemo(() => {
    const selectedPlanIds = new Set(planBlocks.map((block) => block.planId).filter(Boolean));
    if (selectedPlanIds.size === 0) return allOptions;

    const applicableOptionIds = new Set<string>();
    allPlans
      .filter((plan) => selectedPlanIds.has(plan.id))
      .forEach((plan) => {
        plan.applicableOptionIds.forEach((optionId) => applicableOptionIds.add(optionId));
      });

    return allOptions.filter((option) => applicableOptionIds.has(option.id));
  }, [allOptions, allPlans, planBlocks]);

  const normalizePlanItems = useCallback(
    (blocks = planBlocks) =>
      blocks
        .filter((block) => block.planId)
        .map((block) => ({
          planId: block.planId,
          siteCount: Math.max(1, block.siteCount),
          siteNumbers: block.siteNumbers.filter(Boolean),
        })),
    [planBlocks],
  );

  const updatePlanBlock = (blockId: string, updater: (block: PlanReservationBlock) => PlanReservationBlock) => {
    setPlanBlocks((prev) => prev.map((block) => (block.id === blockId ? updater(block) : block)));
    setError(null);
    setSuccess(false);
  };

  const addPlanBlock = () => {
    setPlanBlocks((prev) => [...prev, createPlanBlock()]);
  };

  const removePlanBlock = (blockId: string) => {
    setPlanBlocks((prev) => (prev.length > 1 ? prev.filter((block) => block.id !== blockId) : prev));
  };

  const handleSubmit = useCallback(async () => {
    setError(null);
    setSuccess(false);

    const planItems = normalizePlanItems();
    const selectedSiteNumbers = planItems.flatMap((item) => item.siteNumbers);

    if (planItems.length === 0) {
      setError('プランを1つ以上選択してください。');
      return;
    }

    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const result = await updateReservation(
      id,
      {
        checkInDate,
        checkOutDate,
        guests: totalGuests,
        adults,
        children,
        infants,
        pets,
        cars,
        siteNumber: selectedSiteNumbers[0] ?? '',
        specialRequests,
        paymentMethod,
        paymentStatus,
        status: reservationStatus,
        totalAmount,
        optionsJson: buildReservationOptionsJson(reservationOptions) as Database['public']['Tables']['guest_reservations']['Row']['options_json'],
        planId: planItems[0]?.planId,
        requestedSiteCount: planItems.reduce((sum, item) => sum + item.siteCount, 0) || 1,
        selectedSiteNumbers,
        planItems,
      },
      user?.email ?? 'unknown',
    );

    setSaving(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push(`/admin/reservations/${id}`), 900);
  }, [
    id,
    checkInDate,
    checkOutDate,
    totalGuests,
    adults,
    children,
    infants,
    pets,
    cars,
    specialRequests,
    paymentMethod,
    paymentStatus,
    reservationStatus,
    totalAmount,
    reservationOptions,
    normalizePlanItems,
    router,
  ]);

  if (loading) {
    return <div className="max-w-4xl p-4 text-sm text-gray-500">読み込み中...</div>;
  }

  if (!reservation) {
    return (
      <div className="max-w-3xl">
        <Link href="/admin/reservations" className="mb-4 inline-block text-sm text-blue-600 hover:underline">
          &larr; 予約一覧に戻る
        </Link>
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error ?? '予約が見つかりません。'}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link href={`/admin/reservations/${id}`} className="text-sm text-blue-600 hover:underline">
          &larr; 詳細に戻る
        </Link>
        <h1 className="text-xl font-bold text-gray-900">
          予約変更 {generateReceptionCode(reservation.id)}
        </h1>
      </div>

      <section className="mb-5 rounded border border-gray-200 bg-gray-50 p-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">予約者情報（変更不可）</h2>
        <div className="grid gap-2 text-sm text-gray-600 sm:grid-cols-3">
          <p>予約者名: {reservation.user_name}</p>
          <p>メール: {reservation.user_email ?? '未設定'}</p>
          <p>電話: {reservation.user_phone ?? '未設定'}</p>
        </div>
      </section>

      {error && (
        <div className="mb-4 whitespace-pre-wrap rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          予約を更新しました。詳細画面へ戻ります。
        </div>
      )}

      <div className="space-y-6">
        <section className="rounded border border-gray-200 bg-white p-5">
          <h2 className="mb-4 border-b border-gray-100 pb-2 text-sm font-semibold text-gray-800">宿泊情報</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="チェックイン日" required>
              <input
                type="date"
                value={checkInDate}
                onChange={(event) => {
                  const nextCheckInDate = event.target.value;
                  setCheckInDate(nextCheckInDate);
                  if (checkOutDate && checkOutDate <= nextCheckInDate) {
                    setCheckOutDate(addDays(nextCheckInDate, 1));
                  }
                }}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="チェックアウト日" required>
              <input
                type="date"
                min={checkOutMin}
                value={checkOutDate}
                onChange={(event) => setCheckOutDate(event.target.value)}
                disabled={!checkInDate}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
              />
            </Field>
            <Field label="大人(中学生以上)" required>
              <input type="number" min={1} value={adults} onChange={(event) => setAdults(parseInt(event.target.value, 10) || 1)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </Field>
            <Field label="子供">
              <input type="number" min={0} value={children} onChange={(event) => setChildren(parseInt(event.target.value, 10) || 0)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </Field>
            <Field label="幼児">
              <input type="number" min={0} value={infants} onChange={(event) => setInfants(parseInt(event.target.value, 10) || 0)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </Field>
            <Field label="合計人数">
              <input type="number" value={totalGuests} readOnly className="w-full rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600" />
            </Field>
            <Field label="ペット数">
              <input type="number" min={0} value={pets} onChange={(event) => setPets(parseInt(event.target.value, 10) || 0)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </Field>
            <Field label="車両数">
              <input type="number" min={0} value={cars} onChange={(event) => setCars(parseInt(event.target.value, 10) || 0)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </Field>
          </div>
          {nights > 0 && <p className="mt-3 text-sm text-gray-500">{nights}泊</p>}
        </section>

        <section className="rounded border border-gray-200 bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">プラン・サイト構成</h2>
              <p className="mt-1 text-xs text-gray-500">大カテゴリ: プラン / 中カテゴリ: サイト数 / 小カテゴリ: サイト番号</p>
            </div>
            <button type="button" onClick={addPlanBlock} className="rounded-full border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50">
              プランを追加
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {planBlocks.map((block, blockIndex) => {
              const selectedPlan = allPlans.find((plan) => plan.id === block.planId);
              const sitesForPlan = getSitesForPlan(block.planId);
              const availabilityForBlock = effectiveSiteAvailability[block.id] ?? {};
              const maxSiteCount = Math.max(1, selectedPlan?.maxConcurrentReservations ?? block.siteCount ?? 10);

              return (
                <div key={block.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold text-gray-800">プラン {blockIndex + 1}</h3>
                    {planBlocks.length > 1 && (
                      <button type="button" onClick={() => removePlanBlock(block.id)} className="text-xs font-medium text-red-600 hover:underline">
                        削除
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    <Field label="大カテゴリ：プラン" required>
                      <select
                        value={block.planId}
                        onChange={(event) =>
                          updatePlanBlock(block.id, (current) => ({
                            ...current,
                            planId: event.target.value,
                            siteNumbers: Array.from({ length: current.siteCount }, () => ''),
                          }))
                        }
                        className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
                      >
                        <option value="">選択してください</option>
                        {allPlans.map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.name}
                            {!plan.isPublished ? '（非公開）' : ''}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="中カテゴリ：サイト数">
                      <select
                        value={block.siteCount}
                        onChange={(event) => {
                          const nextCount = Math.max(1, Number(event.target.value));
                          updatePlanBlock(block.id, (current) => ({
                            ...current,
                            siteCount: nextCount,
                            siteNumbers: Array.from({ length: nextCount }, (_, index) => current.siteNumbers[index] ?? ''),
                          }));
                        }}
                        className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
                      >
                        {Array.from({ length: Math.max(maxSiteCount, block.siteCount) }, (_, index) => index + 1).map((count) => (
                          <option key={count} value={count}>
                            {count}サイト
                          </option>
                        ))}
                      </select>
                    </Field>

                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-gray-600">小カテゴリ：サイト番号</p>
                      {Array.from({ length: block.siteCount }, (_, siteIndex) => {
                        const currentValue = block.siteNumbers[siteIndex] ?? '';

                        return (
                          <select
                            key={`${block.id}-${siteIndex}`}
                            value={currentValue}
                            onChange={(event) =>
                              updatePlanBlock(block.id, (current) => ({
                                ...current,
                                siteNumbers: current.siteNumbers.map((siteNumber, index) =>
                                  index === siteIndex ? event.target.value : siteNumber,
                                ),
                              }))
                            }
                            disabled={!block.planId}
                            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-gray-100"
                          >
                            <option value="">指定なし</option>
                            {sitesForPlan.map((site) => {
                              const isAvailable = availabilityForBlock[site.siteNumber] ?? true;
                              const isCurrentValue = currentValue === site.siteNumber;
                              const alreadySelected = block.siteNumbers.some(
                                (siteNumber, index) => index !== siteIndex && siteNumber === site.siteNumber,
                              );
                              const disabled = (!isAvailable && !isCurrentValue) || alreadySelected;

                              return (
                                <option key={site.id} value={site.siteNumber} disabled={disabled}>
                                  {site.siteNumber} - {site.siteName}
                                  {!isAvailable && !isCurrentValue ? '（満枠）' : alreadySelected ? '（選択済み）' : ''}
                                </option>
                              );
                            })}
                          </select>
                        );
                      })}
                      {checkInDate && checkOutDate && block.planId && (
                        <p className="text-xs text-gray-500">
                          満枠、または同じプラン内で選択済みのサイトは選択できません。現在この予約で選択中のサイトは引き続き選択できます。
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded border border-gray-200 bg-white p-5">
          <h2 className="mb-4 border-b border-gray-100 pb-2 text-sm font-semibold text-gray-800">支払い情報</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="合計金額（税込）" required>
              <input type="number" min={0} value={totalAmount} onChange={(event) => setTotalAmount(parseInt(event.target.value, 10) || 0)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </Field>
            <Field label="予約ステータス" required>
              <select
                value={reservationStatus}
                onChange={(event) => setReservationStatus(event.target.value as ReservationStatus)}
                className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                {RESERVATION_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="支払い方法" required>
              <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)} className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm">
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="支払い状況" required>
              <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as PaymentStatus)} className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm">
                {PAYMENT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        <ReservationOptionEditor options={editableOptions} items={reservationOptions} onChange={setReservationOptions} />

        <section className="rounded border border-gray-200 bg-white p-5">
          <h2 className="mb-4 border-b border-gray-100 pb-2 text-sm font-semibold text-gray-800">備考</h2>
          <textarea
            value={specialRequests}
            onChange={(event) => setSpecialRequests(event.target.value)}
            rows={3}
            className="w-full resize-y rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="連絡事項があれば入力してください"
          />
        </section>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="rounded bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-40"
          >
            {saving ? '保存中...' : '変更を保存'}
          </button>
          <Link href={`/admin/reservations/${id}`} className="rounded border border-gray-300 bg-white px-5 py-2 text-sm text-gray-600 hover:bg-gray-50">
            キャンセル
          </Link>
        </div>
      </div>
    </div>
  );
}
