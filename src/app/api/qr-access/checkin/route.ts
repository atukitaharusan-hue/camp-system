import { NextRequest, NextResponse } from 'next/server';
import {
  getQrAccessSupabaseClient,
  QR_ACCESS_COOKIE,
  verifyQrAccessSessionToken,
} from '@/lib/qrAccessServer';

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const reservationId = typeof body?.reservationId === 'string' ? body.reservationId : '';
  const qrReservationId = typeof body?.qrReservationId === 'string' && body.qrReservationId.length > 0 ? body.qrReservationId : null;
  const qrToken = typeof body?.qrToken === 'string' && body.qrToken.length > 0 ? body.qrToken : null;

  if (!reservationId) {
    return NextResponse.json({ error: '更新対象の予約IDが不足しています。' }, { status: 400 });
  }

  if (!qrReservationId && !qrToken) {
    return NextResponse.json({ error: 'QRコードの予約識別情報が不足しています。' }, { status: 400 });
  }

  const sessionToken = request.cookies.get(QR_ACCESS_COOKIE)?.value;
  if (!verifyQrAccessSessionToken(sessionToken, { reservationId: qrReservationId, qrToken })) {
    return NextResponse.json({ error: 'チェックイン更新には管理人パスワード認証が必要です。' }, { status: 401 });
  }

  try {
    const supabase = getQrAccessSupabaseClient();
    const checkedInAt = new Date().toISOString();
    const { data, error } = await supabase
      .from('guest_reservations')
      .update({ status: 'checked_in', checked_in_at: checkedInAt, updated_at: checkedInAt })
      .eq('id', reservationId)
      .neq('status', 'cancelled')
      .select('id, status, checked_in_at')
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, reservation: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'チェックイン更新に失敗しました。';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
