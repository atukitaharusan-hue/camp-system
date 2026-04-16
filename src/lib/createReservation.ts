import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type GuestReservationInsert = Database['public']['Tables']['guest_reservations']['Insert'];
type GuestReservationRow = Database['public']['Tables']['guest_reservations']['Row'];

export type CreateReservationResult =
  | { success: true; reservation: GuestReservationRow }
  | { success: false; error: string };

/**
 * guest_reservations テーブルへ 1 件 INSERT
 */
export async function createReservation(
  payload: GuestReservationInsert,
): Promise<CreateReservationResult> {
  const { data, error } = await supabase
    .from('guest_reservations')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('[createReservation] Supabase error:', error);
    return {
      success: false,
      error: error.message ?? '予約の保存に失敗しました',
    };
  }

  return { success: true, reservation: data };
}
