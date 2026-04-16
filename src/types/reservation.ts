import type { Database } from './database';

type ReservationStatus = Database['public']['Enums']['reservation_status'];
type PaymentMethod = Database['public']['Enums']['payment_method'];
type PaymentStatus = Database['public']['Enums']['payment_status'];
type SiteType = Database['public']['Enums']['site_type'];

/** QR表示ページで使用する予約詳細の統合型 */
export interface ReservationDetail {
  id: string;
  status: ReservationStatus;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  totalAmount: number;
  specialRequests: string | null;
  createdAt: string;

  // QRコード用トークン（将来的に署名付きトークンに差し替え可能）
  qrToken: string;

  // チェックイン情報
  checkedInAt: string | null;

  // ユーザー情報
  userName: string;
  userEmail: string;

  // サイト情報
  siteNumber: string;
  siteType: SiteType;

  // キャンプ場情報
  campgroundName: string;

  // 決済情報
  paymentMethod: PaymentMethod | null;
  paymentStatus: PaymentStatus | null;
}

/** 受付コード生成用ヘルパー（reservation_idの先頭8文字を大文字化） */
export function generateReceptionCode(reservationId: string): string {
  return reservationId.replace(/-/g, '').substring(0, 8).toUpperCase();
}

/** 宿泊数を計算 */
export function calculateNights(checkIn: string, checkOut: string): number {
  const inDate = new Date(checkIn);
  const outDate = new Date(checkOut);
  return Math.ceil((outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24));
}

/** サイトタイプの日本語ラベル */
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

/** 支払い方法の日本語ラベル */
export function getPaymentMethodLabel(method: PaymentMethod | null): string {
  if (!method) return '未設定';
  const labels: Record<PaymentMethod, string> = {
    credit_card: 'クレジットカード',
    cash: '現地払い',
    bank_transfer: '銀行振込',
  };
  return labels[method];
}

/** 支払いステータスの日本語ラベル */
export function getPaymentStatusLabel(status: PaymentStatus | null): string {
  if (!status) return '未設定';
  const labels: Record<PaymentStatus, string> = {
    pending: '決済待ち',
    paid: '決済済み',
    refunded: '返金済み',
    failed: '決済失敗',
  };
  return labels[status];
}
