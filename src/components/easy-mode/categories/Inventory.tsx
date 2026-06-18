'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  fetchEasyModeInventoryOverrides,
  fetchOptions,
  saveEasyModeInventoryOverrides,
} from '@/lib/admin/fetchData';
import type { EasyModeInventoryOverride } from '@/types/admin';
import type { OptionItem } from '@/types/options';

function getItemState(option: OptionItem, override?: EasyModeInventoryOverride) {
  const status = override?.status ?? (option.isActive ? 'available' : 'inactive');
  const remaining = override?.remaining ?? option.maxQuantity ?? null;

  if (status === 'inactive') {
    return { label: '販売停止', color: 'bg-slate-100 text-slate-700 border-slate-300', remaining };
  }
  if (status === 'sold_out' || remaining === 0) {
    return { label: '売切', color: 'bg-red-100 text-red-700 border-red-300', remaining: 0 };
  }
  if (typeof remaining === 'number' && remaining <= 3) {
    return { label: '残り少ない', color: 'bg-amber-100 text-amber-700 border-amber-300', remaining };
  }
  return { label: '在庫あり', color: 'bg-emerald-100 text-emerald-700 border-emerald-300', remaining };
}

export default function InventoryCategory() {
  const [options, setOptions] = useState<OptionItem[]>([]);
  const [overrides, setOverrides] = useState<Record<string, EasyModeInventoryOverride>>({});
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [remainingInput, setRemainingInput] = useState('0');

  useEffect(() => {
    let mounted = true;
    Promise.all([fetchOptions(), fetchEasyModeInventoryOverrides()]).then(([optionItems, inventoryOverrides]) => {
      if (!mounted) return;
      setOptions(optionItems);
      setOverrides(inventoryOverrides);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const selectedOption = useMemo(
    () => options.find((option) => option.id === selectedOptionId) ?? null,
    [options, selectedOptionId],
  );

  const handleSaveOverride = async (optionId: string, next: Partial<EasyModeInventoryOverride>) => {
    const current = overrides[optionId];
    const merged: EasyModeInventoryOverride = {
      optionId,
      status: next.status ?? current?.status ?? 'available',
      remaining: Object.prototype.hasOwnProperty.call(next, 'remaining') ? next.remaining ?? null : current?.remaining ?? null,
      updatedAt: new Date().toISOString(),
    };
    const nextOverrides = { ...overrides, [optionId]: merged };
    setOverrides(nextOverrides);
    await saveEasyModeInventoryOverrides(nextOverrides);
  };

  return (
    <section className="easy-mode-panel-card">
      <div className="space-y-5">
        <div>
          <p className="text-[1.05em] font-extrabold text-slate-900">在庫状況</p>
          <p className="mt-2 text-[0.86em] leading-relaxed text-slate-600">
            売切・在庫あり・販売停止を簡単に切り替えられます。細かい履歴管理は通常画面で行ってください。
          </p>
        </div>

        {loading ? (
          <p className="rounded-3xl bg-slate-50 px-5 py-6 text-[0.9em] text-slate-500">商品を読み込み中です。</p>
        ) : (
          <div className="space-y-4">
            {options.map((option) => {
              const state = getItemState(option, overrides[option.id]);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    const state = getItemState(option, overrides[option.id]);
                    setRemainingInput(typeof state.remaining === 'number' ? String(state.remaining) : '0');
                    setSelectedOptionId(option.id);
                  }}
                  className="w-full rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <p className="text-[0.95em] font-extrabold text-slate-900">{option.name}</p>
                      {option.description ? (
                        <p className="text-[0.8em] leading-relaxed text-slate-600">{option.description}</p>
                      ) : null}
                      <div className="flex flex-wrap gap-3 text-[0.78em] text-slate-600">
                        <span>残数: {typeof state.remaining === 'number' ? state.remaining : '未設定'}</span>
                        <span>価格: {option.price.toLocaleString('ja-JP')}円</span>
                      </div>
                    </div>
                    <span className={`rounded-full border px-3 py-2 text-[0.72em] font-bold ${state.color}`}>
                      {state.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedOption ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-2xl rounded-[32px] bg-white p-6 shadow-2xl">
            <div className="space-y-4">
              <p className="text-[1.05em] font-extrabold text-slate-900">{selectedOption.name}</p>
              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void handleSaveOverride(selectedOption.id, { status: 'sold_out', remaining: 0 })}
                  className="min-h-16 rounded-2xl bg-red-100 px-5 py-4 text-[0.88em] font-bold text-red-700"
                >
                  売切にする
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void handleSaveOverride(selectedOption.id, {
                      status: 'available',
                      remaining: Math.max(Number(remainingInput || '1'), 1),
                    })
                  }
                  className="min-h-16 rounded-2xl bg-emerald-100 px-5 py-4 text-[0.88em] font-bold text-emerald-700"
                >
                  在庫ありに戻す
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveOverride(selectedOption.id, { status: 'inactive' })}
                  className="min-h-16 rounded-2xl bg-slate-200 px-5 py-4 text-[0.88em] font-bold text-slate-800"
                >
                  販売停止にする
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOptionId(null)}
                  className="min-h-16 rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-4 text-[0.88em] font-bold text-slate-800"
                >
                  閉じる
                </button>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-2 text-[0.85em] font-bold text-slate-900">残数を変更する</p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setRemainingInput(String(Math.max(Number(remainingInput || '0') - 1, 0)))}
                    className="min-h-16 min-w-16 rounded-2xl border border-slate-300 bg-white text-[1.2em] font-bold"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={remainingInput}
                    onChange={(event) => setRemainingInput(event.target.value)}
                    className="min-h-16 flex-1 rounded-2xl border border-slate-300 px-4 text-center text-[1em] font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setRemainingInput(String(Number(remainingInput || '0') + 1))}
                    className="min-h-16 min-w-16 rounded-2xl border border-slate-300 bg-white text-[1.2em] font-bold"
                  >
                    ＋
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void handleSaveOverride(selectedOption.id, {
                      status: Number(remainingInput || '0') === 0 ? 'sold_out' : 'available',
                      remaining: Math.max(Number(remainingInput || '0'), 0),
                    })
                  }
                  className="mt-4 min-h-16 w-full rounded-2xl bg-slate-900 px-5 py-4 text-[0.88em] font-bold text-white"
                >
                  残数を保存する
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
