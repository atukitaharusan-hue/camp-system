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
  siteNumber: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  specialRequests: string;
  totalAmount: number;
  adminEmail?: string;
}

export type AdminCreateResult =
  | { success: true; reservation: GuestReservationRow }
  | { success: false; error: string };

export function validateAdminReservation(input: AdminReservationInput): string | null {
  if (!input.userName.trim()) return '予約者名を入力してください';
  if (!input.planId.trim()) return 'プランを選択してください';
  if (!input.checkInDate) return 'チェックイン日を入力してください';
  if (!input.checkOutDate) return 'チェックアウト日を入力してください';
  if (input.checkOutDate <= input.checkInDate) return 'チェックアウト日はチェックイン日より後の日付を選択してください';
  if (input.guests < 1) return '人数は1名以上で入力してください';
  if (input.totalAmount < 0) return '金額は0円以上で入力してください';
  return null;
}

function buildCustomerMemo(input: AdminReservationInput) {
  const lines = [
    `プランID: ${input.planId || '-'}`,
    `性別: ${input.gender || '未回答'}`,
    `職業: ${input.occupation || '-'}`,
    `郵便番号: ${input.postalCode || '-'}`,
    `都道府県: ${input.prefecture || '-'}`,
    `市区町村: ${input.city || '-'}`,
    `番地: ${input.addressLine || '-'}`,
    `建物名・部屋番号: ${input.buildingName || '-'}`,
    `LINEアカウント名: ${input.lineDisplayName || '-'}`,
    `LINE ID: ${input.lineId || '-'}`,
    `知ったきっかけ: ${input.referralSource || '-'}`,
  ];

  if (input.specialRequests.trim()) {
    lines.push(`備考: ${input.specialRequests.trim()}`);
  }

  return lines.join('\n');
}

export async function createAdminReservation(input: AdminReservationInput): Promise<AdminCreateResult> {
  const formError = validateAdminReservation(input);
  if (formError) {
    return { success: false, error: formError };
  }

  if (input.siteNumber.trim()) {
    const validation = await validateReservation({
      siteNumber: input.siteNumber,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      guests: input.guests,
      source: 'admin',
      planId: input.planId,
    });

    if (!validation.valid) {
      return { success: false, error: formatAdminErrors(validation.errors) };
    }
  }

  const nights = calculateNights(input.checkInDate, input.checkOutDate);

  const { data, error } = await supabase
    .from('guest_reservations')
    .insert({
      user_name: input.userName.trim(),
      user_phone: input.userPhone.trim() || null,
      user_email: input.userEmail.trim() || null,
      check_in_date: input.checkInDate,
      check_out_date: input.checkOutDate,
      nights,
      guests: input.guests,
      site_number: input.siteNumber.trim() || null,
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
    return { success: false, error: error.message ?? '手動予約の登録に失敗しました' };
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
        site_number: data.site_number,
      },
    });
  }

  await notifyReservationCreated(data.id, input.userEmail || null);

  return { success: true, reservation: data };
}
