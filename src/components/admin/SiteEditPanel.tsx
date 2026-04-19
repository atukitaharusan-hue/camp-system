'use client';

import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import type { AdminSite } from '@/types/admin';

interface Props {
  site: AdminSite;
  onClose: () => void;
  onSave: (site: AdminSite) => void;
}

export default function SiteEditPanel({ site, onClose, onSave }: Props) {
  const [form, setForm] = useState<AdminSite>({ ...site });
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = event.target;
    setErrorMessage('');
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

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (!form.siteNumber.trim()) {
      setErrorMessage('サイト番号を入力してください。');
      return;
    }

    if (!form.siteName.trim()) {
      setErrorMessage('サイト名を入力してください。');
      return;
    }

    onSave({
      ...form,
      siteNumber: form.siteNumber.trim(),
      siteName: form.siteName.trim(),
      area: form.area.trim(),
      subArea: form.subArea.trim(),
      featureNote: form.featureNote.trim(),
      id: form.id || `site-${Date.now()}`,
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
          <h2 className="text-base font-bold text-gray-900">{form.id ? 'サイトを編集' : 'サイトを追加'}</h2>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-gray-400 hover:text-gray-600">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          {errorMessage && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              {errorMessage}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="サイト番号" required>
              <input
                type="text"
                name="siteNumber"
                value={form.siteNumber}
                onChange={handleChange}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="サイト名" required>
              <input
                type="text"
                name="siteName"
                value={form.siteName}
                onChange={handleChange}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="エリア">
              <input
                type="text"
                name="area"
                value={form.area}
                onChange={handleChange}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="サイト種別・補足">
              <input
                type="text"
                name="subArea"
                value={form.subArea}
                onChange={handleChange}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <Field label="公開ステータス">
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="active">公開中</option>
              <option value="maintenance">メンテナンス中</option>
              <option value="closed">受付停止</option>
            </select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="定員">
              <input
                type="number"
                min={1}
                name="capacity"
                value={form.capacity}
                onChange={handleChange}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="サイト指定料金">
              <input
                type="number"
                min={0}
                name="designationFee"
                value={form.designationFee}
                onChange={handleChange}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            基本料金はプラン管理で設定します。
            <br />
            サイト管理では、サイト番号・サイト名・サイト指定料金など追加情報のみを扱います。
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="傾斜 (1-5)">
              <input
                type="number"
                min={1}
                max={5}
                name="slopeRating"
                value={form.slopeRating}
                onChange={handleChange}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="施設までの距離 (m)">
              <input
                type="number"
                min={0}
                name="facilityDistance"
                value={form.facilityDistance}
                onChange={handleChange}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <div className="grid gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:grid-cols-3">
            <CheckField label="水道あり" name="waterAvailable" checked={form.waterAvailable} onChange={handleChange} />
            <CheckField label="電源あり" name="electricAvailable" checked={form.electricAvailable} onChange={handleChange} />
            <CheckField label="排水あり" name="sewerAvailable" checked={form.sewerAvailable} onChange={handleChange} />
          </div>

          <Field label="サイト説明">
            <textarea
              name="featureNote"
              value={form.featureNote}
              onChange={handleChange}
              rows={4}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              placeholder="景観や注意点などを入力してください。"
            />
          </Field>

          <CheckField label="公開画面に表示する" name="isPublished" checked={form.isPublished} onChange={handleChange} />

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
              一覧に反映
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  required = false,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
        {required ? ' *' : ''}
      </label>
      {children}
    </div>
  );
}

function CheckField({
  label,
  name,
  checked,
  onChange,
}: {
  label: string;
  name: string;
  checked: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <input type="checkbox" name={name} checked={checked} onChange={onChange} className="rounded border-gray-300" />
      {label}
    </label>
  );
}
