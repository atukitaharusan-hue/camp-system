'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchSites } from '@/lib/admin/fetchData';
import type { AdminPlan, AdminSite } from '@/types/admin';

interface Props {
  plan: AdminPlan;
  onClose: () => void;
  onSave: (plan: AdminPlan) => void;
}

export default function PlanEditPanel({ plan, onClose, onSave }: Props) {
  const [form, setForm] = useState<AdminPlan>({ ...plan });
  const [imagePreview, setImagePreview] = useState(plan.imageUrl || '/site-map-placeholder.svg');
  const [selectedFileName, setSelectedFileName] = useState('');

  const [sites, setSites] = useState<AdminSite[]>([]);
  useEffect(() => { fetchSites().then(setSites); }, []);

  const handleFieldChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        type === 'number'
          ? Number(value)
          : type === 'checkbox'
            ? (event.target as HTMLInputElement).checked
            : value,
    }));
  };

  const handleSiteToggle = (siteId: string) => {
    setForm((prev) => ({
      ...prev,
      targetSiteIds: prev.targetSiteIds.includes(siteId)
        ? prev.targetSiteIds.filter((item) => item !== siteId)
        : [...prev.targetSiteIds, siteId],
    }));
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const imageUrl = reader.result;
        setImagePreview(imageUrl);
        setForm((prev) => ({ ...prev, imageUrl }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSave({
      ...form,
      imageUrl: imagePreview,
      id: form.id || `plan-${Date.now()}`,
      createdAt: form.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <h2 className="text-base font-bold text-gray-900">{form.id ? 'プランを編集' : 'プランを追加'}</h2>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-gray-400 hover:text-gray-600">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <Field label="プラン名">
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleFieldChange}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="説明文">
            <textarea
              name="description"
              value={form.description}
              onChange={handleFieldChange}
              rows={4}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="カテゴリ">
            <input
              type="text"
              name="category"
              value={form.category}
              onChange={handleFieldChange}
              placeholder="例: 閑散期限定, ファミリー向け, スタンダード"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="特徴テキスト">
            <input
              type="text"
              name="features"
              value={form.features}
              onChange={handleFieldChange}
              placeholder="例: オートサイト / 電源あり / 最大6名"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="プラン画像">
            <div className="space-y-3">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="block w-full text-sm text-gray-600"
              />
              <p className="text-xs text-gray-500">
                {selectedFileName || '画像を選択すると一覧とプレビュー画面に反映されます。'}
              </p>
            </div>
          </Field>
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
            <img
              src={imagePreview}
              alt={form.name || 'プラン画像'}
              className="h-44 w-full object-cover"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="基本料金">
              <input
                type="number"
                min={0}
                name="basePrice"
                value={form.basePrice}
                onChange={handleFieldChange}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="定員">
              <input
                type="number"
                min={1}
                name="capacity"
                value={form.capacity}
                onChange={handleFieldChange}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="販売開始日">
              <input
                type="date"
                name="salesStartDate"
                value={form.salesStartDate ?? ''}
                onChange={handleFieldChange}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="販売終了日">
              <input
                type="date"
                name="salesEndDate"
                value={form.salesEndDate ?? ''}
                onChange={handleFieldChange}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">対象サイト</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {sites.map((site) => (
                <label key={site.id} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.targetSiteIds.includes(site.id)}
                    onChange={() => handleSiteToggle(site.id)}
                  />
                  <span>
                    {site.siteNumber} / {site.siteName}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              name="isPublished"
              checked={form.isPublished}
              onChange={handleFieldChange}
              className="rounded border-gray-300"
            />
            公開画面に表示する
          </label>

          <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              下書きに反映
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</label>
      {children}
    </div>
  );
}
