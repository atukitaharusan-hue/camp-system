'use client';

import { toCustomLinkConfig } from '@/lib/easyMode';
import type { EasyModeCategorySetting } from '@/types/admin';

export default function CustomLinksCategory({ category }: { category: EasyModeCategorySetting }) {
  const config = toCustomLinkConfig(category.config);

  return (
    <section className="easy-mode-panel-card">
      <div className="space-y-4">
        <p className="text-[1.05em] font-extrabold text-slate-900">{category.name}</p>
        {config.links.length === 0 ? (
          <p className="rounded-3xl bg-slate-50 px-5 py-6 text-[0.9em] text-slate-500">
            まだリンクが設定されていません。
          </p>
        ) : (
          <div className="space-y-4">
            {config.links.map((link) => (
              <a
                key={link.id}
                href={link.url || '#'}
                className="block rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <span className="text-[1.6em]" aria-hidden="true">
                    {link.icon || '🔗'}
                  </span>
                  <div className="space-y-2">
                    <p className="text-[0.95em] font-extrabold text-slate-900">{link.title || 'リンク'}</p>
                    {link.description ? (
                      <p className="text-[0.82em] leading-relaxed text-slate-600">{link.description}</p>
                    ) : null}
                    {link.url ? <p className="text-[0.72em] text-sky-700">{link.url}</p> : null}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
