'use client';

import { useMemo, useState } from 'react';
import CategoryTabs from '@/components/easy-mode/CategoryTabs';
import type { EasyModeCategorySetting, EasyModeFooterItemSetting } from '@/types/admin';

type PreviewWidth = 'mobile' | 'tablet';
type PreviewFont = 'small' | 'medium' | 'large' | 'xlarge';

const FONT_SIZE_PIXELS: Record<PreviewFont, number> = {
  small: 20,
  medium: 22,
  large: 24,
  xlarge: 28,
};

export default function EasyModePreview({
  categories,
  footerItems,
}: {
  categories: EasyModeCategorySetting[];
  footerItems: EasyModeFooterItemSetting[];
}) {
  const [previewWidth, setPreviewWidth] = useState<PreviewWidth>('mobile');
  const [fontSize, setFontSize] = useState<PreviewFont>('large');
  const [activeCategoryId, setActiveCategoryId] = useState<string>(categories[0]?.id ?? '');
  const [activeFooterId, setActiveFooterId] = useState<string>('home');

  const visibleCategories = useMemo(
    () =>
      categories
        .filter((category) => category.isVisible)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((category) => ({
          id: category.id,
          name: category.name,
          icon: category.icon,
        })),
    [categories],
  );

  const visibleFooterItems = useMemo(
    () =>
      footerItems
        .filter((item) => item.isVisible || item.isRequired)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [footerItems],
  );

  const frameWidth = previewWidth === 'mobile' ? 375 : 768;
  const activeCategoryName =
    visibleCategories.find((category) => category.id === activeCategoryId)?.name ?? 'カテゴリ';

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">プレビュー</h2>
          <p className="mt-1 text-sm text-gray-500">
            設定中のカテゴリ順とフッター順を、スマホとタブレット幅で確認できます。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={previewWidth}
            onChange={(event) => setPreviewWidth(event.target.value as PreviewWidth)}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="mobile">スマホ</option>
            <option value="tablet">タブレット</option>
          </select>
          <select
            value={fontSize}
            onChange={(event) => setFontSize(event.target.value as PreviewFont)}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="small">小</option>
            <option value="medium">中</option>
            <option value="large">大</option>
            <option value="xlarge">特大</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div
          className="mx-auto overflow-hidden rounded-[32px] border border-slate-300 bg-slate-50 shadow-inner"
          style={{ width: `${frameWidth}px`, fontSize: `${FONT_SIZE_PIXELS[fontSize]}px` }}
        >
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
            <span className="text-[0.95em] font-extrabold text-slate-900">かんたんモード</span>
            <span className="rounded-full border border-slate-200 px-3 py-2 text-[0.7em] font-semibold text-slate-700">
              文字サイズ:
              {' '}
              {fontSize === 'small' ? '小' : fontSize === 'medium' ? '中' : fontSize === 'large' ? '大' : '特大'}
            </span>
          </div>
          <div className="border-b border-slate-200 bg-slate-50">
            <CategoryTabs
              categories={visibleCategories}
              activeCategoryId={activeCategoryId}
              onSelect={setActiveCategoryId}
            />
          </div>
          <div className="min-h-[300px] bg-white p-6 text-[0.9em] text-slate-700">
            「{activeCategoryName}」の内容がここに表示されます。
          </div>
          <div className="border-t border-slate-200 bg-white px-2 py-2">
            <div className="grid grid-cols-6 gap-2">
              {visibleFooterItems.map((item) => (
                <button
                  key={`${item.id}-${item.label}`}
                  type="button"
                  className={`rounded-2xl border px-2 py-3 text-center text-[0.6em] font-bold ${
                    activeFooterId === item.id
                      ? item.actionType === 'cancel'
                        ? 'border-red-300 bg-red-100 text-red-700'
                        : 'border-blue-300 bg-blue-100 text-blue-700'
                      : item.actionType === 'cancel'
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : 'border-slate-200 bg-white text-slate-700'
                  }`}
                  onClick={() => setActiveFooterId(item.id)}
                >
                  <div>{item.icon}</div>
                  <div className="mt-1 break-words">{item.label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
