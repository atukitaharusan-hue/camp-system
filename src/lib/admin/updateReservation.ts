import { supabase } from '@/lib/supabase';
import {
  validateReservation,
  formatAdminErrors,
  calculateNights,
} from '@/lib/validateReservation';
import { logAdminAction } from '@/lib/admin/actionLog';
import {
  notifyReservationUpdated,
  notifyReservationCancelled,
} from '@/lib/admin/notificationLog';
import type { Database } from '@/types/database';

type GuestReservationRow = Database['public']['Tables']['guest_reservations']['Row'];
type PaymentMethod = Database['public']['Enums']['payment_method'];
type PaymentStatus = Database['public']['Enums']['payment_status'];

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
  totalAmount: number;
  planId?: string;
  requestedSiteCount?: number;
  selectedSiteNumbers?: string[];
  planItems?: ReservationPlanItemInput[];
}

export type UpdateResult =
  | { success: true; reservation: GuestReservationRow }
  | { success: false; error: string };

export async function updateReservation(
  id: string,
  input: UpdateReservationInput,
  adminEmail: string,
): Promise<UpdateResult> {
  const { data: current, error: fetchErr } = await supabase
    .from('guest_reservations')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !current) {
    return { success: false, error: '予約が見つかりません。' };
  }

  if (current.status === 'cancelled') {
    return { success: false, error: 'キャンセル済みの予約は変更できません。' };
  }

  if (input.checkOutDate <= input.checkInDate) {
    return { success: false, error: 'チェックアウト日はチェックイン日より後にしてください。' };
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

  const { data: updated, error: updateErr } = await supabase
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
      total_amount: input.totalAmount,
    })
    .eq('id', id)
    .select()
    .single();

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  const changes = buildChanges(current, updated);

  await logAdminAction({
    adminEmail,
    actionType: 'reservation_update',
    targetType: 'reservation',
    targetId: id,
    before: pickFields(current),
    after: pickFields(updated),
  });

  await notifyReservationUpdated(id, current.user_email, changes);

  return { success: true, reservation: updated };
}

export async function cancelReservation(
  id: string,
  adminEmail: string,
): Promise<{ success: boolean; error?: string }> {
  const { data: current, error: fetchErr } = await supabase
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

  const { error: updateErr } = await supabase
    .from('guest_reservations')
    .update({ status: 'cancelled' })
    .eq('id', id);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  await logAdminAction({
    adminEmail,
    actionType: 'reservation_cancel',
    targetType: 'reservation',
    targetId: id,
    before: pickFields(current),
    after: { ...pickFields(current), status: 'cancelled' },
  });

  await notifyReservationCancelled(id, current.user_email);

  return { success: true };
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
      (siteNumber): siteNumber is string => typeof siteNumber === 'string' && siteNumber.trim().length > 0,
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
  const totalRequestedSiteCount = planItems.reduce((sum, item) => sum + item.siteCount, 0) || 1;

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
  ] as const;

  for (const key of keys) {
    const b = before[key];
    const a = after[key];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      changes[key] = { from: b, to: a };
    }
  }
  return changes;
}
