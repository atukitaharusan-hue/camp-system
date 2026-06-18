import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { findMyPageLinkedReservationIds } from '@/lib/mypageReservationLinks';
import { setMyPageAccessCredential } from '@/lib/mypageAccessCredentials';

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const reservationId = typeof body?.reservationId === 'string' ? body.reservationId : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';

  if (!reservationId || !password || !userId) {
    return NextResponse.json({ error: '予約情報とマイページ用パスワードが必要です。' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data: reservation, error } = await supabase
      .from('guest_reservations')
      .select('id, user_identifier')
      .eq('id', reservationId)
      .maybeSingle();

    if (error) throw error;
    if (!reservation) {
      return NextResponse.json({ error: '予約が見つかりません。' }, { status: 404 });
    }

    const linkedReservationIds = await findMyPageLinkedReservationIds({ userId });
    const canManage =
      reservation.user_identifier === userId || linkedReservationIds.includes(reservationId);

    if (!canManage) {
      return NextResponse.json(
        { error: 'この予約のマイページ用パスワードを設定する権限がありません。' },
        { status: 403 },
      );
    }

    await setMyPageAccessCredential({ reservationId, password });
    return NextResponse.json({ ok: true, message: 'マイページ用パスワードを設定しました。' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'マイページ用パスワードの設定に失敗しました。';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

