'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { fetchPlans, fetchSites, saveSites, fetchSiteMapSettings, saveSiteMapSettings, fetchSiteDetails } from '@/lib/admin/fetchData';
import { getSiteStatusLabel, type AdminPlan, type AdminSite, type AdminSiteMapSettings } from '@/types/admin';
import { siteTypeLabels, type SiteType, type SiteDetail } from '@/data/sitesDummyData';
import SiteEditPanel from '@/components/admin/SiteEditPanel';

const emptySite: AdminSite = {
  id: '',
  siteNumber: '',
  siteName: '',
  area: '',
  subArea: '',
  status: 'active',
  capacity: 4,
  basePrice: 0,
  designationFee: 0,
  isPublished: true,
  slopeRating: 1,
  facilityDistance: 0,
  featureNote: '',
  waterAvailable: false,
  electricAvailable: false,
  sewerAvailable: false,
  createdAt: '',
  updatedAt: '',
};

export default function AdminSitesPage() {
  const [savedSites, setSavedSites] = useState<AdminSite[]>([]);
  const [draftSites, setDraftSites] = useState<AdminSite[]>([]);
  const [savedSiteMaps, setSavedSiteMaps] = useState<AdminSiteMapSettings>({ description: '', imageUrls: [] });
  const [draftSiteMaps, setDraftSiteMaps] = useState<AdminSiteMapSettings>({ description: '', imageUrls: [] });
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [editingSite, setEditingSite] = useState<AdminSite | null>(null);
  const [previewPlanId, setPreviewPlanId] = useState('');
  const [previewArea, setPreviewArea] = useState('');
  const [previewType, setPreviewType] = useState<SiteType | ''>('');

  useEffect(() => {
    Promise.all([fetchSites(), fetchSiteMapSettings(), fetchPlans()]).then(([initialSites, initialSiteMaps, initialPlans]) => {
      setSavedSites(initialSites);
      setDraftSites(initialSites);
      setSavedSiteMaps(initialSiteMaps);
      setDraftSiteMaps(initialSiteMaps);
      setPlans(initialPlans);
      setPreviewPlanId(initialPlans[0]?.id ?? '');
    });
  }, []);

  const hasChanges =
    JSON.stringify(savedSites) !== JSON.stringify(draftSites) ||
    JSON.stringify(savedSiteMaps) !== JSON.stringify(draftSiteMaps);

  const [previewSites, setPreviewSites] = useState<SiteDetail[]>([]);

  useEffect(() => {
    fetchSiteDetails().then(setPreviewSites);
  }, [draftSites]);

  const previewPlan = useMemo(
    () => plans.find((plan) => plan.id === previewPlanId) ?? plans[0] ?? null,
    [plans, previewPlanId],
  );

  const planSites = useMemo(() => {
    if (!previewPlan || previewPlan.targetSiteIds.length === 0) return previewSites;
    return previewSites.filter((site) => previewPlan.targetSiteIds.includes(site.id));
  }, [previewPlan, previewSites]);

  const areaOptions = useMemo(
    () => Array.from(new Set(planSites.map((site) => site.areaName))).filter(Boolean),
    [planSites],
  );

  const typeOptions = useMemo(
    () => Array.from(new Set(planSites.map((site) => site.type))),
    [planSites],
  );

  useEffect(() => {
    if (!areaOptions.includes(previewArea)) {
      setPreviewArea(areaOptions[0] ?? '');
    }
  }, [areaOptions, previewArea]);

  useEffect(() => {
    if (previewType && !typeOptions.includes(previewType)) {
      setPreviewType((typeOptions[0] as SiteType | undefined) ?? '');
    }
    if (!previewType && typeOptions.length > 0) {
      setPreviewType(typeOptions[0]);
    }
  }, [previewType, typeOptions]);

  const filteredPreviewSites = useMemo(
    () =>
      planSites.filter(
        (site) =>
          (!previewArea || site.areaName === previewArea) &&
          (!previewType || site.type === previewType),
      ),
    [planSites, previewArea, previewType],
  );

  const autoAreaLabel = useMemo(() => {
    const labels = Array.from(new Set(planSites.map((site) => site.areaName))).filter(Boolean);
    return labels.length > 0 ? labels.join(' / ') : '未設定';
  }, [planSites]);

  const autoTypeLabel = useMemo(() => {
    const labels = Array.from(new Set(planSites.map((site) => siteTypeLabels[site.type]))).filter(Boolean);
    return labels.length > 0 ? labels.join(' / ') : '未設定';
  }, [planSites]);

  const updateDraftSite = (site: AdminSite) => {
    setDraftSites((prev) => {
      if (!site.id) {
        return [...prev, { ...site, id: `site-${Date.now()}` }];
      }

      return prev.map((item) => (item.id === site.id ? site : item));
    });
    setEditingSite(null);
  };

  const handleDelete = (siteId: string) => {
    setDraftSites((prev) => prev.filter((site) => site.id !== siteId));
  };

  const handleMapUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    Promise.all(
      files.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
            reader.readAsDataURL(file);
          }),
      ),
    ).then((images) => {
      setDraftSiteMaps((prev) => ({
        ...prev,
        imageUrls: [...prev.imageUrls, ...images.filter(Boolean)],
      }));
    });
  };

  const handleSave = () => {
    saveSites(draftSites);
    saveSiteMapSettings(draftSiteMaps);
    setSavedSites(draftSites);
    setSavedSiteMaps(draftSiteMaps);
    window.alert('変更を適用しました');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">サイト管理</h1>
          <p className="mt-1 text-sm text-gray-500">
            左側でサイト情報とサイトマップを編集し、右側のプレビューで実際のサイト選択画面に近い見え方を確認できます。
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setEditingSite(emptySite)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            サイトを追加
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            保存
          </button>
        </div>
      </div>

      {hasChanges && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          未保存の変更があります。保存するとプレビュー画面のサイト選択へ反映されます。
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.1fr,1fr]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">サイトマップ</h2>
                <p className="mt-1 text-sm text-gray-500">公開画面の「サイトマップ」見出しの下に表示されます。</p>
              </div>
            </div>
            <label className="mb-3 block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">説明文</span>
              <textarea
                value={draftSiteMaps.description}
                onChange={(event) =>
                  setDraftSiteMaps((prev) => ({ ...prev, description: event.target.value }))
                }
                rows={3}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">サイトマップ画像を追加</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleMapUpload}
                className="block w-full text-sm text-gray-600"
              />
            </label>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {draftSiteMaps.imageUrls.map((imageUrl, index) => (
                <div key={`${imageUrl}-${index}`} className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                  <img src={imageUrl} alt={`サイトマップ ${index + 1}`} className="h-40 w-full object-cover" />
                  <div className="flex justify-end p-3">
                    <button
                      type="button"
                      onClick={() =>
                        setDraftSiteMaps((prev) => ({
                          ...prev,
                          imageUrls: prev.imageUrls.filter((_, itemIndex) => itemIndex !== index),
                        }))
                      }
                      className="text-sm font-medium text-red-600 hover:text-red-700"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">登録サイト一覧</h2>
                <p className="mt-1 text-sm text-gray-500">編集内容は保存ボタンを押すまで公開画面へ反映されません。</p>
              </div>
            </div>
            <div className="space-y-3">
              {draftSites.map((site) => (
                <article key={site.id} className="rounded-2xl border border-gray-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-gray-400">
                        {site.area} / {site.subArea}
                      </p>
                      <h3 className="mt-1 font-semibold text-gray-900">{site.siteName}</h3>
                      <p className="text-sm text-gray-500">{site.siteNumber}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                        {getSiteStatusLabel(site.status)}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          site.isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {site.isPublished ? '公開' : '非公開'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-4">
                    <InfoCard label="基本料金" value={`¥${site.basePrice.toLocaleString()}`} />
                    <InfoCard label="指定料" value={`¥${site.designationFee.toLocaleString()}`} />
                    <InfoCard label="傾斜" value={`${site.slopeRating} / 5`} />
                    <InfoCard label="水場・管理棟まで" value={`${site.facilityDistance}m`} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {site.waterAvailable && <Badge label="水道あり" tone="blue" />}
                    {site.electricAvailable && <Badge label="電気あり" tone="yellow" />}
                    {site.sewerAvailable && <Badge label="下水あり" tone="emerald" />}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-gray-600">{site.featureNote || '特徴メモは未設定です。'}</p>
                  <div className="mt-4 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => handleDelete(site.id)}
                      className="text-sm font-medium text-red-600 hover:text-red-700"
                    >
                      削除
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingSite(site)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      編集
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">サイト選択プレビュー</h2>
              <p className="mt-1 text-sm text-gray-500">右側は実際の公開画面に近いレイアウトです。</p>
            </div>
            <select
              value={previewPlan?.id ?? ''}
              onChange={(event) => setPreviewPlanId(event.target.value)}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-5 bg-white">
            <div className="grid gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 md:grid-cols-2">
              <InfoCard label="選択中のプラン" value={previewPlan?.name ?? '未設定'} />
              <InfoCard label="プランに紐づくサイト数" value={`${planSites.length}件`} />
              <InfoCard label="自動表示エリア" value={autoAreaLabel} />
              <InfoCard label="自動表示サイト種類" value={autoTypeLabel} />
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <h3 className="text-lg font-semibold text-gray-900">サイトマップ</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">{draftSiteMaps.description}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {draftSiteMaps.imageUrls.map((imageUrl, index) => (
                  <div key={`${imageUrl}-${index}`} className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                    <img src={imageUrl} alt={`サイトマップ ${index + 1}`} className="h-48 w-full object-cover" />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">エリア</span>
                  <select
                    value={previewArea}
                    onChange={(event) => setPreviewArea(event.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    {areaOptions.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">サイト種類で絞り込む</span>
                  <select
                    value={previewType}
                    onChange={(event) => setPreviewType(event.target.value as SiteType)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    {typeOptions.map((type) => (
                      <option key={type} value={type}>
                        {siteTypeLabels[type]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">サイト選択</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {previewArea || '未設定'} / {previewType ? siteTypeLabels[previewType] : '未設定'}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                  サイト指定しない
                  <br />
                  ※で当日の混雑状況に伴い自動で決定いたします。
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredPreviewSites.map((site) => (
                  <article key={site.id} className="rounded-2xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-gray-400">{site.areaName}</p>
                        <h4 className="mt-1 font-semibold text-gray-900">{site.siteNumber}</h4>
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
                      {site.features.water && <Badge label="水道あり" tone="blue" />}
                      {site.features.electricity && <Badge label="電気あり" tone="yellow" />}
                      {site.features.sewer && <Badge label="下水あり" tone="emerald" />}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <InfoCard label="料金" value={`¥${site.price.toLocaleString()}`} compact />
                      <InfoCard label="指定料" value={`¥${site.designationFee.toLocaleString()}`} compact />
                      <InfoCard label="傾斜" value={`${site.slope} / 5`} compact />
                      <InfoCard label="水場・管理棟まで" value={`${site.distance}m`} compact />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-gray-600">{site.description}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {editingSite && (
        <SiteEditPanel
          site={editingSite}
          onClose={() => setEditingSite(null)}
          onSave={updateDraftSite}
        />
      )}
    </div>
  );
}

function InfoCard({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={`rounded-xl bg-gray-50 ${compact ? 'p-2' : 'p-3'}`}>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className={`${compact ? 'mt-1 text-sm' : 'mt-1 text-sm'} font-semibold text-gray-900`}>{value}</dd>
    </div>
  );
}

function Badge({ label, tone }: { label: string; tone: 'blue' | 'yellow' | 'emerald' }) {
  const styles = {
    blue: 'bg-blue-100 text-blue-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    emerald: 'bg-emerald-100 text-emerald-700',
  };

  return <span className={`rounded-full px-2.5 py-1 font-medium ${styles[tone]}`}>{label}</span>;
}
