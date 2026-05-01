import { NextRequest, NextResponse } from 'next/server';
import {
  getQrAccessSupabaseClient,
  QR_ACCESS_COOKIE,
  verifyQrAccessSessionToken,
} from '@/lib/qrAccessServer';
import type { Database, Json } from '@/types/database';

type GuestReservationRow = Database['public']['Tables']['guest_reservations']['Row'];

function getIdentity(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const reservationId = searchParams.get('id');
  const qrToken = searchParams.get('token');
  return {
    reservationId: reservationId && reservationId.length > 0 ? reservationId : null,
    qrToken: qrToken && qrToken.length > 0 ? qrToken : null,
  };
}

function sameCustomer(target: GuestReservationRow, candidate: GuestReservationRow) {
  if (target.user_identifier && candidate.user_identifier === target.user_identifier) return true;
  if (target.user_email && candidate.user_email === target.user_email) return true;
  if (target.user_phone && candidate.user_phone === target.user_phone) return true;
  return candidate.user_name === target.user_name;
}

function parseOptions(value: Json | null, optionNameMap: Map<string, string>) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, Json> => typeof item === 'object' && item !== null && !Array.isArray(item))
    .map((item) => {
      const optionId = typeof item.optionId === 'string' ? item.optionId : '';
      const name =
        (typeof item.name === 'string' && item.name.length > 0 ? item.name : null) ??
        optionNameMap.get(optionId) ??
        'オプション';
      const quantity = typeof item.quantity === 'number' ? item.quantity : 1;
      const people = typeof item.people === 'number' ? item.people : undefined;
      const days = typeof item.days === 'number' ? item.days : undefined;
      const subtotal = typeof item.subtotal === 'number' ? item.subtotal : 0;
      return { optionId, name, quantity, people, days, subtotal };
    });
}

function toPublicReservation(
  reservation: GuestReservationRow,
  planNameMap: Map<string, string>,
  optionNameMap: Map<string, string>,
) {
  const options = parseOptions(reservation.options_json, optionNameMap);
  return {
    id: reservation.id,
    receptionCode: reservation.id.replace(/-/g, '').slice(0, 8).toUpperCase(),
    status: reservation.status,
    planName: reservation.plan_id ? planNameMap.get(reservation.plan_id) ?? 'プラン未設定' : 'プラン未設定',
    siteNumber: reservation.site_number,
    siteName: reservation.site_name,
    selectedSiteNumbers: Array.isArray(reservation.selected_site_numbers)
      ? reservation.selected_site_numbers.filter((item): item is string => typeof item === 'string')
      : [],
    checkInDate: reservation.check_in_date,
    checkOutDate: reservation.check_out_date,
    checkedInAt: reservation.checked_in_at,
    nights: reservation.nights,
    adults: reservation.adults,
    children: reservation.children,
    infants: reservation.infants,
    guests: reservation.guests,
    options,
    optionTotal: options.reduce((sum, option) => sum + option.subtotal, 0),
    totalAmount: reservation.total_amount,
    paymentMethod: reservation.payment_method,
    createdAt: reservation.created_at,
  };
}

export async function GET(request: NextRequest) {
  const identity = getIdentity(request);
  if (!identity.reservationId && !identity.qrToken) {
    return NextResponse.json({ error: 'QRコードの予約識別情報が不足しています。' }, { status: 400 });
  }

  const sessionToken = request.cookies.get(QR_ACCESS_COOKIE)?.value;
  if (!verifyQrAccessSessionToken(sessionToken, identity)) {
    return NextResponse.json({ error: 'QR閲覧には管理人パスワード認証が必要です。' }, { status: 401 });
  }

  try {
    const supabase = getQrAccessSupabaseClient();
    let targetQuery = supabase.from('guest_reservations').select('*').limit(1);
    if (identity.reservationId) {
      targetQuery = targetQuery.eq('id', identity.reservationId);
    } else {
      targetQuery = targetQuery.eq('qr_token', identity.qrToken ?? '');
    }
    const { data: target, error: targetError } = await targetQuery.maybeSingle();

    if (targetError) throw targetError;
    if (!target) {
      return NextResponse.json({ error: '該当する予約が見つかりません。' }, { status: 404 });
    }

    const [{ data: reservations, error: reservationsError }, { data: plans }, { data: options }] = await Promise.all([
      supabase.from('guest_reservations').select('*').order('check_in_date', { ascending: false }),
      supabase.from('plans').select('id, name'),
      supabase.from('options').select('id, name'),
    ]);

    if (reservationsError) throw reservationsError;

    const planNameMap = new Map((plans ?? []).map((plan) => [plan.id, plan.name]));
    const optionNameMap = new Map((options ?? []).map((option) => [option.id, option.name]));
    const relatedReservations = (reservations ?? []).filter((reservation) => sameCustomer(target, reservation));

    return NextResponse.json({
      member: {
        name: target.user_name,
        phone: target.user_phone,
        email: target.user_email,
        identifier: target.user_identifier ?? target.user_email ?? target.user_phone ?? target.id,
        gender: target.user_gender,
        occupation: target.user_occupation,
        address: target.user_address,
        referralSource: target.user_referral_source,
      },
      reservations: relatedReservations.map((reservation) =>
        toPublicReservation(reservation, planNameMap, optionNameMap),
      ),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '予約情報の取得に失敗しました。';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
