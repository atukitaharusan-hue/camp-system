import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRequest } from '@/lib/admin/requestAuth';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import {
  buildSessionPreviewFromReservation,
  fetchActiveCheckinSessionByReservationId,
  fetchCheckinSessionByCounterToken,
  finalizeCheckinSession,
  getOptionSubtotal,
  markReservationFlowStatus,
  upsertCheckinSession,
} from '@/lib/checkinSessionServer';
import type { Database, Json } from '@/types/database';

type GuestReservationRow = Database['public']['Tables']['guest_reservations']['Row'];

function extractErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return fallback;
}

async function fetchPlanOptions(planId: string | null) {
  if (!planId) return [];
  const supabase = getSupabaseAdminClient();
  const { data: planOptions, error: planOptionsError } = await supabase
    .from('plan_options')
    .select('option_id')
    .eq('plan_id', planId);
  if (planOptionsError) throw planOptionsError;
  const ids = (planOptions ?? []).map((item) => item.option_id);
  if (ids.length === 0) return [];
  const { data: options, error } = await supabase.from('options').select('*').in('id', ids).eq('is_active', true);
  if (error) throw error;
  return options ?? [];
}

export async function GET(request: NextRequest) {
  const authError = await requireAdminRequest(request);
  if (authError) return authError;

  const token = request.nextUrl.searchParams.get('token');
  const reservationId = request.nextUrl.searchParams.get('reservationId');
  if (!token && !reservationId) {
    return NextResponse.json({ error: '対象情報が不足しています。' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const session = token
      ? await fetchCheckinSessionByCounterToken(token)
      : await fetchActiveCheckinSessionByReservationId(reservationId ?? '');

    let reservation: GuestReservationRow | null = null;
    if (session) {
      const { data, error } = await supabase.from('guest_reservations').select('*').eq('id', session.reservation_id).single();
      if (error) throw error;
      reservation = data;
    } else if (reservationId) {
      const { data, error } = await supabase.from('guest_reservations').select('*').eq('id', reservationId).single();
      if (error) throw error;
      reservation = data;
    }

    if (!reservation) {
      return NextResponse.json({ error: '対象の予約が見つかりません。' }, { status: 404 });
    }

    const options = await fetchPlanOptions(reservation.plan_id);
    return NextResponse.json({
      reservation,
      session: session ?? buildSessionPreviewFromReservation(reservation),
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
    const message = extractErrorMessage(error, 'セッション情報の取得に失敗しました。');
    console.error('[admin-checkin-sessions:get] error', {
      message,
      reservationId,
      hasToken: Boolean(token),
      rawError: error,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminRequest(request);
  if (authError) return authError;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = typeof body?.action === 'string' ? body.action : '';

  try {
    const supabase = getSupabaseAdminClient();

    if (action === 'update') {
      const reservationId = typeof body?.reservationId === 'string' ? body.reservationId : '';
      if (!reservationId) {
        return NextResponse.json({ error: '予約情報が不足しています。' }, { status: 400 });
      }

      const { data: reservation, error } = await supabase
        .from('guest_reservations')
        .select('*')
        .eq('id', reservationId)
        .single();
      if (error) throw error;

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
      const selectedSiteNumbers = Array.isArray(body?.selectedSiteNumbers)
        ? body.selectedSiteNumbers.filter((item): item is string => typeof item === 'string' && item.length > 0)
        : Array.isArray(reservation.selected_site_numbers)
          ? reservation.selected_site_numbers.filter((item): item is string => typeof item === 'string' && item.length > 0)
          : [];
      const requestedSiteCount = Math.max(1, Number(body?.requestedSiteCount ?? reservation.reserved_site_count ?? 1));

      const availableOptions = await fetchPlanOptions(reservation.plan_id);
      const optionMap = new Map(availableOptions.map((option) => [option.id, option]));
      const rawOptions = Array.isArray(body?.optionsJson) ? body.optionsJson : Array.isArray(reservation.options_json) ? reservation.options_json : [];
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
          userIdentifier: reservation.user_identifier ?? null,
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
        typeof body?.status === 'string' && body.status === 'counter_processing' ? 'counter_processing' : 'arrived_pending',
      );

      await markReservationFlowStatus(reservationId, session.status);
      return NextResponse.json({ success: true, session, estimatedTotalAmount });
    }

    if (action === 'finalize') {
      const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';
      if (!sessionId) {
        return NextResponse.json({ error: 'セッション情報が不足しています。' }, { status: 400 });
      }

      const result = await finalizeCheckinSession(sessionId);
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({ error: '未対応の処理です。' }, { status: 400 });
  } catch (error) {
    const message = extractErrorMessage(error, '処理に失敗しました。');
    console.error('[admin-checkin-sessions:post] error', {
      message,
      action,
      hasReservationId: typeof body?.reservationId === 'string' && body.reservationId.length > 0,
      hasSessionId: typeof body?.sessionId === 'string' && body.sessionId.length > 0,
      rawError: error,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
