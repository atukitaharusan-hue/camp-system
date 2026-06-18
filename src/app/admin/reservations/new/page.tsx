'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { fetchAccountingSubjects, fetchOptions, fetchPlans, fetchPricingSettings, fetchSiteDetails } from '@/lib/admin/fetchData';
import { createAdminReservation, validateAdminReservation, type AdminReservationInput } from '@/lib/admin/createAdminReservation';
import { getSiteAvailabilityForStay } from '@/lib/bookingAvailability';
import { ReservationOptionEditor, type ReservationOptionDraft, buildReservationOptionsJson } from '@/components/admin/ReservationOptionEditor';
import { calculateReservationPricing, resolvePlanAccommodationAmount } from '@/lib/pricing';
import type { Database } from '@/types/database';
import type { AccountingSubjectSetting, AdminPlan } from '@/types/admin';
import type { OptionItem } from '@/types/options';
import type { PricingSettings } from '@/types/pricing';
import type { SiteDetail } from '@/types/site';

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

type CustomerProfile = Pick<
  AdminReservationInput,
  | 'userName'
  | 'userPhone'
  | 'userEmail'
  | 'gender'
  | 'occupation'
  | 'postalCode'
  | 'prefecture'
  | 'city'
  | 'addressLine'
  | 'buildingName'
  | 'lineDisplayName'
  | 'lineId'
  | 'referralSource'
>;

const RESERVATION_STATUS_OPTIONS: { value: ReservationStatus; label: string }[] = [
  { value: 'pending', label: '仮予約' },
  { value: 'confirmed', label: '予約確定' },
  { value: 'checked_in', label: 'チェックイン済み' },
  { value: 'completed', label: '完了' },
  { value: 'cancelled', label: 'キャンセル' },
];

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: '現地払い(現金のみ)' },
  { value: 'credit_card', label: 'クレジットカード' },
  { value: 'bank_transfer', label: '銀行振込' },
];

const PAYMENT_STATUS_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: 'pending', label: '未入金' },
  { value: 'paid', label: '入金済み' },
];

const OCCUPATION_OPTIONS = ['会社員', '学生', '自営業', '公務員', '主婦', '無職', 'その他'];
const CUSTOMER_PROFILE_KEY = 'admin-reservation-customer-profile';

function createPlanBlock(): PlanReservationBlock {
  return { id: crypto.randomUUID(), planId: '', siteCount: 1, siteNumbers: [''] };
}

function addDays(dateStr: string, days: number) {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function ReservationTabs() {
  return (
    <div className="mb-6 flex gap-2 border-b border-gray-200 pb-3">
      <Link href="/admin/reservations/new" className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white">
        新規予約登録
      </Link>
      <Link href="/admin/import" className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700">
        顧客データ一括登録
      </Link>
    </div>
  );
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

export default function AdminReservationNewPage() {
  const router = useRouter();
  const availabilityPrefillApplied = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allPlans, setAllPlans] = useState<AdminPlan[]>([]);
  const [allSiteDetails, setAllSiteDetails] = useState<SiteDetail[]>([]);
  const [allOptions, setAllOptions] = useState<OptionItem[]>([]);
  const [accountingSubjects, setAccountingSubjects] = useState<AccountingSubjectSetting[]>([]);
  const [pricingSettings, setPricingSettings] = useState<PricingSettings | null>(null);
  const [planBlocks, setPlanBlocks] = useState<PlanReservationBlock[]>([createPlanBlock()]);
  const [siteAvailability, setSiteAvailability] = useState<SiteAvailabilityMap>({});
  const [reservationOptions, setReservationOptions] = useState<ReservationOptionDraft[]>([]);
  const [allowCapacityOverride, setAllowCapacityOverride] = useState(false);

  const [form, setForm] = useState<AdminReservationInput>({
    userName: '',
    userPhone: '',
    userEmail: '',
    planId: '',
    gender: '',
    occupation: '',
    postalCode: '',
    prefecture: '',
    city: '',
    addressLine: '',
    buildingName: '',
    lineDisplayName: '',
    lineId: '',
    referralSource: '',
    checkInDate: '',
    checkOutDate: '',
    guests: 1,
    adults: 1,
    children: 0,
    infants: 0,
    siteNumber: '',
    paymentMethod: 'cash',
    paymentStatus: 'pending',
    status: 'confirmed',
    totalAmount: 0,
    specialRequests: '',
    requestedSiteCount: 1,
    planItems: [],
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(CUSTOMER_PROFILE_KEY);
      if (!stored) return;
      const profile = JSON.parse(stored) as Partial<CustomerProfile>;
      const timer = window.setTimeout(() => {
        setForm((prev) => ({ ...prev, ...profile }));
      }, 0);
      return () => window.clearTimeout(timer);
    } catch {
      // ignore local parse failures
    }
  }, []);

  useEffect(() => {
    void Promise.all([
      fetchPlans(),
      fetchSiteDetails(),
      fetchOptions(),
      fetchAccountingSubjects(),
      fetchPricingSettings(),
    ]).then(([plans, sites, options, subjects, settings]) => {
      setAllPlans(plans);
      setAllSiteDetails(sites);
      setAllOptions(options);
      setAccountingSubjects(subjects.filter((subject) => subject.isActive));
      setPricingSettings(settings);
    });
  }, []);

  useEffect(() => {
    if (availabilityPrefillApplied.current) return;
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('from') !== 'availability') return;

    const planId = params.get('planId') ?? '';
    const checkInDate = params.get('checkInDate') ?? '';
    const checkOutDate = params.get('checkOutDate') ?? '';
    const siteNumber = params.get('siteNumber') ?? '';
    const siteMode = params.get('siteMode') ?? '';

    if (!planId || !checkInDate || !checkOutDate) return;

    availabilityPrefillApplied.current = true;

    const timer = window.setTimeout(() => {
      setForm((prev) => ({
        ...prev,
        checkInDate,
        checkOutDate,
        planId,
        siteNumber: siteMode === 'unspecified' ? '' : siteNumber,
        requestedSiteCount: 1,
        planItems: [
          {
            planId,
            siteCount: 1,
            siteNumbers: siteMode === 'unspecified' ? [] : siteNumber ? [siteNumber] : [],
          },
        ],
      }));

      setPlanBlocks([
        {
          id: crypto.randomUUID(),
          planId,
          siteCount: 1,
          siteNumbers: [siteMode === 'unspecified' ? '' : siteNumber],
        },
      ]);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!form.checkInDate || !form.checkOutDate) {
      queueMicrotask(() => {
        setSiteAvailability({});
      });
      return;
    }

    let active = true;
    Promise.all(
      planBlocks
        .filter((block) => block.planId)
        .map(async (block) => {
          const items = await getSiteAvailabilityForStay(form.checkInDate, form.checkOutDate, block.planId);
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
  }, [form.checkInDate, form.checkOutDate, planBlocks]);

  const availablePlans = useMemo(() => allPlans.filter((plan) => plan.isPublished), [allPlans]);
  const editableOptions = useMemo(() => {
    const selectedPlanIds = new Set(planBlocks.map((block) => block.planId).filter(Boolean));
    if (selectedPlanIds.size === 0) return allOptions;
    const applicableOptionIds = new Set(
      allPlans.filter((plan) => selectedPlanIds.has(plan.id)).flatMap((plan) => plan.applicableOptionIds),
    );
    return allOptions.filter((option) => applicableOptionIds.has(option.id));
  }, [allOptions, allPlans, planBlocks]);
  const normalizedPlanItems = useMemo(
    () =>
      planBlocks
        .filter((block) => block.planId)
        .map((block) => ({
          planId: block.planId,
          siteCount: Math.max(1, block.siteCount),
          siteNumbers: block.siteNumbers.filter(Boolean),
        })),
    [planBlocks],
  );
  const totalGuests = form.adults + form.children + form.infants;
  const nights =
    form.checkInDate && form.checkOutDate && form.checkOutDate > form.checkInDate
      ? Math.ceil((new Date(form.checkOutDate).getTime() - new Date(form.checkInDate).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
  const checkOutMin = form.checkInDate ? addDays(form.checkInDate, 1) : '';

  useEffect(() => {
    if (!pricingSettings) return;
    if (!form.checkInDate || !form.checkOutDate || nights <= 0) {
      queueMicrotask(() => {
        setForm((prev) => (prev.totalAmount === 0 ? prev : { ...prev, totalAmount: 0 }));
      });
      return;
    }

    if (normalizedPlanItems.length === 0) {
      queueMicrotask(() => {
        setForm((prev) => (prev.totalAmount === 0 ? prev : { ...prev, totalAmount: 0 }));
      });
      return;
    }

    const accommodationAmount = normalizedPlanItems.reduce((sum, item) => {
      const plan = allPlans.find((candidate) => candidate.id === item.planId);
      if (!plan) return sum;

      const result = resolvePlanAccommodationAmount(
        {
          pricingMode: plan.pricingMode,
          basePrice: plan.basePrice,
          adultPrice: plan.adultPrice,
          childPrice: plan.childPrice,
          infantPrice: plan.infantPrice,
          guestBandRules: plan.guestBandRules,
        },
        {
          adults: form.adults,
          children: form.children,
          infants: form.infants,
        },
        {
          checkInDate: form.checkInDate,
          nights,
          requestedSiteCount: item.siteCount,
        },
      );

      return sum + (result.valid ? result.amount : 0);
    }, 0);

    const designationFeeAmount = normalizedPlanItems.reduce((sum, item) => {
      const selectedSiteNumbers = item.siteNumbers.filter(Boolean);
      if (selectedSiteNumbers.length === 0) return sum;

      return (
        sum +
        selectedSiteNumbers.reduce((siteSum, siteNumber) => {
          const site = allSiteDetails.find((candidate) => candidate.siteNumber === siteNumber);
          return siteSum + (site?.designationFee ?? 0);
        }, 0)
      );
    }, 0);

    const optionsAmount = reservationOptions.reduce((sum, item) => sum + Math.max(0, item.subtotal), 0);
    const primaryPlan = allPlans.find((plan) => plan.id === normalizedPlanItems[0]?.planId);
    const pricingBreakdown = calculateReservationPricing(pricingSettings, {
      adults: form.adults,
      children: form.children,
      infants: form.infants,
      accommodationAmount,
      designationFeeAmount,
      optionsAmount,
      isLodgingTaxApplicable: primaryPlan?.isLodgingTaxApplicable ?? false,
    });

    queueMicrotask(() => {
      setForm((prev) =>
        prev.totalAmount === pricingBreakdown.totalAmount
          ? prev
          : { ...prev, totalAmount: pricingBreakdown.totalAmount },
      );
    });
  }, [
    allPlans,
    allSiteDetails,
    form.adults,
    form.children,
    form.checkInDate,
    form.checkOutDate,
    form.infants,
    nights,
    pricingSettings,
    reservationOptions,
    normalizedPlanItems,
  ]);

  const getSitesForPlan = (planId: string) => {
    const selectedPlan = allPlans.find((plan) => plan.id === planId);
    if (!selectedPlan) return [];
    return allSiteDetails.filter((site) => selectedPlan.targetSiteIds.includes(site.id));
  };

  const update = <K extends keyof AdminReservationInput>(key: K, value: AdminReservationInput[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };

      if (key === 'checkInDate') {
        next.checkOutDate =
          prev.checkOutDate && prev.checkOutDate <= (value as string) ? addDays(value as string, 1) : prev.checkOutDate;
      }

      if (key === 'adults' || key === 'children' || key === 'infants') {
        next.guests = Number(next.adults) + Number(next.children) + Number(next.infants);
      }

      return next;
    });
    setError(null);
  };

  const updatePlanBlock = (blockId: string, updater: (block: PlanReservationBlock) => PlanReservationBlock) => {
    setPlanBlocks((prev) => prev.map((block) => (block.id === blockId ? updater(block) : block)));
    setError(null);
  };

  const addPlanBlock = () => {
    setPlanBlocks((prev) => [...prev, createPlanBlock()]);
  };

  const removePlanBlock = (blockId: string) => {
    setPlanBlocks((prev) => (prev.length > 1 ? prev.filter((block) => block.id !== blockId) : prev));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const planItems = normalizedPlanItems;
    const selectedSiteNumbers = planItems.flatMap((item) => item.siteNumbers);
    const payload: AdminReservationInput = {
      ...form,
      guests: totalGuests,
      planId: planItems[0]?.planId ?? '',
      siteNumber: selectedSiteNumbers[0] ?? '',
      optionsJson: buildReservationOptionsJson(reservationOptions) as AdminReservationInput['optionsJson'],
      requestedSiteCount: planItems.reduce((sum, item) => sum + item.siteCount, 0) || 1,
      allowCapacityOverride,
      planItems,
    };

    const validationError = validateAdminReservation(payload);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const result = await createAdminReservation({ ...payload, adminEmail: user?.email ?? undefined });
    setSaving(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    const customerProfile: CustomerProfile = {
      userName: form.userName,
      userPhone: form.userPhone,
      userEmail: form.userEmail,
      gender: form.gender,
      occupation: form.occupation,
      postalCode: form.postalCode,
      prefecture: form.prefecture,
      city: form.city,
      addressLine: form.addressLine,
      buildingName: form.buildingName,
      lineDisplayName: form.lineDisplayName,
      lineId: form.lineId,
      referralSource: form.referralSource,
    };
    localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(customerProfile));

    router.push(`/admin/reservations/${result.reservation.id}`);
  };

  return (
    <div className="max-w-7xl">
      <ReservationTabs />
      <h1 className="mb-6 text-xl font-bold text-gray-900">新規予約登録</h1>

      {error && (
        <div className="mb-4 whitespace-pre-wrap rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded border-2 border-amber-300 bg-amber-50 p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-amber-950">手動予約の上限超過</h2>
              <p className="mt-1 text-sm text-amber-900">
                新規予約登録のときだけ、上限サイト数や同時予約上限を超えて登録できます。
              </p>
              <p className="mt-1 text-xs text-amber-800">
                この画面で作成する手動予約にのみ有効です。公開予約や既存の通常ロジックには影響しません。
              </p>
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm font-medium text-amber-950">
              <input
                type="checkbox"
                checked={allowCapacityOverride}
                onChange={(event) => setAllowCapacityOverride(event.target.checked)}
                className="h-5 w-5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
              />
              <span>上限を超えて登録する</span>
            </label>
          </div>
        </section>

        <section className="rounded border border-gray-200 bg-white p-5">
          <h2 className="mb-4 border-b border-gray-100 pb-2 text-sm font-semibold text-gray-800">顧客情報</h2>
          <p className="mb-4 text-xs text-gray-500">
            一度登録した顧客情報は、この端末では次回の新規予約登録時に自動入力されます。
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="予約者名" required>
              <input type="text" value={form.userName} onChange={(event) => update('userName', event.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </Field>
            <Field label="性別">
              <select value={form.gender} onChange={(event) => update('gender', event.target.value)} className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm">
                <option value="">未選択</option>
                <option value="male">男性</option>
                <option value="female">女性</option>
                <option value="other">その他</option>
                <option value="no_answer">回答しない</option>
              </select>
            </Field>
            <Field label="電話番号">
              <input type="tel" value={form.userPhone} onChange={(event) => update('userPhone', event.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </Field>
            <Field label="職業">
              <select value={form.occupation} onChange={(event) => update('occupation', event.target.value)} className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm">
                <option value="">選択してください</option>
                {OCCUPATION_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="メールアドレス">
              <input type="email" value={form.userEmail} onChange={(event) => update('userEmail', event.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </Field>
            <Field label="郵便番号">
              <input type="text" value={form.postalCode} onChange={(event) => update('postalCode', event.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </Field>
            <Field label="都道府県">
              <input type="text" value={form.prefecture} onChange={(event) => update('prefecture', event.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </Field>
            <Field label="市区町村">
              <input type="text" value={form.city} onChange={(event) => update('city', event.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </Field>
            <Field label="住所">
              <input type="text" value={form.addressLine} onChange={(event) => update('addressLine', event.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </Field>
            <Field label="建物名・部屋番号">
              <input type="text" value={form.buildingName} onChange={(event) => update('buildingName', event.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </Field>
            <Field label="LINE表示名">
              <input type="text" value={form.lineDisplayName} onChange={(event) => update('lineDisplayName', event.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </Field>
            <Field label="LINE ID">
              <input type="text" value={form.lineId} onChange={(event) => update('lineId', event.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="キャンプ場を知ったきっかけ">
                <input type="text" value={form.referralSource} onChange={(event) => update('referralSource', event.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </Field>
            </div>
          </div>
        </section>

        <section className="rounded border border-gray-200 bg-white p-5">
          <h2 className="mb-4 border-b border-gray-100 pb-2 text-sm font-semibold text-gray-800">宿泊情報</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="チェックイン日" required>
              <input type="date" value={form.checkInDate} onChange={(event) => update('checkInDate', event.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </Field>
            <Field label="チェックアウト日" required>
              <input
                type="date"
                min={checkOutMin}
                value={form.checkOutDate}
                onChange={(event) => update('checkOutDate', event.target.value)}
                disabled={!form.checkInDate}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
              />
            </Field>
            <Field label="大人(中学生以上)" required>
              <input type="number" min={1} value={form.adults} onChange={(event) => update('adults', parseInt(event.target.value, 10) || 1)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </Field>
            <Field label="子供">
              <input type="number" min={0} value={form.children} onChange={(event) => update('children', parseInt(event.target.value, 10) || 0)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </Field>
            <Field label="幼児">
              <input type="number" min={0} value={form.infants} onChange={(event) => update('infants', parseInt(event.target.value, 10) || 0)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </Field>
            <Field label="合計人数">
              <input type="number" value={totalGuests} readOnly className="w-full rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600" />
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
            <button
              type="button"
              onClick={addPlanBlock}
              className="rounded-full border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
            >
              プランを追加
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {planBlocks.map((block, blockIndex) => {
              const selectedPlan = allPlans.find((plan) => plan.id === block.planId);
              const sitesForPlan = getSitesForPlan(block.planId);
              const availabilityForBlock = siteAvailability[block.id] ?? {};

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
                        {availablePlans.map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.name}
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
                        {Array.from({ length: Math.max(1, selectedPlan?.maxConcurrentReservations ?? 10) }, (_, index) => index + 1).map((count) => (
                          <option key={count} value={count}>
                            {count}サイト
                          </option>
                        ))}
                      </select>
                    </Field>

                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-gray-600">小カテゴリ：サイト番号</p>
                      {Array.from({ length: block.siteCount }, (_, siteIndex) => (
                        <select
                          key={`${block.id}-${siteIndex}`}
                          value={block.siteNumbers[siteIndex] ?? ''}
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
                            const alreadySelected = block.siteNumbers.some(
                              (siteNumber, index) => index !== siteIndex && siteNumber === site.siteNumber,
                            );
                            const disabled = !isAvailable || alreadySelected;
                            return (
                              <option key={site.id} value={site.siteNumber} disabled={disabled}>
                                {site.siteNumber} - {site.siteName}
                                {!isAvailable ? '（満枠）' : alreadySelected ? '（選択済み）' : ''}
                              </option>
                            );
                          })}
                        </select>
                      ))}
                      {form.checkInDate && form.checkOutDate && block.planId && (
                        <p className="text-xs text-gray-500">満枠または同じプラン内で選択済みのサイトは選択できません。</p>
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
              <input type="number" min={0} value={form.totalAmount} onChange={(event) => update('totalAmount', parseInt(event.target.value, 10) || 0)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </Field>
            <Field label="予約ステータス" required>
              <select
                value={form.status ?? 'confirmed'}
                onChange={(event) => update('status', event.target.value as ReservationStatus)}
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
              <select value={form.paymentMethod} onChange={(event) => update('paymentMethod', event.target.value as PaymentMethod)} className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm">
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="支払い状況" required>
              <select value={form.paymentStatus} onChange={(event) => update('paymentStatus', event.target.value as PaymentStatus)} className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm">
                {PAYMENT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        <ReservationOptionEditor
          options={editableOptions}
          accountingSubjects={accountingSubjects}
          items={reservationOptions}
          onChange={setReservationOptions}
        />

        <section className="rounded border border-gray-200 bg-white p-5">
          <h2 className="mb-4 border-b border-gray-100 pb-2 text-sm font-semibold text-gray-800">備考</h2>
          <textarea
            value={form.specialRequests}
            onChange={(event) => update('specialRequests', event.target.value)}
            rows={3}
            className="w-full resize-y rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="連絡事項があれば入力してください"
          />
        </section>

        <div className="flex items-center justify-between pt-2">
          <button type="button" onClick={() => router.push('/admin/reservations')} className="text-sm text-gray-500 underline hover:text-gray-700">
            一覧に戻る
          </button>
          <button type="submit" disabled={saving} className="rounded bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? '登録中...' : '予約を登録する'}
          </button>
        </div>
      </form>
    </div>
  );
}
