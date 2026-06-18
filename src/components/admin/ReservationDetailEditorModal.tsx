import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { coerceReservationPricingBreakdown } from '@/lib/pricing';
import { fetchAccountingSubjects } from '@/lib/admin/fetchData';
import {
  getGeneratedPlanSubjectId,
  getGeneratedSiteSubjectId,
} from '@/lib/accountingSubjects';
import type { AdminPlan, AccountingSubjectKind, AccountingSubjectSetting } from '@/types/admin';
import type { Database } from '@/types/database';
import type { OptionItem } from '@/types/options';
import type { PricingLineItem, ReservationPricingBreakdown } from '@/types/pricing';
import { generateReceptionCode } from '@/types/reservation';
import {
  buildReservationOptionsJson,
  parseReservationOptions,
  ReservationOptionEditor,
  type ReservationOptionDraft,
} from '@/components/admin/ReservationOptionEditor';

type GuestReservationRow = Database['public']['Tables']['guest_reservations']['Row'];
type ReservationStatus = Database['public']['Enums']['reservation_status'];

const RESERVATION_STATUS_OPTIONS: Array<{ value: ReservationStatus; label: string }> = [
  { value: 'pending', label: '仮予約' },
  { value: 'confirmed', label: '予約確定' },
  { value: 'checked_in', label: 'チェックイン済み' },
  { value: 'completed', label: '完了' },
  { value: 'cancelled', label: 'キャンセル' },
];

export type ReservationDetailUpdatePayload = {
  status: ReservationStatus;
  optionsJson: Database['public']['Tables']['guest_reservations']['Row']['options_json'];
  totalAmount: number;
  additionalItemsCount: number;
  pricingBreakdown: ReservationPricingBreakdown;
  guests: number;
  adults: number;
  children: number;
  infants: number;
};

function toCurrency(value: number) {
  return `¥${Math.round(value).toLocaleString('ja-JP')}`;
}

function diffNights(checkInDate: string, checkOutDate: string) {
  const start = new Date(`${checkInDate}T00:00:00+09:00`);
  const end = new Date(`${checkOutDate}T00:00:00+09:00`);
  const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Number.isFinite(diff) ? Math.max(1, diff) : 1;
}

function getGuestBreakdown(reservation: GuestReservationRow) {
  const adults =
    reservation.adults ??
    Math.max((reservation.guests ?? 1) - (reservation.children ?? 0) - (reservation.infants ?? 0), 1);
  return {
    adults,
    children: reservation.children ?? 0,
    infants: reservation.infants ?? 0,
  };
}

function getChargeUnitQuantity(
  chargeUnit: PricingLineItem['chargeUnit'],
  guests: { adults: number; children: number; infants: number },
) {
  if (chargeUnit === 'adult') return guests.adults;
  if (chargeUnit === 'child') return guests.children;
  if (chargeUnit === 'infant') return guests.infants;
  return guests.adults + guests.children + guests.infants;
}

function syncAccommodationLinesWithGuests(
  lines: PricingLineItem[],
  guests: { adults: number; children: number; infants: number },
) {
  return lines.map((line) => {
    if (line.id === 'accommodation-adult' || line.id.includes('-adult')) {
      const quantity = guests.adults;
      return { ...line, quantity, amount: line.unitPrice * quantity };
    }
    if (line.id === 'accommodation-child' || line.id.includes('-child')) {
      const quantity = guests.children;
      return { ...line, quantity, amount: line.unitPrice * quantity };
    }
    if (line.id === 'accommodation-infant' || line.id.includes('-infant')) {
      const quantity = guests.infants;
      return { ...line, quantity, amount: line.unitPrice * quantity };
    }
    return line;
  });
}

function syncFeeLinesWithGuests(
  lines: PricingLineItem[],
  guests: { adults: number; children: number; infants: number },
) {
  return lines.map((line) => {
    const quantity = getChargeUnitQuantity(line.chargeUnit, guests);
    return { ...line, quantity, amount: line.unitPrice * quantity };
  });
}

function syncFeeLineWithGuests(
  line: PricingLineItem | null,
  guests: { adults: number; children: number; infants: number },
) {
  if (!line) return null;
  const quantity = getChargeUnitQuantity(line.chargeUnit, guests);
  return { ...line, quantity, amount: line.unitPrice * quantity };
}

function fallbackSubject(
  subjects: AccountingSubjectSetting[],
  kind: AccountingSubjectKind,
  exactName?: string | null,
) {
  return (
    (exactName ? subjects.find((subject) => subject.name === exactName) : undefined) ??
    subjects.find((subject) => subject.kind === kind) ??
    null
  );
}

function createEditableLine(
  input: Partial<PricingLineItem> & { id: string; label: string; amount: number; quantity?: number; chargeUnit?: PricingLineItem['chargeUnit'] },
) {
  const quantity = Math.max(1, input.quantity ?? 1);
  const amount = Math.max(0, input.amount);
  return {
    id: input.id,
    label: input.label,
    chargeUnit: input.chargeUnit ?? 'guest',
    quantity,
    unitPrice: quantity > 0 ? amount / quantity : amount,
    amount,
    accountingSubjectId: input.accountingSubjectId ?? null,
    accountingSubjectName: input.accountingSubjectName ?? null,
  } satisfies PricingLineItem;
}

function buildFallbackBreakdown(reservation: GuestReservationRow): ReservationPricingBreakdown {
  const options = parseReservationOptions(reservation.options_json);
  const optionsAmount = options.reduce((sum, item) => sum + Math.max(0, item.subtotal), 0);
  const totalAmount = Math.max(0, Number(reservation.total_amount ?? 0));
  return {
    accommodationAmount: Math.max(0, totalAmount - optionsAmount),
    accommodationLines: [
      createEditableLine({
        id: 'accommodation-line-1',
        label: '宿泊料金',
        amount: Math.max(0, totalAmount - optionsAmount),
      }),
    ],
    accommodationSubjectId: null,
    accommodationSubjectName: null,
    designationFeeAmount: 0,
    designationFeeLine: null,
    designationFeeSubjectId: null,
    designationFeeSubjectName: null,
    optionsAmount,
    mandatoryFees: [],
    lodgingTax: null,
    totalAmount,
  };
}

function buildAutoAccommodationLines(
  reservation: GuestReservationRow,
  plan: AdminPlan | null,
  subjects: AccountingSubjectSetting[],
  existingLines: PricingLineItem[],
) {
  if (existingLines.length > 0) {
    return existingLines;
  }

  if (!plan) {
    return [
      createEditableLine({
        id: 'accommodation-line-1',
        label: '宿泊料金',
        amount: Math.max(0, Number(reservation.total_amount ?? 0)),
        accountingSubjectId: null,
        accountingSubjectName: null,
      }),
    ];
  }

  const nights = reservation.nights > 0 ? reservation.nights : diffNights(reservation.check_in_date, reservation.check_out_date);
  const siteCount = Math.max(1, reservation.reserved_site_count ?? 1);
  const multiplier = Math.max(1, nights * siteCount);
  const guests = getGuestBreakdown(reservation);

  if (plan.pricingMode === 'per_person') {
    const rows: PricingLineItem[] = [];
    if (guests.adults > 0 && plan.adultPrice > 0) {
      const subject = fallbackSubject(subjects, 'lodging', `${plan.name} 大人料金`);
      rows.push(
        createEditableLine({
          id: 'accommodation-adult',
          label: `${plan.name} 大人料金`,
          amount: guests.adults * multiplier * plan.adultPrice,
          quantity: guests.adults * multiplier,
          accountingSubjectId: subject?.id ?? getGeneratedPlanSubjectId(plan.id, 'adult'),
          accountingSubjectName: subject?.name ?? `${plan.name} 大人料金`,
          chargeUnit: 'adult',
        }),
      );
    }
    if (guests.children > 0 && plan.childPrice > 0) {
      const subject = fallbackSubject(subjects, 'lodging', `${plan.name} 子ども料金`);
      rows.push(
        createEditableLine({
          id: 'accommodation-child',
          label: `${plan.name} 子ども料金`,
          amount: guests.children * multiplier * plan.childPrice,
          quantity: guests.children * multiplier,
          accountingSubjectId: subject?.id ?? getGeneratedPlanSubjectId(plan.id, 'child'),
          accountingSubjectName: subject?.name ?? `${plan.name} 子ども料金`,
          chargeUnit: 'child',
        }),
      );
    }
    if (guests.infants > 0 && plan.infantPrice > 0) {
      const subject = fallbackSubject(subjects, 'lodging', `${plan.name} 幼児料金`);
      rows.push(
        createEditableLine({
          id: 'accommodation-infant',
          label: `${plan.name} 幼児料金`,
          amount: guests.infants * multiplier * plan.infantPrice,
          quantity: guests.infants * multiplier,
          accountingSubjectId: subject?.id ?? getGeneratedPlanSubjectId(plan.id, 'infant'),
          accountingSubjectName: subject?.name ?? `${plan.name} 幼児料金`,
          chargeUnit: 'infant',
        }),
      );
    }
    return rows.length > 0
      ? rows
      : [
          createEditableLine({
            id: 'accommodation-base',
            label: plan.name,
            amount: Math.max(0, Number(reservation.total_amount ?? 0)),
            quantity: multiplier,
            accountingSubjectId: getGeneratedPlanSubjectId(plan.id, 'base'),
            accountingSubjectName: plan.name,
          }),
        ];
  }

  const subject = fallbackSubject(subjects, 'lodging', plan.name);
  return [
    createEditableLine({
      id: 'accommodation-base',
      label: plan.name,
      amount: Math.max(0, Number(reservation.total_amount ?? 0)),
      quantity: multiplier,
      accountingSubjectId: subject?.id ?? getGeneratedPlanSubjectId(plan.id, 'base'),
      accountingSubjectName: subject?.name ?? plan.name,
    }),
  ];
}

function buildAutoDesignationLine(
  amount: number,
  primarySiteId: string | null,
  siteLabel: string,
  subjects: AccountingSubjectSetting[],
  existingLine: PricingLineItem | null,
) {
  if (existingLine) return existingLine;
  if (amount <= 0) return null;
  const subject = primarySiteId
    ? subjects.find((item) => item.id === getGeneratedSiteSubjectId(primarySiteId, 'designation'))
    : fallbackSubject(subjects, 'lodging', '指定料金');

  return createEditableLine({
    id: 'designation-fee',
    label: `${siteLabel} 指定料金`,
    amount,
    accountingSubjectId: subject?.id ?? (primarySiteId ? getGeneratedSiteSubjectId(primarySiteId, 'designation') : null),
    accountingSubjectName: subject?.name ?? `${siteLabel} 指定料金`,
  });
}

function applyDefaultSubjectsToLines(
  lines: PricingLineItem[],
  subjects: AccountingSubjectSetting[],
  kind: AccountingSubjectKind,
) {
  return lines.map((line) => {
    if (line.accountingSubjectId) return line;
    const subject = fallbackSubject(subjects, kind, line.label);
    if (!subject) return line;
    return {
      ...line,
      accountingSubjectId: subject.id,
      accountingSubjectName: subject.name,
    };
  });
}

function InfoCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'highlight';
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        tone === 'highlight' ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 font-semibold ${tone === 'highlight' ? 'text-emerald-900' : 'text-slate-900'}`}>{value}</p>
    </div>
  );
}

function EditableAmountRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-slate-700">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
      />
    </label>
  );
}

function EditableUnitPriceRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-slate-700">{label}</span>
      <input
        type="number"
        min={0}
        value={Math.round(value)}
        onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
      />
    </label>
  );
}

function LineItemEditor({
  title,
  lines,
  subjects,
  onChange,
}: {
  title: string;
  lines: PricingLineItem[];
  subjects: AccountingSubjectSetting[];
  onChange: (lines: PricingLineItem[]) => void;
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
      {lines.map((line) => (
        <div key={line.id} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1.2fr_120px_120px_1.3fr_120px]">
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-slate-700">項目名</span>
            <input
              value={line.label}
              onChange={(event) =>
                onChange(lines.map((item) => (item.id === line.id ? { ...item, label: event.target.value } : item)))
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <EditableAmountRow
            label="金額"
            value={line.amount}
            onChange={(amount) =>
              onChange(
                lines.map((item) =>
                  item.id === line.id
                    ? {
                        ...item,
                        amount,
                        unitPrice: item.quantity > 0 ? amount / item.quantity : amount,
                      }
                    : item,
                ),
              )
            }
          />
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-slate-700">数量</span>
            <input
              type="number"
              min={1}
              value={line.quantity}
              onChange={(event) => {
                const quantity = Math.max(1, Number(event.target.value) || 1);
                onChange(
                  lines.map((item) =>
                    item.id === line.id
                      ? {
                          ...item,
                          quantity,
                          unitPrice: quantity > 0 ? item.amount / quantity : item.amount,
                        }
                      : item,
                  ),
                );
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-slate-700">会計科目</span>
            <select
              value={line.accountingSubjectId ?? ''}
              onChange={(event) => {
                const subject = subjects.find((item) => item.id === event.target.value) ?? null;
                onChange(
                  lines.map((item) =>
                    item.id === line.id
                      ? {
                          ...item,
                          accountingSubjectId: subject?.id ?? null,
                          accountingSubjectName: subject?.name ?? null,
                        }
                      : item,
                  ),
                );
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">未選択</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ))}
    </div>
  );
}

function LineItemEditorV2({
  title,
  lines,
  subjects,
  onChange,
}: {
  title: string;
  lines: PricingLineItem[];
  subjects: AccountingSubjectSetting[];
  onChange: (lines: PricingLineItem[]) => void;
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
      {lines.map((line) => (
        <div
          key={line.id}
          className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1.2fr_120px_120px_1.3fr_120px]"
        >
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-slate-700">項目名</span>
            <input
              value={line.label}
              onChange={(event) =>
                onChange(lines.map((item) => (item.id === line.id ? { ...item, label: event.target.value } : item)))
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <EditableUnitPriceRow
            label="単価"
            value={line.unitPrice}
            onChange={(unitPrice) =>
              onChange(
                lines.map((item) =>
                  item.id === line.id
                    ? {
                        ...item,
                        unitPrice,
                        amount: unitPrice * item.quantity,
                      }
                    : item,
                ),
              )
            }
          />
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-slate-700">数量</span>
            <input
              type="number"
              min={1}
              value={line.quantity}
              onChange={(event) => {
                const quantity = Math.max(1, Number(event.target.value) || 1);
                onChange(
                  lines.map((item) =>
                    item.id === line.id
                      ? {
                          ...item,
                          quantity,
                          amount: item.unitPrice * quantity,
                        }
                      : item,
                  ),
                );
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-slate-700">会計科目</span>
            <select
              value={line.accountingSubjectId ?? ''}
              onChange={(event) => {
                const subject = subjects.find((item) => item.id === event.target.value) ?? null;
                onChange(
                  lines.map((item) =>
                    item.id === line.id
                      ? {
                          ...item,
                          accountingSubjectId: subject?.id ?? null,
                          accountingSubjectName: subject?.name ?? null,
                        }
                      : item,
                  ),
                );
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">未選択</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
            <span className="block text-xs font-medium text-slate-700">小計</span>
            <span className="mt-1 block font-semibold text-slate-900">{toCurrency(line.amount)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReservationDetailEditorModal({
  reservation,
  options,
  planName,
  siteLabel,
  plan = null,
  primarySiteId = null,
  onClose,
  onSave,
}: {
  reservation: GuestReservationRow;
  options: OptionItem[];
  planName: string;
  siteLabel: string;
  plan?: AdminPlan | null;
  primarySiteId?: string | null;
  onClose: () => void;
  onSave: (payload: ReservationDetailUpdatePayload) => Promise<{ success: boolean; error?: string }>;
}) {
  const initialBreakdown = useMemo(
    () => coerceReservationPricingBreakdown(reservation.pricing_breakdown) ?? buildFallbackBreakdown(reservation),
    [reservation],
  );
  const initialGuestBreakdown = useMemo(() => getGuestBreakdown(reservation), [reservation]);

  const [accountingSubjects, setAccountingSubjects] = useState<AccountingSubjectSetting[]>([]);
  const [items, setItems] = useState<ReservationOptionDraft[]>(() => parseReservationOptions(reservation.options_json));
  const [status, setStatus] = useState<ReservationStatus>(() => (reservation.status ?? 'confirmed') as ReservationStatus);
  const [adults, setAdults] = useState(initialGuestBreakdown.adults);
  const [children, setChildren] = useState(initialGuestBreakdown.children);
  const [infants, setInfants] = useState(initialGuestBreakdown.infants);
  const [accommodationLines, setAccommodationLines] = useState<PricingLineItem[]>(initialBreakdown.accommodationLines ?? []);
  const [designationFeeLine, setDesignationFeeLine] = useState<PricingLineItem | null>(initialBreakdown.designationFeeLine ?? null);
  const [mandatoryFees, setMandatoryFees] = useState<PricingLineItem[]>(initialBreakdown.mandatoryFees);
  const [lodgingTax, setLodgingTax] = useState<PricingLineItem | null>(initialBreakdown.lodgingTax);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchAccountingSubjects().then(setAccountingSubjects);
  }, []);

  useEffect(() => {
    setAdults(initialGuestBreakdown.adults);
    setChildren(initialGuestBreakdown.children);
    setInfants(initialGuestBreakdown.infants);
  }, [initialGuestBreakdown]);

  useEffect(() => {
    if (accountingSubjects.length === 0) return;
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;

      setAccommodationLines((current) =>
        applyDefaultSubjectsToLines(
          current.length > 0
            ? current
            : buildAutoAccommodationLines(reservation, plan, accountingSubjects, initialBreakdown.accommodationLines ?? []),
          accountingSubjects,
          'lodging',
        ),
      );
      setMandatoryFees((current) => applyDefaultSubjectsToLines(current, accountingSubjects, 'entry_fee'));
      setLodgingTax((current) => {
        if (!current) return current;
        if (current.accountingSubjectId) return current;
        const subject = fallbackSubject(accountingSubjects, 'tax', current.label);
        return {
          ...current,
          accountingSubjectId: subject?.id ?? null,
          accountingSubjectName: subject?.name ?? null,
        };
      });
      setDesignationFeeLine((current) =>
        current ??
        buildAutoDesignationLine(
          initialBreakdown.designationFeeAmount,
          primarySiteId,
          siteLabel,
          accountingSubjects,
          initialBreakdown.designationFeeLine ?? null,
        ),
      );
      setItems((current) =>
        current.map((item) => {
          if (item.accountingSubjectId) return item;
          const subject =
            (!item.optionId ? null : accountingSubjects.find((entry) => entry.id === `generated-option-${item.optionId}`)) ??
            fallbackSubject(
              accountingSubjects,
              item.type === 'event' ? 'event' : item.type === 'purchase' ? 'shop' : 'rental',
              item.name,
            );
          return {
            ...item,
            accountingSubjectId: subject?.id ?? null,
            accountingSubjectName: subject?.name ?? null,
          };
        }),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [
    accountingSubjects,
    initialBreakdown,
    plan,
    primarySiteId,
    reservation.id,
    reservation.total_amount,
    reservation.check_in_date,
    reservation.check_out_date,
    reservation.guests,
    reservation.children,
    reservation.infants,
    reservation.adults,
    reservation.nights,
    reservation.reserved_site_count,
    siteLabel,
  ]);

  useEffect(() => {
    const guestCounts = { adults, children, infants };
    setAccommodationLines((current) => syncAccommodationLinesWithGuests(current, guestCounts));
    setMandatoryFees((current) => syncFeeLinesWithGuests(current, guestCounts));
    setLodgingTax((current) => syncFeeLineWithGuests(current, guestCounts));
  }, [adults, children, infants]);

  const optionsTotal = useMemo(() => items.reduce((sum, item) => sum + Math.max(0, item.subtotal), 0), [items]);
  const guests = useMemo(() => Math.max(1, adults + children + infants), [adults, children, infants]);
  const accommodationAmount = useMemo(
    () => accommodationLines.reduce((sum, line) => sum + Math.max(0, line.amount), 0),
    [accommodationLines],
  );
  const designationFeeAmount = useMemo(() => Math.max(0, designationFeeLine?.amount ?? 0), [designationFeeLine]);
  const lodgingAmount = useMemo(
    () =>
      accommodationAmount +
      designationFeeAmount +
      mandatoryFees.reduce((sum, fee) => sum + Math.max(0, fee.amount), 0) +
      Math.max(0, lodgingTax?.amount ?? 0),
    [accommodationAmount, designationFeeAmount, lodgingTax, mandatoryFees],
  );

  const nextPricingBreakdown = useMemo<ReservationPricingBreakdown>(
    () => ({
      accommodationAmount,
      accommodationLines,
      accommodationSubjectId:
        accommodationLines.length === 1 ? (accommodationLines[0].accountingSubjectId ?? null) : null,
      accommodationSubjectName:
        accommodationLines.length === 1 ? (accommodationLines[0].accountingSubjectName ?? null) : null,
      designationFeeAmount,
      designationFeeLine,
      designationFeeSubjectId: designationFeeLine?.accountingSubjectId ?? null,
      designationFeeSubjectName: designationFeeLine?.accountingSubjectName ?? null,
      optionsAmount: optionsTotal,
      mandatoryFees,
      lodgingTax,
      totalAmount: lodgingAmount + optionsTotal,
    }),
    [accommodationAmount, accommodationLines, designationFeeAmount, designationFeeLine, lodgingAmount, lodgingTax, mandatoryFees, optionsTotal],
  );

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    const result = await onSave({
      status,
      optionsJson: buildReservationOptionsJson(items) as Database['public']['Tables']['guest_reservations']['Row']['options_json'],
      totalAmount: nextPricingBreakdown.totalAmount,
      additionalItemsCount: items.length,
      pricingBreakdown: nextPricingBreakdown,
      guests,
      adults,
      children,
      infants,
    });

    setSaving(false);

    if (!result.success) {
      setError(result.error ?? '保存に失敗しました。');
      return;
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">予約詳細と追加項目の編集</h2>
            <p className="mt-1 text-sm text-gray-500">
              受付コード {generateReceptionCode(reservation.id)} / 予約者 {reservation.user_name || '未設定'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            閉じる
          </button>
        </div>

        <div className="max-h-[calc(90vh-88px)] space-y-4 overflow-y-auto p-5">
          <div className="grid gap-3 md:grid-cols-5">
            <InfoCard label="プラン" value={planName} />
            <InfoCard label="サイト" value={siteLabel} />
            <InfoCard label="日程" value={`${reservation.check_in_date} - ${reservation.check_out_date}`} />
            <InfoCard label="宿泊料金" value={toCurrency(lodgingAmount)} tone="highlight" />
            <InfoCard label="追加購入合計" value={toCurrency(optionsTotal)} />
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-base font-semibold text-slate-900">予約ステータス</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <label className="text-sm font-medium text-slate-700">
                大人
                <input
                  type="number"
                  min={0}
                  value={adults}
                  onChange={(event) => setAdults(Math.max(0, Number(event.target.value) || 0))}
                  className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                子ども
                <input
                  type="number"
                  min={0}
                  value={children}
                  onChange={(event) => setChildren(Math.max(0, Number(event.target.value) || 0))}
                  className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                幼児
                <input
                  type="number"
                  min={0}
                  value={infants}
                  onChange={(event) => setInfants(Math.max(0, Number(event.target.value) || 0))}
                  className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                />
              </label>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div className="text-xs text-emerald-700">合計人数</div>
                <div className="mt-2 text-lg font-semibold text-emerald-900">{guests}名</div>
              </div>
            </div>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as ReservationStatus)}
              className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            >
              {RESERVATION_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-gray-500">
              ステータスと追加項目は、最後に「全て保存」を押すとまとめて保存されます。
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-base font-semibold text-slate-900">宿泊料金内訳</h3>
            <p className="mt-1 text-sm text-slate-500">
              上部の宿泊料金は、ここで編集した宿泊内訳の合計です。追加購入合計は下の追加項目から計算されます。
            </p>

            <div className="mt-4 space-y-5">
              <LineItemEditorV2
                title="宿泊料金"
                lines={accommodationLines}
                subjects={accountingSubjects}
                onChange={setAccommodationLines}
              />

              {designationFeeLine ? (
                <LineItemEditorV2
                  title="指定料金"
                  lines={[designationFeeLine]}
                  subjects={accountingSubjects}
                  onChange={(lines) => setDesignationFeeLine(lines[0] ?? null)}
                />
              ) : null}

              {mandatoryFees.length > 0 ? (
                <LineItemEditorV2
                  title="入場料・必須料金"
                  lines={mandatoryFees}
                  subjects={accountingSubjects}
                  onChange={setMandatoryFees}
                />
              ) : null}

              {lodgingTax ? (
                <LineItemEditorV2
                  title="宿泊税"
                  lines={[lodgingTax]}
                  subjects={accountingSubjects}
                  onChange={(lines) => setLodgingTax(lines[0] ?? null)}
                />
              ) : null}
            </div>
          </section>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}

          <ReservationOptionEditor
            options={options}
            accountingSubjects={accountingSubjects}
            items={items}
            onChange={setItems}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div>
              <p className="text-sm text-slate-500">保存対象</p>
              <p className="text-sm font-medium text-slate-900">
                宿泊料金内訳 / 追加項目 / 追加項目合計 / 最終合計金額 / 予約ステータス
              </p>
              <div className="mt-2 grid gap-2 text-xs text-slate-600 md:grid-cols-3">
                <span>宿泊料金: {toCurrency(lodgingAmount)}</span>
                <span>追加購入合計: {toCurrency(optionsTotal)}</span>
                <span>最終合計金額: {toCurrency(nextPricingBreakdown.totalAmount)}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/admin/reservations/${reservation.id}`}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
              >
                詳細を見る
              </Link>
              <Link
                href={`/admin/reservations/${reservation.id}/edit`}
                className="rounded-full border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-white"
              >
                通常編集へ
              </Link>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? '保存中...' : '全て保存'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
