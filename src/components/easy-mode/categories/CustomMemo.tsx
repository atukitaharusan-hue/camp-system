'use client';

import { toCustomMemoConfig } from '@/lib/easyMode';
import type { EasyModeCategorySetting } from '@/types/admin';

export default function CustomMemoCategory({ category }: { category: EasyModeCategorySetting }) {
  const config = toCustomMemoConfig(category.config);

  return (
    <section className="easy-mode-panel-card">
      <div className="space-y-4">
        <p className="text-[1.05em] font-extrabold text-slate-900">{category.name}</p>
        <div className="rounded-3xl bg-amber-50 px-5 py-6 text-[0.92em] leading-relaxed text-slate-800 shadow-sm">
          {config.content ? (
            <p className="whitespace-pre-wrap">{config.content}</p>
          ) : (
            <p>まだ内容が設定されていません。</p>
          )}
        </div>
        {config.updatedAt ? (
          <p className="text-[0.75em] text-slate-500">
            最終更新: {config.updatedAt.slice(0, 16).replace('T', ' ')}
            {config.lastUpdatedBy ? ` / ${config.lastUpdatedBy}` : ''}
          </p>
        ) : null}
      </div>
    </section>
  );
}
