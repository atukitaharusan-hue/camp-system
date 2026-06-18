import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import {
  buildPhoneVariants,
  findMyPageLinkedReservationIds,
  normalizeEmail,
  normalizePhone,
  readMyPageReservationLinks,
  upsertMyPageReservationLink,
} from '@/lib/mypageReservationLinks';
import { generateReceptionCode } from '@/types/reservation';

function getTodayJst() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeReservationNumber(value?: string | null) {
  return value ? value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
}

async function loadReservationsByIds(ids: string[]) {
  if (ids.length === 0) return [];

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('guest_reservations')
    .select(
      'id, status, check_in_date, check_out_date, nights, guests, site_number, total_amount, created_at, user_gender, user_occupation, user_phone, user_email, user_address, user_identifier',
    )
    .in('id', ids);

  if (error) throw error;
  return data ?? [];
}

function uniqueIds(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values.filter((value): value is string => typeof value === 'string' && value.length > 0 && isUuid(value)),
    ),
  );
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const mode = typeof body?.mode === 'string' ? body.mode : 'list';
  const supabase = getSupabaseAdminClient();

  try {
    if (mode === 'manual-link') {
      const receptionCode = normalizeReservationNumber(typeof body?.receptionCode === 'string' ? body.receptionCode : '');
      const phone = normalizePhone(typeof body?.phone === 'string' ? body.phone : '');
      const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';

      if (!receptionCode || !phone || !userId) {
        return NextResponse.json(
          { error: '予約番号、電話番号、LINEログイン情報が必要です。' },
          { status: 400 },
        );
      }

      const phoneVariants = buildPhoneVariants(phone);
      const { data, error } = await supabase
        .from('guest_reservations')
        .select(
          'id, status, check_in_date, check_out_date, nights, guests, site_number, total_amount, created_at, user_phone, user_email, user_identifier',
        )
        .in('user_phone', phoneVariants)
        .order('check_in_date', { ascending: false });

      if (error) throw error;

      const reservation = (data ?? []).find((row) => generateReceptionCode(row.id) === receptionCode);
      if (!reservation) {
        return NextResponse.json({ error: '一致する予約が見つかりませんでした。' }, { status: 404 });
      }

      const existingLinks = await readMyPageReservationLinks();
      const existingLink = existingLinks.links.find((link) => link.reservationId === reservation.id);

      if (reservation.user_identifier && reservation.user_identifier !== userId) {
        return NextResponse.json(
          { error: 'この予約は別のLINEアカウントに連携済みです。管理画面で確認してください。' },
          { status: 409 },
        );
      }

      if (existingLink?.userIdentifier && existingLink.userIdentifier !== userId) {
        return NextResponse.json(
          { error: 'この予約は別のLINEアカウントに連携済みです。管理画面で確認してください。' },
          { status: 409 },
        );
      }

      if (!reservation.user_identifier) {
        const { error: updateError } = await supabase
          .from('guest_reservations')
          .update({ user_identifier: userId })
          .eq('id', reservation.id)
          .is('user_identifier', null);

        if (updateError) throw updateError;
      }

      await upsertMyPageReservationLink({
        reservationId: reservation.id,
        userIdentifier: userId,
        phone: normalizePhone(reservation.user_phone),
        email: normalizeEmail(reservation.user_email),
        verifiedLevel: 'phone_verified',
        updatedAt: new Date().toISOString(),
      });

      const [refreshed] = await loadReservationsByIds([reservation.id]);
      return NextResponse.json({ ok: true, reservation: refreshed ?? reservation });
    }

    const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
    const phone = normalizePhone(typeof body?.phone === 'string' ? body.phone : '');
    const email = normalizeEmail(typeof body?.email === 'string' ? body.email : '');
    const lastReservationId = typeof body?.lastReservationId === 'string' ? body.lastReservationId.trim() : '';
    const linkedReservationIds = Array.isArray(body?.linkedReservationIds)
      ? body.linkedReservationIds.filter((value): value is string => typeof value === 'string' && isUuid(value))
      : [];

    if (!userId && !phone && !email && !lastReservationId && linkedReservationIds.length === 0) {
      return NextResponse.json({ reservations: [], todayReservationCount: 0, reservationCount: 0, latest: null });
    }

    const directReservationsPromise = userId
      ? supabase
          .from('guest_reservations')
          .select(
            'id, status, check_in_date, check_out_date, nights, guests, site_number, total_amount, created_at, user_gender, user_occupation, user_phone, user_email, user_address, user_identifier',
          )
          .eq('user_identifier', userId)
          .order('check_in_date', { ascending: false })
      : Promise.resolve({ data: [], error: null });

    const [directResult, strictLinkedIds, supportLinkedIds] = await Promise.all([
      directReservationsPromise,
      userId ? findMyPageLinkedReservationIds({ userId }) : Promise.resolve([]),
      phone || email
        ? findMyPageLinkedReservationIds({ phone, email, includeSupportMatches: true })
        : Promise.resolve([]),
    ]);

    if (directResult.error) throw directResult.error;

    const merged = new Map<string, Record<string, unknown>>();
    for (const row of directResult.data ?? []) {
      merged.set(row.id, row);
    }

    const candidateIds = uniqueIds([
      ...strictLinkedIds,
      ...supportLinkedIds,
      ...linkedReservationIds,
      lastReservationId,
    ]);

    const linkedReservations = await loadReservationsByIds(candidateIds);
    for (const row of linkedReservations) {
      merged.set(row.id, row);
    }

    const reservations = Array.from(merged.values()).sort(
      (a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime(),
    );

    const today = getTodayJst();
    const todayReservationCount = reservations.filter(
      (reservation) => reservation.check_in_date === today && reservation.status !== 'cancelled',
    ).length;

    return NextResponse.json({
      reservations,
      reservationCount: reservations.length,
      todayReservationCount,
      latest: reservations[0] ?? null,
    });
  } catch (error) {
    console.error('[mypage-reservations] error', error);
    console.error('[mypage-reservations] search', {
      hasLineUserId: typeof body?.userId === 'string' && body.userId.trim().length > 0,
      hasReservationNumber: typeof body?.receptionCode === 'string' && normalizeReservationNumber(body.receptionCode).length > 0,
      hasPhone: typeof body?.phone === 'string' && normalizePhone(body.phone).length > 0,
      hasEmail: typeof body?.email === 'string' && normalizeEmail(body.email).length > 0,
    });

    const message = error instanceof Error ? error.message : '予約情報の取得に失敗しました。';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
