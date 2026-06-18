'use client';

import type { ReactNode } from 'react';
import type {
  AdminMember,
  EasyModeCategorySetting,
  EasyModeCategoryType,
  EasyModeDeviceTarget,
  EasyModeDisplayCondition,
  EasyModeRoleTarget,
} from '@/types/admin';
import {
  toChecklistConfig,
  toCustomEventsConfig,
  toCustomLinkConfig,
  toCustomMemoConfig,
  toCustomProductsConfig,
  toCustomReservationsConfig,
} from '@/lib/easyMode';

const CATEGORY_TYPE_OPTIONS: Array<{ value: EasyModeCategoryType; label: string }> = [
  { value: 'today_guests', label: '今日のお客様' },
  { value: 'availability', label: '空き状況' },
  { value: 'checkout', label: '会計' },
  { value: 'inventory', label: '在庫状況' },
  { value: 'staff_memos', label: 'やることメモ' },
  { value: 'reservations', label: '予約一覧' },
  { value: 'sales_report', label: '売上日報' },
  { value: 'events', label: 'イベント' },
  { value: 'custom_memo', label: 'カスタムメモ' },
  { value: 'custom_link', label: 'カスタムリンク' },
  { value: 'custom_checklist', label: 'チェックリスト' },
  { value: 'custom_products', label: '商品カテゴリ' },
  { value: 'custom_events', label: 'イベントカテゴリ' },
  { value: 'custom_reservations', label: '予約フィルター' },
];

const DEVICE_OPTIONS: Array<{ value: EasyModeDeviceTarget; label: string }> = [
  { value: 'all', label: 'すべて' },
  { value: 'mobile', label: 'スマホ' },
  { value: 'tablet', label: 'タブレット' },
  { value: 'pc', label: 'PC' },
];

const ROLE_OPTIONS: Array<{ value: EasyModeRoleTarget; label: string }> = [
  { value: 'all', label: '全員' },
  { value: 'admin_only', label: '管理者のみ' },
  { value: 'staff_only', label: '現場スタッフ' },
  { value: 'specific', label: '特定スタッフ' },
];

const CONDITION_OPTIONS: Array<{ value: EasyModeDisplayCondition; label: string }> = [
  { value: 'always', label: '常に表示' },
  { value: 'today_only', label: '当日のみ' },
  { value: 'has_reservations', label: '予約がある日だけ' },
  { value: 'has_events', label: 'イベントがある日だけ' },
  { value: 'low_stock', label: '在庫が少ない時だけ' },
  { value: 'has_pending_memos', label: '未対応メモがある時だけ' },
];

type CategoryEditModalProps = {
  category: EasyModeCategorySetting;
  members: AdminMember[];
  optionCategories: string[];
  onClose: () => void;
  onSave: (category: EasyModeCategorySetting) => void;
};

function updateConfig(category: EasyModeCategorySetting, nextConfig: Record<string, unknown>) {
  return {
    ...category,
    config: nextConfig,
  };
}

export default function CategoryEditModal({
  category,
  members,
  optionCategories,
  onClose,
  onSave,
}: CategoryEditModalProps) {
  const memoConfig = toCustomMemoConfig(category.config);
  const linkConfig = toCustomLinkConfig(category.config);
  const checklistConfig = toChecklistConfig(category.config);
  const productsConfig = toCustomProductsConfig(category.config);
  const eventsConfig = toCustomEventsConfig(category.config);
  const reservationsConfig = toCustomReservationsConfig(category.config);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 px-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">カテゴリを編集</h2>
            <p className="mt-1 text-sm text-gray-500">
              かんたんモードに表示するカテゴリ名、表示条件、種別ごとの内容を設定します。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            閉じる
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="カテゴリ名">
            <input
              value={category.name}
              onChange={(event) => onSave({ ...category, name: event.target.value })}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="種別">
            <select
              value={category.type}
              onChange={(event) => onSave({ ...category, type: event.target.value as EasyModeCategoryType })}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            >
              {CATEGORY_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="アイコン">
            <input
              value={category.icon}
              onChange={(event) => onSave({ ...category, icon: event.target.value })}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="テーマカラー">
            <input
              type="color"
              value={category.color}
              onChange={(event) => onSave({ ...category, color: event.target.value })}
              className="h-12 w-full rounded-xl border border-gray-300 bg-white px-2 py-1"
            />
          </Field>
          <Field label="対象端末">
            <select
              value={category.targetDevice}
              onChange={(event) => onSave({ ...category, targetDevice: event.target.value as EasyModeDeviceTarget })}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            >
              {DEVICE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="対象スタッフ">
            <select
              value={category.targetRole}
              onChange={(event) =>
                onSave({
                  ...category,
                  targetRole: event.target.value as EasyModeRoleTarget,
                  targetStaffIds: event.target.value === 'specific' ? category.targetStaffIds : [],
                })
              }
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="表示条件">
            <select
              value={category.displayCondition}
              onChange={(event) =>
                onSave({ ...category, displayCondition: event.target.value as EasyModeDisplayCondition })
              }
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            >
              {CONDITION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="表示順">
            <input
              type="number"
              value={category.sortOrder}
              onChange={(event) => onSave({ ...category, sortOrder: Number(event.target.value || 0) })}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="表示する">
            <label className="flex min-h-11 items-center gap-3 rounded-xl border border-gray-200 px-4 py-2 text-sm">
              <input
                type="checkbox"
                checked={category.isVisible}
                onChange={(event) => onSave({ ...category, isVisible: event.target.checked })}
                className="rounded border-gray-300"
              />
              かんたんモードに表示する
            </label>
          </Field>
        </div>

        {category.targetRole === 'specific' ? (
          <div className="mt-4">
            <p className="mb-2 text-sm font-semibold text-gray-700">表示するスタッフ</p>
            <p className="mb-3 text-xs text-amber-700">
              今の管理認証では個人判定が弱いため、特定スタッフ設定は参考値として保存します。
            </p>
            <div className="grid gap-2 rounded-2xl border border-gray-200 p-4 md:grid-cols-2">
              {members.map((member) => {
                const checked = category.targetStaffIds.includes(member.id);
                return (
                  <label key={member.id} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) =>
                        onSave({
                          ...category,
                          targetStaffIds: event.target.checked
                            ? [...category.targetStaffIds, member.id]
                            : category.targetStaffIds.filter((staffId) => staffId !== member.id),
                        })
                      }
                      className="rounded border-gray-300"
                    />
                    {member.userName}
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="mt-4">
          <Field label="説明文">
            <textarea
              value={category.description}
              onChange={(event) => onSave({ ...category, description: event.target.value })}
              rows={3}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
        </div>

        {category.type === 'custom_memo' ? (
          <ConfigSection title="メモ内容">
            <textarea
              rows={8}
              value={memoConfig.content}
              onChange={(event) =>
                onSave(
                  updateConfig(category, {
                    ...memoConfig,
                    content: event.target.value,
                    updatedAt: new Date().toISOString(),
                  }),
                )
              }
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm"
              placeholder="今日の注意事項や共有したい内容を入力してください"
            />
          </ConfigSection>
        ) : null}

        {category.type === 'custom_link' ? (
          <ConfigSection title="リンク設定">
            <div className="space-y-3">
              {linkConfig.links.map((link, index) => (
                <div key={link.id} className="grid gap-3 rounded-2xl border border-gray-200 p-4 md:grid-cols-2">
                  <input
                    value={link.title}
                    onChange={(event) => {
                      const links = [...linkConfig.links];
                      links[index] = { ...link, title: event.target.value };
                      onSave(updateConfig(category, { links }));
                    }}
                    className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
                    placeholder="リンク名"
                  />
                  <input
                    value={link.icon}
                    onChange={(event) => {
                      const links = [...linkConfig.links];
                      links[index] = { ...link, icon: event.target.value };
                      onSave(updateConfig(category, { links }));
                    }}
                    className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
                    placeholder="アイコン"
                  />
                  <input
                    value={link.url}
                    onChange={(event) => {
                      const links = [...linkConfig.links];
                      links[index] = { ...link, url: event.target.value };
                      onSave(updateConfig(category, { links }));
                    }}
                    className="rounded-xl border border-gray-300 px-3 py-2 text-sm md:col-span-2"
                    placeholder="https://..."
                  />
                  <textarea
                    rows={2}
                    value={link.description}
                    onChange={(event) => {
                      const links = [...linkConfig.links];
                      links[index] = { ...link, description: event.target.value };
                      onSave(updateConfig(category, { links }));
                    }}
                    className="rounded-xl border border-gray-300 px-3 py-2 text-sm md:col-span-2"
                    placeholder="説明"
                  />
                  <button
                    type="button"
                    onClick={() => onSave(updateConfig(category, { links: linkConfig.links.filter((item) => item.id !== link.id) }))}
                    className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 md:col-span-2"
                  >
                    このリンクを削除
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  onSave(
                    updateConfig(category, {
                      links: [
                        ...linkConfig.links,
                        {
                          id: `link-${Date.now()}`,
                          title: '',
                          url: '',
                          icon: '🔗',
                          description: '',
                        },
                      ],
                    }),
                  )
                }
                className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700"
              >
                ＋ リンクを追加
              </button>
            </div>
          </ConfigSection>
        ) : null}

        {category.type === 'custom_checklist' ? (
          <ConfigSection title="チェック項目">
            <div className="space-y-3">
              {checklistConfig.items.map((item, index) => (
                <div key={item.id} className="grid gap-3 rounded-2xl border border-gray-200 p-4 md:grid-cols-2">
                  <input
                    value={item.title}
                    onChange={(event) => {
                      const items = [...checklistConfig.items];
                      items[index] = { ...item, title: event.target.value };
                      onSave(updateConfig(category, { ...checklistConfig, items }));
                    }}
                    className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
                    placeholder="項目名"
                  />
                  <input
                    value={item.assignedTo}
                    onChange={(event) => {
                      const items = [...checklistConfig.items];
                      items[index] = { ...item, assignedTo: event.target.value };
                      onSave(updateConfig(category, { ...checklistConfig, items }));
                    }}
                    className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
                    placeholder="担当者"
                    list="easy-mode-members"
                  />
                  <textarea
                    rows={2}
                    value={item.description}
                    onChange={(event) => {
                      const items = [...checklistConfig.items];
                      items[index] = { ...item, description: event.target.value };
                      onSave(updateConfig(category, { ...checklistConfig, items }));
                    }}
                    className="rounded-xl border border-gray-300 px-3 py-2 text-sm md:col-span-2"
                    placeholder="説明"
                  />
                  <input
                    type="datetime-local"
                    value={item.dueAt}
                    onChange={(event) => {
                      const items = [...checklistConfig.items];
                      items[index] = { ...item, dueAt: event.target.value };
                      onSave(updateConfig(category, { ...checklistConfig, items }));
                    }}
                    className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
                  />
                  <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={item.resetDaily}
                      onChange={(event) => {
                        const items = [...checklistConfig.items];
                        items[index] = { ...item, resetDaily: event.target.checked };
                        onSave(updateConfig(category, { ...checklistConfig, items }));
                      }}
                    />
                    毎日リセットする
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      onSave(updateConfig(category, { ...checklistConfig, items: checklistConfig.items.filter((entry) => entry.id !== item.id) }))
                    }
                    className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 md:col-span-2"
                  >
                    この項目を削除
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  onSave(
                    updateConfig(category, {
                      ...checklistConfig,
                      items: [
                        ...checklistConfig.items,
                        {
                          id: `item-${Date.now()}`,
                          title: '',
                          description: '',
                          assignedTo: '',
                          dueAt: '',
                          isCompleted: false,
                          completedAt: null,
                          sortOrder: checklistConfig.items.length + 1,
                          resetDaily: true,
                        },
                      ],
                    }),
                  )
                }
                className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700"
              >
                ＋ チェック項目を追加
              </button>
            </div>
          </ConfigSection>
        ) : null}

        {category.type === 'custom_products' ? (
          <ConfigSection title="商品カテゴリ設定">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="対象カテゴリ">
                <select
                  value={productsConfig.optionCategory}
                  onChange={(event) =>
                    onSave(updateConfig(category, { ...productsConfig, optionCategory: event.target.value }))
                  }
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">すべて</option>
                  {optionCategories.map((optionCategory) => (
                    <option key={optionCategory} value={optionCategory}>
                      {optionCategory}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="名前に含む文字">
                <input
                  value={productsConfig.titleContains}
                  onChange={(event) =>
                    onSave(updateConfig(category, { ...productsConfig, titleContains: event.target.value }))
                  }
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                />
              </Field>
              <CheckboxRow
                label="在庫数を表示"
                checked={productsConfig.showStock}
                onChange={(checked) => onSave(updateConfig(category, { ...productsConfig, showStock: checked }))}
              />
              <CheckboxRow
                label="価格を表示"
                checked={productsConfig.showPrice}
                onChange={(checked) => onSave(updateConfig(category, { ...productsConfig, showPrice: checked }))}
              />
              <CheckboxRow
                label="会計へ進むボタンを表示"
                checked={productsConfig.allowCheckout}
                onChange={(checked) => onSave(updateConfig(category, { ...productsConfig, allowCheckout: checked }))}
              />
            </div>
          </ConfigSection>
        ) : null}

        {category.type === 'custom_events' ? (
          <ConfigSection title="イベント表示条件">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="表示範囲">
                <select
                  value={eventsConfig.filter}
                  onChange={(event) => onSave(updateConfig(category, { ...eventsConfig, filter: event.target.value }))}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="today">今日だけ</option>
                  <option value="this_week">今週</option>
                  <option value="upcoming">これから</option>
                </select>
              </Field>
              <CheckboxRow
                label="参加人数を表示"
                checked={eventsConfig.showParticipants}
                onChange={(checked) => onSave(updateConfig(category, { ...eventsConfig, showParticipants: checked }))}
              />
              <CheckboxRow
                label="説明文を表示"
                checked={eventsConfig.showNotes}
                onChange={(checked) => onSave(updateConfig(category, { ...eventsConfig, showNotes: checked }))}
              />
            </div>
          </ConfigSection>
        ) : null}

        {category.type === 'custom_reservations' ? (
          <ConfigSection title="予約フィルター設定">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="表示する予約">
                <select
                  value={reservationsConfig.filter}
                  onChange={(event) =>
                    onSave(updateConfig(category, { ...reservationsConfig, filter: event.target.value }))
                  }
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="arrived_pending">本日未到着</option>
                  <option value="not_arrived">チェックイン待ち</option>
                  <option value="checked_in">チェックイン済み</option>
                  <option value="needs_attention">要確認</option>
                </select>
              </Field>
              <Field label="対象日">
                <select
                  value={reservationsConfig.date}
                  onChange={(event) => onSave(updateConfig(category, { ...reservationsConfig, date: event.target.value }))}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="today">今日</option>
                  <option value="tomorrow">明日</option>
                  <option value="all">すべて</option>
                </select>
              </Field>
            </div>
          </ConfigSection>
        ) : null}

        <datalist id="easy-mode-members">
          {members.map((member) => (
            <option key={member.id} value={member.userName} />
          ))}
        </datalist>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
      {children}
    </label>
  );
}

function ConfigSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">{title}</h3>
      {children}
    </section>
  );
}

function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}
