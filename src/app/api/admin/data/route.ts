import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRequest } from '@/lib/admin/requestAuth';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import {
  AdminSaveError,
  saveEventsToDatabase,
  saveOptionsToDatabase,
  saveSalesRuleToDatabase,
  saveSitesToDatabase,
} from '@/lib/admin/fetchData';
import { persistPlansToDatabase } from '@/lib/admin/persistPlans';
import type { SalesRule } from '@/types/admin';

function errorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof AdminSaveError) {
    return NextResponse.json(
      { error: error.message, code: error.code, details: error.details },
      { status: 400 },
    );
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminRequest(request);
  if (authError) return authError;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = typeof body?.action === 'string' ? body.action : '';
  const supabase = getSupabaseAdminClient();

  try {
    if (action === 'saveSites') {
      await saveSitesToDatabase(supabase, Array.isArray(body?.sites) ? body.sites : []);
      return NextResponse.json({ ok: true });
    }

    if (action === 'savePlans') {
      await persistPlansToDatabase(supabase, Array.isArray(body?.plans) ? body.plans : []);
      return NextResponse.json({ ok: true });
    }

    if (action === 'saveEvents') {
      await saveEventsToDatabase(supabase, Array.isArray(body?.events) ? body.events : []);
      return NextResponse.json({ ok: true });
    }

    if (action === 'saveOptions') {
      await saveOptionsToDatabase(supabase, Array.isArray(body?.options) ? body.options : []);
      return NextResponse.json({ ok: true });
    }

    if (action === 'saveSalesRule') {
      if (!body?.rule || typeof body.rule !== 'object') {
        return NextResponse.json({ error: '販売ルールが不足しています。' }, { status: 400 });
      }
      await saveSalesRuleToDatabase(supabase, body.rule as SalesRule);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: '未対応の管理データ操作です。' }, { status: 400 });
  } catch (error) {
    return errorResponse(error, '管理データの保存に失敗しました。');
  }
}
