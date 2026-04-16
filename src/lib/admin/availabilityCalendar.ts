import type { AdminPlan, AdminSite } from '@/types/admin';
import type { Database } from '@/types/database';

export const DEFAULT_WARNING_RATIO = 0.3;

type ReservationRow = Database['public']['Tables']['guest_reservations']['Row'];

export type AvailabilityMark = '〇' | '△' | '×';

export type AvailabilityCell = {
  date: string;
  planId: string;
  planName: string;
  capacity: number;
  reserved: number;
  available: number;
  remainingRatio: number;
  mark: AvailabilityMark;
};

export function formatIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getMonthStart(monthKey: string) {
  return new Date(`${monthKey}-01T00:00:00`);
}

export function getMonthDates(monthKey: string) {
  const start = getMonthStart(monthKey);
  const month = start.getMonth();
  const dates: string[] = [];
  const cursor = new Date(start);

  while (cursor.getMonth() === month) {
    dates.push(formatIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

export function getMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-');
  return `${year}年${Number(month)}月`;
}

export function getCurrentMonthKey(baseDate = new Date()) {
  return `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}`;
}

export function isReservationActiveOnDate(reservation: ReservationRow, date: string) {
  return reservation.check_in_date <= date && reservation.check_out_date > date;
}

function reservationMatchesPlan(reservation: ReservationRow, planSiteNumbers: Set<string>) {
  if (!reservation.site_number) return false;
  return planSiteNumbers.has(reservation.site_number);
}

export function getAvailabilityMark(available: number, capacity: number) {
  if (available <= 0 || capacity <= 0) {
    return '×';
  }

  const remainingRatio = available / capacity;
  return remainingRatio <= DEFAULT_WARNING_RATIO ? '△' : '〇';
}

export function buildAvailabilityCells(
  reservations: ReservationRow[],
  dates: string[],
  plans: AdminPlan[],
  sites: AdminSite[],
): AvailabilityCell[] {
  return dates.flatMap((date) =>
    plans.map((plan) => {
      const planSiteNumbers = new Set(
        plan.targetSiteIds
          .map((siteId) => sites.find((site) => site.id === siteId)?.siteNumber)
          .filter((value): value is string => Boolean(value)),
      );

      const reserved = reservations.filter(
        (reservation) =>
          reservation.status !== 'cancelled' &&
          isReservationActiveOnDate(reservation, date) &&
          reservationMatchesPlan(reservation, planSiteNumbers),
      ).length;

      const available = Math.max(plan.capacity - reserved, 0);
      const remainingRatio = plan.capacity > 0 ? available / plan.capacity : 0;

      return {
        date,
        planId: plan.id,
        planName: plan.name,
        capacity: plan.capacity,
        reserved,
        available,
        remainingRatio,
        mark: getAvailabilityMark(available, plan.capacity),
      };
    }),
  );
}
