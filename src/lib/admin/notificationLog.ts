export type NotificationType =
  | 'reservation_created'
  | 'reservation_updated'
  | 'reservation_cancelled'
  | 'checkin_reminder';

export type NotificationChannel = 'email' | 'line' | 'internal';

export interface CreateNotificationInput {
  reservationId?: string;
  type: NotificationType;
  channel: NotificationChannel;
  recipient?: string;
  payload?: Record<string, unknown>;
}

/**
 * 通知ログを1件記録する。
 * 現時点では実際の送信は行わず、status='queued' で保存。
 */
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

/**
 * 予約作成時の通知ログを一括作成
 */
export async function notifyReservationCreated(
  reservationId: string,
  userEmail?: string | null,
) {
  // 管理者通知（internal）
  await createNotificationLog({
    reservationId,
    type: 'reservation_created',
    channel: 'internal',
    payload: { message: '新しい予約が作成されました' },
  });

  // ユーザー通知（email）- メールがあれば
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

/**
 * 予約変更時の通知ログを一括作成
 */
export async function notifyReservationUpdated(
  reservationId: string,
  userEmail?: string | null,
  changes?: Record<string, unknown>,
) {
  await createNotificationLog({
    reservationId,
    type: 'reservation_updated',
    channel: 'internal',
    payload: { message: '予約が変更されました', changes },
  });

  if (userEmail) {
    await createNotificationLog({
      reservationId,
      type: 'reservation_updated',
      channel: 'email',
      recipient: userEmail,
      payload: { message: '予約内容が変更されました', changes },
    });
  }
}

/**
 * 予約キャンセル時の通知ログを一括作成
 */
export async function notifyReservationCancelled(
  reservationId: string,
  userEmail?: string | null,
) {
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

/**
 * 指定予約の通知履歴を取得
 */
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

/**
 * 直近の通知ログ一覧
 */
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
  reservation_updated: '予約変更',
  reservation_cancelled: '予約キャンセル',
  checkin_reminder: 'チェックイン案内',
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
