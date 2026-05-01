import 'server-only';

import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import type { Json } from '@/types/database';
import type { CreateNotificationInput } from '@/lib/admin/notificationLog';

export async function createNotificationLogServer(input: CreateNotificationInput) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from('notification_logs').insert({
    reservation_id: input.reservationId ?? null,
    notification_type: input.type,
    channel: input.channel,
    recipient: input.recipient ?? null,
    payload_json: (input.payload as Json) ?? {},
    status: 'queued',
  });

  if (error) {
    console.error('[createNotificationLogServer] Failed:', error.message);
  }
}

export async function notifyReservationCreatedServer(
  reservationId: string,
  userEmail?: string | null,
) {
  await createNotificationLogServer({
    reservationId,
    type: 'reservation_created',
    channel: 'internal',
    payload: { message: '新しい予約が作成されました' },
  });

  if (userEmail) {
    await createNotificationLogServer({
      reservationId,
      type: 'reservation_created',
      channel: 'email',
      recipient: userEmail,
      payload: { message: '予約が確定しました' },
    });
  }
}

export async function notifyReservationUpdatedServer(
  reservationId: string,
  userEmail?: string | null,
  changes?: Record<string, unknown>,
) {
  await createNotificationLogServer({
    reservationId,
    type: 'reservation_updated',
    channel: 'internal',
    payload: { message: '予約が変更されました', changes },
  });

  if (userEmail) {
    await createNotificationLogServer({
      reservationId,
      type: 'reservation_updated',
      channel: 'email',
      recipient: userEmail,
      payload: { message: '予約内容が変更されました', changes },
    });
  }
}

export async function notifyReservationCancelledServer(
  reservationId: string,
  userEmail?: string | null,
) {
  await createNotificationLogServer({
    reservationId,
    type: 'reservation_cancelled',
    channel: 'internal',
    payload: { message: '予約がキャンセルされました' },
  });

  if (userEmail) {
    await createNotificationLogServer({
      reservationId,
      type: 'reservation_cancelled',
      channel: 'email',
      recipient: userEmail,
      payload: { message: '予約がキャンセルされました' },
    });
  }
}
