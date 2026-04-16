import { supabase } from '@/lib/supabase';
import {
  validateReservation,
  formatAdminErrors,
  calculateNights,
} from '@/lib/validateReservation';
import { logAdminAction } from '@/lib/admin/actionLog';
import {
  notifyReservationUpdated,
  notifyReservationCancelled,
} from '@/lib/admin/notificationLog';
import type { Database } from '@/types/database';

type GuestReservationRow = Database['public']['Tables']['guest_reservations']['Row'];
type PaymentMethod = Database['public']['Enums']['payment_method'];
type PaymentStatus = Database['public']['Enums']['payment_status'];

export interface UpdateReservationInput {
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  adults: number;
  children: number;
  infants: number;
  pets: number;
  cars: number;
  siteNumber: string;
  specialRequests: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  totalAmount: number;
}

export type UpdateResult =
  | { success: true; reservation: GuestReservationRow }
  | { success: false; error: string };

/**
 * 管理者による予約変更
 */
export async function updateReservation(
  id: string,
  input: UpdateReservationInput,
  adminEmail: string,
): Promise<UpdateResult> {
  // 1. 現在の予約を取得
  const { data: current, error: fetchErr } = await supabase
    .from('guest_reservations')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !current) {
    return { success: false, error: '予約が見つかりません' };
  }

  if (current.status === 'cancelled') {
    return { success: false, error: 'キャンセル済みの予約は変更できません' };
  }

  // 2. 基本バリデーション
  if (input.checkOutDate <= input.checkInDate) {
    return { success: false, error: 'チェックアウト日はチェックイン日より後にしてください' };
  }
  if (input.guests < 1) {
    return { success: false, error: '人数は1人以上を指定してください' };
  }

  // 3. 共通バリデーション（重複チェック時に自分自身を除外）
  const validation = await validateReservation({
    siteNumber: input.siteNumber,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    guests: input.guests,
    source: 'admin_update',
    excludeReservationId: id,
  });

  if (!validation.valid) {
    return { success: false, error: formatAdminErrors(validation.errors) };
  }

  const nights = calculateNights(input.checkInDate, input.checkOutDate);

  // 4. UPDATE
  const { data: updated, error: updateErr } = await supabase
    .from('guest_reservations')
    .update({
      check_in_date: input.checkInDate,
      check_out_date: input.checkOutDate,
      nights,
      guests: input.guests,
      adults: input.adults,
      children: input.children,
      infants: input.infants,
      pets: input.pets,
      cars: input.cars,
      site_number: input.siteNumber,
      special_requests: input.specialRequests.trim() || null,
      payment_method: input.paymentMethod,
      payment_status: input.paymentStatus,
      total_amount: input.totalAmount,
    })
    .eq('id', id)
    .select()
    .single();

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  // 5. 変更前後の差分を算出してログ
  const changes = buildChanges(current, updated);

  await logAdminAction({
    adminEmail,
    actionType: 'reservation_update',
    targetType: 'reservation',
    targetId: id,
    before: pickFields(current),
    after: pickFields(updated),
  });

  // 6. 通知記録
  await notifyReservationUpdated(id, current.user_email, changes);

  return { success: true, reservation: updated };
}

/**
 * 管理者による予約キャンセル
 */
export async function cancelReservation(
  id: string,
  adminEmail: string,
): Promise<{ success: boolean; error?: string }> {
  // 1. 現在の予約を取得
  const { data: current, error: fetchErr } = await supabase
    .from('guest_reservations')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !current) {
    return { success: false, error: '予約が見つかりません' };
  }

  if (current.status === 'cancelled') {
    return { success: false, error: 'すでにキャンセル済みです' };
  }

  // 2. ステータスを cancelled に変更
  const { error: updateErr } = await supabase
    .from('guest_reservations')
    .update({ status: 'cancelled' })
    .eq('id', id);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  // 3. 操作ログ
  await logAdminAction({
    adminEmail,
    actionType: 'reservation_cancel',
    targetType: 'reservation',
    targetId: id,
    before: pickFields(current),
    after: { ...pickFields(current), status: 'cancelled' },
  });

  // 4. 通知記録
  await notifyReservationCancelled(id, current.user_email);

  return { success: true };
}

// --- 内部ユーティリティ ---

function pickFields(r: GuestReservationRow): Record<string, unknown> {
  return {
    check_in_date: r.check_in_date,
    check_out_date: r.check_out_date,
    nights: r.nights,
    guests: r.guests,
    adults: r.adults,
    children: r.children,
    infants: r.infants,
    pets: r.pets,
    cars: r.cars,
    site_number: r.site_number,
    special_requests: r.special_requests,
    payment_method: r.payment_method,
    payment_status: r.payment_status,
    total_amount: r.total_amount,
    status: r.status,
  };
}

function buildChanges(
  before: GuestReservationRow,
  after: GuestReservationRow,
): Record<string, unknown> {
  const changes: Record<string, unknown> = {};
  const keys = [
    'check_in_date', 'check_out_date', 'guests', 'adults', 'children',
    'infants', 'pets', 'cars', 'site_number',
    'special_requests', 'payment_method', 'payment_status', 'total_amount',
  ] as const;

  for (const key of keys) {
    const b = before[key];
    const a = after[key];
    if (String(b) !== String(a)) {
      changes[key] = { from: b, to: a };
    }
  }
  return changes;
}
