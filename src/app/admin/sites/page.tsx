'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import SiteEditPanel from '@/components/admin/SiteEditPanel';
import {
  AdminSaveError,
  fetchPlans,
  fetchSiteDetails,
  fetchSiteMapSettings,
  fetchSites,
  saveSiteMapSettings,
  saveSites,
} from '@/lib/admin/fetchData';
import type { AdminPlan, AdminSite, AdminSiteMapSettings } from '@/types/admin';
import type { SiteDetail, SiteType } from '@/types/site';

const siteStatusLabels: Record<AdminSite['status'], string> = {
  active: '公開中',
  maintenance: 'メンテナンス中',
  closed: '受付停止',
};

const siteTypeLabels: Record<SiteType, string> = {
  auto: 'オートサイト',
  family: 'ファミリー向けサイト',
  cottage: 'コテージ',
};

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

type FeedbackState =
  | {
      type: 'success' | 'error';
      message: string;
      details?: string[];
    }
  | null;

function serialize(value: unknown) {
  return JSON.stringify(value);
}

function normalizeError(error: unknown): FeedbackState {
  if (error instanceof AdminSaveError) {
    return {
      type: 'error',
      message: error.message,
      details: error.details,
    };
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    const message = error.message;

    if (message.toLowerCase().includes('failed to fetch')) {
      return {
        type: 'error',
        message: '通信に失敗しました。ネットワーク接続を確認して、もう一度保存してください。',
      };
    }

    if (message.includes('statement timeout')) {
      return {
        type: 'error',
        message: '保存処理が混み合って時間切れになりました。少し待ってから再度お試しください。',
      };
    }

    return {
      type: 'error',
      message,
    };
  }

  return {
    type: 'error',
    message: 'サイト管理の保存に失敗しました。入力内容を確認して、もう一度お試しください。',
  };
}

export default function AdminSitesPage() {
  const [savedSites, setSavedSites] = useState<AdminSite[]>([]);
  const [draftSites, setDraftSites] = useState<AdminSite[]>([]);
  const [savedSiteMaps, setSavedSiteMaps] = useState<AdminSiteMapSettings>({ description: '', imageUrls: [] });
  const [draftSiteMaps, setDraftSiteMaps] = useState<AdminSiteMapSettings>({ description: '', imageUrls: [] });
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [previewSites, setPreviewSites] = useState<SiteDetail[]>([]);
  const [editingSite, setEditingSite] = useState<AdminSite | null>(null);
  const [previewPlanId, setPreviewPlanId] = useState('');
  const [previewArea, setPreviewArea] = useState('');
  const [previewType, setPreviewType] = useState<SiteType | ''>('');
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      try {
        const [initialSites, initialSiteMaps, initialPlans, initialPreviewSites] = await Promise.all([
          fetchSites(),
          fetchSiteMapSettings(),
          fetchPlans(),
          fetchSiteDetails(),
        ]);

        if (!isMounted) return;

        setSavedSites(initialSites);
        setDraftSites(initialSites);
        setSavedSiteMaps(initialSiteMaps);
        setDraftSiteMaps(initialSiteMaps);
        setPlans(initialPlans);
        setPreviewSites(initialPreviewSites);
        setPreviewPlanId(initialPlans[0]?.id ?? '');
      } catch (error) {
        if (!isMounted) return;
        setFeedback(normalizeError(error));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  const hasSiteChanges = serialize(savedSites) !== serialize(draftSites);
  const hasSiteMapChanges = serialize(savedSiteMaps) !== serialize(draftSiteMaps);
  const hasChanges = hasSiteChanges || hasSiteMapChanges;

  const previewPlan = useMemo(
    () => plans.find((plan) => plan.id === previewPlanId) ?? plans[0] ?? null,
    [plans, previewPlanId],
  );

  const planSites = useMemo(() => {
    if (!previewPlan || previewPlan.targetSiteIds.length === 0) {
      return previewSites;
    }

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
    if (previewArea && !areaOptions.includes(previewArea)) {
      setPreviewArea('');
    }
  }, [areaOptions, previewArea]);

  useEffect(() => {
    if (previewType && !typeOptions.includes(previewType)) {
      setPreviewType('');
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
    setFeedback(null);
    setDraftSites((prev) => {
      const normalized = {
        ...site,
        id: site.id || `site-${Date.now()}`,
      };
      const exists = prev.some((item) => item.id === normalized.id);
      if (!exists) {
        return [...prev, normalized];
      }
      return prev.map((item) => (item.id === normalized.id ? normalized : item));
    });
    setEditingSite(null);
  };

  const handleDelete = (siteId: string) => {
    setFeedback(null);
    setDraftSites((prev) => prev.filter((site) => site.id !== siteId));
  };

  const handleMapUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setFeedback(null);
    void Promise.all(
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

  const handleSave = async () => {
    setFeedback(null);
    setIsSaving(true);

    try {
      if (hasSiteChanges) {
        await saveSites(draftSites);
      }

      if (hasSiteMapChanges) {
        await saveSiteMapSettings(draftSiteMaps);
      }

      const refreshTasks: Promise<unknown>[] = [];
      if (hasSiteChanges) {
        refreshTasks.push(fetchSites(), fetchSiteDetails());
      }
      if (hasSiteMapChanges) {
        refreshTasks.push(fetchSiteMapSettings());
      }

      const refreshedResults = refreshTasks.length > 0 ? await Promise.all(refreshTasks) : [];

      let cursor = 0;
      if (hasSiteChanges) {
        const refreshedSites = refreshedResults[cursor] as AdminSite[];
        const refreshedPreviewSites = refreshedResults[cursor + 1] as SiteDetail[];
        cursor += 2;
        setSavedSites(refreshedSites);
        setDraftSites(refreshedSites);
        setPreviewSites(refreshedPreviewSites);
      }

      if (hasSiteMapChanges) {
        const refreshedMaps = refreshedResults[cursor] as AdminSiteMapSettings;
        setSavedSiteMaps(refreshedMaps);
        setDraftSiteMaps(refreshedMaps);
      }

      setFeedback({
        type: 'success',
        message: 'サイト管理の変更を保存しました。',
      });
    } catch (error) {
      console.error('saveSites error:', error);
      setFeedback(normalizeError(error));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
          サイト管理データを読み込んでいます...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">サイト管理</h1>
          <p className="mt-1 text-sm text-gray-500">
            サイト情報とサイト指定料金を管理します。基本料金はプラン管理で設定されます。
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              setFeedback(null);
              setEditingSite(emptySite);
            }}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            サイトを追加
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          <p className="font-medium">{feedback.message}</p>
          {feedback.details && feedback.details.length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {feedback.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {hasChanges && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          未保存の変更があります。内容を確認してから保存してください。
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.1fr,1fr]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-gray-900">サイトマップ設定</h2>
              <p className="mt-1 text-sm text-gray-500">ユーザー画面に表示する案内文と画像を管理します。</p>
            </div>
            <label className="mb-3 block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                説明文
              </span>
              <textarea
                value={draftSiteMaps.description}
                onChange={(event) => {
                  setFeedback(null);
                  setDraftSiteMaps((prev) => ({ ...prev, description: event.target.value }));
                }}
                rows={3}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                サイトマップ画像を追加
              </span>
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
                      onClick={() => {
                        setFeedback(null);
                        setDraftSiteMaps((prev) => ({
                          ...prev,
                          imageUrls: prev.imageUrls.filter((_, itemIndex) => itemIndex !== index),
                        }));
                      }}
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
            <div className="mb-4">
              <h2 className="text-base font-semibold text-gray-900">登録サイト一覧</h2>
              <p className="mt-1 text-sm text-gray-500">保存前の変更内容もここに反映されます。</p>
            </div>

            {draftSites.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                登録サイトがありません。右上の「サイトを追加」から作成してください。
              </div>
            ) : (
              <div className="space-y-3">
                {draftSites.map((site) => (
                  <article key={site.id} className="rounded-2xl border border-gray-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-gray-400">
                          {[site.area, site.subArea].filter(Boolean).join(' / ') || 'エリア未設定'}
                        </p>
                        <h3 className="mt-1 font-semibold text-gray-900">{site.siteName || 'サイト名未設定'}</h3>
                        <p className="text-sm text-gray-500">{site.siteNumber || 'サイト番号未設定'}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                          {siteStatusLabels[site.status]}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            site.isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {site.isPublished ? '公開中' : '非公開'}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <InfoCard label="サイト指定料金" value={`¥${site.designationFee.toLocaleString()}`} />
                      <InfoCard label="傾斜" value={`${site.slopeRating} / 5`} />
                      <InfoCard label="施設までの距離" value={`${site.facilityDistance}m`} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {site.waterAvailable && <Badge label="水道あり" tone="blue" />}
                      {site.electricAvailable && <Badge label="電源あり" tone="yellow" />}
                      {site.sewerAvailable && <Badge label="排水あり" tone="emerald" />}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-gray-600">
                      {site.featureNote || '特記事項はありません。'}
                    </p>
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
                        onClick={() => {
                          setFeedback(null);
                          setEditingSite(site);
                        }}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700"
                      >
                        編集
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">ユーザー画面プレビュー</h2>
              <p className="mt-1 text-sm text-gray-500">プランに紐づく公開サイトの見え方を確認できます。</p>
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
              <InfoCard label="表示エリア" value={autoAreaLabel} />
              <InfoCard label="表示サイト種別" value={autoTypeLabel} />
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <h3 className="text-lg font-semibold text-gray-900">サイトマップ</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">{draftSiteMaps.description || '説明文は未設定です。'}</p>
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
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    エリア
                  </span>
                  <select
                    value={previewArea}
                    onChange={(event) => setPreviewArea(event.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">すべて</option>
                    {areaOptions.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    サイト種別
                  </span>
                  <select
                    value={previewType}
                    onChange={(event) => setPreviewType(event.target.value as SiteType | '')}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">すべて</option>
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
                  <h3 className="text-lg font-semibold text-gray-900">公開サイト一覧</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {(previewArea || 'すべてのエリア')} /{' '}
                    {previewType ? siteTypeLabels[previewType] : 'すべてのサイト種別'}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                  ここではサイト指定料金のみ表示します。
                  <br />
                  宿泊料金はプラン管理の設定が使われます。
                </div>
              </div>
              {filteredPreviewSites.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                  条件に一致する公開サイトがありません。
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredPreviewSites.map((site) => (
                    <article key={site.id} className="rounded-2xl border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs text-gray-400">{site.areaName || 'エリア未設定'}</p>
                          <h4 className="mt-1 font-semibold text-gray-900">{site.siteNumber}</h4>
                          <p className="text-sm text-gray-500">{site.siteName}</p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            site.available ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {site.available ? '選択可能' : '受付停止'}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {site.features.water && <Badge label="水道あり" tone="blue" />}
                        {site.features.electricity && <Badge label="電源あり" tone="yellow" />}
                        {site.features.sewer && <Badge label="排水あり" tone="emerald" />}
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                        <InfoCard label="サイト指定料金" value={`¥${site.designationFee.toLocaleString()}`} compact />
                        <InfoCard label="傾斜" value={`${site.slope} / 5`} compact />
                        <InfoCard label="距離" value={`${site.distance}m`} compact />
                      </div>
                      <p className="mt-3 text-sm leading-6 text-gray-600">{site.description || '説明は未設定です。'}</p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {editingSite && (
        <SiteEditPanel site={editingSite} onClose={() => setEditingSite(null)} onSave={updateDraftSite} />
      )}
    </div>
  );
}

function InfoCard({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={`rounded-xl bg-gray-50 ${compact ? 'p-2' : 'p-3'}`}>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-gray-900">{value}</dd>
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
