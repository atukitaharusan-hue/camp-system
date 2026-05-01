import { NextRequest, NextResponse } from 'next/server';
import {
  fetchQrAccessPasswordSetting,
  getQrAccessSupabaseClient,
  makeQrAccessSessionToken,
  QR_ACCESS_COOKIE,
  QR_ACCESS_MAX_AGE_SECONDS,
  verifyPassword,
} from '@/lib/qrAccessServer';

function normalizeIdentity(body: Record<string, unknown> | null) {
  const reservationId = typeof body?.reservationId === 'string' && body.reservationId.length > 0 ? body.reservationId : null;
  const qrToken = typeof body?.qrToken === 'string' && body.qrToken.length > 0 ? body.qrToken : null;
  return { reservationId, qrToken };
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const password = typeof body?.password === 'string' ? body.password : '';
  const identity = normalizeIdentity(body);

  if (!identity.reservationId && !identity.qrToken) {
    return NextResponse.json({ error: 'QRコードの予約識別情報が不足しています。' }, { status: 400 });
  }

  if (!password) {
    return NextResponse.json({ error: 'パスワードを入力してください。' }, { status: 400 });
  }

  try {
    const setting = await fetchQrAccessPasswordSetting();
    if (!setting) {
      return NextResponse.json({ error: 'QR閲覧用パスワードが未設定です。管理画面で設定してください。' }, { status: 409 });
    }

    if (!verifyPassword(password, setting)) {
      return NextResponse.json({ error: 'パスワードが正しくありません。' }, { status: 401 });
    }

    const supabase = getQrAccessSupabaseClient();
    let query = supabase.from('guest_reservations').select('id, qr_token').limit(1);
    if (identity.reservationId) {
      query = query.eq('id', identity.reservationId);
    } else {
      query = query.eq('qr_token', identity.qrToken ?? '');
    }
    const { data, error } = await query.maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: '該当する予約が見つかりません。QRコードをご確認ください。' }, { status: 404 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(QR_ACCESS_COOKIE, makeQrAccessSessionToken(identity), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: QR_ACCESS_MAX_AGE_SECONDS,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'QR閲覧認証に失敗しました。';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
