import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRequest } from '@/lib/admin/requestAuth';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import type { Database } from '@/types/database';

const ALLOWED_SETTING_KEYS = new Set([
  'admin_account',
  'calendar_display_settings',
  'easy_mode_categories',
  'easy_mode_footer_items',
  'easy_mode_inventory_overrides',
  'policy_settings',
  'pricing_settings',
  'qr_screen_settings',
  'accounting_subjects',
  'sales_report_categories',
  'sales_report_output_settings',
  'site_map_settings',
]);

export async function GET(request: NextRequest) {
  const authError = await requireAdminRequest(request);
  if (authError) return authError;

  const key = request.nextUrl.searchParams.get('key') ?? '';
  if (!ALLOWED_SETTING_KEYS.has(key)) {
    return NextResponse.json({ error: '取得できない設定キーです。' }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ value: data?.value ?? null });
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminRequest(request);
  if (authError) return authError;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const key = typeof body?.key === 'string' ? body.key : '';

  if (!ALLOWED_SETTING_KEYS.has(key)) {
    return NextResponse.json({ error: '保存できない設定キーです。' }, { status: 400 });
  }

  if (!body || !Object.prototype.hasOwnProperty.call(body, 'value')) {
    return NextResponse.json({ error: '設定値が不足しています。' }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('app_settings')
    .upsert({
      key,
      value: body.value as Database['public']['Tables']['app_settings']['Row']['value'],
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
