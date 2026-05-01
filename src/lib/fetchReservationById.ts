import { supabase } from '@/lib/supabase';
import { fetchPlans } from '@/lib/admin/fetchData';
import { coerceReservationPricingBreakdown } from '@/lib/pricing';
import type { ReservationDetail } from '@/types/reservation';
import type { Database } from '@/types/database';

type GuestReservationRow = Database['public']['Tables']['guest_reservations']['Row'];

function toReservationDetail(row: GuestReservationRow, planName = ''): ReservationDetail {
  const totalGuests = typeof row.guests === 'number' && row.guests > 0 ? row.guests : 1;
  const children = typeof row.children === 'number' && row.children >= 0 ? row.children : 0;
  const infants = typeof row.infants === 'number' && row.infants >= 0 ? row.infants : 0;
  const adults =
    typeof row.adults === 'number' && row.adults >= 0
      ? row.adults
      : Math.max(totalGuests - children - infants, 1);

  return {
    id: row.id,
    status: row.status ?? 'pending',
    checkInDate: row.check_in_date,
    checkOutDate: row.check_out_date,
    nights: row.nights,
    guests: totalGuests,
    adults,
    children,
    infants,
    totalAmount: Number(row.total_amount ?? 0),
    specialRequests: row.special_requests,
    createdAt: row.created_at,
    qrToken: row.qr_token ?? '',
    checkedInAt: row.checked_in_at,
    userName: row.user_name || 'ご予約者様',
    userEmail: row.user_email ?? '',
    planName,
    siteNumber: row.site_number ?? '',
    siteName: row.site_name ?? '',
    siteType: row.site_type ?? 'standard',
    campgroundName: row.campground_name ?? 'Green Valley',
    paymentMethod: row.payment_method ?? null,
    paymentStatus: row.payment_status ?? null,
    optionsJson: Array.isArray(row.options_json) ? (row.options_json as ReservationDetail['optionsJson']) : null,
    pricingBreakdown: coerceReservationPricingBreakdown(row.pricing_breakdown),
  };
}

export async function fetchReservationById(reservationId: string): Promise<ReservationDetail | null> {
  const { data, error } = await supabase.from('guest_reservations').select('*').eq('id', reservationId).single();

  if (!error && data) {
    const plans = await fetchPlans();
    const planName = plans.find((plan) => plan.id === data.plan_id)?.name ?? '';
    return toReservationDetail(data, planName);
  }

  return null;
}
