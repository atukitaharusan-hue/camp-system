// === オプション定義の型 ===

/** 料金タイプ */
export type PriceType = "per_unit" | "per_day" | "per_person" | "fixed";

/** カテゴリ */
export type OptionCategory = "rental" | "event";

/** オプション項目の定義 */
export interface OptionItem {
  id: string;
  category: OptionCategory;
  name: string;
  description: string;
  price: number;
  priceType: PriceType;
  /** 単位ラベル（例: "個", "台", "名"） */
  unitLabel: string;
  maxQuantity: number;
  isActive: boolean;
  /** 商品画像URL（未設定時はプレースホルダー表示） */
  imageUrl?: string;
  /** イベント系のみ：開催日時 */
  eventDate?: string;
  /** イベント系のみ：所要時間 */
  duration?: string;
  /** イベント系のみ：場所 */
  location?: string;
  /** イベント系のみ：定員 */
  capacity?: number;
  /** イベント系のみ：現在の申込数 */
  currentParticipants?: number;
}

// === ユーザーの選択状態 ===

/** 個別オプションの選択結果 */
export interface OptionSelection {
  optionId: string;
  quantity: number;
  /** レンタル系：利用日数 */
  days: number;
  /** イベント系：参加人数 */
  people: number;
  subtotal: number;
}

// === 予約基本情報（前画面から引き継ぎ） ===

export interface BookingContext {
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  guests: number;
  adults: number;
  children: number;
  infants: number;
  planPricingMode: PlanPricingMode;
  planBasePrice: number;
  planAdultPrice: number;
  planChildPrice: number;
  planInfantPrice: number;
  planGuestBandRules: GuestBandSeasonRule[];
  requestedSiteCount: number;
  siteId: string;
  siteNumber: string;
  siteName: string;
  sitePrice: number;
  designationFee: number;
  areaName: string;
  subAreaName: string;
}

// === sessionStorage キー ===

/** オプション選択 → 規約・支払いページ間の受け渡し用 */
export const STORAGE_KEY_OPTIONS_PAYLOAD = "booking_options_payload";

// === 確認画面へ渡す payload ===

export interface OptionsPayload {
  booking: BookingContext;
  selectedOptions: OptionSelection[];
  optionsTotalAmount: number;
}

/** 規約・支払い完了後、確認画面へ渡す payload */
export interface TermsPaymentPayload {
  booking: BookingContext;
  selectedOptions: OptionSelection[];
  optionsTotalAmount: number;
  agreedCancelPolicy: boolean;
  agreedTerms: boolean;
  agreedSns: boolean;
  selectedPayment: string;
  totalAmount: number;
}
import type { GuestBandSeasonRule, PlanPricingMode } from "./admin";
