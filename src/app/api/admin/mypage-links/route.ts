import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRequest } from '@/lib/admin/requestAuth';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import {
  buildPhoneVariants,
  getMyPageLinkStatusMap,
  normalizeEmail,
  normalizePhone,
  upsertMyPageReservationLink,
} from '@/lib/mypageReservationLinks';

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function buildResponse(params: { linked: boolean; lineUserId: string | null }) {
  if (params.linked && params.lineUserId) {
    return {
      success: true,
      reason: 'LINE_LINKED',
      message: 'マイページ更新完了：LINE連携済み',
      linkStatus: 'linked' as const,
      lineUserId: params.lineUserId,
    };
  }

  return {
    success: false,
    reason: 'LINE_USER_NOT_LINKED',
    message: '予約はありますが、LINEアカウント未紐付けです',
    linkStatus: 'support' as const,
    lineUserId: null,
  };
}

function logParams(
  label: string,
  params: {
    reservationId?: string;
    hasPhone?: boolean;
    hasEmail?: boolean;
    hasUserIdentifier?: boolean;
  },
) {
  console.error(label, {
    reservationId: params.reservationId ?? null,
    hasPhone: Boolean(params.hasPhone),
    hasEmail: Boolean(params.hasEmail),
    hasUserIdentifier: Boolean(params.hasUserIdentifier),
  });
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminRequest(request);
  if (authError) return authError;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = typeof body?.action === 'string' ? body.action : 'sync';

  try {
    const supabase = getSupabaseAdminClient();

    if (action === 'status') {
      const reservationIds = Array.isArray(body?.reservationIds)
        ? body.reservationIds.filter((value): value is string => typeof value === 'string' && isUuid(value))
        : [];

      if (reservationIds.length === 0) {
        return NextResponse.json({ statuses: {} });
      }

      const { data, error } = await supabase.from('guest_reservations').select('id, user_identifier').in('id', reservationIds);
      if (error) {
        console.error('[mypage-links] guest_reservations error', error);
        throw error;
      }

      const reservations = (data ?? []).map((row) => ({
        id: row.id,
        userIdentifier: row.user_identifier,
      }));
      const linkStatusMap = await getMyPageLinkStatusMap(reservations);

      return NextResponse.json({
        statuses: reservationIds.reduce<Record<string, { linkStatus: string; lineUserId: string | null }>>(
          (accumulator, reservationId) => {
            accumulator[reservationId] = {
              linkStatus: linkStatusMap[reservationId]?.status ?? 'unlinked',
              lineUserId: linkStatusMap[reservationId]?.lineUserId ?? null,
            };
            return accumulator;
          },
          {},
        ),
      });
    }

    const reservationId = typeof body?.reservationId === 'string' ? body.reservationId.trim() : '';
    if (!isUuid(reservationId)) {
      return NextResponse.json(
        { success: false, reason: 'INVALID_RESERVATION_ID', message: '対象予約が見つかりません' },
        { status: 400 },
      );
    }

    const { data: reservation, error: reservationError } = await supabase
      .from('guest_reservations')
      .select('id, user_identifier, user_phone, user_email')
      .eq('id', reservationId)
      .maybeSingle();

    if (reservationError) {
      console.error('[mypage-links] guest_reservations error', reservationError);
      logParams('[mypage-links] params', {
        reservationId,
        hasPhone: false,
        hasEmail: false,
        hasUserIdentifier: false,
      });
      throw reservationError;
    }

    if (!reservation) {
      return NextResponse.json(
        { success: false, reason: 'RESERVATION_NOT_FOUND', message: '対象予約が見つかりません' },
        { status: 404 },
      );
    }

    const phone = normalizePhone(reservation.user_phone);
    const email = normalizeEmail(reservation.user_email);
    let userIdentifier = reservation.user_identifier?.trim() || null;

    if (!userIdentifier && (phone || email)) {
      const candidateQueries = [];

      if (phone) {
        const phoneVariants = buildPhoneVariants(phone);
        if (phoneVariants.length > 0) {
          candidateQueries.push(
            supabase
              .from('guest_reservations')
              .select('user_identifier')
              .in('user_phone', phoneVariants)
              .not('user_identifier', 'is', null),
          );
        }
      }

      if (email) {
        candidateQueries.push(
          supabase
            .from('guest_reservations')
            .select('user_identifier')
            .eq('user_email', email)
            .not('user_identifier', 'is', null),
        );
      }

      const results = await Promise.all(candidateQueries);
      const uniqueCandidates = new Set(
        results
          .flatMap((result) => {
            if (result.error) {
              console.error('[mypage-links] guest_reservations error', result.error);
              throw result.error;
            }
            return result.data ?? [];
          })
          .map((row) => row.user_identifier)
          .filter((value): value is string => typeof value === 'string' && value.length > 0),
      );

      if (uniqueCandidates.size === 1) {
        userIdentifier = Array.from(uniqueCandidates)[0] ?? null;
      }
    }

    if (!reservation.user_identifier && userIdentifier) {
      const { error: updateError } = await supabase
        .from('guest_reservations')
        .update({ user_identifier: userIdentifier })
        .eq('id', reservation.id)
        .is('user_identifier', null);

      if (updateError) {
        console.error('[mypage-links] guest_reservations error', updateError);
        throw updateError;
      }
    }

    await upsertMyPageReservationLink({
      reservationId: reservation.id,
      userIdentifier,
      phone: phone || null,
      email: email || null,
      verifiedLevel: userIdentifier ? 'phone_verified' : 'support',
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json(buildResponse({ linked: Boolean(userIdentifier), lineUserId: userIdentifier }));
  } catch (error) {
    console.error('[mypage-links] error', error);
    logParams('[mypage-links] params', {
      reservationId: typeof body?.reservationId === 'string' ? body.reservationId.trim() : undefined,
      hasPhone: typeof body?.phone === 'string' && body.phone.length > 0,
      hasEmail: typeof body?.email === 'string' && body.email.length > 0,
      hasUserIdentifier: typeof body?.userIdentifier === 'string' && body.userIdentifier.length > 0,
    });

    const message = error instanceof Error ? error.message : 'マイページ連携情報の更新に失敗しました。';
    return NextResponse.json(
      {
        success: false,
        reason: 'DB_ERROR',
        message: '予約情報の取得に失敗しました',
        error: message,
      },
      { status: 500 },
    );
  }
}
