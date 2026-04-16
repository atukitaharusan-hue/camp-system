import type { BookingDraft } from '@/stores/bookingDraftStore';
import type { Database } from '@/types/database';

type GuestReservationInsert = Database['public']['Tables']['guest_reservations']['Insert'];
type PaymentMethod = Database['public']['Enums']['payment_method'];
type PaymentStatus = Database['public']['Enums']['payment_status'];
type ReservationStatus = Database['public']['Enums']['reservation_status'];

function toDbPaymentMethod(method: BookingDraft['payment']['method']): PaymentMethod | null {
  if (method === 'credit_card') return 'credit_card';
  if (method === 'on_site') return 'cash';
  return null;
}

function deriveStatuses(method: BookingDraft['payment']['method']): {
  reservationStatus: ReservationStatus;
  paymentStatus: PaymentStatus;
} {
  if (method === 'credit_card') {
    return { reservationStatus: 'confirmed', paymentStatus: 'paid' };
  }

  return { reservationStatus: 'confirmed', paymentStatus: 'pending' };
}

function buildOptionsJson(options: BookingDraft['options']) {
  const items: Array<{
    type: 'rental' | 'event';
    optionId: string;
    quantity: number;
    days?: number;
    people?: number;
    subtotal: number;
  }> = [];

  for (const rental of options.rentals) {
    items.push({
      type: 'rental',
      optionId: rental.optionId,
      quantity: rental.quantity,
      days: rental.days,
      subtotal: rental.subtotal,
    });
  }

  for (const event of options.events) {
    items.push({
      type: 'event',
      optionId: event.optionId,
      quantity: 1,
      people: event.people,
      subtotal: event.subtotal,
    });
  }

  return items;
}

function buildConsentMemo(policy: BookingDraft['policy']) {
  return [
    `キャンセルポリシー同意: ${policy.agreedCancellation ? 'あり' : 'なし'}`,
    `利用規約同意: ${policy.agreedTerms ? 'あり' : 'なし'}`,
    `SNS・広報同意: ${policy.agreedSns ? 'あり' : 'なし'}`,
  ].join(' / ');
}

export interface BookingToReservationInput {
  draft: BookingDraft;
  qrToken: string;
  totalAmount: number;
}

export function bookingToReservation({
  draft,
  qrToken,
  totalAmount,
}: BookingToReservationInput): GuestReservationInsert {
  const { reservationStatus, paymentStatus } = deriveStatuses(draft.payment.method);

  return {
    user_identifier: draft.lineProfile.userId ?? null,
    user_name: draft.lineProfile.displayName ?? 'ゲスト予約',
    user_email: null,
    check_in_date: draft.stay.checkIn!,
    check_out_date: draft.stay.checkOut!,
    nights: draft.stay.nights,
    guests: draft.stay.adults + draft.stay.children,
    site_number: draft.site.siteNumber,
    site_name: draft.site.siteName,
    site_type: 'standard',
    campground_name: 'キャンプ場 Green Valley',
    total_amount: totalAmount,
    status: reservationStatus,
    payment_method: toDbPaymentMethod(draft.payment.method),
    payment_status: paymentStatus,
    qr_token: qrToken,
    options_json: buildOptionsJson(draft.options),
    special_requests: buildConsentMemo(draft.policy),
    agreed_cancellation: draft.policy.agreedCancellation,
    agreed_terms: draft.policy.agreedTerms,
    agreed_sns: draft.policy.agreedSns,
  };
}
