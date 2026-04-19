import { supabase } from '@/lib/supabase';
import { fetchPlans, fetchSalesRule, fetchSites } from '@/lib/admin/fetchData';
import { getStayDates, validateInventory } from '@/lib/bookingAvailability';

export type ReservationSource = 'web' | 'admin' | 'import' | 'admin_update';

export interface ReservationValidationInput {
  siteNumber: string;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  source: ReservationSource;
  planId?: string | null;
  requestedSiteCount?: number;
  selectedSiteNumbers?: string[];
  excludeReservationId?: string;
}

export interface ValidationError {
  code: string;
  message: string;
  adminMessage: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  nights: number;
}

function toDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

export function calculateNights(checkIn: string, checkOut: string): number {
  return Math.ceil((toDate(checkOut).getTime() - toDate(checkIn).getTime()) / (1000 * 60 * 60 * 24));
}

export function deriveCheckOutDate(checkIn: string, nights: number): string {
  const date = toDate(checkIn);
  date.setUTCDate(date.getUTCDate() + nights);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function parseSiteNumber(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.startsWith('!')) {
    return { siteNumber: trimmed.slice(1), designationRequested: true };
  }
  return { siteNumber: trimmed, designationRequested: false };
}

function buildError(code: string, message: string, adminMessage = message): ValidationError {
  return { code, message, adminMessage };
}

function getRangeDates(startDate: string, endDate: string) {
  const dates: string[] = [];
  const cursor = toDate(startDate);
  const end = toDate(endDate);

  while (cursor <= end) {
    dates.push(
      `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}-${String(cursor.getUTCDate()).padStart(2, '0')}`,
    );
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

async function checkOverlap(
  siteNumber: string,
  checkIn: string,
  checkOut: string,
  source: ReservationSource,
  excludeReservationId?: string,
): Promise<ValidationError | null> {
  try {
    let query = supabase
      .from('guest_reservations')
      .select('id, check_in_date, check_out_date')
      .eq('site_number', siteNumber)
      .not('status', 'eq', 'cancelled')
      .lt('check_in_date', checkOut)
      .gt('check_out_date', checkIn)
      .limit(1);

    if (excludeReservationId) {
      query = query.not('id', 'eq', excludeReservationId);
    }

    const { data, error } = await query;

    if (error) {
      if (source === 'admin' || source === 'admin_update' || source === 'import') {
        return null;
      }
      return buildError('OVERLAP_CHECK_ERROR', '重複予約の確認に失敗しました。', `重複確認エラー: ${error.message}`);
    }

    if (data && data.length > 0) {
      const existing = data[0];
      return buildError(
        'DUPLICATE_RESERVATION',
        '指定したサイトは選択日程で予約済みです。',
        `サイト ${siteNumber} は ${existing.check_in_date} - ${existing.check_out_date} に予約済みです。`,
      );
    }

    return null;
  } catch (error) {
    if (source === 'admin' || source === 'admin_update' || source === 'import') {
      return null;
    }
    const message = error instanceof Error ? error.message : 'unknown error';
    return buildError('OVERLAP_CHECK_ERROR', '重複予約の確認に失敗しました。', `重複確認エラー: ${message}`);
  }
}

export async function validateReservation(input: ReservationValidationInput): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const [runtimeSites, runtimePlans, runtimeSalesRule] = await Promise.all([
    fetchSites(),
    fetchPlans(),
    fetchSalesRule(),
  ]);

  if (!input.checkInDate || !input.checkOutDate || input.checkOutDate <= input.checkInDate) {
    return {
      valid: false,
      errors: [buildError('INVALID_DATE_ORDER', 'チェックアウト日はチェックイン日より後の日付を選択してください。')],
      nights: 0,
    };
  }

  const nights = calculateNights(input.checkInDate, input.checkOutDate);

  if (input.guests < 1) {
    errors.push(buildError('INVALID_GUESTS', '人数は1名以上で入力してください。'));
  }

  const stayDates = getStayDates(input.checkInDate, input.checkOutDate);

  const blockedDates = stayDates.filter((date) => runtimeSalesRule.closedDates.includes(date));
  if (blockedDates.length > 0) {
    errors.push(buildError('CLOSED_DATE', `休業日のため予約できません: ${blockedDates.join(', ')}`));
  }

  const blockedRanges = runtimeSalesRule.closedDateRanges.filter((range) =>
    getRangeDates(range.startDate, range.endDate).some((date) => stayDates.includes(date)),
  );
  if (blockedRanges.length > 0) {
    errors.push(
      buildError(
        'CLOSED_RANGE',
        '休業期間が含まれているため予約できません。',
        blockedRanges.map((range) => `${range.startDate} - ${range.endDate} (${range.reason || 'closed'})`).join(', '),
      ),
    );
  }

  if (!input.siteNumber.trim() && !input.planId) {
    return { valid: errors.length === 0, errors, nights };
  }

  const normalizedSiteNumber = input.siteNumber.trim();
  const site = normalizedSiteNumber ? runtimeSites.find((item) => item.siteNumber === normalizedSiteNumber) : null;
  if (normalizedSiteNumber && !site) {
    return {
      valid: false,
      errors: [buildError('SITE_NOT_FOUND', '指定したサイトが見つかりません。')],
      nights,
    };
  }

  if (site && input.source === 'web' && !site.isPublished) {
    errors.push(buildError('SITE_NOT_PUBLISHED', '公開されていないサイトです。'));
  }

  if (site && site.status !== 'active') {
    errors.push(buildError('SITE_UNAVAILABLE', 'このサイトは現在利用できません。'));
  }

  if (site && input.guests > site.capacity) {
    errors.push(buildError('CAPACITY_EXCEEDED', `このサイトの定員は ${site.capacity} 名です。`));
  }

  if (input.source === 'web' && input.planId) {
    const plan = runtimePlans.find((item) => item.id === input.planId);
    if (plan && !plan.isPublished) {
      errors.push(buildError('PLAN_NOT_PUBLISHED', '公開されていないプランです。'));
    }
  }

  if (normalizedSiteNumber) {
    const matchingSiteClosures = runtimeSalesRule.siteClosures.filter((item) => item.siteNumber === normalizedSiteNumber);
    const blockedSiteClosures = matchingSiteClosures.filter((closure) => closure.dates.some((date) => stayDates.includes(date)));
    if (blockedSiteClosures.length > 0) {
      errors.push(
        buildError(
          'SITE_CLOSED_DATE',
          `${normalizedSiteNumber} は選択日程では利用できません。`,
          blockedSiteClosures.map((closure) => `${closure.startDate} - ${closure.endDate} / ${closure.reason || 'closed'}`).join(', '),
        ),
      );
    }
  }

  if (input.planId) {
    const inventory = await validateInventory({
      planId: input.planId,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      requestedSiteCount: input.requestedSiteCount ?? 1,
      guests: input.guests,
      selectedSiteNumbers: input.selectedSiteNumbers ?? (normalizedSiteNumber ? [normalizedSiteNumber] : []),
      excludeReservationId: input.excludeReservationId,
    });

    if (!inventory.valid) {
      errors.push(...inventory.errors.map((message) => buildError('PLAN_INVENTORY_EXCEEDED', message, message)));
    }
  } else if (normalizedSiteNumber) {
    const overlapError = await checkOverlap(
      normalizedSiteNumber,
      input.checkInDate,
      input.checkOutDate,
      input.source,
      input.excludeReservationId,
    );

    if (overlapError) {
      errors.push(overlapError);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    nights,
  };
}

export function formatUserErrors(errors: ValidationError[]): string {
  return errors.map((error) => error.message).join('\n');
}

export function formatAdminErrors(errors: ValidationError[]): string {
  return errors.map((error) => `[${error.code}] ${error.adminMessage}`).join('\n');
}
