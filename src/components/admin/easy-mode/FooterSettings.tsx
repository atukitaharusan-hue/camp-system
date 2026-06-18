'use client';

import type { EasyModeFooterItemSetting } from '@/types/admin';

type FooterSettingsProps = {
  items: EasyModeFooterItemSetting[];
  onMove: (id: string, direction: 'up' | 'down') => void;
  onToggleVisible: (id: string) => void;
  onUpdate: (id: string, patch: Partial<EasyModeFooterItemSetting>) => void;
};

function actionLabel(actionType: EasyModeFooterItemSetting['actionType']) {
  switch (actionType) {
    case 'home':
      return 'ホーム';
    case 'new_reservation':
      return '予約登録';
    case 'cancel':
      return 'キャンセル';
    case 'site_assignment':
      return 'サイト割振';
    case 'checkin':
      return 'チェックイン';
    case 'checkout':
      return '会計';
    default:
      return 'カスタムリンク';
  }
}

export default function FooterSettings({
  items,
  onMove,
  onToggleVisible,
  onUpdate,
}: FooterSettingsProps) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">フッター設定</h2>
        <p className="mt-1 text-sm text-gray-500">
          かんたんモード下部の固定ボタンを設定します。
        </p>
      </div>

      <div className="space-y-4">
        {items.map((item, index) => (
          <article key={item.id} className="rounded-2xl border border-gray-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {index + 1}. {item.label}
                </p>
                <p className="mt-1 text-xs text-gray-500">{actionLabel(item.actionType)}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onMove(item.id, 'up')}
                  disabled={index === 0}
                  className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => onMove(item.id, 'down')}
                  disabled={index === items.length - 1}
                  className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40"
                >
                  ↓
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">ラベル</span>
                <input
                  value={item.label}
                  onChange={(event) => onUpdate(item.id, { label: event.target.value })}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">アイコン</span>
                <input
                  value={item.icon}
                  onChange={(event) => onUpdate(item.id, { icon: event.target.value })}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={item.isVisible}
                  disabled={item.isRequired}
                  onChange={() => onToggleVisible(item.id)}
                  className="rounded border-gray-300"
                />
                {item.isRequired ? '必須項目のため常に表示' : '表示する'}
              </label>
              {item.actionType === 'custom_link' ? (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">リンク先</span>
                  <input
                    value={item.customUrl}
                    onChange={(event) => onUpdate(item.id, { customUrl: event.target.value })}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
