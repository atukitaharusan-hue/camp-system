import 'server-only';

import { randomBytes } from 'node:crypto';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { recalculateReservationsPricingInDatabase } from '@/lib/admin/recalculateReservationPricing';
import { createNotificationLogServer } from '@/lib/admin/notificationLogServer';
import { upsertMyPageReservationLink } from '@/lib/mypageReservationLinks';
import type { Database, Json } from '@/types/database';

type GuestReservationRow = Database['public']['Tables']['guest_reservations']['Row'];
type CheckinSessionRow = Database['public']['Tables']['checkin_sessions']['Row'];
type OptionRow = Database['public']['Tables']['options']['Row'];

export type CheckinSessionPayload = {
  reservationId: string;
  userIdentifier: string | null;
  userName: string;
  userPhone: string | null;
  userEmail: string | null;
  userGender: string | null;
  userOccupation: string | null;
  userAddress: string | null;
  userReferralSource: string | null;
  adults: number;
  children: number;
  infants: number;
  guests: number;
  specialRequests: string | null;
  selectedSiteNumbers: string[];
  requestedSiteCount: number;
  optionsJson: Json;
  estimatedTotalAmount: number;
  customerNote: string | null;
};

export function makeCheckinToken(prefix: 'self' | 'counter' = 'self') {
  return `${prefix === 'counter' ? 'chk' : 'ses'}_${randomBytes(18).toString('base64url')}`;
}

export function getOptionSubtotal(option: OptionRow, quantity: number, days: number, people: number) {
  const priceType = option.price_type ?? 'per_unit';
  if (priceType === 'per_day') return option.price * quantity * days;
  if (priceType === 'per_person') return option.price * people;
  if (priceType === 'fixed') return quantity > 0 ? option.price : 0;
  return option.price * quantity;
}

export async function fetchActiveCheckinSessionByReservationId(reservationId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('checkin_sessions')
    .select('*')
    .eq('reservation_id', reservationId)
    .in('status', ['self_started', 'arrived_pending', 'counter_processing'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchCheckinSessionByCounterToken(counterToken: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('checkin_sessions')
    .select('*')
    .eq('counter_token', counterToken)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertCheckinSession(payload: CheckinSessionPayload, nextStatus: CheckinSessionRow['status']) {
  const supabase = getSupabaseAdminClient();
  const active = await fetchActiveCheckinSessionByReservationId(payload.reservationId);
  const now = new Date().toISOString();

  const base = {
    reservation_id: payload.reservationId,
    user_identifier: payload.userIdentifier,
    user_name: payload.userName,
    user_phone: payload.userPhone,
    user_email: payload.userEmail,
    user_gender: payload.userGender,
    user_occupation: payload.userOccupation,
    user_address: payload.userAddress,
    user_referral_source: payload.userReferralSource,
    adults: payload.adults,
    children: payload.children,
    infants: payload.infants,
    guests: payload.guests,
    special_requests: payload.specialRequests,
    selected_site_numbers: payload.selectedSiteNumbers as unknown as Json,
    requested_site_count: payload.requestedSiteCount,
    options_json: payload.optionsJson,
    estimated_total_amount: payload.estimatedTotalAmount,
    customer_note: payload.customerNote,
    status: nextStatus,
    expires_at: new Date(Date.now() + 1000 * 60 * 60 * 6).toISOString(),
  };

  if (active) {
    const { data, error } = await supabase
      .from('checkin_sessions')
      .update({
        ...base,
        confirmed_at: nextStatus === 'arrived_pending' ? now : active.confirmed_at,
      })
      .eq('id', active.id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('checkin_sessions')
    .insert({
      ...base,
      session_token: makeCheckinToken('self'),
      counter_token: makeCheckinToken('counter'),
      confirmed_at: nextStatus === 'arrived_pending' ? now : null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function markReservationFlowStatus(
  reservationId: string,
  flowStatus: string | null,
) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('guest_reservations')
    .update({ checkin_flow_status: flowStatus, updated_at: new Date().toISOString() })
    .eq('id', reservationId);

  if (error) throw error;
}

async function syncReservationMypageLink(params: {
  reservationId: string;
  reservationUserIdentifier: string | null;
  sessionUserIdentifier: string | null;
  phone: string | null;
  email: string | null;
  updatedAt: string;
}) {
  const supabase = getSupabaseAdminClient();
  const resolvedUserIdentifier =
    (params.reservationUserIdentifier && params.reservationUserIdentifier.length > 0
      ? params.reservationUserIdentifier
      : null) ??
    (params.sessionUserIdentifier && params.sessionUserIdentifier.length > 0
      ? params.sessionUserIdentifier
      : null);

  if (!params.reservationUserIdentifier && resolvedUserIdentifier) {
    const { error } = await supabase
      .from('guest_reservations')
      .update({
        user_identifier: resolvedUserIdentifier,
        updated_at: params.updatedAt,
      })
      .eq('id', params.reservationId)
      .is('user_identifier', null);

    if (error) throw error;
  }

  if (!resolvedUserIdentifier && !params.phone && !params.email) {
    return;
  }

  await upsertMyPageReservationLink({
    reservationId: params.reservationId,
    userIdentifier: resolvedUserIdentifier,
    phone: params.phone,
    email: params.email,
    verifiedLevel: resolvedUserIdentifier ? 'phone_verified' : 'support',
    updatedAt: params.updatedAt,
  });
}

export async function finalizeCheckinSession(sessionId: string) {
  const supabase = getSupabaseAdminClient();
  const { data: session, error: sessionError } = await supabase
    .from('checkin_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (sessionError) throw sessionError;

  const now = new Date().toISOString();
  const { data: updatedReservation, error: updateError } = await supabase
    .from('guest_reservations')
    .update({
      user_name: session.user_name ?? undefined,
      user_phone: session.user_phone ?? undefined,
      user_email: session.user_email ?? undefined,
      user_gender: session.user_gender ?? undefined,
      user_occupation: session.user_occupation ?? undefined,
      user_address: session.user_address ?? undefined,
      user_referral_source: session.user_referral_source ?? undefined,
      adults: session.adults,
      children: session.children,
      infants: session.infants,
      guests: session.guests,
      special_requests: session.special_requests,
      selected_site_numbers: session.selected_site_numbers,
      reserved_site_count: session.requested_site_count,
      options_json: session.options_json,
      checkin_flow_status: 'checked_in',
      status: 'checked_in',
      checked_in_at: now,
      updated_at: now,
    })
    .eq('id', session.reservation_id)
    .select('*')
    .single();

  if (updateError) throw updateError;

  await syncReservationMypageLink({
    reservationId: session.reservation_id,
    reservationUserIdentifier: updatedReservation.user_identifier,
    sessionUserIdentifier: session.user_identifier,
    phone: updatedReservation.user_phone,
    email: updatedReservation.user_email,
    updatedAt: now,
  });

  await recalculateReservationsPricingInDatabase(supabase, [updatedReservation as GuestReservationRow]);

  const { error: sessionUpdateError } = await supabase
    .from('checkin_sessions')
    .update({ status: 'completed', completed_at: now, updated_at: now })
    .eq('id', session.id);

  if (sessionUpdateError) throw sessionUpdateError;

  await createNotificationLogServer({
    reservationId: session.reservation_id,
    type: 'checkin_completed',
    channel: 'internal',
    payload: {
      message: 'チェックインが完了しました',
      sessionId: session.id,
    },
  });

  return { session, reservationId: session.reservation_id };
}

export async function notifyArrivedPending(reservationId: string, sessionId: string) {
  await createNotificationLogServer({
    reservationId,
    type: 'checkin_arrived_pending',
    channel: 'internal',
    payload: {
      message: 'お客様がチェックイン内容を確定し、レジ待ちになりました',
      sessionId,
    },
  });
}

export async function syncCheckinSessionMypageLink(session: CheckinSessionRow) {
  const now = new Date().toISOString();
  const supabase = getSupabaseAdminClient();
  const { data: reservation, error } = await supabase
    .from('guest_reservations')
    .select('id, user_identifier, user_phone, user_email')
    .eq('id', session.reservation_id)
    .single();

  if (error) throw error;

  await syncReservationMypageLink({
    reservationId: session.reservation_id,
    reservationUserIdentifier: reservation.user_identifier,
    sessionUserIdentifier: session.user_identifier,
    phone: session.user_phone ?? reservation.user_phone,
    email: session.user_email ?? reservation.user_email,
    updatedAt: now,
  });
}

export function buildSessionPreviewFromReservation(reservation: GuestReservationRow) {
  return {
    userName: reservation.user_name,
    userPhone: reservation.user_phone,
    userEmail: reservation.user_email,
    userGender: reservation.user_gender,
    userOccupation: reservation.user_occupation,
    userAddress: reservation.user_address,
    userReferralSource: reservation.user_referral_source,
    adults: reservation.adults ?? 1,
    children: reservation.children ?? 0,
    infants: reservation.infants ?? 0,
    guests: reservation.guests ?? 1,
    specialRequests: reservation.special_requests,
    selectedSiteNumbers: Array.isArray(reservation.selected_site_numbers)
      ? reservation.selected_site_numbers.filter((item): item is string => typeof item === 'string' && item.length > 0)
      : [],
    requestedSiteCount: Math.max(1, reservation.reserved_site_count ?? 1),
    optionsJson: (Array.isArray(reservation.options_json) ? reservation.options_json : []) as Json,
    estimatedTotalAmount: Number(reservation.total_amount ?? 0),
    customerNote: null,
  };
}
