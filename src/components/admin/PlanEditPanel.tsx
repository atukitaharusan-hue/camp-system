'use client';

import { useEffect, useState } from 'react';
import { fetchOptions, fetchSites } from '@/lib/admin/fetchData';
import { normalizeGuestBandRules } from '@/lib/pricing';
import type { AdminPlan, AdminSite, GuestBandPriceTier, GuestBandSeasonRule } from '@/types/admin';
import type { OptionItem } from '@/types/options';

interface Props {
  plan: AdminPlan;
  onClose: () => void;
  onSave: (plan: AdminPlan) => void;
}

const monthOptions = [
  { value: 1, label: '1月' },
  { value: 2, label: '2月' },
  { value: 3, label: '3月' },
  { value: 4, label: '4月' },
  { value: 5, label: '5月' },
  { value: 6, label: '6月' },
  { value: 7, label: '7月' },
  { value: 8, label: '8月' },
  { value: 9, label: '9月' },
  { value: 10, label: '10月' },
  { value: 11, label: '11月' },
  { value: 12, label: '12月' },
];

function createGuestBandTier(index: number): GuestBandPriceTier {
  return {
    id: `guest-band-tier-${Date.now()}-${index}`,
    maxGuests: index + 2,
    price: 0,
  };
}

function createGuestBandRule(index: number): GuestBandSeasonRule {
  return {
    id: `guest-band-rule-${Date.now()}-${index}`,
    label: `特別料金 ${index + 1}`,
    periodMode: 'months',
    months: [],
    startDate: null,
    endDate: null,
    bands: [createGuestBandTier(0)],
  };
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-800">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </span>
      {hint && <p className="mb-2 text-xs leading-5 text-slate-500">{hint}</p>}
      {children}
    </label>
  );
}

export default function PlanEditPanel({ plan, onClose, onSave }: Props) {
  const [form, setForm] = useState<AdminPlan>({
    ...plan,
    guestBandRules: normalizeGuestBandRules(plan.guestBandRules),
  });
  const [sites, setSites] = useState<AdminSite[]>([]);
  const [options, setOptions] = useState<OptionItem[]>([]);

  useEffect(() => {
    Promise.all([fetchSites(), fetchOptions()]).then(([nextSites, nextOptions]) => {
      setSites(nextSites);
      setOptions(nextOptions.filter((option) => option.isActive));
    });
  }, []);

  const updateForm = <K extends keyof AdminPlan>(key: K, value: AdminPlan[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleFieldChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = event.target;
    updateForm(
      name as keyof AdminPlan,
      (type === 'checkbox'
        ? (event.target as HTMLInputElement).checked
        : type === 'number'
          ? Number(value)
          : value) as never,
    );
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateForm('imageUrl', reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleValue = (values: string[], nextValue: string) =>
    values.includes(nextValue) ? values.filter((value) => value !== nextValue) : [...values, nextValue];

  const toggleMonth = (ruleId: string, month: number) => {
    updateForm(
      'guestBandRules',
      normalizeGuestBandRules(
        form.guestBandRules.map((rule) =>
          rule.id === ruleId
            ? {
                ...rule,
                months: rule.months.includes(month)
                  ? rule.months.filter((value) => value !== month)
                  : [...rule.months, month],
              }
            : rule,
        ),
      ),
    );
  };

  const updateGuestBandRule = (ruleId: string, next: Partial<GuestBandSeasonRule>) => {
    updateForm(
      'guestBandRules',
      normalizeGuestBandRules(
        form.guestBandRules.map((rule) => (rule.id === ruleId ? { ...rule, ...next } : rule)),
      ),
    );
  };

  const updateGuestBandTier = (ruleId: string, tierId: string, next: Partial<GuestBandPriceTier>) => {
    updateForm(
      'guestBandRules',
      normalizeGuestBandRules(
        form.guestBandRules.map((rule) =>
          rule.id === ruleId
            ? {
                ...rule,
                bands: rule.bands.map((tier) => (tier.id === tierId ? { ...tier, ...next } : tier)),
              }
            : rule,
        ),
      ),
    );
  };

  const addGuestBandRule = () => {
    updateForm('guestBandRules', [...form.guestBandRules, createGuestBandRule(form.guestBandRules.length)]);
  };

  const removeGuestBandRule = (ruleId: string) => {
    updateForm(
      'guestBandRules',
      form.guestBandRules.filter((rule) => rule.id !== ruleId),
    );
  };

  const addGuestBandTier = (ruleId: string) => {
    updateForm(
      'guestBandRules',
      form.guestBandRules.map((rule) =>
        rule.id === ruleId
          ? { ...rule, bands: [...rule.bands, createGuestBandTier(rule.bands.length)] }
          : rule,
      ),
    );
  };

  const removeGuestBandTier = (ruleId: string, tierId: string) => {
    updateForm(
      'guestBandRules',
      form.guestBandRules.map((rule) =>
        rule.id === ruleId
          ? { ...rule, bands: rule.bands.filter((tier) => tier.id !== tierId) }
          : rule,
      ),
    );
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSave({
      ...form,
      capacity: form.maxSiteCount,
      basePrice: Number(form.basePrice || 0),
      adultPrice: Number(form.adultPrice || 0),
      childPrice: Number(form.childPrice || 0),
      infantPrice: Number(form.infantPrice || 0),
      guestBandRules: normalizeGuestBandRules(form.guestBandRules),
      id: form.id || `plan-${Date.now()}`,
      createdAt: form.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative h-full w-full max-w-3xl overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Plan Editor</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                {form.id ? 'プランを編集' : '新しいプランを追加'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                基本情報、料金、在庫上限、対象サイト、適用オプションをまとめて設定します。
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
            >
              閉じる
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8 px-6 py-6">
          <section className="grid gap-5 md:grid-cols-2">
            <Field label="プラン名" required>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleFieldChange}
                required
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />
            </Field>

            <Field label="カテゴリ">
              <input
                type="text"
                name="category"
                value={form.category}
                onChange={handleFieldChange}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />
            </Field>

            <Field label="説明" required hint="ユーザー画面にも表示されます。">
              <textarea
                name="description"
                value={form.description}
                onChange={handleFieldChange}
                required
                rows={4}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />
            </Field>

            <Field label="特徴">
              <textarea
                name="features"
                value={form.features}
                onChange={handleFieldChange}
                rows={4}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />
            </Field>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
            <div className="mb-4">
              <h3 className="text-base font-bold text-slate-900">料金と在庫制御</h3>
              <p className="mt-1 text-sm text-slate-500">
                通常料金と料金計算パターン、在庫上限を設定します。
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <Field label="料金計算パターン" required>
                <select
                  name="pricingMode"
                  value={form.pricingMode}
                  onChange={handleFieldChange}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                >
                  <option value="per_group">1組あたり固定料金</option>
                  <option value="per_person">1人あたり料金</option>
                  <option value="guest_band">人数帯別固定料金</option>
                </select>
              </Field>

              <Field
                label={form.pricingMode === 'guest_band' ? '通常料金(対象期間外のフォールバック)' : '通常料金'}
                required
                hint={form.pricingMode === 'guest_band' ? '人数帯ルールの対象外日程で使う金額です。' : undefined}
              >
                <input
                  type="number"
                  min={0}
                  name="basePrice"
                  value={form.basePrice}
                  onChange={handleFieldChange}
                  required
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                />
              </Field>

              {form.pricingMode === 'per_person' && (
                <>
                  <Field label="大人単価" required>
                    <input
                      type="number"
                      min={0}
                      name="adultPrice"
                      value={form.adultPrice}
                      onChange={handleFieldChange}
                      required
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    />
                  </Field>
                  <Field label="子ども単価" required>
                    <input
                      type="number"
                      min={0}
                      name="childPrice"
                      value={form.childPrice}
                      onChange={handleFieldChange}
                      required
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    />
                  </Field>
                  <Field label="幼児単価">
                    <input
                      type="number"
                      min={0}
                      name="infantPrice"
                      value={form.infantPrice}
                      onChange={handleFieldChange}
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    />
                  </Field>
                </>
              )}

              <Field label="上限サイト数" required>
                <input
                  type="number"
                  min={1}
                  name="maxSiteCount"
                  value={form.maxSiteCount}
                  onChange={handleFieldChange}
                  required
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                />
              </Field>

              <Field label="同時予約上限数" required>
                <input
                  type="number"
                  min={1}
                  name="maxConcurrentReservations"
                  value={form.maxConcurrentReservations}
                  onChange={handleFieldChange}
                  required
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                />
              </Field>

              <Field label="1予約の上限定員数" required>
                <input
                  type="number"
                  min={1}
                  name="maxGuestsPerReservation"
                  value={form.maxGuestsPerReservation}
                  onChange={handleFieldChange}
                  required
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                />
              </Field>
            </div>

            {form.pricingMode === 'guest_band' && (
              <div className="mt-6 rounded-3xl border border-emerald-200 bg-white p-5">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">人数帯別固定料金</h4>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      宿泊日が対象月または対象期間に入るときだけ、合計人数に応じて特別料金を適用します。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addGuestBandRule}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    ルールを追加
                  </button>
                </div>

                <div className="space-y-4">
                  {form.guestBandRules.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                      まだ人数帯ルールがありません。必要な月や期間ごとに追加してください。
                    </div>
                  )}

                  {form.guestBandRules.map((rule, ruleIndex) => (
                    <div key={rule.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <Field label="ルール名">
                          <input
                            type="text"
                            value={rule.label}
                            onChange={(event) => updateGuestBandRule(rule.id, { label: event.target.value })}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                          />
                        </Field>

                        <button
                          type="button"
                          onClick={() => removeGuestBandRule(rule.id)}
                          className="mt-7 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                        >
                          削除
                        </button>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <Field label="適用方法">
                          <select
                            value={rule.periodMode}
                            onChange={(event) =>
                              updateGuestBandRule(rule.id, {
                                periodMode: event.target.value as GuestBandSeasonRule['periodMode'],
                              })
                            }
                            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                          >
                            <option value="months">適用月</option>
                            <option value="date_range">適用期間</option>
                          </select>
                        </Field>

                        {rule.periodMode === 'date_range' ? (
                          <>
                            <Field label="開始日" required>
                              <input
                                type="date"
                                value={rule.startDate ?? ''}
                                onChange={(event) => updateGuestBandRule(rule.id, { startDate: event.target.value || null })}
                                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                              />
                            </Field>
                            <Field label="終了日" required>
                              <input
                                type="date"
                                value={rule.endDate ?? ''}
                                onChange={(event) => updateGuestBandRule(rule.id, { endDate: event.target.value || null })}
                                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                              />
                            </Field>
                          </>
                        ) : (
                          <div className="md:col-span-2">
                            <span className="mb-1.5 block text-sm font-semibold text-slate-800">適用月</span>
                            <div className="flex flex-wrap gap-2">
                              {monthOptions.map((monthOption) => {
                                const checked = rule.months.includes(monthOption.value);
                                return (
                                  <button
                                    key={monthOption.value}
                                    type="button"
                                    onClick={() => toggleMonth(rule.id, monthOption.value)}
                                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                                      checked
                                        ? 'border-emerald-400 bg-emerald-100 text-emerald-800'
                                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                                    }`}
                                  >
                                    {monthOption.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <h5 className="text-sm font-semibold text-slate-900">人数帯テーブル</h5>
                            <p className="text-xs text-slate-500">合計人数が最大人数以下になる最初の行を適用します。</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => addGuestBandTier(rule.id)}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            行を追加
                          </button>
                        </div>

                        <div className="space-y-3">
                          {rule.bands.map((tier, tierIndex) => (
                            <div key={tier.id} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                              <Field label="最大人数">
                                <input
                                  type="number"
                                  min={1}
                                  value={tier.maxGuests}
                                  onChange={(event) =>
                                    updateGuestBandTier(rule.id, tier.id, { maxGuests: Number(event.target.value) })
                                  }
                                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                                />
                              </Field>
                              <Field label="金額">
                                <input
                                  type="number"
                                  min={0}
                                  value={tier.price}
                                  onChange={(event) =>
                                    updateGuestBandTier(rule.id, tier.id, { price: Number(event.target.value) })
                                  }
                                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                                />
                              </Field>
                              <button
                                type="button"
                                onClick={() => removeGuestBandTier(rule.id, tier.id)}
                                disabled={rule.bands.length === 1}
                                className="mt-7 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-300"
                              >
                                削除
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="grid gap-5 md:grid-cols-2">
            <Field label="販売開始日">
              <input
                type="date"
                name="salesStartDate"
                value={form.salesStartDate ?? ''}
                onChange={handleFieldChange}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />
            </Field>
            <Field label="販売終了日">
              <input
                type="date"
                name="salesEndDate"
                value={form.salesEndDate ?? ''}
                onChange={handleFieldChange}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />
            </Field>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5">
            <div className="mb-4">
              <h3 className="text-base font-bold text-slate-900">プラン画像</h3>
              <p className="mt-1 text-sm text-slate-500">
                プラン一覧や確認画面で使う画像を設定します。新規作成時も編集時もここから変更できます。
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-[240px_1fr]">
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
                <img
                  src={form.imageUrl || '/site-map-placeholder.svg'}
                  alt={form.name || 'プラン画像プレビュー'}
                  className="h-48 w-full object-cover"
                />
              </div>

              <div className="space-y-4">
                <Field label="画像アップロード">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="block w-full text-sm text-slate-600"
                  />
                </Field>

                <Field label="画像URL">
                  <input
                    type="text"
                    name="imageUrl"
                    value={form.imageUrl}
                    onChange={handleFieldChange}
                    placeholder="https://... またはアップロード済み画像"
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  />
                </Field>

                <button
                  type="button"
                  onClick={() => updateForm('imageUrl', '')}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  画像をクリア
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">対象サイト</h3>
                <p className="mt-1 text-sm text-slate-500">このプランで選択できるサイトを指定します。</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {form.targetSiteIds.length}件選択中
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {sites.map((site) => {
                const checked = form.targetSiteIds.includes(site.id);
                return (
                  <label
                    key={site.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                      checked
                        ? 'border-emerald-300 bg-emerald-50'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => updateForm('targetSiteIds', toggleValue(form.targetSiteIds, site.id))}
                      className="mt-1 rounded border-slate-300"
                    />
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {site.siteNumber} / {site.siteName}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {site.area}
                        {site.subArea ? ` / ${site.subArea}` : ''}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">適用オプション</h3>
                <p className="mt-1 text-sm text-slate-500">このプランで表示するオプションだけを選択します。</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {form.applicableOptionIds.length}件選択中
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {options.map((option) => {
                const checked = form.applicableOptionIds.includes(option.id);
                return (
                  <label
                    key={option.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                      checked
                        ? 'border-emerald-300 bg-emerald-50'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        updateForm('applicableOptionIds', toggleValue(form.applicableOptionIds, option.id))
                      }
                      className="mt-1 rounded border-slate-300"
                    />
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{option.name}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {(option.category === 'event' ? 'イベント' : 'レンタル')} / ¥{option.price.toLocaleString()}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </section>

          <section className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-slate-200 bg-slate-50 px-5 py-4">
            <label className="flex items-center gap-3 text-sm font-medium text-slate-800">
              <input
                type="checkbox"
                name="isPublished"
                checked={form.isPublished}
                onChange={handleFieldChange}
                className="rounded border-slate-300"
              />
              このプランを公開する
            </label>

            <label className="flex items-center gap-3 text-sm font-medium text-slate-800">
              <input
                type="checkbox"
                name="isLodgingTaxApplicable"
                checked={Boolean(form.isLodgingTaxApplicable)}
                onChange={handleFieldChange}
                className="rounded border-slate-300"
              />
              宿泊税対象プラン
            </label>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-white"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                下書きに反映
              </button>
            </div>
          </section>
        </form>
      </div>
    </div>
  );
}
