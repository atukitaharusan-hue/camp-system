import { supabase } from '@/lib/supabase';
import { generateQrToken } from '@/lib/generateQrToken';
import { calculateNights, formatAdminErrors, validateReservation } from '@/lib/validateReservation';
import { logAdminAction } from '@/lib/admin/actionLog';
import { notifyReservationCreated } from '@/lib/admin/notificationLog';
import type { Database } from '@/types/database';

type GuestReservationRow = Database['public']['Tables']['guest_reservations']['Row'];
type PaymentMethod = Database['public']['Enums']['payment_method'];
type PaymentStatus = Database['public']['Enums']['payment_status'];

export interface AdminReservationInput {
  userName: string;
  userPhone: string;
  userEmail: string;
  planId: string;
  gender: string;
  occupation: string;
  postalCode: string;
  prefecture: string;
  city: string;
  addressLine: string;
  buildingName: string;
  lineDisplayName: string;
  lineId: string;
  referralSource: string;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  adults: number;
  children: number;
  infants: number;
  siteNumber: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  specialRequests: string;
  totalAmount: number;
  requestedSiteCount?: number;
  planItems?: Array<{
    planId: string;
    siteCount: number;
    siteNumbers: string[];
  }>;
  adminEmail?: string;
}

export type AdminCreateResult =
  | { success: true; reservation: GuestReservationRow }
  | { success: false; error: string };

export function validateAdminReservation(input: AdminReservationInput): string | null {
  if (!input.userName.trim()) return '予約者名を入力してください。';
  if (!input.planId.trim()) return 'プランを選択してください。';
  if (!input.checkInDate) return 'チェックイン日を入力してください。';
  if (!input.checkOutDate) return 'チェックアウト日を入力してください。';
  if (input.checkOutDate <= input.checkInDate) {
    return 'チェックアウト日はチェックイン日より後の日付にしてください。';
  }
  if (input.adults < 1) return '大人(中学生以上)人数は1名以上で入力してください。';
  if (input.children < 0) return '子ども人数は0名以上で入力してください。';
  if (input.infants < 0) return '幼児人数は0名以上で入力してください。';
  if (input.guests !== input.adults + input.children + input.infants) {
  return '人数合計が一致していません。大人(中学生以上)・子ども・幼児の人数を確認してください。';
  }
  if (input.totalAmount < 0) return '金額は0円以上で入力してください。';
  return null;
}

function buildCustomerMemo(input: AdminReservationInput) {
  const normalizedPlanItems = normalizePlanItems(input);
  return [
    `PLAN_ID: ${input.planId}`,
    `REQUESTED_SITE_COUNT: ${getTotalRequestedSiteCount(input)}`,
    `SELECTED_SITE_NUMBERS: ${getAllSelectedSiteNumbers(input).join(',')}`,
    `MULTI_PLAN_ITEMS: ${JSON.stringify(normalizedPlanItems)}`,
    `GENDER: ${input.gender || ''}`,
    `OCCUPATION: ${input.occupation || ''}`,
    `POSTAL_CODE: ${input.postalCode || ''}`,
    `PREFECTURE: ${input.prefecture || ''}`,
    `CITY: ${input.city || ''}`,
    `ADDRESS_LINE: ${input.addressLine || ''}`,
    `BUILDING: ${input.buildingName || ''}`,
    `LINE_NAME: ${input.lineDisplayName || ''}`,
    `LINE_ID: ${input.lineId || ''}`,
    `REFERRAL_SOURCE: ${input.referralSource || ''}`,
    input.specialRequests.trim() ? `NOTE: ${input.specialRequests.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function normalizePlanItems(input: AdminReservationInput) {
  const sourceItems = input.planItems?.length
    ? input.planItems
    : [
        {
          planId: input.planId,
          siteCount: input.requestedSiteCount ?? 1,
          siteNumbers: input.siteNumber ? [input.siteNumber] : [],
        },
      ];

  return sourceItems
    .map((item) => {
      const siteCount = Math.max(1, Math.trunc(Number(item.siteCount || 1)));
      const siteNumbers = item.siteNumbers
        .map((siteNumber) => siteNumber.trim())
        .filter((siteNumber) => siteNumber.length > 0)
        .slice(0, siteCount);
      return {
        planId: item.planId.trim(),
        siteCount,
        siteNumbers,
      };
    })
    .filter((item) => item.planId.length > 0);
}

function getTotalRequestedSiteCount(input: AdminReservationInput) {
  const planItems = normalizePlanItems(input);
  return planItems.reduce((sum, item) => sum + item.siteCount, 0) || 1;
}

function getAllSelectedSiteNumbers(input: AdminReservationInput) {
  return Array.from(
    new Set(normalizePlanItems(input).flatMap((item) => item.siteNumbers)),
  );
}

export async function createAdminReservation(input: AdminReservationInput): Promise<AdminCreateResult> {
  const formError = validateAdminReservation(input);
  if (formError) {
    return { success: false, error: formError };
  }

  const planItems = normalizePlanItems(input);
  if (planItems.length === 0) {
    return { success: false, error: 'プランを1つ以上選択してください。' };
  }

  const allSelectedSiteNumbersForValidation = getAllSelectedSiteNumbers(input);
  const rawSelectedCount = planItems.reduce((sum, item) => sum + item.siteNumbers.length, 0);
  if (allSelectedSiteNumbersForValidation.length !== rawSelectedCount) {
    return { success: false, error: '同じサイト番号を複数のプランで重複して選択することはできません。' };
  }

  const validationErrors: string[] = [];
  for (const item of planItems) {
    const validation = await validateReservation({
      siteNumber: item.siteNumbers[0] ?? '',
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      guests: input.guests,
      source: 'admin',
      planId: item.planId,
      requestedSiteCount: item.siteCount,
      selectedSiteNumbers: item.siteNumbers,
    });

    if (!validation.valid) {
      validationErrors.push(formatAdminErrors(validation.errors));
    }
  }

  if (validationErrors.length > 0) {
    return { success: false, error: validationErrors.join('\n') };
  }

  const nights = calculateNights(input.checkInDate, input.checkOutDate);
  const primaryPlanId = planItems[0]?.planId ?? input.planId;
  const selectedSiteNumbers = getAllSelectedSiteNumbers(input);
  const totalRequestedSiteCount = getTotalRequestedSiteCount(input);

  const { data, error } = await supabase
    .from('guest_reservations')
    .insert({
      user_name: input.userName.trim(),
      user_phone: input.userPhone.trim() || null,
      user_email: input.userEmail.trim() || null,
      plan_id: primaryPlanId,
      check_in_date: input.checkInDate,
      check_out_date: input.checkOutDate,
      nights,
      guests: input.guests,
      adults: input.adults,
      children: input.children,
      infants: input.infants,
      reserved_site_count: totalRequestedSiteCount,
      selected_site_numbers: selectedSiteNumbers,
      site_number: selectedSiteNumbers[0] ?? null,
      total_amount: input.totalAmount,
      status: 'confirmed',
      payment_method: input.paymentMethod,
      payment_status: input.paymentStatus,
      qr_token: generateQrToken(),
      options_json: [],
      agreed_cancellation: true,
      agreed_terms: true,
      agreed_sns: false,
      special_requests: buildCustomerMemo(input),
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message ?? '予約の保存に失敗しました。' };
  }

  if (input.adminEmail) {
    await logAdminAction({
      adminEmail: input.adminEmail,
      actionType: 'reservation_create',
      targetType: 'reservation',
      targetId: data.id,
      after: {
        user_name: data.user_name,
        check_in_date: data.check_in_date,
        check_out_date: data.check_out_date,
        guests: data.guests,
        adults: data.adults,
        children: data.children,
        infants: data.infants,
        site_number: data.site_number,
        reserved_site_count: data.reserved_site_count,
        plan_items: planItems,
      },
    });
  }

  await notifyReservationCreated(data.id, input.userEmail || null);

  return { success: true, reservation: data };
}
