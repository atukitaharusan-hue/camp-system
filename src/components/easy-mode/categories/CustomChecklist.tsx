'use client';

import { useEffect, useMemo, useState } from 'react';
import { resetChecklistForToday, toChecklistConfig } from '@/lib/easyMode';
import type { EasyModeCategorySetting } from '@/types/admin';

type CustomChecklistProps = {
  category: EasyModeCategorySetting;
  onUpdateConfig: (categoryId: string, config: Record<string, unknown>) => Promise<void> | void;
};

export default function CustomChecklist({ category, onUpdateConfig }: CustomChecklistProps) {
  const [saving, setSaving] = useState(false);
  const config = useMemo(() => toChecklistConfig(category.config), [category.config]);
  const items = config.items;

  useEffect(() => {
    const resetConfig = resetChecklistForToday(config);
    if (JSON.stringify(resetConfig) !== JSON.stringify(config)) {
      void onUpdateConfig(category.id, resetConfig as unknown as Record<string, unknown>);
    }
  }, [category.id, config, onUpdateConfig]);

  const completedCount = items.filter((item) => item.isCompleted).length;
  const allDone = items.length > 0 && completedCount === items.length;

  const handleToggle = async (itemId: string) => {
    setSaving(true);
    const nextItems = items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            isCompleted: !item.isCompleted,
            completedAt: !item.isCompleted ? new Date().toISOString() : null,
          }
        : item,
    );
    await onUpdateConfig(category.id, {
      ...config,
      items: nextItems,
    });
    setSaving(false);
  };

  return (
    <section className="easy-mode-panel-card">
      <div className="space-y-5">
        <div>
          <p className="text-[1.05em] font-extrabold text-slate-900">{category.name}</p>
          <p className="mt-2 text-[0.84em] leading-relaxed text-slate-600">
            今日やることを大きなチェックボックスで確認できます。
          </p>
        </div>

        {items.length === 0 ? (
          <p className="rounded-3xl bg-slate-50 px-5 py-6 text-[0.9em] text-slate-500">
            まだチェック項目がありません。
          </p>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void handleToggle(item.id)}
                disabled={saving}
                className={`w-full rounded-3xl border p-5 text-left shadow-sm ${
                  item.isCompleted ? 'border-emerald-200 bg-emerald-50 opacity-70' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start gap-4">
                  <span
                    className={`mt-1 inline-flex h-10 w-10 items-center justify-center rounded-2xl text-[1.1em] ${
                      item.isCompleted ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {item.isCompleted ? '✓' : '□'}
                  </span>
                  <div className="space-y-2">
                    <p className="text-[0.95em] font-extrabold text-slate-900">{item.title}</p>
                    {item.description ? (
                      <p className="text-[0.82em] leading-relaxed text-slate-600">{item.description}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-3 text-[0.72em] text-slate-500">
                      {item.assignedTo ? <span>担当: {item.assignedTo}</span> : null}
                      {item.dueAt ? <span>期限: {item.dueAt.replace('T', ' ')}</span> : null}
                      {item.resetDaily ? <span>毎日リセット</span> : null}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {allDone ? (
          <div className="rounded-3xl bg-emerald-600 px-5 py-5 text-[0.95em] font-extrabold text-white">
            全部終わりました！
          </div>
        ) : (
          <div className="rounded-3xl bg-slate-100 px-5 py-4 text-[0.82em] font-semibold text-slate-700">
            完了 {completedCount} / {items.length}
          </div>
        )}
      </div>
    </section>
  );
}
