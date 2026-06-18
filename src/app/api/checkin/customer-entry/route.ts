import { NextRequest, NextResponse } from 'next/server';
import {
  CUSTOMER_CHECKIN_COOKIE,
  makeCustomerCheckinSessionToken,
  QR_ACCESS_MAX_AGE_SECONDS,
} from '@/lib/qrAccessServer';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';

function getTodayJst() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function normalizeReceptionCode(value: string) {
  return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '');
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function buildPhoneVariants(value: string) {
  const digits = normalizePhone(value);
  const variants = new Set<string>();
  if (!digits) return [] as string[];

  variants.add(digits);

  if (digits.length === 11) {
    variants.add(`${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`);
  }

  if (digits.length === 10) {
    variants.add(`${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`);
    variants.add(`${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`);
    variants.add(`${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`);
  }

  return Array.from(variants);
}

function makeResponse(reservationId: string) {
  const entryToken = makeCustomerCheckinSessionToken({ reservationId, source: 'customer' });
  const response = NextResponse.json({ ok: true, reservationId, entryToken });
  response.cookies.set(
    CUSTOMER_CHECKIN_COOKIE,
    entryToken,
    {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: QR_ACCESS_MAX_AGE_SECONDS,
    },
  );
  return response;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const mode = typeof body?.mode === 'string' ? body.mode : '';
  const supabase = getSupabaseAdminClient();
  const today = getTodayJst();

  try {
    if (mode === 'line-select') {
      const reservationId = typeof body?.reservationId === 'string' ? body.reservationId : '';
      const userId = typeof body?.userId === 'string' ? body.userId : '';
      const phone = typeof body?.phone === 'string' ? normalizePhone(body.phone) : '';
      const email = typeof body?.email === 'string' ? normalizeEmail(body.email) : '';

      if (!reservationId || !userId) {
        return NextResponse.json({ error: '予約情報が不足しています。' }, { status: 400 });
      }

      const { data: reservation, error } = await supabase
        .from('guest_reservations')
        .select('id, user_identifier, user_phone, user_email, check_in_date, status')
        .eq('id', reservationId)
        .maybeSingle();

      if (error) throw error;

      const matchesLine = reservation?.user_identifier === userId;
      const matchesFallbackPhone =
        !reservation?.user_identifier && !!phone && buildPhoneVariants(phone).includes(reservation?.user_phone ?? '');
      const matchesFallbackEmail =
        !reservation?.user_identifier && !!email && normalizeEmail(reservation?.user_email ?? '') === email;

      if (!reservation || (!matchesLine && !matchesFallbackPhone && !matchesFallbackEmail)) {
        return NextResponse.json({ error: '対象の予約を確認できませんでした。' }, { status: 404 });
      }
      if (reservation.check_in_date !== today) {
        return NextResponse.json({ error: '本日チェックイン対象の予約のみ開始できます。' }, { status: 400 });
      }
      if (reservation.status === 'cancelled' || reservation.status === 'checked_in' || reservation.status === 'completed') {
        return NextResponse.json({ error: 'この予約ではチェックインを開始できません。' }, { status: 400 });
      }

      return makeResponse(reservation.id);
    }

    if (mode === 'manual-lookup') {
      const receptionCode = typeof body?.receptionCode === 'string' ? normalizeReceptionCode(body.receptionCode) : '';
      const phone = typeof body?.phone === 'string' ? normalizePhone(body.phone) : '';
      if (!receptionCode || !phone) {
        return NextResponse.json({ error: '予約番号と電話番号を入力してください。' }, { status: 400 });
      }

      const phoneVariants = buildPhoneVariants(phone);
      const { data: reservations, error } = await supabase
        .from('guest_reservations')
        .select('id, user_phone, check_in_date, status')
        .eq('check_in_date', today)
        .in('user_phone', phoneVariants)
        .not('status', 'in', '(cancelled,checked_in,completed)');

      if (error) throw error;

      const target = (reservations ?? []).find((reservation) => {
        const reservationCode = normalizeReceptionCode(reservation.id.replace(/-/g, '').slice(0, 8));
        return reservationCode === receptionCode && phoneVariants.includes(reservation.user_phone ?? '');
      });

      if (!target) {
        return NextResponse.json({ error: '本日の予約が見つかりませんでした。' }, { status: 404 });
      }

      return makeResponse(target.id);
    }

    return NextResponse.json({ error: '未対応の操作です。' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'チェックイン開始に失敗しました。';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
