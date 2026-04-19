'use client';

import { useEffect, useMemo, useState } from 'react';
import PlanEditPanel from '@/components/admin/PlanEditPanel';
import { fetchPlans, fetchPricingSettings, savePricingSettings } from '@/lib/admin/fetchData';
import { savePlansWithValidation } from '@/lib/admin/savePlansWithValidation';
import { normalizePricingSettings } from '@/lib/pricing';
import type { AdminPlan } from '@/types/admin';
import type { MandatoryFeeSetting, PricingSettings } from '@/types/pricing';

const ADMIN_PLANS_CACHE_KEY = 'admin-plans-page-cache-v1';

const emptyPlan: AdminPlan = {
  id: '',
  name: '',
  description: '',
  category: '',
  features: '',
  isPublished: false,
  isLodgingTaxApplicable: false,
  pricingMode: 'per_group',
  basePrice: 0,
  adultPrice: 0,
  childPrice: 0,
  infantPrice: 0,
  guestBandRules: [],
  targetSiteIds: [],
  applicableOptionIds: [],
  capacity: 1,
  maxSiteCount: 1,
  maxConcurrentReservations: 1,
  maxGuestsPerReservation: 1,
  salesStartDate: null,
  salesEndDate: null,
  imageUrl: '/site-map-placeholder.svg',
  createdAt: '',
  updatedAt: '',
};

type SaveFeedback = {
  type: 'success' | 'error';
  message: string;
  details: string[];
} | null;

type AdminPlansPageCache = {
  savedPlans: AdminPlan[];
  pricingSettings: PricingSettings;
};

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <dt className="text-xs font-medium tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-base font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function MandatoryFeeEditor({
  fee,
  onChange,
  onDelete,
}: {
  fee: MandatoryFeeSetting;
  onChange: (next: MandatoryFeeSetting) => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-slate-700">料金名</span>
          <input
            value={fee.name}
            onChange={(event) => onChange({ ...fee, name: event.target.value })}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            placeholder="入場料"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-slate-700">単価</span>
          <input
            type="number"
            min={0}
            value={fee.unitPrice}
            onChange={(event) => onChange({ ...fee, unitPrice: Number(event.target.value) })}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-slate-700">課金対象</span>
          <select
            value={fee.chargeUnit}
            onChange={(event) =>
              onChange({
                ...fee,
                chargeUnit: event.target.value as MandatoryFeeSetting['chargeUnit'],
              })
            }
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          >
            <option value="adult">大人(中学生以上)ごと</option>
            <option value="child">子どもごと</option>
            <option value="guest">大人(中学生以上)+子どもの合計人数ごと</option>
          </select>
        </label>

        <div className="flex items-end justify-between gap-3">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={fee.enabled}
              onChange={(event) => onChange({ ...fee, enabled: event.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            有効にする
          </label>

          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
          >
            削除
          </button>
        </div>
      </div>
    </div>
  );
}

function createMandatoryFee(): MandatoryFeeSetting {
  return {
    id: `mandatory-fee-${Date.now()}`,
    enabled: true,
    name: '',
    chargeUnit: 'guest',
    unitPrice: 0,
  };
}

function readPlansPageCache(): AdminPlansPageCache | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(ADMIN_PLANS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AdminPlansPageCache>;
    if (!Array.isArray(parsed.savedPlans)) return null;

    return {
      savedPlans: parsed.savedPlans,
      pricingSettings: normalizePricingSettings(parsed.pricingSettings ?? null),
    };
  } catch {
    return null;
  }
}

function writePlansPageCache(value: AdminPlansPageCache) {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(ADMIN_PLANS_CACHE_KEY, JSON.stringify(value));
  } catch {
    // ignore storage write failures
  }
}

export default function AdminPlansPage() {
  const [savedPlans, setSavedPlans] = useState<AdminPlan[]>([]);
  const [draftPlans, setDraftPlans] = useState<AdminPlan[]>([]);
  const [savedPricingSettings, setSavedPricingSettings] = useState<PricingSettings>(normalizePricingSettings(null));
  const [draftPricingSettings, setDraftPricingSettings] = useState<PricingSettings>(normalizePricingSettings(null));
  const [editingPlan, setEditingPlan] = useState<AdminPlan | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<SaveFeedback>(null);

  useEffect(() => {
    const cached = readPlansPageCache();
    if (cached) {
      setSavedPlans(cached.savedPlans);
      setDraftPlans(cached.savedPlans);
      setSavedPricingSettings(cached.pricingSettings);
      setDraftPricingSettings(cached.pricingSettings);
    }

    let isMounted = true;
    setIsRefreshing(true);

    Promise.all([fetchPlans(), fetchPricingSettings()])
      .then(([plans, pricingSettings]) => {
        if (!isMounted) return;
        setSavedPlans(plans);
        setDraftPlans(plans);
        setSavedPricingSettings(pricingSettings);
        setDraftPricingSettings(pricingSettings);
        writePlansPageCache({
          savedPlans: plans,
          pricingSettings,
        });
      })
      .finally(() => {
        if (isMounted) setIsRefreshing(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const hasChanges = useMemo(
    () =>
      JSON.stringify(savedPlans) !== JSON.stringify(draftPlans) ||
      JSON.stringify(savedPricingSettings) !== JSON.stringify(draftPricingSettings),
    [draftPlans, draftPricingSettings, savedPlans, savedPricingSettings],
  );

  const publishedCount = draftPlans.filter((plan) => plan.isPublished).length;
  const lodgingTaxPlanCount = draftPlans.filter((plan) => plan.isLodgingTaxApplicable).length;

  const updateDraftPlan = (plan: AdminPlan) => {
    setFeedback(null);
    setDraftPlans((prev) => {
      const resolvedPlan = {
        ...plan,
        id: plan.id || `plan-${Date.now()}`,
      };
      const exists = prev.some((item) => item.id === resolvedPlan.id);
      if (!exists) return [...prev, resolvedPlan];
      return prev.map((item) => (item.id === resolvedPlan.id ? resolvedPlan : item));
    });
    setEditingPlan(null);
  };

  const handleDelete = (planId: string) => {
    setFeedback(null);
    setDraftPlans((prev) => prev.filter((item) => item.id !== planId));
  };

  const updateMandatoryFee = (feeId: string, next: MandatoryFeeSetting) => {
    setFeedback(null);
    setDraftPricingSettings((prev) => ({
      ...prev,
      mandatoryFees: prev.mandatoryFees.map((fee) => (fee.id === feeId ? next : fee)),
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setFeedback(null);

    try {
      const normalizedPricingSettings = normalizePricingSettings(draftPricingSettings);
      await savePricingSettings(normalizedPricingSettings);
      await savePlansWithValidation(draftPlans);
      const [refreshedPlans, refreshedPricingSettings] = await Promise.all([
        fetchPlans(),
        fetchPricingSettings(),
      ]);
      setSavedPlans(refreshedPlans);
      setDraftPlans(refreshedPlans);
      setSavedPricingSettings(refreshedPricingSettings);
      setDraftPricingSettings(refreshedPricingSettings);
      writePlansPageCache({
        savedPlans: refreshedPlans,
        pricingSettings: refreshedPricingSettings,
      });
      setFeedback({
        type: 'success',
        message: 'プラン設定と共通料金設定を保存しました。',
        details: [],
      });
    } catch (error) {
      const message =
        typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
          ? error.message
          : 'プラン設定の保存に失敗しました。';
      const details =
        typeof error === 'object' && error !== null && 'details' in error && Array.isArray(error.details)
          ? error.details.filter((detail): detail is string => typeof detail === 'string')
          : [];
      setFeedback({
        type: 'error',
        message,
        details,
      });
      console.error('savePlans error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-emerald-50/70 p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">Plan Management</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">プラン管理</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              公開するプランの内容、在庫上限、宿泊税対象、そして全プラン共通で加算する必須料金と宿泊税をまとめて管理します。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setEditingPlan(emptyPlan)}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              新しいプランを追加
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>

        <dl className="mt-6 grid gap-3 sm:grid-cols-4">
          <StatCard label="登録プラン数" value={`${draftPlans.length}件`} />
          <StatCard label="公開中プラン" value={`${publishedCount}件`} />
          <StatCard label="宿泊税対象プラン" value={`${lodgingTaxPlanCount}件`} />
          <StatCard label="未保存の変更" value={hasChanges ? 'あり' : 'なし'} />
        </dl>
      </section>

      {feedback && (
        <section
          className={`rounded-3xl border px-5 py-4 shadow-sm ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          <p className="text-sm font-semibold">{feedback.message}</p>
          {feedback.details.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6">
              {feedback.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">必須料金設定</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                全プラン・全宿泊サイト共通で加算する料金です。人数区分ごとの自動加算に対応しています。
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setDraftPricingSettings((prev) => ({
                  ...prev,
                  mandatoryFees: [...prev.mandatoryFees, createMandatoryFee()],
                }))
              }
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              必須料金を追加
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {draftPricingSettings.mandatoryFees.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                まだ必須料金は登録されていません。
              </div>
            ) : (
              draftPricingSettings.mandatoryFees.map((fee) => (
                <MandatoryFeeEditor
                  key={fee.id}
                  fee={fee}
                  onChange={(next) => updateMandatoryFee(fee.id, next)}
                  onDelete={() =>
                    setDraftPricingSettings((prev) => ({
                      ...prev,
                      mandatoryFees: prev.mandatoryFees.filter((item) => item.id !== fee.id),
                    }))
                  }
                />
              ))
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">宿泊税設定</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            宿泊税は、宿泊税対象として設定したプランにだけ人数連動で加算されます。
          </p>

          <div className="mt-5 space-y-4">
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draftPricingSettings.lodgingTax.enabled}
                onChange={(event) =>
                  setDraftPricingSettings((prev) => ({
                    ...prev,
                    lodgingTax: { ...prev.lodgingTax, enabled: event.target.checked },
                  }))
                }
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              宿泊税を有効にする
            </label>

            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-slate-700">表示名</span>
              <input
                value={draftPricingSettings.lodgingTax.name}
                onChange={(event) =>
                  setDraftPricingSettings((prev) => ({
                    ...prev,
                    lodgingTax: { ...prev.lodgingTax, name: event.target.value },
                  }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-slate-700">単価</span>
              <input
                type="number"
                min={0}
                value={draftPricingSettings.lodgingTax.unitPrice}
                onChange={(event) =>
                  setDraftPricingSettings((prev) => ({
                    ...prev,
                    lodgingTax: { ...prev.lodgingTax, unitPrice: Number(event.target.value) },
                  }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-slate-700">課金対象</span>
              <select
                value={draftPricingSettings.lodgingTax.chargeUnit}
                onChange={(event) =>
                  setDraftPricingSettings((prev) => ({
                    ...prev,
                    lodgingTax: {
                      ...prev.lodgingTax,
                      chargeUnit: event.target.value as PricingSettings['lodgingTax']['chargeUnit'],
                    },
                  }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              >
                <option value="adult">大人(中学生以上)ごと</option>
                <option value="child">子どもごと</option>
                <option value="guest">大人(中学生以上)+子どもの合計人数ごと</option>
              </select>
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draftPricingSettings.lodgingTax.applyToLodgingTaxApplicablePlansOnly}
                onChange={(event) =>
                  setDraftPricingSettings((prev) => ({
                    ...prev,
                    lodgingTax: {
                      ...prev.lodgingTax,
                      applyToLodgingTaxApplicablePlansOnly: event.target.checked,
                    },
                  }))
                }
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              宿泊税対象プランのみに適用する
            </label>
          </div>
        </div>
      </section>

      {hasChanges && !feedback && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 shadow-sm">
          未保存の変更があります。公開内容へ反映するには保存してください。
        </section>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {draftPlans.map((plan) => (
          <article
            key={plan.id}
            className="group overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="relative">
              <img
                src={plan.imageUrl || '/site-map-placeholder.svg'}
                alt={plan.name || 'プラン画像'}
                className="h-52 w-full bg-slate-100 object-cover"
              />
              <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
                <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">
                  {plan.category || 'カテゴリ未設定'}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${
                    plan.isPublished
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {plan.isPublished ? '公開中' : '非公開'}
                </span>
              </div>
            </div>

            <div className="space-y-5 p-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold leading-8 text-slate-900">
                    {plan.name || 'プラン名未設定'}
                  </h2>
                  {plan.isLodgingTaxApplicable && (
                    <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                      宿泊税対象
                    </span>
                  )}
                </div>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                  {plan.description || '説明文がまだ入力されていません。'}
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-3">
                <StatCard
                  label={plan.pricingMode === 'per_person' ? '料金計算' : '基本料金'}
                  value={
                    plan.pricingMode === 'per_person'
                      ? `大人(中学生以上)¥${plan.adultPrice.toLocaleString()} / 子ども¥${plan.childPrice.toLocaleString()}`
                      : `¥${plan.basePrice.toLocaleString()}`
                  }
                />
                <StatCard label="上限サイト数" value={`${plan.maxSiteCount}`} />
                <StatCard label="同時予約上限数" value={`${plan.maxConcurrentReservations}`} />
                <StatCard label="1予約の上限定員数" value={`${plan.maxGuestsPerReservation}`} />
              </dl>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <div className="font-medium text-slate-900">対象サイト</div>
                <div className="mt-1">
                  {plan.targetSiteIds.length > 0 ? `${plan.targetSiteIds.length}件のサイトに紐付け` : '未設定'}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>予約可能期間</span>
                <span className="font-medium text-slate-700">
                  {plan.salesStartDate && plan.salesEndDate
                    ? `${plan.salesStartDate} - ${plan.salesEndDate}`
                    : '未設定'}
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => handleDelete(plan.id)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                >
                  削除
                </button>
                <button
                  type="button"
                  onClick={() => setEditingPlan(plan)}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  編集
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {editingPlan && (
        <PlanEditPanel
          plan={editingPlan}
          onClose={() => setEditingPlan(null)}
          onSave={updateDraftPlan}
        />
      )}
    </div>
  );
}
