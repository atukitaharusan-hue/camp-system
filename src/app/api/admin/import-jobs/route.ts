import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRequest } from '@/lib/admin/requestAuth';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
  const authError = await requireAdminRequest(request);
  if (authError) return authError;

  const id = request.nextUrl.searchParams.get('id');
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? 20) || 20, 100);
  const includeRows = request.nextUrl.searchParams.get('includeRows') === 'true';
  const supabase = getSupabaseAdminClient();

  if (id) {
    const { data: job, error: jobError } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 });

    if (!includeRows) {
      return NextResponse.json({ job, rows: [] });
    }

    const { data: rows, error: rowsError } = await supabase
      .from('import_job_rows')
      .select('*')
      .eq('import_job_id', id)
      .order('row_number', { ascending: true });

    if (rowsError) return NextResponse.json({ error: rowsError.message }, { status: 500 });
    return NextResponse.json({ job, rows: rows ?? [] });
  }

  const { data, error } = await supabase
    .from('import_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data ?? [] });
}
