import { NextRequest, NextResponse } from 'next/server';
import {
  CUSTOMER_CHECKIN_COOKIE,
  getQrAccessSupabaseClient,
  QR_ACCESS_COOKIE,
  verifyCustomerCheckinSessionToken,
  verifyQrAccessSessionToken,
} from '@/lib/qrAccessServer';
import {
  buildSessionPreviewFromReservation,
  fetchActiveCheckinSessionByReservationId,
  getOptionSubtotal,
  markReservationFlowStatus,
  notifyArrivedPending,
  syncCheckinSessionMypageLink,
  upsertCheckinSession,
} from '@/lib/checkinSessionServer';
import type { Database, Json } from '@/types/database';

type GuestReservationRow = Database['public']['Tables']['guest_reservations']['Row'];

function getIdentity(request: NextRequest) {
  const reservationId = request.nextUrl.searchParams.get('id');
  const qrToken = request.nextUrl.searchParams.get('token');
  const entryToken = request.nextUrl.searchParams.get('entryToken');
  return {
    reservationId: reservationId && reservationId.length > 0 ? reservationId : null,
    qrToken: qrToken && qrToken.length > 0 ? qrToken : null,
    entryToken: entryToken && entryToken.length > 0 ? entryToken : null,
  };
}

async function fetchTargetReservation(
  identity: { reservationId: string | null; qrToken: string | null },
) {
  const supabase = getQrAccessSupabaseClient();
  let query = supabase.from('guest_reservations').select('*').limit(1);
  if (identity.reservationId) {
    query = query.eq('id', identity.reservationId);
  } else {
    query = query.eq('qr_token', identity.qrToken ?? '');
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchPlanOptions(planId: string | null) {
  if (!planId) return [];
  const supabase = getQrAccessSupabaseClient();
  const { data: planOptions, error: planOptionsError } = await supabase
    .from('plan_options')
    .select('option_id')
    .eq('plan_id', planId);

  if (planOptionsError) throw planOptionsError;
  const ids = (planOptions ?? []).map((item) => item.option_id);
  if (ids.length === 0) return [];

  const { data: options, error: optionsError } = await supabase
    .from('options')
    .select('*')
    .in('id', ids)
    .eq('is_active', true)
    .order('name');

  if (optionsError) throw optionsError;
  return options ?? [];
}

function hasCustomerAccess(
  request: NextRequest,
  identity: { reservationId: string | null; qrToken: string | null; entryToken?: string | null },
) {
  const qrSessionToken = request.cookies.get(QR_ACCESS_COOKIE)?.value;
  const customerSessionToken = request.cookies.get(CUSTOMER_CHECKIN_COOKIE)?.value;
  return (
    verifyQrAccessSessionToken(qrSessionToken, identity) ||
    (identity.reservationId
      ? verifyCustomerCheckinSessionToken(customerSessionToken, { reservationId: identity.reservationId }) ||
        verifyCustomerCheckinSessionToken(identity.entryToken ?? undefined, { reservationId: identity.reservationId })
      : false)
  );
}

export async function GET(request: NextRequest) {
  const identity = getIdentity(request);
  if (!identity.reservationId && !identity.qrToken) {
    return NextResponse.json({ error: '予約情報が見つかりません。' }, { status: 400 });
  }

  if (!hasCustomerAccess(request, identity)) {
    return NextResponse.json({ error: '予約の確認権限がありません。' }, { status: 401 });
  }

  try {
    const reservation = await fetchTargetReservation(identity);
    if (!reservation) {
      return NextResponse.json({ error: '対象の予約が見つかりません。' }, { status: 404 });
    }

    const [activeSession, options] = await Promise.all([
      fetchActiveCheckinSessionByReservationId(reservation.id),
      fetchPlanOptions(reservation.plan_id),
    ]);

    return NextResponse.json({
      reservationId: reservation.id,
      planId: reservation.plan_id,
      preview: activeSession ?? buildSessionPreviewFromReservation(reservation),
      session: activeSession,
      options: options.map((option) => ({
        id: option.id,
        name: option.name,
        category: option.category,
        price: option.price,
        priceType: option.price_type,
        eventDate: option.event_date,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'チェックイン情報の取得に失敗しました。';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const reservationId = typeof body?.reservationId === 'string' ? body.reservationId : '';
  const qrReservationId = typeof body?.qrReservationId === 'string' && body.qrReservationId.length > 0 ? body.qrReservationId : null;
  const qrToken = typeof body?.qrToken === 'string' && body.qrToken.length > 0 ? body.qrToken : null;
  const entryToken = typeof body?.entryToken === 'string' && body.entryToken.length > 0 ? body.entryToken : null;

  if (!reservationId || (!qrReservationId && !qrToken)) {
    return NextResponse.json({ error: '予約情報が見つかりません。' }, { status: 400 });
  }

  if (!hasCustomerAccess(request, { reservationId: qrReservationId ?? reservationId, qrToken, entryToken })) {
    return NextResponse.json({ error: '予約の確認権限がありません。' }, { status: 401 });
  }

  try {
    const reservation = (await fetchTargetReservation({ reservationId: qrReservationId, qrToken })) as GuestReservationRow | null;
    if (!reservation || reservation.id !== reservationId) {
      return NextResponse.json({ error: '対象の予約が見つかりません。' }, { status: 404 });
    }

    const adults = Math.max(1, Number(body?.adults ?? reservation.adults ?? 1));
    const children = Math.max(0, Number(body?.children ?? reservation.children ?? 0));
    const infants = Math.max(0, Number(body?.infants ?? reservation.infants ?? 0));
    const guests = adults + children + infants;
    const userName = typeof body?.userName === 'string' && body.userName.trim().length > 0 ? body.userName.trim() : reservation.user_name;
    const userPhone = typeof body?.userPhone === 'string' ? body.userPhone.trim() || null : reservation.user_phone;
    const userEmail = typeof body?.userEmail === 'string' ? body.userEmail.trim() || null : reservation.user_email;
    const userGender = typeof body?.userGender === 'string' ? body.userGender.trim() || null : reservation.user_gender;
    const userOccupation =
      typeof body?.userOccupation === 'string' ? body.userOccupation.trim() || null : reservation.user_occupation;
    const userAddress = typeof body?.userAddress === 'string' ? body.userAddress.trim() || null : reservation.user_address;
    const userReferralSource =
      typeof body?.userReferralSource === 'string'
        ? body.userReferralSource.trim() || null
        : reservation.user_referral_source;
    const specialRequests = typeof body?.specialRequests === 'string' ? body.specialRequests : reservation.special_requests;
    const customerNote = typeof body?.customerNote === 'string' ? body.customerNote : null;
    const lineUserId =
      typeof body?.lineUserId === 'string' && body.lineUserId.trim().length > 0 ? body.lineUserId.trim() : null;

    const selectedSiteNumbers = Array.isArray(body?.selectedSiteNumbers)
      ? body.selectedSiteNumbers.filter((item): item is string => typeof item === 'string' && item.length > 0)
      : Array.isArray(reservation.selected_site_numbers)
        ? reservation.selected_site_numbers.filter((item): item is string => typeof item === 'string' && item.length > 0)
        : [];
    const requestedSiteCount = Math.max(1, Number(body?.requestedSiteCount ?? reservation.reserved_site_count ?? 1));

    const rawOptions = Array.isArray(body?.optionsJson)
      ? body.optionsJson
      : Array.isArray(reservation.options_json)
        ? reservation.options_json
        : [];
    const availableOptions = await fetchPlanOptions(reservation.plan_id);
    const optionMap = new Map(availableOptions.map((option) => [option.id, option]));
    const normalizedOptions = rawOptions
      .filter((item): item is Record<string, Json> => typeof item === 'object' && item !== null && !Array.isArray(item))
      .map((item) => {
        const optionId = typeof item.optionId === 'string' ? item.optionId : '';
        const option = optionMap.get(optionId);
        if (!option) return null;
        const quantity = Math.max(1, Number(item.quantity ?? 1));
        const days = Math.max(1, Number(item.days ?? 1));
        const people = Math.max(1, Number(item.people ?? quantity));
        return {
          type: option.category === 'event' ? 'event' : 'rental',
          optionId: option.id,
          name: option.name,
          quantity,
          days: option.price_type === 'per_day' ? days : undefined,
          people: option.category === 'event' || option.price_type === 'per_person' ? people : undefined,
          subtotal: getOptionSubtotal(option, quantity, days, people),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const currentOptionsTotal = Array.isArray(reservation.options_json)
      ? reservation.options_json.reduce<number>((sum, item) => {
          if (typeof item !== 'object' || item === null || Array.isArray(item)) return sum;
          return sum + Number((item as Record<string, unknown>).subtotal ?? 0);
        }, 0)
      : 0;
    const nextOptionsTotal = normalizedOptions.reduce((sum, item) => sum + item.subtotal, 0);
    const estimatedTotalAmount = Math.max(0, Number(reservation.total_amount ?? 0) - currentOptionsTotal + nextOptionsTotal);

    const session = await upsertCheckinSession(
      {
        reservationId,
        userIdentifier: lineUserId ?? reservation.user_identifier ?? null,
        userName,
        userPhone,
        userEmail,
        userGender,
        userOccupation,
        userAddress,
        userReferralSource,
        adults,
        children,
        infants,
        guests,
        specialRequests,
        selectedSiteNumbers,
        requestedSiteCount,
        optionsJson: normalizedOptions as unknown as Json,
        estimatedTotalAmount,
        customerNote,
      },
      'arrived_pending',
    );

    await syncCheckinSessionMypageLink(session);
    await markReservationFlowStatus(reservationId, 'arrived_pending');
    await notifyArrivedPending(reservationId, session.id);

    return NextResponse.json({
      success: true,
      session,
      estimatedTotalAmount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'チェックイン内容の確定に失敗しました。';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
