'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { resolvePlanAccommodationAmount } from '@/lib/pricing';
import { useBookingDraftStore } from '@/stores/bookingDraftStore';
import { fetchSiteDetails, fetchSiteMapSettings } from '@/lib/admin/fetchData';
import type { AdminSiteMapSettings } from '@/types/admin';
import type { SiteDetail } from '@/types/site';

export default function SitesPage() {
  const router = useRouter();
  const stay = useBookingDraftStore((state) => state.stay);
  const plan = useBookingDraftStore((state) => state.plan);
  const storedSiteId = useBookingDraftStore((state) => state.site.siteId);
  const storedSelectedSiteNumbers = useBookingDraftStore(
    (state) => state.site.selectedSiteNumbers,
  );
  const setSite = useBookingDraftStore((state) => state.setSite);

  const hasStay = !!(stay.checkIn && stay.checkOut && stay.nights > 0);
  const hasPlan = !!(plan.majorCategoryId && plan.minorPlanId);

  const [sites, setSites] = useState<SiteDetail[]>([]);
  const [siteMapSettings, setSiteMapSettings] = useState<AdminSiteMapSettings>({
    description: '',
    imageUrls: [],
  });
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>(
    storedSiteId && storedSiteId !== 'auto-assigned'
      ? [storedSiteId]
      : [],
  );
  const [isUndesignated, setIsUndesignated] = useState(
    storedSiteId === 'auto-assigned',
  );

  useEffect(() => {
    if (!hasStay) {
      router.replace('/');
    } else if (!hasPlan) {
      router.replace('/booking/plans');
    }
  }, [hasPlan, hasStay, router]);

  useEffect(() => {
    fetchSiteDetails().then(setSites);
    fetchSiteMapSettings().then(setSiteMapSettings);
  }, []);

  const compatibleSites = useMemo(
    () =>
      sites.filter((site) =>
        plan.minorPlanId ? site.compatiblePlanIds.includes(plan.minorPlanId) : true,
      ),
    [plan.minorPlanId, sites],
  );

  useEffect(() => {
    if (compatibleSites.length === 0) return;
    if (storedSelectedSiteNumbers.length === 0) return;

    const resolvedIds = compatibleSites
      .filter((site) => storedSelectedSiteNumbers.includes(site.siteNumber))
      .map((site) => site.id);

    if (resolvedIds.length > 0) {
      setSelectedSiteIds(resolvedIds);
      setIsUndesignated(false);
    }
  }, [compatibleSites, storedSelectedSiteNumbers]);

  const selectedSites = useMemo(
    () => compatibleSites.filter((site) => selectedSiteIds.includes(site.id)),
    [compatibleSites, selectedSiteIds],
  );

  const requestedSiteCount = Math.max(1, plan.requestedSiteCount || 1);
  const pricingResult = resolvePlanAccommodationAmount(
    {
      pricingMode: plan.pricingMode,
      basePrice: plan.basePrice,
      adultPrice: plan.adultPrice,
      childPrice: plan.childPrice,
      infantPrice: plan.infantPrice,
      guestBandRules: plan.guestBandRules,
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
  const accommodationAmount = pricingResult.amount;
  const canSelectMore = selectedSiteIds.length < requestedSiteCount;

  const handleSelect = (siteId: string) => {
    const nextSite = compatibleSites.find((item) => item.id === siteId);
    if (!nextSite || !nextSite.available) return;

    setIsUndesignated(false);
    setSelectedSiteIds((prev) => {
      if (prev.includes(siteId)) {
        return prev.filter((id) => id !== siteId);
      }

      if (requestedSiteCount === 1) {
        return [siteId];
      }

      if (prev.length >= requestedSiteCount) {
        return prev;
      }

      return [...prev, siteId];
    });
  };

  const handleUndesignated = () => {
    setSelectedSiteIds([]);
    setIsUndesignated(true);
  };

  const handleNext = () => {
    if (isUndesignated) {
      setSite({
        siteId: 'auto-assigned',
        siteNumber: null,
        siteName:
          requestedSiteCount > 1
            ? `${requestedSiteCount}サイトを自動割当`
            : '指定なし ※無料',
        sitePrice: accommodationAmount,
        siteFee: 0,
        designationFee: 0,
        areaId: null,
        areaName: null,
        subAreaName: null,
        selectedSiteNumbers: [],
      });
      router.push('/booking/options');
      return;
    }

    if (selectedSites.length !== requestedSiteCount) return;

    const primarySite = selectedSites[0];
    const totalDesignationFee = selectedSites.reduce(
      (sum, site) => sum + site.designationFee,
      0,
    );

    setSite({
      siteId:
        selectedSites.length === 1
          ? primarySite.id
          : selectedSites.map((site) => site.id).join(','),
      siteNumber: selectedSites.length === 1 ? primarySite.siteNumber : null,
      siteName:
        selectedSites.length === 1
          ? primarySite.siteName
          : `${selectedSites.length}サイト指定`,
      sitePrice: accommodationAmount,
      siteFee: totalDesignationFee,
      designationFee: totalDesignationFee,
      areaId: null,
      areaName: null,
      subAreaName: null,
      selectedSiteNumbers: selectedSites.map((site) => site.siteNumber),
    });
    router.push('/booking/options');
  };

  const canProceed = pricingResult.valid && (isUndesignated || selectedSites.length === requestedSiteCount);

  return (
    <div className="min-h-screen bg-white py-8">
      <div className="mx-auto max-w-7xl px-4">
        <section className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
          プランまたはサイト情報が表示されるまでに、1分ほどかかる場合があります。
          <br />
          お手数をおかけしますが、そのままお待ちください。
        </section>

        <div className="mb-8 text-center">
          <Link
            href="/booking/plans"
            className="text-sm text-emerald-700 hover:text-emerald-800"
          >
            プラン選択へ戻る
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-gray-900">サイト選択</h1>
          <p className="mt-2 text-sm text-gray-500">
            プランに紐づくサイトを選択してください。必要なサイト数まで複数選択できます。
          </p>
        </div>

        <div className="mb-6 grid gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryItem label="宿泊日程" value={`${stay.checkIn} - ${stay.checkOut}`} />
          <SummaryItem label="宿泊数" value={`${stay.nights}泊`} />
          <SummaryItem label="選択中のプラン" value={plan.planName ?? '未選択'} />
          <SummaryItem label="予約サイト数" value={`${requestedSiteCount}サイト`} />
        </div>

        <div className="grid gap-8 xl:grid-cols-[1.05fr,1fr]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-gray-900">サイトマップ</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                {siteMapSettings.description}
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {siteMapSettings.imageUrls.map((imageUrl, index) => (
                  <div
                    key={`${imageUrl}-${index}`}
                    className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50"
                  >
                    <img
                      src={imageUrl}
                      alt={`サイトマップ ${index + 1}`}
                      className="h-60 w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">サイトの選び方</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    サイト番号を指定するか、指定無しをお選びください。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleUndesignated}
                  className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                    isUndesignated
                      ? 'border-amber-300 bg-amber-50 text-amber-900'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  指定なし ※無料
                </button>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  選択中 {selectedSites.length} / {requestedSiteCount} サイト
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {isUndesignated
                    ? '指定なしで進みます。'
                    : requestedSiteCount > 1
                      ? `必要なサイト数まで選択してください。上限 ${requestedSiteCount} サイトです。`
                      : '1サイト選択してください。'}
                </p>
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">サイト一覧</h2>
                <p className="mt-1 text-sm text-gray-500">
                  このプランで予約できるサイトを表示しています。
                </p>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                {compatibleSites.length}件
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {compatibleSites.map((site) => {
                const isSelected = selectedSiteIds.includes(site.id);
                const disabled =
                  !site.available || (!isSelected && !canSelectMore && !isUndesignated);

                return (
                  <button
                    key={site.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleSelect(site.id)}
                    className={`rounded-2xl border p-4 text-left transition-colors ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100'
                        : 'border-gray-200 bg-white'
                    } ${disabled ? 'cursor-not-allowed grayscale' : 'hover:border-emerald-300'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">
                          {site.siteNumber}
                        </h3>
                        <p className="text-sm text-gray-500">{site.siteName}</p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          !site.available
                            ? 'bg-gray-100 text-gray-500'
                            : isSelected
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-sky-100 text-sky-700'
                        }`}
                      >
                        {!site.available ? '満枠' : isSelected ? '選択中' : '選択可能'}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <SummaryItem
                        compact
                        label="指定料金"
                        value={`¥${site.designationFee.toLocaleString()}`}
                      />
                      <SummaryItem compact label="定員" value={`${site.capacity}名`} />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-gray-600">
                      {site.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {selectedSites.length > 0 && !isUndesignated && (
              <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <h3 className="text-base font-semibold text-gray-900">選択中のサイト</h3>
                <ul className="mt-2 space-y-2 text-sm text-gray-700">
                  {selectedSites.map((site) => (
                    <li key={site.id}>
                      {site.siteNumber} / {site.siteName}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>

        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/booking/plans"
            className="rounded-xl border border-gray-300 px-8 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            戻る
          </Link>
          <button
            type="button"
            disabled={!canProceed}
            onClick={handleNext}
            className="rounded-xl bg-emerald-600 px-8 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            次へ: オプション選択
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryItem({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-xl bg-gray-50 ${compact ? 'p-2' : 'p-3'}`}>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-gray-900">{value}</dd>
    </div>
  );
}
