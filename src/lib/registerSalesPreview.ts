import type {
  PreviewRegisterSale,
  PreviewRegisterSaleItem,
  SalesReportCategorySetting,
} from '@/types/admin';

const STORAGE_KEY = 'preview_register_sales_v1';

function isBrowser() {
  return typeof window !== 'undefined';
}

function coerceItem(value: unknown): PreviewRegisterSaleItem | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (typeof source.accountingSubjectId !== 'string' || typeof source.accountingSubjectName !== 'string') {
    return null;
  }

  return {
    id: typeof source.id === 'string' ? source.id : `${source.accountingSubjectId}-${Date.now()}`,
    accountingSubjectId: source.accountingSubjectId,
    accountingSubjectName: source.accountingSubjectName,
    parentCategoryName: typeof source.parentCategoryName === 'string' ? source.parentCategoryName : '未分類',
    unitPrice: Number.isFinite(Number(source.unitPrice)) ? Number(source.unitPrice) : 0,
    quantity: Number.isFinite(Number(source.quantity)) ? Math.max(1, Number(source.quantity)) : 1,
    subtotal: Number.isFinite(Number(source.subtotal)) ? Math.max(0, Number(source.subtotal)) : 0,
  };
}

function coerceSale(value: unknown): PreviewRegisterSale | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const items = Array.isArray(source.items) ? source.items.map(coerceItem).filter((item): item is PreviewRegisterSaleItem => item !== null) : [];

  return {
    id: typeof source.id === 'string' ? source.id : `preview-sale-${Date.now()}`,
    reservationId: typeof source.reservationId === 'string' ? source.reservationId : null,
    reservationCode: typeof source.reservationCode === 'string' ? source.reservationCode : null,
    customerName: typeof source.customerName === 'string' ? source.customerName : '予約なし会計',
    siteNumber: typeof source.siteNumber === 'string' ? source.siteNumber : '指定なし',
    checkInDate: typeof source.checkInDate === 'string' ? source.checkInDate : null,
    planName: typeof source.planName === 'string' ? source.planName : '',
    guests: Number.isFinite(Number(source.guests)) ? Math.max(1, Number(source.guests)) : undefined,
    adults: Number.isFinite(Number(source.adults)) ? Math.max(0, Number(source.adults)) : undefined,
    children: Number.isFinite(Number(source.children)) ? Math.max(0, Number(source.children)) : undefined,
    infants: Number.isFinite(Number(source.infants)) ? Math.max(0, Number(source.infants)) : undefined,
    saleType:
      source.saleType === 'additional' ||
      source.saleType === 'adjustment' ||
      source.saleType === 'refund'
        ? source.saleType
        : 'register',
    paymentMethod:
      source.paymentMethod === 'cash' ||
      source.paymentMethod === 'card' ||
      source.paymentMethod === 'paid' ||
      source.paymentMethod === 'other'
        ? source.paymentMethod
        : 'cash',
    totalAmount: Number.isFinite(Number(source.totalAmount)) ? Math.max(0, Number(source.totalAmount)) : 0,
    receivedAmount: Number.isFinite(Number(source.receivedAmount)) ? Number(source.receivedAmount) : null,
    changeAmount: Number.isFinite(Number(source.changeAmount)) ? Number(source.changeAmount) : null,
    createdAt: typeof source.createdAt === 'string' ? source.createdAt : new Date().toISOString(),
    items,
  };
}

export function loadPreviewRegisterSales(): PreviewRegisterSale[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(coerceSale).filter((sale): sale is PreviewRegisterSale => sale !== null);
  } catch {
    return [];
  }
}

export function savePreviewRegisterSale(sale: PreviewRegisterSale) {
  if (!isBrowser()) return;
  const current = loadPreviewRegisterSales();
  const next = [sale, ...current].slice(0, 200);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('preview-register-sales-updated'));
}

export function savePreviewRegisterSales(sales: PreviewRegisterSale[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sales.slice(0, 200)));
  window.dispatchEvent(new CustomEvent('preview-register-sales-updated'));
}

export function updatePreviewRegisterSale(saleId: string, updater: (sale: PreviewRegisterSale) => PreviewRegisterSale) {
  if (!isBrowser()) return;
  const next = loadPreviewRegisterSales().map((sale) => (sale.id === saleId ? updater(sale) : sale));
  savePreviewRegisterSales(next);
}

export function deletePreviewRegisterSale(saleId: string) {
  if (!isBrowser()) return;
  const next = loadPreviewRegisterSales().filter((sale) => sale.id !== saleId);
  savePreviewRegisterSales(next);
}

export function clearPreviewRegisterSales() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('preview-register-sales-updated'));
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
