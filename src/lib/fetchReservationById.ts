import { supabase } from '@/lib/supabase';
import { coerceReservationPricingBreakdown } from '@/lib/pricing';
import type { ReservationDetail } from '@/types/reservation';
import type { Database } from '@/types/database';

type GuestReservationRow = Database['public']['Tables']['guest_reservations']['Row'];

/**
 * guest_reservations の行 → ReservationDetail へ変換
 */
function toReservationDetail(row: GuestReservationRow): ReservationDetail {
  return {
    id: row.id,
    status: row.status ?? 'pending',
    checkInDate: row.check_in_date,
    checkOutDate: row.check_out_date,
    guests: row.guests,
    adults: row.adults,
    children: row.children,
    infants: row.infants,
    totalAmount: Number(row.total_amount),
    specialRequests: row.special_requests,
    createdAt: row.created_at,
    qrToken: row.qr_token,
    checkedInAt: row.checked_in_at,
    userName: row.user_name,
    userEmail: row.user_email ?? '',
    siteNumber: row.site_number ?? '未定',
    siteType: row.site_type ?? 'standard',
    campgroundName: row.campground_name ?? '森のキャンプ場 Green Valley',
    paymentMethod: row.payment_method ?? null,
    paymentStatus: row.payment_status ?? null,
    optionsJson: Array.isArray(row.options_json) ? row.options_json as ReservationDetail['optionsJson'] : null,
    pricingBreakdown: coerceReservationPricingBreakdown(row.pricing_breakdown),
  };
}

/**
 * 予約IDで取得
 * 1. Supabase の guest_reservations を検索
 * 2. 見つからなければ既存のダミーデータにフォールバック
 */
export async function fetchReservationById(
  reservationId: string,
): Promise<ReservationDetail | null> {
  // Supabase から取得
  const { data, error } = await supabase
    .from('guest_reservations')
    .select('*')
    .eq('id', reservationId)
    .single();

  if (!error && data) {
    return toReservationDetail(data);
  }

  return null;
}
