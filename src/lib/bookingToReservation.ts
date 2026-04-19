import type { BookingDraft } from '@/stores/bookingDraftStore';
import type { Database } from '@/types/database';
import type { ReservationPricingBreakdown } from '@/types/pricing';

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

function buildSpecialRequests(draft: BookingDraft) {
  return [
    `PLAN_ID: ${draft.plan.minorPlanId ?? ''}`,
    `REQUESTED_SITE_COUNT: ${draft.plan.requestedSiteCount}`,
    `SELECTED_SITE_NUMBERS: ${draft.site.selectedSiteNumbers.join(',')}`,
    `AGREED_CANCELLATION: ${draft.policy.agreedCancellation}`,
    `AGREED_TERMS: ${draft.policy.agreedTerms}`,
    `AGREED_SNS: ${draft.policy.agreedSns}`,
  ].join('\n');
}

export interface BookingToReservationInput {
  draft: BookingDraft;
  qrToken: string;
  pricingBreakdown: ReservationPricingBreakdown;
}

export function bookingToReservation({
  draft,
  qrToken,
  pricingBreakdown,
}: BookingToReservationInput): GuestReservationInsert {
  const { reservationStatus, paymentStatus } = deriveStatuses(draft.payment.method);

  return {
    user_identifier: draft.lineProfile.userId ?? null,
    user_name: draft.lineProfile.displayName ?? 'ゲスト予約',
    user_email: draft.userInfo.email ?? null,
    user_phone: draft.userInfo.phone ?? null,
    user_gender: draft.userInfo.gender ?? null,
    user_occupation: draft.userInfo.occupation ?? null,
    user_address: draft.userInfo.address ?? null,
    user_referral_source: draft.userInfo.referralSource ?? null,
    check_in_date: draft.stay.checkIn!,
    check_out_date: draft.stay.checkOut!,
    nights: draft.stay.nights,
    adults: draft.stay.adults,
    children: draft.stay.children,
    infants: draft.stay.infants,
    guests: draft.stay.adults + draft.stay.children + draft.stay.infants,
    plan_id: draft.plan.minorPlanId,
    reserved_site_count: draft.plan.requestedSiteCount,
    selected_site_numbers: draft.site.selectedSiteNumbers,
    site_number: draft.site.siteNumber,
    site_name: draft.site.siteName,
    site_type: 'standard',
    campground_name: 'Green Valley',
    total_amount: pricingBreakdown.totalAmount,
    status: reservationStatus,
    payment_method: toDbPaymentMethod(draft.payment.method),
    payment_status: paymentStatus,
    qr_token: qrToken,
    options_json: buildOptionsJson(draft.options),
    pricing_breakdown: pricingBreakdown as unknown as Database['public']['Tables']['guest_reservations']['Insert']['pricing_breakdown'],
    special_requests: buildSpecialRequests(draft),
    agreed_cancellation: draft.policy.agreedCancellation,
    agreed_terms: draft.policy.agreedTerms,
    agreed_sns: draft.policy.agreedSns,
  };
}
