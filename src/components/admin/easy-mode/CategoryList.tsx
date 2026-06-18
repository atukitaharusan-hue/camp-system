'use client';

import type { EasyModeCategorySetting } from '@/types/admin';

type CategoryListProps = {
  categories: EasyModeCategorySetting[];
  onMove: (id: string, direction: 'up' | 'down') => void;
  onToggleVisible: (id: string) => void;
  onEdit: (id: string) => void;
  onAdd: () => void;
};

function typeLabel(type: EasyModeCategorySetting['type']) {
  const labels: Record<EasyModeCategorySetting['type'], string> = {
    today_guests: '既存機能',
    availability: '既存機能',
    checkout: '既存機能',
    inventory: '既存機能',
    staff_memos: '既存機能',
    reservations: '既存機能',
    sales_report: '既存機能',
    events: '既存機能',
    custom_memo: 'カスタムメモ',
    custom_link: 'カスタムリンク',
    custom_checklist: 'チェックリスト',
    custom_products: '商品カテゴリ',
    custom_events: 'イベントカテゴリ',
    custom_reservations: '予約フィルター',
  };
  return labels[type];
}

function roleLabel(role: EasyModeCategorySetting['targetRole']) {
  switch (role) {
    case 'admin_only':
      return '管理者のみ';
    case 'staff_only':
      return '現場スタッフ';
    case 'specific':
      return '特定スタッフ';
    default:
      return '全員';
  }
}

export default function CategoryList({
  categories,
  onMove,
  onToggleVisible,
  onEdit,
  onAdd,
}: CategoryListProps) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">カテゴリ設定</h2>
          <p className="mt-1 text-sm text-gray-500">
            かんたんモードの上部カテゴリを並び替えたり、表示内容を編集したりできます。
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
        >
          ＋ カテゴリを追加
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-3 py-2">表示順</th>
              <th className="px-3 py-2">表示</th>
              <th className="px-3 py-2">カテゴリ名</th>
              <th className="px-3 py-2">種別</th>
              <th className="px-3 py-2">対象</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {categories.map((category, index) => (
              <tr key={category.id}>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-8 text-center font-semibold text-gray-700">{index + 1}</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => onMove(category.id, 'up')}
                        disabled={index === 0}
                        className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => onMove(category.id, 'down')}
                        disabled={index === categories.length - 1}
                        className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={category.isVisible}
                      onChange={() => onToggleVisible(category.id)}
                      className="rounded border-gray-300"
                    />
                    <span className={category.isVisible ? 'text-emerald-700' : 'text-gray-400'}>
                      {category.isVisible ? 'ON' : 'OFF'}
                    </span>
                  </label>
                </td>
                <td className="px-3 py-3 font-medium text-gray-900">
                  <div className="flex items-center gap-2">
                    <span>{category.icon}</span>
                    <span>{category.name}</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-gray-600">{typeLabel(category.type)}</td>
                <td className="px-3 py-3 text-gray-600">{roleLabel(category.targetRole)}</td>
                <td className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => onEdit(category.id)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    編集
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
