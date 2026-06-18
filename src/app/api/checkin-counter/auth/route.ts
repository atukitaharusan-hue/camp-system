import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_MAX_AGE, COOKIE_NAME, hasAdminSessionSecret, makeSessionToken } from '@/lib/admin/session';
import { fetchQrAccessPasswordSetting, getQrAccessSupabaseClient, verifyPassword } from '@/lib/qrAccessServer';

function normalizeReservationId(body: Record<string, unknown> | null) {
  return typeof body?.reservationId === 'string' && body.reservationId.trim().length > 0
    ? body.reservationId.trim()
    : '';
}

function matchesFallbackAdminPassword(password: string) {
  const adminPassword = process.env.ADMIN_PASSWORD ?? '';
  if (!adminPassword || password.length !== adminPassword.length) return false;

  let diff = 0;
  for (let index = 0; index < password.length; index += 1) {
    diff |= password.charCodeAt(index) ^ adminPassword.charCodeAt(index);
  }

  return diff === 0;
}

function buildErrorRedirect(request: NextRequest, reservationId: string, message: string) {
  const url = new URL('/checkin-counter', request.nextUrl.origin);
  if (reservationId) {
    url.searchParams.set('reservationId', reservationId);
  }
  url.searchParams.set('error', message);
  return NextResponse.redirect(url);
}

async function parseRequest(request: NextRequest) {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    return {
      reservationId: normalizeReservationId(body),
      password: typeof body?.password === 'string' ? body.password : '',
      mode: 'json' as const,
    };
  }

  const formData = await request.formData().catch(() => null);
  return {
    reservationId:
      formData && typeof formData.get('reservationId') === 'string'
        ? String(formData.get('reservationId')).trim()
        : '',
    password: formData && typeof formData.get('password') === 'string' ? String(formData.get('password')) : '',
    mode: 'form' as const,
  };
}

export async function POST(request: NextRequest) {
  const { reservationId, password, mode } = await parseRequest(request);

  if (!reservationId) {
    return mode === 'json'
      ? NextResponse.json({ error: '予約情報が見つかりません。' }, { status: 400 })
      : buildErrorRedirect(request, reservationId, '予約情報が見つかりません。');
  }

  if (!password) {
    return mode === 'json'
      ? NextResponse.json({ error: '管理人用パスワードを入力してください。' }, { status: 400 })
      : buildErrorRedirect(request, reservationId, '管理人用パスワードを入力してください。');
  }

  if (!hasAdminSessionSecret()) {
    return mode === 'json'
      ? NextResponse.json({ error: '管理人セッションを開始できませんでした。' }, { status: 500 })
      : buildErrorRedirect(request, reservationId, '管理人セッションを開始できませんでした。');
  }

  try {
    const supabase = getQrAccessSupabaseClient();
    const { data: reservation, error } = await supabase
      .from('guest_reservations')
      .select('id')
      .eq('id', reservationId)
      .maybeSingle();

    if (error) throw error;
    if (!reservation) {
      return mode === 'json'
        ? NextResponse.json({ error: '対象の予約が見つかりません。' }, { status: 404 })
        : buildErrorRedirect(request, reservationId, '対象の予約が見つかりません。');
    }

    const setting = await fetchQrAccessPasswordSetting();
    const verified = setting ? verifyPassword(password, setting) : matchesFallbackAdminPassword(password);

    if (!verified) {
      return mode === 'json'
        ? NextResponse.json({ error: '管理人用パスワードが正しくありません。' }, { status: 401 })
        : buildErrorRedirect(request, reservationId, '管理人用パスワードが正しくありません。');
    }

    const redirectTo = `/admin/checkin-session?reservationId=${encodeURIComponent(reservationId)}`;
    const response =
      mode === 'json'
        ? NextResponse.json({
            ok: true,
            redirectTo,
          })
        : NextResponse.redirect(new URL(redirectTo, request.nextUrl.origin));

    response.cookies.set(COOKIE_NAME, await makeSessionToken(), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : '管理人用認証に失敗しました。';
    return mode === 'json'
      ? NextResponse.json({ error: message }, { status: 500 })
      : buildErrorRedirect(request, reservationId, message);
  }
}
