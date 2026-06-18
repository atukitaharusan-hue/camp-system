'use client';

import { useEffect, useMemo, useState } from 'react';
import CategoryList from '@/components/admin/easy-mode/CategoryList';
import CategoryEditModal from '@/components/admin/easy-mode/CategoryEditModal';
import EasyModePreview from '@/components/admin/easy-mode/EasyModePreview';
import FooterSettings from '@/components/admin/easy-mode/FooterSettings';
import {
  defaultEasyModeCategories,
  defaultEasyModeFooterItems,
  fetchAdminMembers,
  fetchEasyModeCategories,
  fetchEasyModeFooterItems,
  fetchOptions,
  saveEasyModeCategories,
  saveEasyModeFooterItems,
} from '@/lib/admin/fetchData';
import type {
  AdminMember,
  EasyModeCategorySetting,
  EasyModeFooterItemSetting,
} from '@/types/admin';

function createCategoryDraft(index: number): EasyModeCategorySetting {
  return {
    id: `custom-${Date.now()}-${index}`,
    name: '新しいカテゴリ',
    type: 'custom_memo',
    icon: '🆕',
    color: '#3B82F6',
    sortOrder: index + 1,
    isVisible: true,
    targetDevice: 'all',
    targetRole: 'all',
    targetStaffIds: [],
    displayCondition: 'always',
    config: {},
    description: '',
  };
}

function reorder<T extends { id: string; sortOrder: number }>(
  items: T[],
  id: string,
  direction: 'up' | 'down',
) {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return items;
  const nextIndex = direction === 'up' ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= items.length) return items;

  const next = [...items];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next.map((item, itemIndex) => ({ ...item, sortOrder: itemIndex + 1 }));
}

export default function AdminEasyModeSettingsPage() {
  const [savedCategories, setSavedCategories] = useState<EasyModeCategorySetting[]>(defaultEasyModeCategories);
  const [draftCategories, setDraftCategories] = useState<EasyModeCategorySetting[]>(defaultEasyModeCategories);
  const [savedFooterItems, setSavedFooterItems] = useState<EasyModeFooterItemSetting[]>(defaultEasyModeFooterItems);
  const [draftFooterItems, setDraftFooterItems] = useState<EasyModeFooterItemSetting[]>(defaultEasyModeFooterItems);
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [optionCategories, setOptionCategories] = useState<string[]>([]);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'categories' | 'footer'>('categories');
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    Promise.all([fetchEasyModeCategories(), fetchEasyModeFooterItems(), fetchAdminMembers(), fetchOptions()]).then(
      ([categories, footerItems, adminMembers, options]) => {
        setSavedCategories(categories);
        setDraftCategories(categories);
        setSavedFooterItems(footerItems);
        setDraftFooterItems(footerItems);
        setMembers(adminMembers);
        setOptionCategories(
          Array.from(
            new Set(options.map((option) => option.category).filter(Boolean) as string[]),
          ).sort(),
        );
      },
    );
  }, []);

  const hasChanges = useMemo(
    () =>
      JSON.stringify(savedCategories) !== JSON.stringify(draftCategories) ||
      JSON.stringify(savedFooterItems) !== JSON.stringify(draftFooterItems),
    [savedCategories, draftCategories, savedFooterItems, draftFooterItems],
  );

  const editingCategory = draftCategories.find((category) => category.id === editingCategoryId) ?? null;

  const handleSave = async () => {
    setSaving(true);
    setSavedMessage('');
    await Promise.all([saveEasyModeCategories(draftCategories), saveEasyModeFooterItems(draftFooterItems)]);
    const [nextCategories, nextFooterItems] = await Promise.all([
      fetchEasyModeCategories(),
      fetchEasyModeFooterItems(),
    ]);
    setSavedCategories(nextCategories);
    setDraftCategories(nextCategories);
    setSavedFooterItems(nextFooterItems);
    setDraftFooterItems(nextFooterItems);
    setSaving(false);
    setSavedMessage('かんたんモード設定を保存しました。');
    window.setTimeout(() => setSavedMessage(''), 1800);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">かんたんモード設定</h1>
          <p className="mt-1 text-sm text-gray-500">
            上部カテゴリ、下部フッター、カスタムカテゴリの内容を管理できます。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!hasChanges || saving}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>

      {hasChanges ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          まだ保存していない変更があります。
        </div>
      ) : null}
      {savedMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {savedMessage}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setActiveTab('categories')}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            activeTab === 'categories' ? 'bg-blue-600 text-white' : 'border border-gray-300 bg-white text-gray-700'
          }`}
        >
          カテゴリ設定
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('footer')}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            activeTab === 'footer' ? 'bg-blue-600 text-white' : 'border border-gray-300 bg-white text-gray-700'
          }`}
        >
          フッター設定
        </button>
      </div>

      {activeTab === 'categories' ? (
        <CategoryList
          categories={draftCategories}
          onMove={(id, direction) => setDraftCategories((current) => reorder(current, id, direction))}
          onToggleVisible={(id) =>
            setDraftCategories((current) =>
              current.map((category) =>
                category.id === id ? { ...category, isVisible: !category.isVisible } : category,
              ),
            )
          }
          onEdit={setEditingCategoryId}
          onAdd={() =>
            setDraftCategories((current) =>
              [...current, createCategoryDraft(current.length)].map((item, index) => ({
                ...item,
                sortOrder: index + 1,
              })),
            )
          }
        />
      ) : (
        <FooterSettings
          items={draftFooterItems}
          onMove={(id, direction) => setDraftFooterItems((current) => reorder(current, id, direction))}
          onToggleVisible={(id) =>
            setDraftFooterItems((current) =>
              current.map((item) =>
                item.id === id && !item.isRequired ? { ...item, isVisible: !item.isVisible } : item,
              ),
            )
          }
          onUpdate={(id, patch) =>
            setDraftFooterItems((current) =>
              current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
            )
          }
        />
      )}

      <EasyModePreview categories={draftCategories} footerItems={draftFooterItems} />

      {editingCategory ? (
        <CategoryEditModal
          category={editingCategory}
          members={members}
          optionCategories={optionCategories}
          onClose={() => setEditingCategoryId(null)}
          onSave={(nextCategory) =>
            setDraftCategories((current) =>
              current.map((category) => (category.id === nextCategory.id ? nextCategory : category)),
            )
          }
        />
      ) : null}
    </div>
  );
}
