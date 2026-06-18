export type NotificationType =
  | 'reservation_created'
  | 'reservation_updated'
  | 'reservation_cancelled'
  | 'checkin_reminder'
  | 'checkin_arrived_pending'
  | 'checkin_completed';

export type NotificationChannel = 'email' | 'line' | 'internal';

export interface CreateNotificationInput {
  reservationId?: string;
  type: NotificationType;
  channel: NotificationChannel;
  recipient?: string;
  payload?: Record<string, unknown>;
}

export async function createNotificationLog(input: CreateNotificationInput) {
  const response = await fetch('/api/admin/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = typeof payload.error === 'string' ? payload.error : '通知ログの保存に失敗しました。';
    console.error('[createNotificationLog] Failed:', message);
  }
}

export async function notifyReservationCreated(reservationId: string, userEmail?: string | null) {
  await createNotificationLog({
    reservationId,
    type: 'reservation_created',
    channel: 'internal',
    payload: { message: '新しい予約が作成されました' },
  });

  if (userEmail) {
    await createNotificationLog({
      reservationId,
      type: 'reservation_created',
      channel: 'email',
      recipient: userEmail,
      payload: { message: '予約が確定しました' },
    });
  }
}

export async function notifyReservationUpdated(
  reservationId: string,
  userEmail?: string | null,
  changes?: Record<string, unknown>,
) {
  await createNotificationLog({
    reservationId,
    type: 'reservation_updated',
    channel: 'internal',
    payload: { message: '予約内容が更新されました', changes },
  });

  if (userEmail) {
    await createNotificationLog({
      reservationId,
      type: 'reservation_updated',
      channel: 'email',
      recipient: userEmail,
      payload: { message: '予約内容が更新されました', changes },
    });
  }
}

export async function notifyReservationCancelled(reservationId: string, userEmail?: string | null) {
  await createNotificationLog({
    reservationId,
    type: 'reservation_cancelled',
    channel: 'internal',
    payload: { message: '予約がキャンセルされました' },
  });

  if (userEmail) {
    await createNotificationLog({
      reservationId,
      type: 'reservation_cancelled',
      channel: 'email',
      recipient: userEmail,
      payload: { message: '予約がキャンセルされました' },
    });
  }
}

export async function fetchNotificationsByReservation(reservationId: string) {
  const params = new URLSearchParams({ limit: '100', reservationId });
  const response = await fetch(`/api/admin/notifications?${params.toString()}`);
  if (!response.ok) {
    console.error('[fetchNotificationsByReservation] Failed:', response.statusText);
    return [];
  }
  const payload = await response.json().catch(() => ({}));
  return Array.isArray(payload.notifications) ? payload.notifications : [];
}

export async function fetchRecentNotifications(limit = 20) {
  const response = await fetch(`/api/admin/notifications?limit=${encodeURIComponent(String(limit))}`);
  if (!response.ok) {
    console.error('[fetchRecentNotifications] Failed:', response.statusText);
    return [];
  }
  const payload = await response.json().catch(() => ({}));
  return Array.isArray(payload.notifications) ? payload.notifications : [];
}

const TYPE_LABELS: Record<string, string> = {
  reservation_created: '予約作成',
  reservation_updated: '予約更新',
  reservation_cancelled: '予約キャンセル',
  checkin_reminder: 'チェックイン案内',
  checkin_arrived_pending: 'セルフチェックイン確定',
  checkin_completed: 'チェックイン完了',
};

const CHANNEL_LABELS: Record<string, string> = {
  email: 'メール',
  line: 'LINE',
  internal: '管理通知',
};

const STATUS_LABELS: Record<string, string> = {
  queued: '未送信',
  sent: '送信済み',
  failed: '送信失敗',
};

export function getNotificationTypeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

export function getChannelLabel(channel: string): string {
  return CHANNEL_LABELS[channel] ?? channel;
}

export function getNotificationStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}
