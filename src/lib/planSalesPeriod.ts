import type { AdminPlan } from '@/types/admin';

interface PlanBookablePeriodResult {
  isAvailable: boolean;
  reason: string | null;
}

function toDate(date: string) {
  return new Date(`${date}T00:00:00Z`);
}

function toIsoDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function getStayDates(checkInDate: string, checkOutDate: string) {
  const dates: string[] = [];
  const current = toDate(checkInDate);
  const end = toDate(checkOutDate);

  while (current < end) {
    dates.push(toIsoDate(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

function buildRangeLabel(start: string | null, end: string | null) {
  if (start && end) return `${start} 〜 ${end}`;
  if (start) return `${start} 以降`;
  if (end) return `${end} まで`;
  return '未設定';
}

export function evaluatePlanBookablePeriod(
  plan: Pick<AdminPlan, 'salesStartDate' | 'salesEndDate'>,
  checkInDate: string,
  checkOutDate: string,
): PlanBookablePeriodResult {
  const start = plan.salesStartDate || null;
  const end = plan.salesEndDate || null;

  if (!checkInDate || !checkOutDate || checkOutDate <= checkInDate) {
    return {
      isAvailable: false,
      reason: '宿泊日が正しく設定されていません。',
    };
  }

  const stayDates = getStayDates(checkInDate, checkOutDate);
  const isOutsideRange = stayDates.some((date) => {
    if (start && date < start) return true;
    if (end && date > end) return true;
    return false;
  });

  if (isOutsideRange) {
    return {
      isAvailable: false,
      reason: `予約可能期間外です（${buildRangeLabel(start, end)} の宿泊日が予約対象です）`,
    };
  }

  return {
    isAvailable: true,
    reason: null,
  };
}
