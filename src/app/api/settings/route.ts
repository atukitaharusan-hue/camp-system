import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';

const PUBLIC_SETTING_KEYS = new Set([
  'calendar_display_settings',
  'policy_settings',
  'pricing_settings',
  'qr_screen_settings',
  'site_map_settings',
]);

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key') ?? '';
  if (!PUBLIC_SETTING_KEYS.has(key)) {
    return NextResponse.json({ error: '公開対象外の設定キーです。' }, { status: 400 });
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
