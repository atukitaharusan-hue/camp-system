import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRequest } from '@/lib/admin/requestAuth';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
  const authError = await requireAdminRequest(request);
  if (authError) return authError;

  const supabase = getSupabaseAdminClient();
  const [membersResult, invitesResult] = await Promise.all([
    supabase.from('admin_members').select('*').order('created_at'),
    supabase.from('admin_invites').select('*').order('created_at'),
  ]);

  if (membersResult.error) {
    return NextResponse.json({ error: membersResult.error.message }, { status: 500 });
  }

  if (invitesResult.error) {
    return NextResponse.json({ error: invitesResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    members: membersResult.data ?? [],
    invites: invitesResult.data ?? [],
  });
}
