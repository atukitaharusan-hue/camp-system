import type { ReservationDetail } from '@/types/reservation';

/**
 * ダミー予約データ
 * 将来的に Supabase から取得する形に差し替える想定
 */
export const dummyReservations: Record<string, ReservationDetail> = {
  // 確定済み予約
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890': {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    status: 'confirmed',
    checkInDate: '2026-04-10',
    checkOutDate: '2026-04-12',
    guests: 4,
    adults: 2,
    children: 1,
    infants: 1,
    totalAmount: 15000,
    specialRequests: '焚き火台をレンタル希望',
    createdAt: '2026-03-25T10:00:00Z',
    qrToken: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    checkedInAt: null,
    userName: '山田 太郎',
    userEmail: 'yamada@example.com',
    siteNumber: 'A-12',
    siteType: 'premium',
    campgroundName: '森のキャンプ場 Green Valley',
    paymentMethod: 'credit_card',
    paymentStatus: 'paid',
    optionsJson: null,
  },

  // チェックイン済み予約
  'b2c3d4e5-f6a7-8901-bcde-f12345678901': {
    id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    status: 'checked_in',
    checkInDate: '2026-04-07',
    checkOutDate: '2026-04-09',
    guests: 2,
    adults: 2,
    children: 0,
    infants: 0,
    totalAmount: 8000,
    specialRequests: null,
    createdAt: '2026-03-20T14:30:00Z',
    qrToken: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    checkedInAt: '2026-04-07T14:05:00Z',
    userName: '佐藤 花子',
    userEmail: 'sato@example.com',
    siteNumber: 'B-03',
    siteType: 'standard',
    campgroundName: '森のキャンプ場 Green Valley',
    paymentMethod: 'credit_card',
    paymentStatus: 'paid',
    optionsJson: null,
  },

  // キャンセル済み予約
  'c3d4e5f6-a7b8-9012-cdef-123456789012': {
    id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    status: 'cancelled',
    checkInDate: '2026-04-15',
    checkOutDate: '2026-04-17',
    guests: 3,
    adults: 2,
    children: 1,
    infants: 0,
    totalAmount: 12000,
    specialRequests: null,
    createdAt: '2026-03-28T09:00:00Z',
    qrToken: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    checkedInAt: null,
    userName: '鈴木 一郎',
    userEmail: 'suzuki@example.com',
    siteNumber: 'C-07',
    siteType: 'deluxe',
    campgroundName: '森のキャンプ場 Green Valley',
    paymentMethod: 'bank_transfer',
    paymentStatus: 'refunded',
    optionsJson: null,
  },

  // 決済待ち予約
  'd4e5f6a7-b8c9-0123-defa-234567890123': {
    id: 'd4e5f6a7-b8c9-0123-defa-234567890123',
    status: 'pending',
    checkInDate: '2026-04-20',
    checkOutDate: '2026-04-22',
    guests: 5,
    adults: 2,
    children: 2,
    infants: 1,
    totalAmount: 20000,
    specialRequests: '電源サイト希望',
    createdAt: '2026-04-01T16:00:00Z',
    qrToken: 'd4e5f6a7-b8c9-0123-defa-234567890123',
    checkedInAt: null,
    userName: '田中 美咲',
    userEmail: 'tanaka@example.com',
    siteNumber: 'D-01',
    siteType: 'rv_only',
    campgroundName: '森のキャンプ場 Green Valley',
    paymentMethod: null,
    paymentStatus: 'pending',
    optionsJson: null,
  },

  // 利用完了済み予約
  'e5f6a7b8-c9d0-1234-efab-345678901234': {
    id: 'e5f6a7b8-c9d0-1234-efab-345678901234',
    status: 'completed',
    checkInDate: '2026-03-28',
    checkOutDate: '2026-03-30',
    guests: 2,
    adults: 2,
    children: 0,
    infants: 0,
    totalAmount: 10000,
    specialRequests: null,
    createdAt: '2026-03-15T11:00:00Z',
    qrToken: 'e5f6a7b8-c9d0-1234-efab-345678901234',
    checkedInAt: '2026-03-28T13:30:00Z',
    userName: '高橋 健太',
    userEmail: 'takahashi@example.com',
    siteNumber: 'A-05',
    siteType: 'standard',
    campgroundName: '森のキャンプ場 Green Valley',
    paymentMethod: 'credit_card',
    paymentStatus: 'paid',
    optionsJson: null,
  },
};

/**
 * 予約データ取得関数（将来的にSupabase接続に差し替え）
 *
 * 将来的な実装例：
 * ```ts
 * const { data, error } = await supabase
 *   .from('reservations')
 *   .select(`
 *     *,
 *     profiles!reservations_user_id_fkey(full_name, email),
 *     sites!reservations_site_id_fkey(site_number, type, campgrounds(name)),
 *     payments(method, status),
 *     check_ins(check_in_time)
 *   `)
 *   .eq('id', reservationId)
 *   .single();
 * ```
 */
export async function fetchReservationById(
  reservationId: string
): Promise<ReservationDetail | null> {
  // ダミー実装: 実際にはSupabaseから取得
  // ネットワーク遅延をシミュレート
  await new Promise((resolve) => setTimeout(resolve, 500));

  return dummyReservations[reservationId] ?? null;
}
