import type { SupabaseClient } from '@supabase/supabase-js';
import {
  calculateNights,
  formatAdminErrors,
  validateReservation,
} from '@/lib/validateReservation';
import { coerceReservationPricingBreakdown } from '@/lib/pricing';
import type { Database } from '@/types/database';
import type { ReservationPricingBreakdown } from '@/types/pricing';

type GuestReservationRow = Database['public']['Tables']['guest_reservations']['Row'];
type AdminSupabaseClient = SupabaseClient<Database>;
type PaymentMethod = Database['public']['Enums']['payment_method'];
type PaymentStatus = Database['public']['Enums']['payment_status'];
type ReservationStatus = Database['public']['Enums']['reservation_status'];

export interface ReservationPlanItemInput {
  planId: string;
  siteCount: number;
  siteNumbers: string[];
}

export interface UpdateReservationInput {
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  adults: number;
  children: number;
  infants: number;
  pets: number;
  cars: number;
  siteNumber: string;
  specialRequests: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status?: ReservationStatus;
  totalAmount: number;
  optionsJson?: Database['public']['Tables']['guest_reservations']['Row']['options_json'];
  planId?: string;
  requestedSiteCount?: number;
  selectedSiteNumbers?: string[];
  planItems?: ReservationPlanItemInput[];
}

export interface ReservationDetailUpdateInput {
  status: ReservationStatus;
  totalAmount: number;
  optionsJson?: Database['public']['Tables']['guest_reservations']['Row']['options_json'];
  pricingBreakdown?: ReservationPricingBreakdown;
  paymentMethod?: PaymentMethod;
  userName?: string;
  guests?: number;
  adults?: number;
  children?: number;
  infants?: number;
}

export type UpdateResult =
  | { success: true; reservation: GuestReservationRow }
  | { success: false; error: string };

interface ReservationUpdateSideEffects {
  logAdminAction?: (input: {
    adminEmail: string;
    actionType: 'reservation_update' | 'reservation_cancel';
    targetType: 'reservation';
    targetId?: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  }) => Promise<void>;
  notifyReservationUpdated?: (
    reservationId: string,
    userEmail?: string | null,
    changes?: Record<string, unknown>,
  ) => Promise<void>;
  notifyReservationCancelled?: (reservationId: string, userEmail?: string | null) => Promise<void>;
}

export async function updateReservationInDatabase(
  supabaseClient: AdminSupabaseClient,
  id: string,
  input: UpdateReservationInput,
  adminEmail: string,
  sideEffects: ReservationUpdateSideEffects = {},
): Promise<UpdateResult> {
  const { data: current, error: fetchErr } = await supabaseClient
    .from('guest_reservations')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !current) {
    return { success: false, error: '予約が見つかりません。' };
  }

  if (current.status === 'cancelled') {
    return { success: false, error: 'キャンセル済みの予約は更新できません。' };
  }

  if (input.checkOutDate <= input.checkInDate) {
    return { success: false, error: 'チェックアウト日はチェックイン日より後の日付を指定してください。' };
  }

  if (input.guests < 1) {
    return { success: false, error: '人数は1人以上を指定してください。' };
  }

  const planItems = normalizePlanItems(input, current);
  if (planItems.length === 0) {
    return { success: false, error: 'プランを1つ以上選択してください。' };
  }

  const allSelectedSiteNumbers = getAllSelectedSiteNumbers(planItems);
  const rawSelectedCount = planItems.reduce((sum, item) => sum + item.siteNumbers.length, 0);
  if (allSelectedSiteNumbers.length !== rawSelectedCount) {
    return { success: false, error: '同じサイト番号を複数のプランで重複して選択することはできません。' };
  }

  const validationErrors: string[] = [];
  for (const item of planItems) {
    const validation = await validateReservation({
      siteNumber: item.siteNumbers[0] ?? '',
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      guests: input.guests,
      source: 'admin_update',
      planId: item.planId,
      requestedSiteCount: item.siteCount,
      selectedSiteNumbers: item.siteNumbers,
      excludeReservationId: id,
    });

    if (!validation.valid) {
      validationErrors.push(formatAdminErrors(validation.errors));
    }
  }

  if (validationErrors.length > 0) {
    return { success: false, error: validationErrors.join('\n') };
  }

  const nights = calculateNights(input.checkInDate, input.checkOutDate);
  const primaryPlanId = planItems[0]?.planId ?? null;
  const selectedSiteNumbers = getAllSelectedSiteNumbers(planItems);
  const totalRequestedSiteCount = planItems.reduce((sum, item) => sum + item.siteCount, 0) || 1;
  const specialRequests = buildSpecialRequests(input.specialRequests, planItems);

  const { data: updated, error: updateErr } = await supabaseClient
    .from('guest_reservations')
    .update({
      check_in_date: input.checkInDate,
      check_out_date: input.checkOutDate,
      nights,
      guests: input.guests,
      adults: input.adults,
      children: input.children,
      infants: input.infants,
      pets: input.pets,
      cars: input.cars,
      plan_id: primaryPlanId,
      reserved_site_count: totalRequestedSiteCount,
      selected_site_numbers: selectedSiteNumbers,
      site_number: selectedSiteNumbers[0] ?? null,
      special_requests: specialRequests,
      payment_method: input.paymentMethod,
      payment_status: input.paymentStatus,
      status: input.status ?? current.status,
      checked_in_at:
        (input.status ?? current.status) === 'checked_in'
          ? current.checked_in_at ?? new Date().toISOString()
          : null,
      total_amount: input.totalAmount,
      options_json: input.optionsJson as Database['public']['Tables']['guest_reservations']['Update']['options_json'] | undefined,
    })
    .eq('id', id)
    .select()
    .single();

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  const changes = buildChanges(current, updated);

  await sideEffects.logAdminAction?.({
    adminEmail,
    actionType: 'reservation_update',
    targetType: 'reservation',
    targetId: id,
    before: pickFields(current),
    after: pickFields(updated),
  });

  await sideEffects.notifyReservationUpdated?.(id, current.user_email, changes);

  return { success: true, reservation: updated };
}

export async function updateReservationDetailInDatabase(
  supabaseClient: AdminSupabaseClient,
  id: string,
  input: ReservationDetailUpdateInput,
  adminEmail: string,
  sideEffects: ReservationUpdateSideEffects = {},
): Promise<UpdateResult> {
  const { data: current, error: fetchErr } = await supabaseClient
    .from('guest_reservations')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !current) {
    return { success: false, error: '予約が見つかりません。' };
  }

  const currentPricingBreakdown = coerceReservationPricingBreakdown(current.pricing_breakdown);
  const derivedOptionsAmount = Array.isArray(input.optionsJson)
    ? (input.optionsJson as unknown[]).reduce<number>((sum, item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return sum;
        const source = item as Record<string, unknown>;
        return sum + (typeof source.subtotal === 'number' ? source.subtotal : 0);
      }, 0)
    : 0;

  const nextPricingBreakdown = input.pricingBreakdown
    ? {
        ...input.pricingBreakdown,
        optionsAmount: derivedOptionsAmount,
        totalAmount: input.totalAmount,
      }
    : currentPricingBreakdown
      ? {
          ...currentPricingBreakdown,
          optionsAmount: derivedOptionsAmount,
          totalAmount: input.totalAmount,
        }
      : current.pricing_breakdown;

  const nextStatus = input.status ?? current.status;
  const nextAdults = Math.max(
    0,
    Math.trunc(
      Number(
        input.adults ??
          current.adults ??
          Math.max((current.guests ?? 1) - (current.children ?? 0) - (current.infants ?? 0), 1),
      ),
    ) || 0,
  );
  const nextChildren = Math.max(0, Math.trunc(Number(input.children ?? current.children ?? 0)) || 0);
  const nextInfants = Math.max(0, Math.trunc(Number(input.infants ?? current.infants ?? 0)) || 0);
  const nextGuests = Math.max(
    1,
    Math.trunc(Number(input.guests ?? nextAdults + nextChildren + nextInfants)) ||
      nextAdults + nextChildren + nextInfants ||
      1,
  );

  const { data: updated, error: updateErr } = await supabaseClient
    .from('guest_reservations')
    .update({
      user_name: input.userName?.trim() ? input.userName.trim() : current.user_name,
      adults: nextAdults,
      children: nextChildren,
      infants: nextInfants,
      guests: nextGuests,
      status: nextStatus,
      checked_in_at: nextStatus === 'checked_in' ? current.checked_in_at ?? new Date().toISOString() : null,
      payment_method: input.paymentMethod ?? current.payment_method,
      options_json:
        input.optionsJson as Database['public']['Tables']['guest_reservations']['Update']['options_json'] | undefined,
      total_amount: input.totalAmount,
      pricing_breakdown:
        nextPricingBreakdown as Database['public']['Tables']['guest_reservations']['Update']['pricing_breakdown'],
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (updateErr || !updated) {
    console.error('[reservation-detail-update] error', updateErr);
    console.error('[reservation-detail-update] params', {
      reservationId: id,
      status: input.status,
      additionalItemsCount: Array.isArray(input.optionsJson) ? input.optionsJson.length : 0,
      totalAmount: input.totalAmount,
    });
    return { success: false, error: updateErr?.message ?? '予約情報を保存できませんでした。' };
  }

  const changes = buildChanges(current, updated);

  await sideEffects.logAdminAction?.({
    adminEmail,
    actionType: 'reservation_update',
    targetType: 'reservation',
    targetId: id,
    before: pickFields(current),
    after: pickFields(updated),
  });

  await sideEffects.notifyReservationUpdated?.(id, current.user_email, changes);

  return { success: true, reservation: updated };
}

export async function updateReservation(
  id: string,
  input: UpdateReservationInput,
  adminEmail: string,
): Promise<UpdateResult> {
  const response = await fetch('/api/admin/reservations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'update', id, input, adminEmail }),
  });

  return response.json();
}

export async function updateReservationDetail(
  id: string,
  input: ReservationDetailUpdateInput,
  adminEmail: string,
): Promise<UpdateResult> {
  const response = await fetch('/api/admin/reservations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'detail-update', id, input, adminEmail }),
  });

  return response.json();
}

export async function cancelReservationInDatabase(
  supabaseClient: AdminSupabaseClient,
  id: string,
  adminEmail: string,
  sideEffects: ReservationUpdateSideEffects = {},
): Promise<{ success: boolean; error?: string }> {
  const { data: current, error: fetchErr } = await supabaseClient
    .from('guest_reservations')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !current) {
    return { success: false, error: '予約が見つかりません。' };
  }

  if (current.status === 'cancelled') {
    return { success: false, error: 'すでにキャンセル済みです。' };
  }

  const { error: updateErr } = await supabaseClient
    .from('guest_reservations')
    .update({ status: 'cancelled' })
    .eq('id', id);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  await markWaitlistCandidate(supabaseClient, current);

  await sideEffects.logAdminAction?.({
    adminEmail,
    actionType: 'reservation_cancel',
    targetType: 'reservation',
    targetId: id,
    before: pickFields(current),
    after: { ...pickFields(current), status: 'cancelled' },
  });

  await sideEffects.notifyReservationCancelled?.(id, current.user_email);

  return { success: true };
}

export async function cancelReservation(
  id: string,
  adminEmail: string,
): Promise<{ success: boolean; error?: string }> {
  const response = await fetch('/api/admin/reservations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'cancel', id, adminEmail }),
  });

  return response.json();
}

export async function promoteWaitlistReservationInDatabase(
  supabaseClient: AdminSupabaseClient,
  id: string,
  adminEmail: string,
  sideEffects: ReservationUpdateSideEffects = {},
): Promise<UpdateResult> {
  const { data: current, error: fetchErr } = await supabaseClient
    .from('guest_reservations')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !current) {
    return { success: false, error: '予約が見つかりません。' };
  }

  if (current.status !== 'waitlisted') {
    return { success: false, error: 'キャンセル待ち予約ではありません。' };
  }

  const selectedSiteNumbers = getSelectedSiteNumbers(current);
  const validation = await validateReservation({
    siteNumber: selectedSiteNumbers[0] ?? '',
    checkInDate: current.check_in_date,
    checkOutDate: current.check_out_date,
    guests: current.guests,
    source: 'admin_update',
    planId: current.plan_id,
    requestedSiteCount: current.reserved_site_count ?? 1,
    selectedSiteNumbers,
    excludeReservationId: current.id,
  });

  if (!validation.valid) {
    return { success: false, error: formatAdminErrors(validation.errors) };
  }

  const nextStatus: PaymentStatus = current.payment_method === 'credit_card' ? 'paid' : 'pending';
  const promotedAt = new Date().toISOString();
  const { data: updated, error: updateErr } = await supabaseClient
    .from('guest_reservations')
    .update({
      status: 'confirmed',
      waitlist_status: 'promoted',
      waitlist_promoted_at: promotedAt,
      payment_status: nextStatus,
      updated_at: promotedAt,
    })
    .eq('id', id)
    .select()
    .single();

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  await sideEffects.logAdminAction?.({
    adminEmail,
    actionType: 'reservation_update',
    targetType: 'reservation',
    targetId: id,
    before: pickFields(current),
    after: pickFields(updated),
  });

  await sideEffects.notifyReservationUpdated?.(id, current.user_email, {
    waitlistPromotion: 'キャンセル待ちから通常予約へ繰り上げ',
  });

  return { success: true, reservation: updated };
}

export async function promoteWaitlistReservation(
  id: string,
  adminEmail: string,
): Promise<UpdateResult> {
  const response = await fetch('/api/admin/reservations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'promote', id, adminEmail }),
  });

  return response.json();
}

async function markWaitlistCandidate(
  supabaseClient: AdminSupabaseClient,
  cancelledReservation: GuestReservationRow,
) {
  if (!cancelledReservation.plan_id) return;

  const { data: candidate, error } = await supabaseClient
    .from('guest_reservations')
    .select('*')
    .eq('plan_id', cancelledReservation.plan_id)
    .eq('status', 'waitlisted')
    .eq('waitlist_status', 'waiting')
    .lt('check_in_date', cancelledReservation.check_out_date)
    .gt('check_out_date', cancelledReservation.check_in_date)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !candidate) return;

  await supabaseClient
    .from('guest_reservations')
    .update({ waitlist_status: 'candidate' })
    .eq('id', candidate.id);
}

function normalizePlanItems(
  input: UpdateReservationInput,
  current: GuestReservationRow,
): ReservationPlanItemInput[] {
  const explicitItems = input.planItems?.length
    ? input.planItems
    : [
        {
          planId: input.planId ?? current.plan_id ?? '',
          siteCount: input.requestedSiteCount ?? current.reserved_site_count ?? 1,
          siteNumbers:
            input.selectedSiteNumbers?.length
              ? input.selectedSiteNumbers
              : input.siteNumber
                ? [input.siteNumber]
                : getSelectedSiteNumbers(current),
        },
      ];

  return explicitItems
    .map((item) => {
      const siteCount = Math.max(1, Math.trunc(Number(item.siteCount || 1)));
      const siteNumbers = item.siteNumbers
        .map((siteNumber) => siteNumber.trim())
        .filter(Boolean)
        .slice(0, siteCount);

      return {
        planId: item.planId.trim(),
        siteCount,
        siteNumbers,
      };
    })
    .filter((item) => item.planId.length > 0);
}

function getSelectedSiteNumbers(reservation: GuestReservationRow): string[] {
  if (Array.isArray(reservation.selected_site_numbers)) {
    return reservation.selected_site_numbers.filter(
      (siteNumber): siteNumber is string =>
        typeof siteNumber === 'string' && siteNumber.trim().length > 0,
    );
  }

  return reservation.site_number ? [reservation.site_number] : [];
}

function getAllSelectedSiteNumbers(planItems: ReservationPlanItemInput[]) {
  return Array.from(new Set(planItems.flatMap((item) => item.siteNumbers)));
}

function buildSpecialRequests(note: string, planItems: ReservationPlanItemInput[]) {
  const cleanNote = stripSystemMemo(note);
  const selectedSiteNumbers = getAllSelectedSiteNumbers(planItems);
  const totalRequestedSiteCount =
    planItems.reduce((sum, item) => sum + item.siteCount, 0) || 1;

  return [
    `PLAN_ID: ${planItems[0]?.planId ?? ''}`,
    `REQUESTED_SITE_COUNT: ${totalRequestedSiteCount}`,
    `SELECTED_SITE_NUMBERS: ${selectedSiteNumbers.join(',')}`,
    `MULTI_PLAN_ITEMS: ${JSON.stringify(planItems)}`,
    cleanNote ? `NOTE: ${cleanNote}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function stripSystemMemo(value: string | null | undefined) {
  const systemPrefixes = [
    'PLAN_ID:',
    'REQUESTED_SITE_COUNT:',
    'SELECTED_SITE_NUMBERS:',
    'MULTI_PLAN_ITEMS:',
  ];

  return (value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => !systemPrefixes.some((prefix) => line.startsWith(prefix)))
    .map((line) => (line.startsWith('NOTE:') ? line.slice(5).trim() : line))
    .filter(Boolean)
    .join('\n');
}

function pickFields(r: GuestReservationRow): Record<string, unknown> {
  return {
    check_in_date: r.check_in_date,
    check_out_date: r.check_out_date,
    nights: r.nights,
    guests: r.guests,
    adults: r.adults,
    children: r.children,
    infants: r.infants,
    pets: r.pets,
    cars: r.cars,
    plan_id: r.plan_id,
    reserved_site_count: r.reserved_site_count,
    selected_site_numbers: r.selected_site_numbers,
    site_number: r.site_number,
    special_requests: r.special_requests,
    payment_method: r.payment_method,
    payment_status: r.payment_status,
    total_amount: r.total_amount,
    status: r.status,
  };
}

function buildChanges(
  before: GuestReservationRow,
  after: GuestReservationRow,
): Record<string, unknown> {
  const changes: Record<string, unknown> = {};
  const keys = [
    'check_in_date',
    'check_out_date',
    'guests',
    'adults',
    'children',
    'infants',
    'pets',
    'cars',
    'plan_id',
    'reserved_site_count',
    'selected_site_numbers',
    'site_number',
    'special_requests',
    'payment_method',
    'payment_status',
    'total_amount',
    'status',
    'options_json',
    'pricing_breakdown',
  ] as const;

  for (const key of keys) {
    const beforeValue = before[key];
    const afterValue = after[key];
    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changes[key] = { from: beforeValue, to: afterValue };
    }
  }
  return changes;
}
