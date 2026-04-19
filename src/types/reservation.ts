import type { Database } from './database';
import type { ReservationPricingBreakdown } from './pricing';

type ReservationStatus = Database['public']['Enums']['reservation_status'];
type PaymentMethod = Database['public']['Enums']['payment_method'];
type PaymentStatus = Database['public']['Enums']['payment_status'];
type SiteType = Database['public']['Enums']['site_type'];

export interface ReservationDetail {
  id: string;
  status: ReservationStatus;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  adults: number;
  children: number;
  infants: number;
  totalAmount: number;
  specialRequests: string | null;
  createdAt: string;
  qrToken: string;
  checkedInAt: string | null;
  userName: string;
  userEmail: string;
  siteNumber: string;
  siteType: SiteType;
  campgroundName: string;
  paymentMethod: PaymentMethod | null;
  paymentStatus: PaymentStatus | null;
  optionsJson: Array<{
    type: 'rental' | 'event';
    optionId: string;
    quantity: number;
    days?: number;
    people?: number;
    subtotal: number;
  }> | null;
  pricingBreakdown?: ReservationPricingBreakdown | null;
}

export function generateReceptionCode(reservationId: string): string {
  return reservationId.replace(/-/g, '').substring(0, 8).toUpperCase();
}

export function calculateNights(checkIn: string, checkOut: string): number {
  const inDate = new Date(checkIn);
  const outDate = new Date(checkOut);
  return Math.ceil((outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24));
}

export function getSiteTypeLabel(type: SiteType): string {
  const labels: Record<SiteType, string> = {
    standard: 'スタンダード',
    premium: 'プレミアム',
    deluxe: 'デラックス',
    tent_only: 'テント専用',
    rv_only: 'RV専用',
  };

  return labels[type];
}

export function getPaymentMethodLabel(method: PaymentMethod | null): string {
  if (!method) return '未設定';

  const labels: Record<PaymentMethod, string> = {
    credit_card: 'クレジットカード',
  cash: '現地払い(現金のみ)',
    bank_transfer: '銀行振込',
  };

  return labels[method];
}

export function getPaymentStatusLabel(status: PaymentStatus | null): string {
  if (!status) return '未設定';

  const labels: Record<PaymentStatus, string> = {
    pending: '支払い待ち',
    paid: '支払い済み',
    refunded: '返金済み',
    failed: '支払い失敗',
  };

  return labels[status];
}
