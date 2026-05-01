export type ActionType =
  | 'reservation_create'
  | 'reservation_update'
  | 'reservation_cancel'
  | 'import_execute'
  | 'plan_update'
  | 'site_update'
  | 'sales_rule_update';

export type TargetType =
  | 'reservation'
  | 'import_job'
  | 'plan'
  | 'site'
  | 'sales_rule';

export interface LogActionInput {
  adminEmail: string;
  actionType: ActionType;
  targetType: TargetType;
  targetId?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

export async function logAdminAction(input: LogActionInput) {
  const response = await fetch('/api/admin/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = typeof payload.error === 'string' ? payload.error : '操作ログの保存に失敗しました。';
    console.error('[logAdminAction] Failed:', message);
  }
}

export async function fetchRecentActions(limit = 10) {
  const response = await fetch(`/api/admin/logs?limit=${encodeURIComponent(String(limit))}`);
  if (!response.ok) {
    console.error('[fetchRecentActions] Failed:', response.statusText);
    return [];
  }
  const payload = await response.json().catch(() => ({}));
  return Array.isArray(payload.actions) ? payload.actions : [];
}

export async function fetchActionsByTarget(targetType: string, targetId: string) {
  const params = new URLSearchParams({ limit: '50', targetType, targetId });
  const response = await fetch(`/api/admin/logs?${params.toString()}`);
  if (!response.ok) {
    console.error('[fetchActionsByTarget] Failed:', response.statusText);
    return [];
  }
  const payload = await response.json().catch(() => ({}));
  return Array.isArray(payload.actions) ? payload.actions : [];
}

const ACTION_LABELS: Record<string, string> = {
  reservation_create: '予約作成',
  reservation_update: '予約変更',
  reservation_cancel: '予約キャンセル',
  import_execute: '取込実行',
  plan_update: 'プラン変更',
  site_update: 'サイト変更',
  sales_rule_update: '販売ルール変更',
};

export function getActionLabel(actionType: string): string {
  return ACTION_LABELS[actionType] ?? actionType;
}
