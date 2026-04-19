'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBookingDraftStore } from '@/stores/bookingDraftStore';
import { fetchPlans } from '@/lib/admin/fetchData';
import { getPlanAvailabilityForStay, type PlanAvailabilitySummary } from '@/lib/bookingAvailability';
import { resolvePlanAccommodationAmount } from '@/lib/pricing';
import type { AdminPlan } from '@/types/admin';

function formatDate(iso: string) {
  return iso.replace(/-/g, '/');
}

function getPricingHint(pricingMode: AdminPlan['pricingMode']) {
  if (pricingMode === 'per_person') return ' / 入力人数で計算';
  if (pricingMode === 'guest_band') return ' / 人数帯別固定';
  return ' / 1組';
}

export default function PlansPage() {
  const router = useRouter();
  const { stay, plan, setPlan } = useBookingDraftStore();
  const [adminPlans, setAdminPlans] = useState<AdminPlan[]>([]);
  const [availabilityByPlanId, setAvailabilityByPlanId] = useState<Record<string, PlanAvailabilitySummary>>({});

  const hasStay = !!(stay.checkIn && stay.checkOut && stay.nights > 0);
  const hasPlan = !!(plan.majorCategoryId && plan.minorPlanId);

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
    const availableSites = availability?.availableSites ?? 0;
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
      },
    );

    if (!pricingResult.valid) return;

    const defaultSiteCount = Math.max(1, Math.min(availableSites, plan.requestedSiteCount || 1));

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
      });
      return;
    }

    setPlan({
      majorCategoryId: categoryName,
      minorPlanId: currentPlan.id,
      planName: currentPlan.name,
      categoryName: categoryName,
      pricingMode: currentPlan.pricingMode,
      basePrice: currentPlan.basePrice,
      adultPrice: currentPlan.adultPrice,
      childPrice: currentPlan.childPrice,
      infantPrice: currentPlan.infantPrice,
      guestBandRules: currentPlan.guestBandRules,
      requestedSiteCount: defaultSiteCount,
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
                      },
                    );
                    const isDisabled =
                      availableSites <= 0 ||
                      remainingConcurrentReservations <= 0 ||
                      !pricingResult.valid;

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
                                  isDisabled
                                    ? 'bg-gray-200 text-gray-600'
                                    : isLowStock
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-emerald-100 text-emerald-700'
                                }`}
                              >
                                {pricingResult.valid
                                  ? isDisabled
                                    ? '満枠'
                                    : isLowStock
                                      ? `残りわずか △ ${availableSites}`
                                      : `空き ${availableSites}`
                                  : '人数帯未設定'}
                              </span>
                            </div>
                            {item.features && <p className="mt-1 text-xs text-gray-400">{item.features}</p>}
                            <p className="mt-2 text-xs leading-5 text-gray-500">
                              上限サイト数 {maxSiteCount} / 同時予約上限数 {maxConcurrentReservations} / 同時予約残り{' '}
                              {remainingConcurrentReservations}
                            </p>
                            <p className="mt-3 text-sm font-semibold text-gray-700">
                              ¥{pricingResult.amount.toLocaleString()}
                              <span className="text-xs font-normal text-gray-400">
                                {getPricingHint(item.pricingMode)}
                              </span>
                            </p>
                            {item.pricingMode === 'guest_band' && pricingResult.usedFallback && (
                              <p className="mt-1 text-xs text-amber-700">対象期間外のため通常料金を適用しています。</p>
                            )}
                            {!pricingResult.valid && pricingResult.reason && (
                              <p className="mt-1 text-xs text-rose-700">{pricingResult.reason}</p>
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
                <option key={count} value={count} disabled={count > maxSelectableSiteCount}>
                  {count}サイト
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-gray-500">
              残サイト数 {selectedAvailability.availableSites} / 上限サイト数 {selectedAvailability.maxSiteCount} / 同時予約残り{' '}
              {selectedAvailability.remainingConcurrentReservations}
            </p>
          </section>
        )}

        <section className="mb-8">
          <button
            type="button"
            disabled={!hasPlan || maxSelectableSiteCount <= 0}
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
