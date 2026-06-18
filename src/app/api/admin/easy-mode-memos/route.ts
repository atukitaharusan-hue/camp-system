import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRequest } from '@/lib/admin/requestAuth';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import type { TablesInsert, TablesUpdate } from '@/types/database';

type StaffMemoInsert = TablesInsert<'staff_memos'>;
type StaffMemoUpdate = TablesUpdate<'staff_memos'>;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const authError = await requireAdminRequest(request);
  if (authError) return authError;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('staff_memos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ memos: data ?? [] });
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminRequest(request);
  if (authError) return authError;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const fromName = typeof body?.fromName === 'string' ? body.fromName.trim() : '';
  const toName = typeof body?.toName === 'string' ? body.toName.trim() : '';
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const bodyText = typeof body?.body === 'string' ? body.body.trim() : '';
  const dueAt = typeof body?.dueAt === 'string' && body.dueAt ? body.dueAt : null;

  if (!fromName || !toName || !title) {
    return jsonError('依頼した人・対応する人・タイトルは必須です。');
  }

  const insertPayload: StaffMemoInsert = {
    from_name: fromName,
    to_name: toName,
    title,
    body: bodyText || null,
    due_at: dueAt,
    status: 'pending',
  };

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from('staff_memos').insert(insertPayload).select('*').single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ memo: data });
}

export async function PATCH(request: NextRequest) {
  const authError = await requireAdminRequest(request);
  if (authError) return authError;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof body?.id === 'string' ? body.id : '';
  const status =
    body?.status === 'pending' || body?.status === 'in_progress' || body?.status === 'completed'
      ? body.status
      : null;

  if (!id || !status) {
    return jsonError('更新に必要な情報が足りません。');
  }

  const payload: StaffMemoUpdate = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === 'completed') {
    payload.completed_at = new Date().toISOString();
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('staff_memos')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ memo: data });
}
