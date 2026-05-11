import 'server-only';

import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import type { Json } from '@/types/database';
import type { LogActionInput } from '@/lib/admin/actionLog';

export async function logAdminActionServer(input: LogActionInput) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from('admin_action_logs').insert({
    admin_email: input.adminEmail,
    action_type: input.actionType,
    target_type: input.targetType,
    target_id: input.targetId ?? null,
    before_json: (input.before as Json) ?? null,
    after_json: (input.after as Json) ?? null,
  });

  if (error) {
    console.error('[logAdminActionServer] Failed:', error.message);
  }
}