'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  fetchEasyModeInventoryOverrides,
  fetchOptions,
} from '@/lib/admin/fetchData';
import { toCustomProductsConfig } from '@/lib/easyMode';
import type { EasyModeCategorySetting, EasyModeInventoryOverride } from '@/types/admin';
import type { OptionItem } from '@/types/options';

type CustomProductsProps = {
  category: EasyModeCategorySetting;
  onGoToCheckout?: () => void;
};

function getProductState(option: OptionItem, override?: EasyModeInventoryOverride) {
  const status = override?.status ?? (option.isActive ? 'available' : 'inactive');
  const remaining = override?.remaining ?? option.maxQuantity ?? null;

  if (status === 'inactive') {
    return { label: '販売停止', tone: 'bg-slate-200 text-slate-700', remaining };
  }
  if (status === 'sold_out' || remaining === 0) {
    return { label: '売切', tone: 'bg-red-100 text-red-700', remaining: 0 };
  }
  if (typeof remaining === 'number' && remaining <= 3) {
    return { label: '残り少ない', tone: 'bg-amber-100 text-amber-700', remaining };
  }
  return { label: '在庫あり', tone: 'bg-emerald-100 text-emerald-700', remaining };
}

export default function CustomProducts({ category, onGoToCheckout }: CustomProductsProps) {
  const config = toCustomProductsConfig(category.config);
  const [options, setOptions] = useState<OptionItem[]>([]);
  const [overrides, setOverrides] = useState<Record<string, EasyModeInventoryOverride>>({});

  useEffect(() => {
    let mounted = true;
    Promise.all([fetchOptions(), fetchEasyModeInventoryOverrides()]).then(([optionItems, inventoryOverrides]) => {
      if (!mounted) return;
      setOptions(optionItems);
      setOverrides(inventoryOverrides);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const filteredOptions = useMemo(() => {
    return options.filter((option) => {
      if (config.optionCategory && option.category !== config.optionCategory) return false;
      if (
        config.titleContains &&
        !option.name.toLowerCase().includes(config.titleContains.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [config.optionCategory, config.titleContains, options]);

  return (
    <section className="easy-mode-panel-card">
      <div className="space-y-4">
        <p className="text-[1.05em] font-extrabold text-slate-900">{category.name}</p>
        {filteredOptions.length === 0 ? (
          <p className="rounded-3xl bg-slate-50 px-5 py-6 text-[0.9em] text-slate-500">
            条件に合う商品がありません。
          </p>
        ) : (
          <div className="space-y-4">
            {filteredOptions.map((option) => {
              const state = getProductState(option, overrides[option.id]);
              return (
                <article key={option.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <p className="text-[0.95em] font-extrabold text-slate-900">{option.name}</p>
                      {option.description ? (
                        <p className="text-[0.8em] leading-relaxed text-slate-600">{option.description}</p>
                      ) : null}
                    </div>
                    <span className={`rounded-full px-3 py-2 text-[0.7em] font-bold ${state.tone}`}>
                      {state.label}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-[0.8em] text-slate-700">
                    {config.showPrice ? <span>価格: {option.price.toLocaleString('ja-JP')}円</span> : null}
                    {config.showStock ? (
                      <span>残数: {typeof state.remaining === 'number' ? state.remaining : '未設定'}</span>
                    ) : null}
                    {option.category ? <span>分類: {option.category}</span> : null}
                  </div>
                  {config.allowCheckout ? (
                    <button
                      type="button"
                      onClick={onGoToCheckout}
                      className="mt-4 min-h-16 rounded-2xl bg-slate-900 px-5 py-4 text-[0.85em] font-bold text-white"
                    >
                      会計へ進む
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
