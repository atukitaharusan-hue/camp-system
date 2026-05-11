import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRequest } from '@/lib/admin/requestAuth';
import { logAdminActionServer } from '@/lib/admin/actionLogServer';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import type { LogActionInput } from '@/lib/admin/actionLog';

export async function GET(request: NextRequest) {
  const authError = await requireAdminRequest(request);
  if (authError) return authError;

  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? 10) || 10, 100);
  const targetType = request.nextUrl.searchParams.get('targetType');
  const targetId = request.nextUrl.searchParams.get('targetId');
  const supabase = getSupabaseAdminClient();

  let query = supabase
    .from('admin_action_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (targetType && targetId) {
    query = query.eq('target_type', targetType).eq('target_id', targetId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ actions: data ?? [] });
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminRequest(request);
  if (authError) return authError;

  const body = (await request.json().catch(() => null)) as LogActionInput | null;
  if (!body?.adminEmail || !body.actionType || !body.targetType) {
    return NextResponse.json({ error: '操作ログに必要な情報が不足しています。' }, { status: 400 });
  }

  await logAdminActionServer(body);
  return NextResponse.json({ ok: true });
}
