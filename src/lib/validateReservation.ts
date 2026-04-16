import { supabase } from '@/lib/supabase';
import { dummyPlans, dummySalesRule, dummySites } from '@/data/adminDummyData';
import {
  ADMIN_PLANS_KEY,
  ADMIN_RULES_KEY,
  ADMIN_SITES_KEY,
  readJsonStorage,
} from '@/lib/admin/browserStorage';

export type ReservationSource = 'web' | 'admin' | 'import' | 'admin_update';

export interface ReservationValidationInput {
  siteNumber: string;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  source: ReservationSource;
  planId?: string | null;
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

function getRuntimePlans() {
  return readJsonStorage(ADMIN_PLANS_KEY, dummyPlans);
}

function getRuntimeSites() {
  return readJsonStorage(ADMIN_SITES_KEY, dummySites);
}

function getRuntimeSalesRule() {
  return readJsonStorage(ADMIN_RULES_KEY, dummySalesRule);
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
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
    date.getUTCDate(),
  ).padStart(2, '0')}`;
}

export function parseSiteNumber(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.startsWith('!')) {
    return { siteNumber: trimmed.slice(1), designationRequested: true };
  }
  return { siteNumber: trimmed, designationRequested: false };
}

function getStayDates(checkIn: string, checkOut: string) {
  const dates: string[] = [];
  const cursor = toDate(checkIn);
  const end = toDate(checkOut);

  while (cursor < end) {
    dates.push(
      `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}-${String(
        cursor.getUTCDate(),
      ).padStart(2, '0')}`,
    );
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
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
      `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}-${String(
        cursor.getUTCDate(),
      ).padStart(2, '0')}`,
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
      return buildError(
        'OVERLAP_CHECK_ERROR',
        '重複チェック中にエラーが発生しました。',
        `重複チェックエラー: ${error.message}`,
      );
    }

    if (data && data.length > 0) {
      const existing = data[0];
      return buildError(
        'DUPLICATE_RESERVATION',
        '同じサイト・同じ日程の予約がすでに入っています。別の日程を選んでください。',
        `サイト ${siteNumber} は ${existing.check_in_date} から ${existing.check_out_date} に既存予約があります。`,
      );
    }

    return null;
  } catch (error) {
    if (source === 'admin' || source === 'admin_update' || source === 'import') {
      return null;
    }
    const message = error instanceof Error ? error.message : 'unknown error';
    return buildError(
      'OVERLAP_CHECK_ERROR',
      '重複チェック中に通信エラーが発生しました。',
      `重複チェックエラー: ${message}`,
    );
  }
}

export async function validateReservation(input: ReservationValidationInput): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const runtimeSites = getRuntimeSites();
  const runtimePlans = getRuntimePlans();
  const runtimeSalesRule = getRuntimeSalesRule();

  if (!input.checkInDate || !input.checkOutDate || input.checkOutDate <= input.checkInDate) {
    return {
      valid: false,
      errors: [
        buildError('INVALID_DATE_ORDER', 'チェックアウト日はチェックイン日より後の日付を選択してください。'),
      ],
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
    errors.push(buildError('CLOSED_DATE', `受付停止日に重なっています: ${blockedDates.join(', ')}`));
  }

  const blockedRanges = runtimeSalesRule.closedDateRanges.filter((range) =>
    getRangeDates(range.startDate, range.endDate).some((date) => stayDates.includes(date)),
  );
  if (blockedRanges.length > 0) {
    errors.push(
      buildError(
        'CLOSED_DATE',
        '受付停止期間に重なっています。',
        `停止期間: ${blockedRanges.map((range) => `${range.startDate} - ${range.endDate} (${range.reason})`).join(', ')}`,
      ),
    );
  }

  if (!input.siteNumber.trim()) {
    return { valid: errors.length === 0, errors, nights };
  }

  const site = runtimeSites.find((item) => item.siteNumber === input.siteNumber);
  if (!site) {
    return {
      valid: false,
      errors: [buildError('SITE_NOT_FOUND', '選択されたサイトが見つかりません。')],
      nights,
    };
  }

  if (input.source === 'web' && !site.isPublished) {
    errors.push(buildError('SITE_NOT_PUBLISHED', 'このサイトは現在公開されていません。'));
  }

  if (site.status !== 'active') {
    errors.push(buildError('SITE_UNAVAILABLE', 'このサイトは現在予約できません。'));
  }

  if (input.guests > site.capacity) {
    errors.push(buildError('CAPACITY_EXCEEDED', `このサイトの定員は${site.capacity}名です。`));
  }

  if (input.source === 'web' && input.planId) {
    const plan = runtimePlans.find((item) => item.id === input.planId);
    if (plan && !plan.isPublished) {
      errors.push(buildError('PLAN_NOT_PUBLISHED', 'このプランは現在公開されていません。'));
    }
  }

  const matchingSiteClosures = runtimeSalesRule.siteClosures.filter(
    (item) => item.siteNumber === input.siteNumber,
  );
  const blockedSiteClosures = matchingSiteClosures.filter((closure) =>
    closure.dates.some((date) => stayDates.includes(date)),
  );
  if (blockedSiteClosures.length > 0) {
    errors.push(
      buildError(
        'SITE_CLOSED_DATE',
        `${input.siteNumber} は停止日に設定されています。`,
        blockedSiteClosures
          .map((closure) => `${closure.siteNumber}: ${closure.startDate} - ${closure.endDate} / ${closure.reason}`)
          .join(', '),
      ),
    );
  }

  if (errors.length > 0) {
    return { valid: false, errors, nights };
  }

  const overlapError = await checkOverlap(
    input.siteNumber,
    input.checkInDate,
    input.checkOutDate,
    input.source,
    input.excludeReservationId,
  );

  if (overlapError) {
    errors.push(overlapError);
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
