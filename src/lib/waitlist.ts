import type { AdminPlan, WaitlistExcludedPeriod } from '@/types/admin';
import type { Database } from '@/types/database';

type ReservationStatus = Database['public']['Enums']['reservation_status'];

export type WaitlistStatus = 'waiting' | 'candidate' | 'promoted' | 'closed';

export function isWaitlistReservationStatus(status: ReservationStatus | null | undefined) {
  return status === 'waitlisted';
}

export function isInventoryReservationStatus(status: ReservationStatus | null | undefined) {
  return status !== 'cancelled' && status !== 'waitlisted';
}

export function isOpenWaitlistStatus(status: string | null | undefined) {
  return status === 'waiting' || status === 'candidate';
}

function rangesOverlap(startA: string, endA: string, startB: string, endB: string) {
  return startA < endB && endA > startB;
}

function isExcludedByPeriods(
  periods: WaitlistExcludedPeriod[],
  checkInDate: string,
  checkOutDate: string,
) {
  return periods.some((period) => rangesOverlap(checkInDate, checkOutDate, period.startDate, period.endDate));
}

export interface WaitlistEvaluationResult {
  isEnabled: boolean;
  isAccepting: boolean;
  reason: string | null;
  activeCount: number;
  remainingCapacity: number;
  message: string | null;
}

export function evaluatePlanWaitlist(params: {
  plan: AdminPlan;
  checkInDate: string;
  checkOutDate: string;
  activeCount: number;
}) {
  const { plan, checkInDate, checkOutDate, activeCount } = params;

  if (!plan.waitlistEnabled) {
    return {
      isEnabled: false,
      isAccepting: false,
      reason: null,
      activeCount,
      remainingCapacity: 0,
      message: null,
    } satisfies WaitlistEvaluationResult;
  }

  if (plan.waitlistStartDate && checkInDate < plan.waitlistStartDate) {
    return {
      isEnabled: true,
      isAccepting: false,
      reason: `${plan.waitlistStartDate} からキャンセル待ち受付開始`,
      activeCount,
      remainingCapacity: Math.max(0, plan.waitlistMaxCount - activeCount),
      message: plan.waitlistMessage || null,
    } satisfies WaitlistEvaluationResult;
  }

  if (plan.waitlistEndDate && checkInDate > plan.waitlistEndDate) {
    return {
      isEnabled: true,
      isAccepting: false,
      reason: 'キャンセル待ち受付期間外です',
      activeCount,
      remainingCapacity: 0,
      message: plan.waitlistMessage || null,
    } satisfies WaitlistEvaluationResult;
  }

  if (isExcludedByPeriods(plan.waitlistExcludedPeriods, checkInDate, checkOutDate)) {
    return {
      isEnabled: true,
      isAccepting: false,
      reason: 'この日程はキャンセル待ち対象外です',
      activeCount,
      remainingCapacity: Math.max(0, plan.waitlistMaxCount - activeCount),
      message: plan.waitlistMessage || null,
    } satisfies WaitlistEvaluationResult;
  }

  const remainingCapacity = Math.max(0, plan.waitlistMaxCount - activeCount);
  return {
    isEnabled: true,
    isAccepting: remainingCapacity > 0,
    reason: remainingCapacity > 0 ? null : 'キャンセル待ち受付上限に達しています',
    activeCount,
    remainingCapacity,
    message: plan.waitlistMessage || null,
  } satisfies WaitlistEvaluationResult;
}

export function getWaitlistStatusLabel(status: string | null | undefined) {
  switch (status) {
    case 'candidate':
      return '追加候補';
    case 'promoted':
      return '繰り上げ済み';
    case 'closed':
      return '受付終了';
    case 'waiting':
    default:
      return '受付中';
  }
}
