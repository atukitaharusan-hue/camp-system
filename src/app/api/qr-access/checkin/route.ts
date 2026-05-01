import { NextRequest, NextResponse } from 'next/server';
import {
  getQrAccessSupabaseClient,
  isSameQrAccessCustomer,
  QR_ACCESS_COOKIE,
  verifyQrAccessSessionToken,
} from '@/lib/qrAccessServer';

function selectQrReservation(
  supabase: ReturnType<typeof getQrAccessSupabaseClient>,
  identity: { reservationId: string | null; qrToken: string | null },
) {
  let query = supabase.from('guest_reservations').select('*').limit(1);
  if (identity.reservationId) {
    query = query.eq('id', identity.reservationId);
  } else {
    query = query.eq('qr_token', identity.qrToken ?? '');
  }
  return query.maybeSingle();
}

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
    const [{ data: qrReservation, error: qrReservationError }, { data: targetReservation, error: targetReservationError }] = await Promise.all([
      selectQrReservation(supabase, { reservationId: qrReservationId, qrToken }),
      supabase.from('guest_reservations').select('*').eq('id', reservationId).maybeSingle(),
    ]);

    if (qrReservationError) throw qrReservationError;
    if (targetReservationError) throw targetReservationError;

    if (!qrReservation || !targetReservation) {
      return NextResponse.json({ error: '該当する予約が見つかりません。' }, { status: 404 });
    }

    if (!isSameQrAccessCustomer(qrReservation, targetReservation)) {
      return NextResponse.json({ error: 'このQRコードでは指定された予約を更新できません。' }, { status: 403 });
    }

    if (targetReservation.status === 'cancelled') {
      return NextResponse.json({ error: 'キャンセル済みの予約はチェックインに変更できません。' }, { status: 409 });
    }

    const checkedInAt = new Date().toISOString();
    const { data, error } = await supabase
      .from('guest_reservations')
      .update({ status: 'checked_in', checked_in_at: checkedInAt, updated_at: checkedInAt })
      .eq('id', reservationId)
      .select('id, status, checked_in_at')
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'チェックイン更新対象の予約が見つかりません。' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, reservation: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'チェックイン更新に失敗しました。';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
