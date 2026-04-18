'use client';

import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import { fetchOptions, saveOptions } from '@/lib/admin/fetchData';
import type { OptionItem } from '@/types/options';

function createEmptyOption(): OptionItem {
  return {
    id: '',
    category: 'rental',
    name: '',
    description: '',
    price: 0,
    priceType: 'per_unit',
    unitLabel: '個',
    maxQuantity: 1,
    isActive: true,
    imageUrl: '/site-map-placeholder.svg',
    eventDate: '',
    location: '',
  };
}

export default function AdminOptionsPage() {
  const [savedOptions, setSavedOptions] = useState<OptionItem[]>([]);
  const [draftOptions, setDraftOptions] = useState<OptionItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<'all' | 'rental' | 'event'>('all');
  const [editingOption, setEditingOption] = useState<OptionItem | null>(null);

  useEffect(() => {
    fetchOptions().then((initial) => {
      setSavedOptions(initial);
      setDraftOptions(initial);
    });
  }, []);

  const hasChanges = JSON.stringify(savedOptions) !== JSON.stringify(draftOptions);

  const filteredOptions = useMemo(() => {
    if (activeCategory === 'all') return draftOptions;
    return draftOptions.filter((item) => item.category === activeCategory);
  }, [activeCategory, draftOptions]);

  const handleOptionDraftSave = (option: OptionItem) => {
    setDraftOptions((prev) => {
      const exists = prev.some((item) => item.id === option.id);
      if (!exists) {
        return [...prev, { ...option, id: option.id || `option-${Date.now()}` }];
      }
      return prev.map((item) => (item.id === option.id ? option : item));
    });
    setEditingOption(null);
  };

  const handleDelete = (id: string) => {
    setDraftOptions((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSave = async () => {
    try {
      await saveOptions(draftOptions);
      const refreshed = await fetchOptions();
      setSavedOptions(refreshed);
      setDraftOptions(refreshed);
      window.alert('変更を適用しました');
    } catch (err) {
      console.error('saveOptions error:', err);
      window.alert('保存に失敗しました。コンソールを確認してください。');
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">オプション設定</h1>
          <p className="mt-1 text-sm text-gray-500">
            オプション選択画面に表示するレンタル品とイベント参加項目を管理します。最後に保存すると公開画面に反映されます。
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setEditingOption(createEmptyOption())}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            オプションを追加
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
          未保存の変更があります。公開画面に反映するには保存してください。
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <FilterChip active={activeCategory === 'all'} onClick={() => setActiveCategory('all')}>
          すべて
        </FilterChip>
        <FilterChip active={activeCategory === 'rental'} onClick={() => setActiveCategory('rental')}>
          レンタル
        </FilterChip>
        <FilterChip active={activeCategory === 'event'} onClick={() => setActiveCategory('event')}>
          イベント
        </FilterChip>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">画像</th>
              <th className="px-4 py-3">区分</th>
              <th className="px-4 py-3">名称</th>
              <th className="px-4 py-3">価格</th>
              <th className="px-4 py-3">上限数</th>
              <th className="px-4 py-3">公開</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredOptions.map((option) => (
              <tr key={option.id} className="border-t border-gray-100 align-top">
                <td className="px-4 py-4">
                  <img
                    src={option.imageUrl || '/site-map-placeholder.svg'}
                    alt={option.name}
                    className="h-16 w-24 rounded-xl object-cover"
                  />
                </td>
                <td className="px-4 py-4">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      option.category === 'event'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {option.category === 'event' ? 'イベント' : 'レンタル'}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="font-medium text-gray-900">{option.name}</div>
                  <div className="mt-1 max-w-md text-xs leading-5 text-gray-500">{option.description}</div>
                </td>
                <td className="px-4 py-4 text-gray-700">
                  ¥{option.price.toLocaleString()} / {option.unitLabel}
                </td>
                <td className="px-4 py-4 text-gray-700">{option.maxQuantity}</td>
                <td className="px-4 py-4">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      option.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {option.isActive ? '表示' : '非表示'}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => handleDelete(option.id)}
                      className="text-sm font-medium text-red-600 hover:text-red-700"
                    >
                      削除
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingOption(option)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      編集
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingOption && (
        <OptionEditor
          option={editingOption}
          onClose={() => setEditingOption(null)}
          onSave={handleOptionDraftSave}
        />
      )}
    </div>
  );
}

function OptionEditor({
  option,
  onClose,
  onSave,
}: {
  option: OptionItem;
  onClose: () => void;
  onSave: (option: OptionItem) => void;
}) {
  const [form, setForm] = useState<OptionItem>(option);

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const imageUrl = reader.result;
        setForm((prev) => ({ ...prev, imageUrl }));
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <h2 className="text-base font-bold text-gray-900">{form.id ? 'オプションを編集' : 'オプションを追加'}</h2>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-gray-400 hover:text-gray-600">
            ×
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <FormField label="区分">
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="rental">レンタル</option>
              <option value="event">イベント</option>
            </select>
          </FormField>
          <FormField label="名称">
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </FormField>
          <FormField label="説明文">
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="価格">
              <input
                type="number"
                name="price"
                min={0}
                value={form.price}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </FormField>
            <FormField label="単位表示">
              <input
                name="unitLabel"
                value={form.unitLabel}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="料金区分">
              <select
                name="priceType"
                value={form.priceType}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="per_unit">個数ごと</option>
                <option value="per_day">日数ごと</option>
                <option value="per_person">人数ごと</option>
                <option value="fixed">固定料金</option>
              </select>
            </FormField>
            <FormField label="上限数">
              <input
                type="number"
                name="maxQuantity"
                min={0}
                value={form.maxQuantity}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </FormField>
          </div>
          {form.category === 'event' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="開催日">
                <input
                  name="eventDate"
                  value={form.eventDate ?? ''}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </FormField>
              <FormField label="開催場所">
                <input
                  name="location"
                  value={form.location ?? ''}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </FormField>
            </div>
          )}
          <FormField label="画像">
            <input type="file" accept="image/*" onChange={handleImageChange} className="block w-full text-sm text-gray-600" />
          </FormField>
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
            <img
              src={form.imageUrl || '/site-map-placeholder.svg'}
              alt={form.name || 'オプション画像'}
              className="h-44 w-full object-cover"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              name="isActive"
              checked={form.isActive}
              onChange={handleChange}
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
              type="button"
              onClick={() => onSave(form)}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              下書きに反映
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-medium ${
        active ? 'bg-gray-900 text-white' : 'border border-gray-300 bg-white text-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</label>
      {children}
    </div>
  );
}
