'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useBookingDraftStore } from '@/stores/bookingDraftStore';
import { dummySiteMapSettings, dummySites } from '@/data/adminDummyData';
import { planTypeDefaults, siteTypeLabels, type SiteType } from '@/data/sitesDummyData';
import {
  ADMIN_CONFIG_UPDATED_EVENT,
  ADMIN_SITE_MAP_KEY,
  ADMIN_SITES_KEY,
  readJsonStorage,
} from '@/lib/admin/browserStorage';
import { buildPublicSiteDetails } from '@/lib/admin/publicConfig';

const planLabels: Record<string, string> = {
  'off-season-auto': 'オートサイトプラン',
  'off-season-cottage': 'コテージプラン',
  'family-oyako': '親子ファミリープラン',
  'family-cottage': 'ファミリーコテージプラン',
  'standard-auto-a': 'スタンダードオートプラン',
  'standard-cottage-b': 'スタンダードコテージプラン',
  'standard-free': 'フリーサイトプラン',
};

export default function SitesPage() {
  const router = useRouter();
  const stay = useBookingDraftStore((state) => state.stay);
  const plan = useBookingDraftStore((state) => state.plan);
  const storedSiteId = useBookingDraftStore((state) => state.site.siteId);
  const setSite = useBookingDraftStore((state) => state.setSite);

  const hasStay = !!(stay.checkIn && stay.checkOut && stay.nights > 0);
  const hasPlan = !!(plan.majorCategoryId && plan.minorPlanId);

  const [sites, setSites] = useState(() => buildPublicSiteDetails(dummySites));
  const [siteMapSettings, setSiteMapSettings] = useState(dummySiteMapSettings);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(storedSiteId && storedSiteId !== 'auto-assigned' ? storedSiteId : null);
  const [isUndesignated, setIsUndesignated] = useState(storedSiteId === 'auto-assigned');

  useEffect(() => {
    if (!hasStay) {
      router.replace('/');
    } else if (!hasPlan) {
      router.replace('/booking/plans');
    }
  }, [hasPlan, hasStay, router]);

  useEffect(() => {
    const syncAdminConfig = () => {
      setSites(buildPublicSiteDetails(readJsonStorage(ADMIN_SITES_KEY, dummySites)));
      setSiteMapSettings(readJsonStorage(ADMIN_SITE_MAP_KEY, dummySiteMapSettings));
    };

    syncAdminConfig();
    window.addEventListener(ADMIN_CONFIG_UPDATED_EVENT, syncAdminConfig);
    window.addEventListener('storage', syncAdminConfig);
    return () => {
      window.removeEventListener(ADMIN_CONFIG_UPDATED_EVENT, syncAdminConfig);
      window.removeEventListener('storage', syncAdminConfig);
    };
  }, []);

  const compatibleSites = useMemo(
    () =>
      sites.filter((site) =>
        plan.minorPlanId ? site.compatiblePlanIds.includes(plan.minorPlanId) : true,
      ),
    [plan.minorPlanId, sites],
  );

  const preferredType = plan.minorPlanId ? planTypeDefaults[plan.minorPlanId] : undefined;
  const autoAreaNames = useMemo(
    () => Array.from(new Set(compatibleSites.map((site) => site.areaName))).filter(Boolean),
    [compatibleSites],
  );
  const autoTypes = useMemo(
    () => Array.from(new Set(compatibleSites.map((site) => site.type))),
    [compatibleSites],
  );

  const [activeAreaName, setActiveAreaName] = useState('');
  const [activeType, setActiveType] = useState<SiteType | ''>('');

  useEffect(() => {
    if (!autoAreaNames.includes(activeAreaName)) {
      setActiveAreaName(autoAreaNames[0] ?? '');
    }
  }, [activeAreaName, autoAreaNames]);

  useEffect(() => {
    if (preferredType && autoTypes.includes(preferredType) && activeType !== preferredType) {
      setActiveType(preferredType);
      return;
    }
    if (!activeType || !autoTypes.includes(activeType)) {
      setActiveType((autoTypes[0] as SiteType | undefined) ?? '');
    }
  }, [activeType, autoTypes, preferredType]);

  const filteredSites = useMemo(
    () =>
      compatibleSites.filter(
        (site) =>
          (!activeAreaName || site.areaName === activeAreaName) &&
          (!activeType || site.type === activeType),
      ),
    [activeAreaName, activeType, compatibleSites],
  );

  const selectedSite = useMemo(
    () => sites.find((site) => site.id === selectedSiteId),
    [selectedSiteId, sites],
  );

  const handleSelect = (siteId: string) => {
    const nextSite = sites.find((item) => item.id === siteId);
    if (!nextSite || !nextSite.available) return;
    setSelectedSiteId(nextSite.id);
    setIsUndesignated(false);
  };

  const handleUndesignated = () => {
    setSelectedSiteId(null);
    setIsUndesignated(true);
  };

  const handleNext = () => {
    if (isUndesignated) {
      setSite({
        siteId: 'auto-assigned',
        siteNumber: null,
        siteName: 'サイト指定なし',
        sitePrice: 0,
        siteFee: 0,
        designationFee: 0,
        areaId: null,
        areaName: null,
        subAreaName: null,
      });
      router.push('/booking/options');
      return;
    }

    if (!selectedSite) return;
    setSite({
      siteId: selectedSite.id,
      siteNumber: selectedSite.siteNumber,
      siteName: selectedSite.siteName,
      sitePrice: selectedSite.price,
      siteFee: selectedSite.price,
      designationFee: selectedSite.designationFee,
      areaId: selectedSite.areaName,
      areaName: selectedSite.areaName,
      subAreaName: selectedSite.subAreaName,
    });
    router.push('/booking/options');
  };

  return (
    <div className="min-h-screen bg-white py-8">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-8 text-center">
          <Link href="/booking/plans" className="text-sm text-emerald-700 hover:text-emerald-800">
            プラン選択へ戻る
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-gray-900">サイト選択</h1>
          <p className="mt-2 text-sm text-gray-500">
            選択中のプランに合うサイトだけを表示しています。エリアとサイト種類で絞り込みながらお選びください。
          </p>
        </div>

        <div className="mb-6 grid gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryItem label="宿泊日" value={`${stay.checkIn} 〜 ${stay.checkOut}`} />
          <SummaryItem label="宿泊数" value={`${stay.nights}泊`} />
          <SummaryItem label="選択中のプラン" value={plan.minorPlanId ? planLabels[plan.minorPlanId] : '未選択'} />
          <SummaryItem label="自動表示サイト種類" value={activeType ? siteTypeLabels[activeType] : '未設定'} />
        </div>

        <div className="grid gap-8 xl:grid-cols-[1.05fr,1fr]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-gray-900">サイトマップ</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">{siteMapSettings.description}</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {siteMapSettings.imageUrls.map((imageUrl, index) => (
                  <div key={`${imageUrl}-${index}`} className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                    <img src={imageUrl} alt={`サイトマップ ${index + 1}`} className="h-60 w-full object-cover" />
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">エリア</span>
                  <select
                    value={activeAreaName}
                    onChange={(event) => setActiveAreaName(event.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    {autoAreaNames.map((areaName) => (
                      <option key={areaName} value={areaName}>
                        {areaName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">サイト種類で絞り込む</span>
                  <select
                    value={activeType}
                    onChange={(event) => setActiveType(event.target.value as SiteType)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    {autoTypes.map((type) => (
                      <option key={type} value={type}>
                        {siteTypeLabels[type]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-amber-900">サイト指定しない</p>
                    <p className="mt-1 text-xs text-amber-800">※で当日の混雑状況に伴い自動で決定いたします。</p>
                    <p className="mt-1 text-xs text-amber-800">この場合、追加費用は0円です。</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleUndesignated}
                    className={`rounded-xl px-4 py-2 text-sm font-medium ${
                      isUndesignated
                        ? 'bg-amber-600 text-white'
                        : 'border border-amber-300 bg-white text-amber-700'
                    }`}
                  >
                    サイト指定しない
                  </button>
                </div>
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">サイト一覧</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {activeAreaName || '未設定'} / {activeType ? siteTypeLabels[activeType] : '未設定'}
                </p>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                {filteredSites.length}件
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {filteredSites.map((site) => (
                <button
                  key={site.id}
                  type="button"
                  disabled={!site.available}
                  onClick={() => handleSelect(site.id)}
                  className={`rounded-2xl border p-4 text-left transition-colors ${
                    selectedSiteId === site.id && !isUndesignated
                      ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100'
                      : 'border-gray-200 bg-white'
                  } ${site.available ? 'hover:border-emerald-300' : 'cursor-not-allowed bg-gray-50 text-gray-400'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-gray-400">{site.areaName}</p>
                      <h3 className="mt-1 text-base font-semibold text-gray-900">{site.siteNumber}</h3>
                      <p className="text-sm text-gray-500">{site.siteName}</p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        site.available ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {site.available ? '選択可能' : '停止中'}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {site.features.water && <FeatureBadge label="水道あり" tone="blue" />}
                    {site.features.electricity && <FeatureBadge label="電気あり" tone="yellow" />}
                    {site.features.sewer && <FeatureBadge label="下水あり" tone="emerald" />}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <SummaryItem compact label="サイト料" value={`¥${site.price.toLocaleString()}`} />
                    <SummaryItem compact label="指定料" value={`¥${site.designationFee.toLocaleString()}`} />
                    <SummaryItem compact label="傾斜" value={`${site.slope} / 5`} />
                    <SummaryItem compact label="水場・管理棟まで" value={`${site.distance}m`} />
                  </div>

                  <p className="mt-3 text-sm leading-6 text-gray-600">{site.description}</p>
                </button>
              ))}
            </div>

            {selectedSite && !isUndesignated && (
              <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <h3 className="text-base font-semibold text-gray-900">選択中のサイト</h3>
                <p className="mt-2 text-sm text-gray-700">
                  {selectedSite.siteNumber} / {selectedSite.siteName}
                </p>
                <p className="mt-2 text-sm leading-6 text-gray-600">{selectedSite.description}</p>
              </div>
            )}

            {isUndesignated && (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                サイトは当日の混雑状況に合わせて自動決定します。指定料金はかかりません。
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
            disabled={!selectedSiteId && !isUndesignated}
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

function FeatureBadge({ label, tone }: { label: string; tone: 'blue' | 'yellow' | 'emerald' }) {
  const styles = {
    blue: 'bg-blue-100 text-blue-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    emerald: 'bg-emerald-100 text-emerald-700',
  };

  return <span className={`rounded-full px-2.5 py-1 font-medium ${styles[tone]}`}>{label}</span>;
}
