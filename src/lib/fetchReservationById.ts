import { supabase } from '@/lib/supabase';
import type { ReservationDetail } from '@/types/reservation';
import type { Database } from '@/types/database';
import { dummyReservations } from '@/data/reservationDummyData';

type GuestReservationRow = Database['public']['Tables']['guest_reservations']['Row'];

/**
 * guest_reservations の行 → ReservationDetail へ変換
 */
function toReservationDetail(row: GuestReservationRow): ReservationDetail {
  return {
    id: row.id,
    status: row.status,
    checkInDate: row.check_in_date,
    checkOutDate: row.check_out_date,
    guests: row.guests,
    totalAmount: Number(row.total_amount),
    specialRequests: row.special_requests,
    createdAt: row.created_at,
    qrToken: row.qr_token,
    checkedInAt: row.checked_in_at,
    userName: row.user_name,
    userEmail: row.user_email ?? '',
    siteNumber: row.site_number ?? '未定',
    siteType: row.site_type,
    campgroundName: row.campground_name ?? '森のキャンプ場 Green Valley',
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
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

  // フォールバック: ダミーデータ
  return dummyReservations[reservationId] ?? null;
}
