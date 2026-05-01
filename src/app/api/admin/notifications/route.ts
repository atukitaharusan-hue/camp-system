import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRequest } from '@/lib/admin/requestAuth';
import { createNotificationLogServer } from '@/lib/admin/notificationLogServer';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import type { CreateNotificationInput } from '@/lib/admin/notificationLog';

export async function GET(request: NextRequest) {
  const authError = await requireAdminRequest(request);
  if (authError) return authError;

  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? 20) || 20, 100);
  const reservationId = request.nextUrl.searchParams.get('reservationId');
  const supabase = getSupabaseAdminClient();

  let query = supabase
    .from('notification_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (reservationId) {
    query = query.eq('reservation_id', reservationId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notifications: data ?? [] });
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminRequest(request);
  if (authError) return authError;

  const body = (await request.json().catch(() => null)) as CreateNotificationInput | null;
  if (!body?.type || !body.channel) {
    return NextResponse.json({ error: '通知ログに必要な情報が不足しています。' }, { status: 400 });
  }

  await createNotificationLogServer(body);
  return NextResponse.json({ ok: true });
}
