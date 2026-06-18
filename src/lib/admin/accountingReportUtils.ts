import { coerceReservationPricingBreakdown } from '@/lib/pricing';
import { parseReservationOptions } from '@/components/admin/ReservationOptionEditor';
import { generateReceptionCode, getPaymentMethodLabel } from '@/types/reservation';
import type {
  AccountingSubjectKind,
  AccountingSubjectSetting,
  PreviewRegisterSaleItem,
  PreviewRegisterSale,
  SalesReportCategorySetting,
  SalesReportOutputSetting,
} from '@/types/admin';
import type { Database } from '@/types/database';

type GuestReservationRow = Database['public']['Tables']['guest_reservations']['Row'];

export type SalesReportLine = {
  reservationId: string;
  reservationCode: string;
  date: string;
  siteNumber: string;
  paymentMethod: string;
  subjectId: string;
  subjectName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type AccountingLogItemSource =
  | 'accommodation'
  | 'designation'
  | 'mandatory_fee'
  | 'lodging_tax'
  | 'option';

export type AccountingLogItem = PreviewRegisterSaleItem & {
  sourceKind: AccountingLogItemSource;
  optionType?: 'rental' | 'event' | 'purchase';
  optionId?: string;
  days?: number;
  people?: number;
};

export type AccountingLogEntry = {
  id: string;
  sourceType: 'reservation' | 'register';
  reservationId: string | null;
  reservationCode: string | null;
  customerName: string;
  siteNumber: string;
  date: string;
  createdAt: string;
  paymentMethod: string;
  paymentMethodLabel: string;
  totalAmount: number;
  guests?: number;
  adults?: number;
  children?: number;
  infants?: number;
  items: AccountingLogItem[];
  canDelete: boolean;
};

function getReservationGuestBreakdown(reservation: GuestReservationRow) {
  const adults =
    reservation.adults ??
    Math.max((reservation.guests ?? 1) - (reservation.children ?? 0) - (reservation.infants ?? 0), 1);
  const children = reservation.children ?? 0;
  const infants = reservation.infants ?? 0;
  return {
    adults,
    children,
    infants,
    guests: Math.max(1, adults + children + infants),
  };
}

export const DEFAULT_SUBJECTS: AccountingSubjectSetting[] = [
  { id: 'subject-plan', name: 'プラン料金', defaultUnitPrice: 0, kind: 'lodging', sortOrder: 1, isActive: true, notes: '' },
  { id: 'subject-site-designation', name: 'サイト指定料', defaultUnitPrice: 0, kind: 'lodging', sortOrder: 2, isActive: true, notes: '' },
  { id: 'subject-entry-fee', name: '入場料', defaultUnitPrice: 0, kind: 'entry_fee', sortOrder: 3, isActive: true, notes: '' },
  { id: 'subject-lodging-tax', name: '宿泊税', defaultUnitPrice: 0, kind: 'tax', sortOrder: 4, isActive: true, notes: '' },
  { id: 'subject-rental', name: 'レンタル料', defaultUnitPrice: 0, kind: 'rental', sortOrder: 5, isActive: true, notes: '' },
  { id: 'subject-event', name: 'イベント参加費', defaultUnitPrice: 0, kind: 'event', sortOrder: 6, isActive: true, notes: '' },
  { id: 'subject-shop', name: '売店商品', defaultUnitPrice: 0, kind: 'shop', sortOrder: 7, isActive: true, notes: '' },
];

export const DEFAULT_CATEGORIES: SalesReportCategorySetting[] = [
  { id: 'category-lodging', parentCategoryName: '宿泊売上', subjectIds: ['subject-plan', 'subject-site-designation'], sortOrder: 1, isActive: true },
  { id: 'category-entry', parentCategoryName: '入場料', subjectIds: ['subject-entry-fee'], sortOrder: 2, isActive: true },
  { id: 'category-tax', parentCategoryName: '宿泊税', subjectIds: ['subject-lodging-tax'], sortOrder: 3, isActive: true },
  { id: 'category-rental', parentCategoryName: 'レンタル売上', subjectIds: ['subject-rental'], sortOrder: 4, isActive: true },
  { id: 'category-event', parentCategoryName: 'イベント売上', subjectIds: ['subject-event'], sortOrder: 5, isActive: true },
  { id: 'category-shop', parentCategoryName: '売店売上', subjectIds: ['subject-shop'], sortOrder: 6, isActive: true },
];

export const DEFAULT_OUTPUTS: SalesReportOutputSetting[] = [
  { id: 'output-all', reportName: '全体日報', includedCategories: ['すべてのカテゴリ'], splitByCategory: false, outputFormat: 'pdf', sortOrder: 1, isActive: true },
  { id: 'output-lodging', reportName: '宿泊関連', includedCategories: ['宿泊売上', '入場料', '宿泊税'], splitByCategory: true, outputFormat: 'pdf', sortOrder: 2, isActive: true },
  { id: 'output-extra', reportName: '追加購入関連', includedCategories: ['レンタル売上', 'イベント売上', '売店売上'], splitByCategory: true, outputFormat: 'pdf', sortOrder: 3, isActive: true },
];

export function todayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatCurrency(value: number) {
  return `¥${Math.round(value).toLocaleString('ja-JP')}`;
}

export function createCategory(sortOrder: number): SalesReportCategorySetting {
  return {
    id: `sales-category-${Date.now()}-${sortOrder}`,
    parentCategoryName: `親カテゴリ${sortOrder}`,
    subjectIds: [],
    sortOrder,
    isActive: true,
  };
}

export function createOutput(sortOrder: number): SalesReportOutputSetting {
  return {
    id: `sales-output-${Date.now()}-${sortOrder}`,
    reportName: `売上日報${sortOrder}`,
    includedCategories: ['すべてのカテゴリ'],
    splitByCategory: false,
    outputFormat: 'pdf',
    sortOrder,
    isActive: true,
  };
}

export function findSubjectForLine(
  subjects: AccountingSubjectSetting[],
  subjectName: string,
  kind: AccountingSubjectKind,
  explicitSubjectId?: string | null,
  explicitSubjectName?: string | null,
): AccountingSubjectSetting {
  if (explicitSubjectId) {
    const byId = subjects.find((subject) => subject.id === explicitSubjectId);
    if (byId) return byId;
  }

  const activeSubjects = subjects.filter((subject) => subject.isActive);
  if (explicitSubjectName) {
    const byExplicitName = activeSubjects.find((subject) => subject.name === explicitSubjectName);
    if (byExplicitName) return byExplicitName;
  }

  const exact = activeSubjects.find((subject) => subject.name === subjectName);
  if (exact) return exact;

  const byKind = activeSubjects.find((subject) => subject.kind === kind);
  if (byKind) return byKind;

  return {
    id: `derived-${kind}-${subjectName}`,
    name: subjectName,
    defaultUnitPrice: 0,
    kind,
    sortOrder: 9999,
    isActive: true,
    notes: '',
  };
}

export function buildSalesReportLinesWithSubjects(
  reservations: GuestReservationRow[],
  subjects: AccountingSubjectSetting[],
  dateFrom: string,
  dateTo: string,
) {
  const lines: SalesReportLine[] = [];

  reservations
    .filter((reservation) => reservation.status !== 'cancelled')
    .filter((reservation) => reservation.check_in_date >= dateFrom && reservation.check_in_date <= dateTo)
    .forEach((reservation) => {
      const pricingBreakdown = coerceReservationPricingBreakdown(reservation.pricing_breakdown);
      const reservationCode = generateReceptionCode(reservation.id);
      const paymentMethod = getPaymentMethodLabel(reservation.payment_method);
      const siteNumber = reservation.site_number ?? '未指定';
      const date = reservation.check_in_date;

      const accommodationLines = pricingBreakdown?.accommodationLines ?? [];
      if (accommodationLines.length > 0) {
        accommodationLines
          .filter((line) => line.amount > 0)
          .forEach((line) => {
            const subject = findSubjectForLine(
              subjects,
              line.label,
              'lodging',
              line.accountingSubjectId,
              line.accountingSubjectName,
            );
            lines.push({
              reservationId: reservation.id,
              reservationCode,
              date,
              siteNumber,
              paymentMethod,
              subjectId: subject.id,
              subjectName: subject.name,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              subtotal: line.amount,
            });
          });
      } else if (pricingBreakdown?.accommodationAmount && pricingBreakdown.accommodationAmount > 0) {
        const subject = findSubjectForLine(
          subjects,
          'プラン料金',
          'lodging',
          pricingBreakdown.accommodationSubjectId,
          pricingBreakdown.accommodationSubjectName,
        );
        lines.push({
          reservationId: reservation.id,
          reservationCode,
          date,
          siteNumber,
          paymentMethod,
          subjectId: subject.id,
          subjectName: subject.name,
          quantity: 1,
          unitPrice: pricingBreakdown.accommodationAmount,
          subtotal: pricingBreakdown.accommodationAmount,
        });
      }

      if (pricingBreakdown?.designationFeeLine && pricingBreakdown.designationFeeLine.amount > 0) {
        const line = pricingBreakdown.designationFeeLine;
        const subject = findSubjectForLine(
          subjects,
          line.label,
          'lodging',
          line.accountingSubjectId,
          line.accountingSubjectName,
        );
        lines.push({
          reservationId: reservation.id,
          reservationCode,
          date,
          siteNumber,
          paymentMethod,
          subjectId: subject.id,
          subjectName: subject.name,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          subtotal: line.amount,
        });
      } else if (pricingBreakdown?.designationFeeAmount && pricingBreakdown.designationFeeAmount > 0) {
        const subject = findSubjectForLine(
          subjects,
          'サイト指定料',
          'lodging',
          pricingBreakdown.designationFeeSubjectId,
          pricingBreakdown.designationFeeSubjectName,
        );
        lines.push({
          reservationId: reservation.id,
          reservationCode,
          date,
          siteNumber,
          paymentMethod,
          subjectId: subject.id,
          subjectName: subject.name,
          quantity: 1,
          unitPrice: pricingBreakdown.designationFeeAmount,
          subtotal: pricingBreakdown.designationFeeAmount,
        });
      }

      (pricingBreakdown?.mandatoryFees ?? []).forEach((fee) => {
        const subject = findSubjectForLine(
          subjects,
          fee.label,
          fee.label.includes('入場') ? 'entry_fee' : 'other',
          fee.accountingSubjectId,
          fee.accountingSubjectName,
        );
        lines.push({
          reservationId: reservation.id,
          reservationCode,
          date,
          siteNumber,
          paymentMethod,
          subjectId: subject.id,
          subjectName: subject.name,
          quantity: fee.quantity,
          unitPrice: fee.unitPrice,
          subtotal: fee.amount,
        });
      });

      if (pricingBreakdown?.lodgingTax && pricingBreakdown.lodgingTax.amount > 0) {
        const subject = findSubjectForLine(
          subjects,
          pricingBreakdown.lodgingTax.label,
          'tax',
          pricingBreakdown.lodgingTax.accountingSubjectId,
          pricingBreakdown.lodgingTax.accountingSubjectName,
        );
        lines.push({
          reservationId: reservation.id,
          reservationCode,
          date,
          siteNumber,
          paymentMethod,
          subjectId: subject.id,
          subjectName: subject.name,
          quantity: pricingBreakdown.lodgingTax.quantity,
          unitPrice: pricingBreakdown.lodgingTax.unitPrice,
          subtotal: pricingBreakdown.lodgingTax.amount,
        });
      }

      parseReservationOptions(reservation.options_json).forEach((item) => {
        const quantity =
          item.type === 'event'
            ? Math.max(1, item.people ?? item.quantity ?? 1)
            : Math.max(1, item.quantity ?? 1);
        const subtotal = Math.max(0, item.subtotal ?? 0);
        const unitPrice = item.unitPrice ?? (quantity > 0 ? Math.round(subtotal / quantity) : subtotal);
        const subject = findSubjectForLine(
          subjects,
          item.name,
          item.type === 'event' ? 'event' : item.type === 'purchase' ? 'shop' : 'rental',
          item.accountingSubjectId,
          item.accountingSubjectName,
        );

        lines.push({
          reservationId: reservation.id,
          reservationCode,
          date,
          siteNumber,
          paymentMethod,
          subjectId: subject.id,
          subjectName: subject.name,
          quantity,
          unitPrice,
          subtotal,
        });
      });
    });

  return lines;
}

export function buildPreviewRegisterLines(
  sales: PreviewRegisterSale[],
  dateFrom: string,
  dateTo: string,
): SalesReportLine[] {
  return sales
    .filter((sale) => {
      const saleDate = sale.createdAt.slice(0, 10);
      return saleDate >= dateFrom && saleDate <= dateTo;
    })
    .flatMap((sale) =>
      sale.items.map((item) => ({
        reservationId: sale.reservationId ?? sale.id,
        reservationCode: sale.reservationCode ?? '予約なし',
        date: sale.createdAt.slice(0, 10),
        siteNumber: sale.siteNumber || '指定なし',
        paymentMethod: sale.paymentMethod,
        subjectId: item.accountingSubjectId,
        subjectName: item.accountingSubjectName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
      })),
    );
}

export function aggregateByPaymentMethod(lines: SalesReportLine[]) {
  const map = new Map<string, number>();
  lines.forEach((line) => map.set(line.paymentMethod, (map.get(line.paymentMethod) ?? 0) + line.subtotal));
  return Array.from(map.entries()).map(([name, subtotal]) => ({ name, subtotal }));
}

export function resolveParentCategoryName(
  subjectId: string,
  categories: SalesReportCategorySetting[],
) {
  return (
    categories.find((category) => category.isActive && category.subjectIds.includes(subjectId))?.parentCategoryName ??
    '未分類'
  );
}

function formatRegisterPaymentMethod(method: string) {
  if (method === 'cash') return '現金';
  if (method === 'card') return 'カード';
  if (method === 'paid') return '決済済み';
  if (method === 'other') return 'その他';
  return method;
}

function formatAccountingPaymentMethod(method: string | null | undefined) {
  if (!method) return '未設定';
  if (method === 'credit_card' || method === 'cash' || method === 'bank_transfer') {
    return getPaymentMethodLabel(method);
  }
  return formatRegisterPaymentMethod(method);
}

function createAccountingLogItem(params: {
  id: string;
  subject: AccountingSubjectSetting;
  categories: SalesReportCategorySetting[];
  sourceKind: AccountingLogItemSource;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  optionType?: 'rental' | 'event' | 'purchase';
  optionId?: string;
  days?: number;
  people?: number;
}): AccountingLogItem {
  return {
    id: params.id,
    accountingSubjectId: params.subject.id,
    accountingSubjectName: params.subject.name,
    parentCategoryName: resolveParentCategoryName(params.subject.id, params.categories),
    quantity: params.quantity,
    unitPrice: params.unitPrice,
    subtotal: params.subtotal,
    sourceKind: params.sourceKind,
    optionType: params.optionType,
    optionId: params.optionId,
    days: params.days,
    people: params.people,
  };
}

export function buildReservationAccountingLogs(
  reservations: GuestReservationRow[],
  subjects: AccountingSubjectSetting[],
  categories: SalesReportCategorySetting[],
  dateFrom: string,
  dateTo: string,
): AccountingLogEntry[] {
  return reservations
    .filter((reservation) => reservation.status !== 'cancelled')
    .filter((reservation) => reservation.check_in_date >= dateFrom && reservation.check_in_date <= dateTo)
    .map((reservation) => {
      const pricingBreakdown = coerceReservationPricingBreakdown(reservation.pricing_breakdown);
      const guestBreakdown = getReservationGuestBreakdown(reservation);
      const items: AccountingLogItem[] = [];

      (pricingBreakdown?.accommodationLines ?? [])
        .filter((line) => line.amount > 0)
        .forEach((line, index) => {
          const subject = findSubjectForLine(
            subjects,
            line.label,
            'lodging',
            line.accountingSubjectId,
            line.accountingSubjectName,
          );
          items.push(
            createAccountingLogItem({
              id: `${reservation.id}-accommodation-${index}`,
              subject,
              categories,
              sourceKind: 'accommodation',
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              subtotal: line.amount,
            }),
          );
        });

      if ((pricingBreakdown?.accommodationLines?.length ?? 0) === 0 && (pricingBreakdown?.accommodationAmount ?? 0) > 0) {
        const subject = findSubjectForLine(
          subjects,
          'プラン料金',
          'lodging',
          pricingBreakdown?.accommodationSubjectId,
          pricingBreakdown?.accommodationSubjectName,
        );
        items.push(
          createAccountingLogItem({
            id: `${reservation.id}-accommodation-fallback`,
            subject,
            categories,
            sourceKind: 'accommodation',
            quantity: 1,
            unitPrice: pricingBreakdown?.accommodationAmount ?? 0,
            subtotal: pricingBreakdown?.accommodationAmount ?? 0,
          }),
        );
      }

      if (pricingBreakdown?.designationFeeLine && pricingBreakdown.designationFeeLine.amount > 0) {
        const subject = findSubjectForLine(
          subjects,
          pricingBreakdown.designationFeeLine.label,
          'lodging',
          pricingBreakdown.designationFeeLine.accountingSubjectId,
          pricingBreakdown.designationFeeLine.accountingSubjectName,
        );
        items.push(
          createAccountingLogItem({
            id: `${reservation.id}-designation-line`,
            subject,
            categories,
            sourceKind: 'designation',
            quantity: pricingBreakdown.designationFeeLine.quantity,
            unitPrice: pricingBreakdown.designationFeeLine.unitPrice,
            subtotal: pricingBreakdown.designationFeeLine.amount,
          }),
        );
      } else if ((pricingBreakdown?.designationFeeAmount ?? 0) > 0) {
        const subject = findSubjectForLine(
          subjects,
          'サイト指定料金',
          'lodging',
          pricingBreakdown?.designationFeeSubjectId,
          pricingBreakdown?.designationFeeSubjectName,
        );
        items.push(
          createAccountingLogItem({
            id: `${reservation.id}-designation-fallback`,
            subject,
            categories,
            sourceKind: 'designation',
            quantity: 1,
            unitPrice: pricingBreakdown?.designationFeeAmount ?? 0,
            subtotal: pricingBreakdown?.designationFeeAmount ?? 0,
          }),
        );
      }

      (pricingBreakdown?.mandatoryFees ?? []).forEach((fee, index) => {
        const subject = findSubjectForLine(
          subjects,
          fee.label,
          fee.label.includes('入場') ? 'entry_fee' : 'other',
          fee.accountingSubjectId,
          fee.accountingSubjectName,
        );
        items.push(
          createAccountingLogItem({
            id: `${reservation.id}-mandatory-${index}`,
            subject,
            categories,
            sourceKind: 'mandatory_fee',
            quantity: fee.quantity,
            unitPrice: fee.unitPrice,
            subtotal: fee.amount,
          }),
        );
      });

      if (pricingBreakdown?.lodgingTax && pricingBreakdown.lodgingTax.amount > 0) {
        const subject = findSubjectForLine(
          subjects,
          pricingBreakdown.lodgingTax.label,
          'tax',
          pricingBreakdown.lodgingTax.accountingSubjectId,
          pricingBreakdown.lodgingTax.accountingSubjectName,
        );
        items.push(
          createAccountingLogItem({
            id: `${reservation.id}-lodging-tax`,
            subject,
            categories,
            sourceKind: 'lodging_tax',
            quantity: pricingBreakdown.lodgingTax.quantity,
            unitPrice: pricingBreakdown.lodgingTax.unitPrice,
            subtotal: pricingBreakdown.lodgingTax.amount,
          }),
        );
      }

      parseReservationOptions(reservation.options_json).forEach((item, index) => {
        const quantity =
          item.type === 'event'
            ? Math.max(1, item.people ?? item.quantity ?? 1)
            : Math.max(1, item.quantity ?? 1);
        const subtotal = Math.max(0, item.subtotal ?? 0);
        const unitPrice = item.unitPrice ?? (quantity > 0 ? Math.round(subtotal / quantity) : subtotal);
        const subject = findSubjectForLine(
          subjects,
          item.name,
          item.type === 'event' ? 'event' : item.type === 'purchase' ? 'shop' : 'rental',
          item.accountingSubjectId,
          item.accountingSubjectName,
        );

        items.push(
          createAccountingLogItem({
            id: `${reservation.id}-option-${index}`,
            subject,
            categories,
            sourceKind: 'option',
            quantity,
            unitPrice,
            subtotal,
            optionType: item.type,
            optionId: item.optionId,
            days: item.days,
            people: item.people,
          }),
        );
      });

      return {
        id: reservation.id,
        sourceType: 'reservation' as const,
        reservationId: reservation.id,
        reservationCode: generateReceptionCode(reservation.id),
        customerName: reservation.user_name,
        siteNumber: reservation.site_number ?? '指定なし',
        date: reservation.check_in_date,
        createdAt: `${reservation.check_in_date}T00:00:00`,
        paymentMethod: reservation.payment_method ?? 'cash',
        paymentMethodLabel: formatAccountingPaymentMethod(reservation.payment_method),
        totalAmount: items.reduce((sum, item) => sum + item.subtotal, 0),
        guests: guestBreakdown.guests,
        adults: guestBreakdown.adults,
        children: guestBreakdown.children,
        infants: guestBreakdown.infants,
        items,
        canDelete: false,
      };
    });
}

export function buildPreviewRegisterLogs(
  sales: PreviewRegisterSale[],
  dateFrom: string,
  dateTo: string,
): AccountingLogEntry[] {
  return sales
    .filter((sale) => {
      const saleDate = sale.createdAt.slice(0, 10);
      return saleDate >= dateFrom && saleDate <= dateTo;
    })
    .map((sale) => ({
      id: sale.id,
      sourceType: 'register' as const,
      reservationId: sale.reservationId,
      reservationCode: sale.reservationCode,
      customerName: sale.customerName,
      siteNumber: sale.siteNumber,
      date: sale.createdAt.slice(0, 10),
      createdAt: sale.createdAt,
      paymentMethod: sale.paymentMethod,
      paymentMethodLabel: formatAccountingPaymentMethod(sale.paymentMethod),
      totalAmount: sale.totalAmount,
      guests: sale.guests,
      adults: sale.adults,
      children: sale.children,
      infants: sale.infants,
      items: sale.items.map((item) => ({
        ...item,
        sourceKind: 'option' as const,
      })),
      canDelete: true,
    }));
}

export function buildSalesReportLinesFromLogs(logs: AccountingLogEntry[]): SalesReportLine[] {
  return logs.flatMap((log) =>
    log.items.map((item) => ({
      reservationId: log.reservationId ?? log.id,
      reservationCode: log.reservationCode ?? '予約なし',
      date: log.date,
      siteNumber: log.siteNumber || '指定なし',
      paymentMethod: log.paymentMethodLabel,
      subjectId: item.accountingSubjectId,
      subjectName: item.accountingSubjectName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
    })),
  );
}
