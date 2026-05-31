'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchPlans } from '@/lib/admin/fetchData';
import { getPlanAvailabilityForStay, type PlanAvailabilitySummary } from '@/lib/bookingAvailability';
import { evaluatePlanBookablePeriod } from '@/lib/planSalesPeriod';
import { resolvePlanAccommodationAmount } from '@/lib/pricing';
import { evaluatePlanWaitlist } from '@/lib/waitlist';
import { useBookingDraftStore } from '@/stores/bookingDraftStore';
import type { AdminPlan } from '@/types/admin';

function formatDate(iso: string) {
  return iso.replace(/-/g, '/');
}

function getPricingHint(pricingMode: AdminPlan['pricingMode']) {
  if (pricingMode === 'per_person') return ' / 1人あたり';
  if (pricingMode === 'guest_band') return ' / 人数帯別料金';
  return ' / 1組あたり';
}

function getStockLabel(params: {
  validPricing: boolean;
  salesAvailable: boolean;
  canUseWaitlist: boolean;
  waitlistCount: number;
  isDisabled: boolean;
  isLowStock: boolean;
  availableSites: number;
}) {
  const { validPricing, salesAvailable, canUseWaitlist, waitlistCount, isDisabled, isLowStock, availableSites } = params;
  if (!validPricing) return '料金未設定';
  if (!salesAvailable) return '期間外';
  if (canUseWaitlist) return `キャンセル待ち ${waitlistCount}組`;
  if (isDisabled) return '満枠';
  if (isLowStock) return `残りわずか △ ${availableSites}`;
  return `空き ${availableSites}`;
}

export default function PlansPage() {
  const router = useRouter();
  const { stay, plan, setPlan } = useBookingDraftStore();
  const [adminPlans, setAdminPlans] = useState<AdminPlan[]>([]);
  const [availabilityByPlanId, setAvailabilityByPlanId] = useState<Record<string, PlanAvailabilitySummary>>({});

  const hasStay = Boolean(stay.checkIn && stay.checkOut && stay.nights > 0);
  const hasPlan = Boolean(plan.majorCategoryId && plan.minorPlanId);
  const stayCheckIn = stay.checkIn ?? '';
  const stayCheckOut = stay.checkOut ?? '';

  useEffect(() => {
    if (!hasStay) {
      router.replace('/');
    }
  }, [hasStay, router]);

  useEffect(() => {
    fetchPlans().then(setAdminPlans);
  }, []);

  useEffect(() => {
    if (!stay.checkIn || !stay.checkOut) return;

    getPlanAvailabilityForStay(stay.checkIn, stay.checkOut).then((items) => {
      setAvailabilityByPlanId(Object.fromEntries(items.map((item) => [item.planId, item])));
    });
  }, [stay.checkIn, stay.checkOut]);

  const categories = useMemo(() => {
    const grouped = new Map<string, AdminPlan[]>();

    for (const currentPlan of adminPlans) {
      if (!currentPlan.isPublished) continue;
      const category = currentPlan.category || '未分類';
      const list = grouped.get(category) ?? [];
      list.push(currentPlan);
      grouped.set(category, list);
    }

    return Array.from(grouped.entries()).map(([name, plans]) => ({ name, plans }));
  }, [adminPlans]);

  const handleSelectPlan = (categoryName: string, currentPlan: AdminPlan) => {
    const availability = availabilityByPlanId[currentPlan.id];
    const salesWindow = evaluatePlanBookablePeriod(currentPlan, stayCheckIn, stayCheckOut);
    const availableSites = availability?.availableSites ?? 0;
    const remainingConcurrentReservations = availability?.remainingConcurrentReservations ?? 0;

    const pricingResult = resolvePlanAccommodationAmount(
      {
        pricingMode: currentPlan.pricingMode,
        basePrice: currentPlan.basePrice,
        adultPrice: currentPlan.adultPrice,
        childPrice: currentPlan.childPrice,
        infantPrice: currentPlan.infantPrice,
        guestBandRules: currentPlan.guestBandRules,
      },
      {
        adults: stay.adults,
        children: stay.children,
        infants: stay.infants,
      },
      {
        checkInDate: stay.checkIn,
        nights: stay.nights,
        requestedSiteCount: plan.requestedSiteCount,
      },
    );

    if (!pricingResult.valid || !salesWindow.isAvailable) return;

    const waitlistEvaluation = evaluatePlanWaitlist({
      plan: currentPlan,
      checkInDate: stayCheckIn,
      checkOutDate: stayCheckOut,
      activeCount: availability?.waitlistCount ?? 0,
    });

    const useWaitlist =
      availableSites <= 0 &&
      remainingConcurrentReservations <= 0 &&
      waitlistEvaluation.isAccepting;

    const defaultSiteCount = useWaitlist
      ? Math.max(1, plan.requestedSiteCount || 1)
      : Math.max(1, Math.min(availableSites, plan.requestedSiteCount || 1));

    if (plan.majorCategoryId === categoryName && plan.minorPlanId === currentPlan.id) {
      setPlan({
        majorCategoryId: null,
        minorPlanId: null,
        planName: null,
        categoryName: null,
        pricingMode: 'per_group',
        basePrice: 0,
        adultPrice: 0,
        childPrice: 0,
        infantPrice: 0,
        guestBandRules: [],
        requestedSiteCount: 1,
        waitlistRequested: false,
        waitlistMessage: null,
      });
      return;
    }

    setPlan({
      majorCategoryId: categoryName,
      minorPlanId: currentPlan.id,
      planName: currentPlan.name,
      categoryName,
      pricingMode: currentPlan.pricingMode,
      basePrice: currentPlan.basePrice,
      adultPrice: currentPlan.adultPrice,
      childPrice: currentPlan.childPrice,
      infantPrice: currentPlan.infantPrice,
      guestBandRules: currentPlan.guestBandRules,
      requestedSiteCount: defaultSiteCount,
      waitlistRequested: useWaitlist,
      waitlistMessage: waitlistEvaluation.message,
    });
  };

  const selectedPlan = adminPlans.find((item) => item.id === plan.minorPlanId) ?? null;
  const selectedAvailability = selectedPlan ? availabilityByPlanId[selectedPlan.id] : undefined;
  const maxSelectableSiteCount = selectedAvailability ? Math.max(0, selectedAvailability.availableSites) : 0;

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-md px-4 py-6 md:max-w-2xl">
        <section className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
          プランまたはサイト情報が表示されるまでに、1分ほどかかる場合があります。
          <br />
          お手数をおかけしますが、そのままお待ちください。
        </section>

        <header className="mb-6">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="mb-3 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
          >
            入力画面へ戻る
          </button>
          <h1 className="text-xl font-bold text-gray-800">プランからサイトを選ぶ</h1>
        </header>

        {hasStay && stay.checkIn && stay.checkOut && (
          <section className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">宿泊日:</span> {formatDate(stay.checkIn)} - {formatDate(stay.checkOut)} /{' '}
              <strong>{stay.nights}泊</strong>
            </p>
          </section>
        )}

        <section className="mb-8">
          <div className="space-y-5">
            {categories.map((category) => (
              <div key={category.name} className="overflow-hidden rounded-lg border border-gray-300">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                  <h3 className="text-sm font-bold text-gray-700">{category.name}</h3>
                </div>

                <div className="divide-y divide-gray-100">
                  {category.plans.map((item) => {
                    const isSelected = plan.majorCategoryId === category.name && plan.minorPlanId === item.id;
                    const availability = availabilityByPlanId[item.id];
                    const salesWindow = evaluatePlanBookablePeriod(item, stayCheckIn, stayCheckOut);
                    const availableSites = availability?.availableSites ?? 0;
                    const remainingConcurrentReservations = availability?.remainingConcurrentReservations ?? 0;
                    const maxSiteCount = availability?.maxSiteCount ?? item.maxSiteCount;
                    const maxConcurrentReservations =
                      availability?.maxConcurrentReservations ?? item.maxConcurrentReservations;
                    const isLowStock =
                      availableSites > 0 && maxSiteCount > 0 && availableSites / maxSiteCount < 0.1;

                    const pricingResult = resolvePlanAccommodationAmount(
                      {
                        pricingMode: item.pricingMode,
                        basePrice: item.basePrice,
                        adultPrice: item.adultPrice,
                        childPrice: item.childPrice,
                        infantPrice: item.infantPrice,
                        guestBandRules: item.guestBandRules,
                      },
                      {
                        adults: stay.adults,
                        children: stay.children,
                        infants: stay.infants,
                      },
                      {
                        checkInDate: stay.checkIn,
                        nights: stay.nights,
                        requestedSiteCount: plan.requestedSiteCount,
                      },
                    );

                    const waitlistEvaluation = evaluatePlanWaitlist({
                      plan: item,
                      checkInDate: stayCheckIn,
                      checkOutDate: stayCheckOut,
                      activeCount: availability?.waitlistCount ?? 0,
                    });

                    const canUseWaitlist =
                      availableSites <= 0 &&
                      remainingConcurrentReservations <= 0 &&
                      waitlistEvaluation.isAccepting;

                    const isDisabled =
                      (!canUseWaitlist &&
                        (availableSites <= 0 || remainingConcurrentReservations <= 0)) ||
                      !salesWindow.isAvailable ||
                      !pricingResult.valid;

                    const stockLabel = getStockLabel({
                      validPricing: pricingResult.valid,
                      salesAvailable: salesWindow.isAvailable,
                      canUseWaitlist,
                      waitlistCount: availability?.waitlistCount ?? 0,
                      isDisabled,
                      isLowStock,
                      availableSites,
                    });

                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => handleSelectPlan(category.name, item)}
                        className={`w-full text-left transition-colors ${
                          isSelected ? 'bg-blue-50 ring-2 ring-inset ring-blue-400' : 'hover:bg-gray-50'
                        } ${isDisabled ? 'cursor-not-allowed grayscale' : ''}`}
                      >
                        <div className="flex gap-4 px-4 py-3">
                          <img
                            src={item.imageUrl || '/site-map-placeholder.svg'}
                            alt={item.name}
                            className="h-20 w-24 rounded-lg object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium text-gray-700">{item.name}</p>
                              {isSelected && (
                                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                                  選択中
                                </span>
                              )}
                              <span
                                className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                                  canUseWaitlist
                                    ? 'bg-amber-100 text-amber-800'
                                    : isDisabled
                                      ? 'bg-gray-200 text-gray-600'
                                      : isLowStock
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-emerald-100 text-emerald-700'
                                }`}
                              >
                                {stockLabel}
                              </span>
                            </div>

                            {item.features && <p className="mt-1 text-xs text-gray-400">{item.features}</p>}

                            <p className="mt-2 text-xs leading-5 text-gray-500">
                              上限サイト数 {maxSiteCount} / 同時予約上限数 {maxConcurrentReservations} / 残り同時予約数{' '}
                              {remainingConcurrentReservations}
                            </p>

                            {(item.salesStartDate || item.salesEndDate) && (
                              <p className="mt-1 text-xs text-gray-500">
                                予約可能期間: {item.salesStartDate ? formatDate(item.salesStartDate) : '開始日未設定'} -{' '}
                                {item.salesEndDate ? formatDate(item.salesEndDate) : '終了日未設定'}
                              </p>
                            )}

                            <p className="mt-3 text-sm font-semibold text-gray-700">
                              ￥{pricingResult.amount.toLocaleString()}
                              <span className="text-xs font-normal text-gray-400">{getPricingHint(item.pricingMode)}</span>
                            </p>

                            {!salesWindow.isAvailable && salesWindow.reason && (
                              <p className="mt-1 text-xs text-rose-700">{salesWindow.reason}</p>
                            )}

                            {!pricingResult.valid && pricingResult.reason && (
                              <p className="mt-1 text-xs text-rose-700">{pricingResult.reason}</p>
                            )}

                            {canUseWaitlist && (
                              <p className="mt-1 text-xs text-amber-700">
                                {item.waitlistMessage || `現在${availability?.waitlistCount ?? 0}組のキャンセル待ちを受け付けています。`}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {selectedPlan && selectedAvailability && (
          <section className="mb-8 rounded-lg border border-gray-200 bg-white p-4">
            <label className="mb-2 block text-sm font-semibold text-gray-700">予約するサイト数</label>
            <select
              value={plan.requestedSiteCount}
              onChange={(event) => setPlan({ requestedSiteCount: Number(event.target.value) })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {Array.from({ length: Math.max(maxSelectableSiteCount, 1) }, (_, index) => index + 1).map((count) => (
                <option key={count} value={count} disabled={count > maxSelectableSiteCount && !plan.waitlistRequested}>
                  {count}サイト
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-gray-500">
              {plan.waitlistRequested
                ? `このプランは満枠のためキャンセル待ちで受付します。現在 ${selectedAvailability.waitlistCount} 組受付中です。`
                : `空きサイト数 ${selectedAvailability.availableSites} / 上限サイト数 ${selectedAvailability.maxSiteCount} / 残り同時予約数 ${selectedAvailability.remainingConcurrentReservations}`}
            </p>
          </section>
        )}

        <section className="mb-8">
          <button
            type="button"
            disabled={!hasPlan || (!plan.waitlistRequested && maxSelectableSiteCount <= 0)}
            onClick={() => router.push('/booking/sites')}
            className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
          >
            サイト選択へ
          </button>
          {!hasPlan && <p className="mt-2 text-center text-xs text-gray-400">プランを選択してください</p>}
        </section>
      </div>
    </div>
  );
}
