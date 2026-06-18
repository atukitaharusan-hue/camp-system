import { useMemo, useState } from 'react';
import type { AccountingSubjectSetting } from '@/types/admin';
import type { Json } from '@/types/database';
import type { OptionItem } from '@/types/options';
import {
  getGeneratedOptionSubjectId,
  resolveAccountingSubjectKindFromOptionType,
} from '@/lib/accountingSubjects';

export type ReservationOptionDraft = {
  id: string;
  type: 'rental' | 'event' | 'purchase';
  optionId: string;
  name: string;
  quantity: number;
  days: number;
  people: number;
  subtotal: number;
  unitPrice?: number;
  accountingSubjectId?: string | null;
  accountingSubjectName?: string | null;
};

function buildDefaultSubjectForItem(
  subjects: AccountingSubjectSetting[],
  item: Pick<ReservationOptionDraft, 'type' | 'optionId' | 'name'>,
) {
  if (item.type !== 'purchase' && item.optionId) {
    const generatedId = getGeneratedOptionSubjectId(item.optionId);
    const generatedSubject = subjects.find((subject) => subject.id === generatedId);
    if (generatedSubject) {
      return {
        accountingSubjectId: generatedSubject.id,
        accountingSubjectName: generatedSubject.name,
      };
    }
  }

  const fallback = subjects.find(
    (subject) => subject.kind === resolveAccountingSubjectKindFromOptionType(item.type),
  );

  return {
    accountingSubjectId: fallback?.id ?? null,
    accountingSubjectName: fallback?.name ?? null,
  };
}

export function parseReservationOptions(value: Json | null | undefined): ReservationOptionDraft[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const source = item as Record<string, unknown>;
    const rawType = typeof source.type === 'string' ? source.type : 'rental';
    const type = rawType === 'event' || rawType === 'purchase' ? rawType : 'rental';
    const quantity = typeof source.quantity === 'number' ? source.quantity : 1;
    const subtotal = typeof source.subtotal === 'number' ? source.subtotal : 0;

    return [
      {
        id: `${type}-${typeof source.optionId === 'string' ? source.optionId : 'manual'}-${index}`,
        type,
        optionId: typeof source.optionId === 'string' ? source.optionId : '',
        name: typeof source.name === 'string' ? source.name : '',
        quantity,
        days: typeof source.days === 'number' ? source.days : 1,
        people: typeof source.people === 'number' ? source.people : 1,
        subtotal,
        unitPrice:
          typeof source.unitPrice === 'number'
            ? source.unitPrice
            : type === 'purchase'
              ? subtotal / Math.max(1, quantity)
              : undefined,
        accountingSubjectId:
          typeof source.accountingSubjectId === 'string' ? source.accountingSubjectId : null,
        accountingSubjectName:
          typeof source.accountingSubjectName === 'string' ? source.accountingSubjectName : null,
      } satisfies ReservationOptionDraft,
    ];
  });
}

export function buildReservationOptionsJson(items: ReservationOptionDraft[]) {
  return items.map((item) => {
    if (item.type === 'event') {
      return {
        type: 'event',
        optionId: item.optionId,
        name: item.name || undefined,
        quantity: 1,
        people: item.people,
        subtotal: item.subtotal,
        accountingSubjectId: item.accountingSubjectId ?? undefined,
        accountingSubjectName: item.accountingSubjectName ?? undefined,
      };
    }

    if (item.type === 'purchase') {
      return {
        type: 'purchase',
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        accountingSubjectId: item.accountingSubjectId ?? undefined,
        accountingSubjectName: item.accountingSubjectName ?? undefined,
      };
    }

    return {
      type: 'rental',
      optionId: item.optionId,
      name: item.name || undefined,
      quantity: item.quantity,
      days: item.days,
      subtotal: item.subtotal,
      accountingSubjectId: item.accountingSubjectId ?? undefined,
      accountingSubjectName: item.accountingSubjectName ?? undefined,
    };
  });
}

export function buildOptionSubtotal(option: OptionItem, quantity: number, days: number, people: number) {
  if (option.category === 'event') {
    return Math.max(1, people) * option.price;
  }

  if (option.priceType === 'per_day') {
    return Math.max(1, quantity) * Math.max(1, days) * option.price;
  }

  if (option.priceType === 'per_person') {
    return Math.max(1, people) * option.price;
  }

  if (option.priceType === 'fixed') {
    return option.price;
  }

  return Math.max(1, quantity) * option.price;
}

function recalculateDraftSubtotal(item: ReservationOptionDraft, option?: OptionItem) {
  if (item.type === 'purchase') {
    return Math.max(0, (item.unitPrice ?? 0) * Math.max(1, item.quantity));
  }

  if (!option) {
    return Math.max(0, item.subtotal);
  }

  return buildOptionSubtotal(option, item.quantity, item.days, item.people);
}

export function ReservationOptionEditor({
  options,
  accountingSubjects = [],
  items,
  onChange,
  showTotal = true,
}: {
  options: OptionItem[];
  accountingSubjects?: AccountingSubjectSetting[];
  items: ReservationOptionDraft[];
  onChange: (items: ReservationOptionDraft[]) => void;
  showTotal?: boolean;
}) {
  const [selectedOptionIdToAdd, setSelectedOptionIdToAdd] = useState('');
  const [selectedOptionQuantity, setSelectedOptionQuantity] = useState(1);
  const [selectedOptionDays, setSelectedOptionDays] = useState(1);
  const [selectedOptionPeople, setSelectedOptionPeople] = useState(1);
  const [purchaseMode, setPurchaseMode] = useState<'subject' | 'manual'>('subject');
  const [manualPurchaseName, setManualPurchaseName] = useState('');
  const [purchaseAmount, setPurchaseAmount] = useState(0);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [purchaseSubjectId, setPurchaseSubjectId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(() => items.reduce((sum, item) => sum + Math.max(0, item.subtotal), 0), [items]);
  const optionById = useMemo(() => new Map(options.map((option) => [option.id, option])), [options]);
  const subjectById = useMemo(
    () => new Map(accountingSubjects.map((subject) => [subject.id, subject])),
    [accountingSubjects],
  );

  const handleAddOption = () => {
    const option = options.find((item) => item.id === selectedOptionIdToAdd);
    if (!option) {
      setError('追加する項目を選択してください。');
      return;
    }

    const quantity = Math.max(1, selectedOptionQuantity);
    const days = Math.max(1, selectedOptionDays);
    const people = Math.max(1, selectedOptionPeople);
    const subtotal = buildOptionSubtotal(option, quantity, days, people);
    const defaultSubject = buildDefaultSubjectForItem(accountingSubjects, {
      type: option.category === 'event' ? 'event' : 'rental',
      optionId: option.id,
      name: option.name,
    });

    onChange([
      ...items,
      {
        id: `${option.category}-${option.id}-${Date.now()}`,
        type: option.category === 'event' ? 'event' : 'rental',
        optionId: option.id,
        name: option.name,
        quantity,
        days,
        people,
        subtotal,
        unitPrice: option.price,
        accountingSubjectId: defaultSubject.accountingSubjectId,
        accountingSubjectName: defaultSubject.accountingSubjectName,
      },
    ]);
    setSelectedOptionIdToAdd('');
    setSelectedOptionQuantity(1);
    setSelectedOptionDays(1);
    setSelectedOptionPeople(1);
    setError(null);
  };

  const handleAddPurchase = () => {
    const quantity = Math.max(1, purchaseQuantity);
    const unitPrice = Math.max(0, purchaseAmount);
    const subject = purchaseSubjectId ? subjectById.get(purchaseSubjectId) : undefined;

    if (purchaseMode === 'subject' && !subject) {
      setError('購入品に使う会計科目を選択してください。');
      return;
    }

    const trimmedName =
      purchaseMode === 'manual' ? manualPurchaseName.trim() : (subject?.name ?? '').trim();
    if (!trimmedName) {
      setError('その他の手動会計では項目名を入力してください。');
      return;
    }

    const defaultSubject = subject
      ? { accountingSubjectId: subject.id, accountingSubjectName: subject.name }
      : buildDefaultSubjectForItem(accountingSubjects, {
          type: 'purchase',
          optionId: '',
          name: trimmedName,
        });

    onChange([
      ...items,
      {
        id: `purchase-${Date.now()}`,
        type: 'purchase',
        optionId: '',
        name: trimmedName,
        quantity,
        days: 1,
        people: 1,
        unitPrice,
        subtotal: unitPrice * quantity,
        accountingSubjectId: defaultSubject.accountingSubjectId,
        accountingSubjectName: defaultSubject.accountingSubjectName,
      },
    ]);
    setManualPurchaseName('');
    setPurchaseAmount(0);
    setPurchaseQuantity(1);
    setPurchaseSubjectId('');
    setPurchaseMode('subject');
    setError(null);
  };

  const handleRemoveItem = (itemId: string) => {
    onChange(items.filter((item) => item.id !== itemId));
  };

  const handleUpdateItem = (
    itemId: string,
    updates: Partial<
      Pick<
        ReservationOptionDraft,
        'quantity' | 'days' | 'people' | 'unitPrice' | 'subtotal' | 'accountingSubjectId' | 'accountingSubjectName'
      >
    >,
  ) => {
    onChange(
      items.map((item) => {
        if (item.id !== itemId) return item;

        const nextItem: ReservationOptionDraft = {
          ...item,
          ...updates,
          quantity: Math.max(1, updates.quantity ?? item.quantity),
          days: Math.max(1, updates.days ?? item.days),
          people: Math.max(1, updates.people ?? item.people),
          unitPrice: updates.unitPrice ?? item.unitPrice,
          accountingSubjectId: updates.accountingSubjectId ?? item.accountingSubjectId ?? null,
          accountingSubjectName: updates.accountingSubjectName ?? item.accountingSubjectName ?? null,
        };

        return {
          ...nextItem,
          subtotal:
            item.type === 'purchase' || optionById.has(item.optionId)
              ? recalculateDraftSubtotal(nextItem, optionById.get(nextItem.optionId))
              : Math.max(0, updates.subtotal ?? item.subtotal),
        };
      }),
    );
  };

  const renderSubjectSelect = (item: ReservationOptionDraft) => (
    <label className="text-xs text-slate-600">
      会計科目
      <select
        value={item.accountingSubjectId ?? ''}
        onChange={(event) => {
          const subject = subjectById.get(event.target.value);
          handleUpdateItem(item.id, {
            accountingSubjectId: subject?.id ?? null,
            accountingSubjectName: subject?.name ?? null,
          });
        }}
        className="ml-2 min-w-[180px] rounded border border-gray-300 px-2 py-1 text-sm"
      >
        <option value="">未選択</option>
        {accountingSubjects.map((subject) => (
          <option key={subject.id} value={subject.id}>
            {subject.name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <section className="rounded border border-gray-200 bg-white p-5">
      <h2 className="mb-4 border-b border-gray-100 pb-2 text-sm font-semibold text-gray-800">
        オプション / イベント / 購入品
      </h2>

      {error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-400">
            追加項目はまだありません。
          </p>
        ) : (
          items.map((item) => {
            const linkedOption = item.optionId ? optionById.get(item.optionId) : undefined;
            return (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-slate-900">{item.name || '追加項目'}</p>
                  <p className="text-sm text-slate-500">
                    {item.type === 'event' ? 'イベント' : item.type === 'purchase' ? '購入品' : 'レンタル'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {item.type === 'event' ? (
                    <label className="text-xs text-slate-600">
                      人数
                      <input
                        type="number"
                        min={1}
                        value={item.people}
                        onChange={(event) =>
                          handleUpdateItem(item.id, { people: Math.max(1, Number(event.target.value) || 1) })
                        }
                        className="ml-2 w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    </label>
                  ) : (
                    <>
                      <label className="text-xs text-slate-600">
                        数量
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(event) =>
                            handleUpdateItem(item.id, { quantity: Math.max(1, Number(event.target.value) || 1) })
                          }
                          className="ml-2 w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                      </label>
                      {item.type === 'rental' ? (
                        <label className="text-xs text-slate-600">
                          日数
                          <input
                            type="number"
                            min={1}
                            value={item.days}
                            onChange={(event) =>
                              handleUpdateItem(item.id, { days: Math.max(1, Number(event.target.value) || 1) })
                            }
                            className="ml-2 w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                          />
                        </label>
                      ) : (
                        <label className="text-xs text-slate-600">
                          単価
                          <input
                            type="number"
                            min={0}
                            value={item.unitPrice ?? 0}
                            onChange={(event) =>
                              handleUpdateItem(item.id, { unitPrice: Math.max(0, Number(event.target.value) || 0) })
                            }
                            className="ml-2 w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                          />
                        </label>
                      )}
                    </>
                  )}
                  {item.type !== 'purchase' && !linkedOption ? (
                    <label className="text-xs text-slate-600">
                      金額
                      <input
                        type="number"
                        min={0}
                        value={item.subtotal}
                        onChange={(event) =>
                          handleUpdateItem(item.id, { subtotal: Math.max(0, Number(event.target.value) || 0) })
                        }
                        className="ml-2 w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    </label>
                  ) : null}
                  {renderSubjectSelect(item)}
                  <p className="min-w-24 text-right font-semibold text-slate-900">
                    ￥{item.subtotal.toLocaleString()}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.id)}
                    className="rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                  >
                    削除
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 p-4">
          <h3 className="text-base font-semibold text-gray-900">レンタル / イベントを追加</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">追加する項目</label>
              <select
                value={selectedOptionIdToAdd}
                onChange={(event) => setSelectedOptionIdToAdd(event.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">選択してください</option>
                {options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">数量</label>
              <input
                type="number"
                min={1}
                value={selectedOptionQuantity}
                onChange={(event) => setSelectedOptionQuantity(Math.max(1, Number(event.target.value) || 1))}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">日数 / 人数</label>
              <input
                type="number"
                min={1}
                value={selectedOptionDays}
                onChange={(event) => setSelectedOptionDays(Math.max(1, Number(event.target.value) || 1))}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mt-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">イベント人数</label>
            <input
              type="number"
              min={1}
              value={selectedOptionPeople}
              onChange={(event) => setSelectedOptionPeople(Math.max(1, Number(event.target.value) || 1))}
              className="w-full max-w-[180px] rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleAddOption}
              className="rounded-full border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
            >
              追加する
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 p-4">
          <h3 className="text-base font-semibold text-gray-900">購入品を追加</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPurchaseMode('subject')}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                purchaseMode === 'subject'
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              会計科目から選ぶ
            </button>
            <button
              type="button"
              onClick={() => setPurchaseMode('manual')}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                purchaseMode === 'manual'
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              その他を手入力
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {purchaseMode === 'subject' ? (
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">会計科目</label>
                <select
                  value={purchaseSubjectId}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    const nextSubject = subjectById.get(nextId);
                    setPurchaseSubjectId(nextId);
                    if (nextSubject) {
                      setPurchaseAmount(nextSubject.defaultUnitPrice ?? 0);
                    }
                  }}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">会計科目を選択</option>
                  {accountingSubjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">その他項目名</label>
                <input
                  type="text"
                  value={manualPurchaseName}
                  onChange={(event) => setManualPurchaseName(event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">単価</label>
              <input
                type="number"
                min={0}
                value={purchaseAmount}
                onChange={(event) => setPurchaseAmount(Math.max(0, Number(event.target.value) || 0))}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">数量</label>
              <input
                type="number"
                min={1}
                value={purchaseQuantity}
                onChange={(event) => setPurchaseQuantity(Math.max(1, Number(event.target.value) || 1))}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {purchaseMode === 'manual' ? (
            <div className="mt-3">
              <label className="mb-1 block text-sm font-medium text-gray-700">会計科目</label>
              <select
                value={purchaseSubjectId}
                onChange={(event) => setPurchaseSubjectId(event.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">自動選択</option>
                {accountingSubjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="mt-4">
            <button
              type="button"
              onClick={handleAddPurchase}
              className="rounded-full border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
            >
              購入品を追加
            </button>
          </div>
        </section>
      </div>

      {showTotal ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">追加項目の合計</p>
          <p className="text-xl font-bold text-slate-900">￥{total.toLocaleString()}</p>
        </div>
      ) : null}
    </section>
  );
}
