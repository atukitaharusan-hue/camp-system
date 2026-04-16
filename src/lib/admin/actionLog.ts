import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/database';

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
  const { error } = await supabase.from('admin_action_logs').insert({
    admin_email: input.adminEmail,
    action_type: input.actionType,
    target_type: input.targetType,
    target_id: input.targetId ?? null,
    before_json: (input.before as Json) ?? null,
    after_json: (input.after as Json) ?? null,
  });
  if (error) {
    console.error('[logAdminAction] Failed:', error.message);
  }
}

export async function fetchRecentActions(limit = 10) {
  const { data, error } = await supabase
    .from('admin_action_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[fetchRecentActions] Failed:', error.message);
    return [];
  }
  return data ?? [];
}

export async function fetchActionsByTarget(targetType: string, targetId: string) {
  const { data, error } = await supabase
    .from('admin_action_logs')
    .select('*')
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[fetchActionsByTarget] Failed:', error.message);
    return [];
  }
  return data ?? [];
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
