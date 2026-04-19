import { supabase } from '@/lib/supabase';
import { fetchPlans, fetchSalesRule, fetchSites } from '@/lib/admin/fetchData';
import { evaluatePlanBookablePeriod } from '@/lib/planSalesPeriod';
import type { AdminPlan, AdminSite, SalesRule } from '@/types/admin';
import type { Database } from '@/types/database';

type ReservationRow = Database['public']['Tables']['guest_reservations']['Row'];

const AVAILABILITY_CONTEXT_TTL_MS = 5_000;
const availabilityContextCache = new Map<
  string,
  {
    expiresAt: number;
    promise: Promise<{
      plans: AdminPlan[];
      sites: AdminSite[];
      salesRule: SalesRule;
      reservations: ReservationRow[];
    }>;
  }
>();

export const LOW_STOCK_RATIO = 0.1;

export type AvailabilityMark = 'circle' | 'triangle' | 'full';

export interface PlanAvailabilityDay {
  date: string;
  planId: string;
  capacity: number;
  reservedSites: number;
  concurrentReservations: number;
  remainingConcurrentReservations: number;
  availableSites: number;
  mark: AvailabilityMark;
}

export interface PlanAvailabilitySummary {
  planId: string;
  planName: string;
  availableSites: number;
  maxSiteCount: number;
  maxConcurrentReservations: number;
  maxGuestsPerReservation: number;
  remainingConcurrentReservations: number;
}

export interface InventoryValidationInput {
  planId: string;
  checkInDate: string;
  checkOutDate: string;
  requestedSiteCount: number;
  guests: number;
  selectedSiteNumbers?: string[];
  excludeReservationId?: string;
  skipSalesWindow?: boolean;
}

export interface InventoryValidationResult {
  valid: boolean;
  errors: string[];
  availableSiteCount: number;
}

function toIsoDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function getStayDates(checkInDate: string, checkOutDate: string) {
  const dates: string[] = [];
  const current = new Date(`${checkInDate}T00:00:00Z`);
  const end = new Date(`${checkOutDate}T00:00:00Z`);

  while (current < end) {
    dates.push(toIsoDate(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

function isActiveReservation(reservation: ReservationRow) {
  return reservation.status !== 'cancelled';
}

function overlaps(reservation: ReservationRow, checkInDate: string, checkOutDate: string) {
  return reservation.check_in_date < checkOutDate && reservation.check_out_date > checkInDate;
}

function getReservedSiteCount(reservation: ReservationRow) {
  const value = reservation.reserved_site_count;
  return typeof value === 'number' && value > 0 ? value : 1;
}

function getSelectedSiteNumbers(reservation: ReservationRow) {
  if (Array.isArray(reservation.selected_site_numbers)) {
    return reservation.selected_site_numbers.filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    );
  }
  return reservation.site_number ? [reservation.site_number] : [];
}

function extractPlanId(reservation: ReservationRow) {
  if (reservation.plan_id) return reservation.plan_id;
  const memo = reservation.special_requests ?? '';
  const match = memo.match(/PLAN_ID:\s*([A-Za-z0-9-]+)/);
  return match?.[1] ?? null;
}

function buildPlanSiteMap(plans: AdminPlan[]) {
  return new Map(plans.map((plan) => [plan.id, new Set(plan.targetSiteIds)]));
}

function buildSiteLookup(sites: AdminSite[]) {
  return new Map(sites.map((site) => [site.id, site]));
}

function getClosedSiteIdsByDate(rule: SalesRule, date: string) {
  return new Set(
    rule.siteClosures
      .filter((closure) => closure.dates.includes(date))
      .map((closure) => closure.siteId),
  );
}

function getPlanCapacityForDate(plan: AdminPlan, sites: AdminSite[], rule: SalesRule, date: string) {
  const closedSiteIds = getClosedSiteIdsByDate(rule, date);
  const activeTargetSiteCount = sites.filter(
    (site) =>
      plan.targetSiteIds.includes(site.id) &&
      site.status === 'active' &&
      site.isPublished &&
      !closedSiteIds.has(site.id),
  ).length;

  const configuredLimit = plan.maxSiteCount > 0 ? plan.maxSiteCount : plan.capacity;
  return Math.max(0, Math.min(configuredLimit, activeTargetSiteCount));
}

function resolveReservationPlanId(
  reservation: ReservationRow,
  planSiteMap: Map<string, Set<string>>,
  siteLookup: Map<string, AdminSite>,
) {
  const explicitPlanId = extractPlanId(reservation);
  if (explicitPlanId) return explicitPlanId;

  if (!reservation.site_number) return null;

  for (const [planId, siteIds] of planSiteMap.entries()) {
    for (const siteId of siteIds) {
      const site = siteLookup.get(siteId);
      if (site?.siteNumber === reservation.site_number) {
        return planId;
      }
    }
  }

  return null;
}

function getPlanReservationMetricsForDate({
  date,
  planId,
  reservations,
  planSiteMap,
  siteLookup,
}: {
  date: string;
  planId: string;
  reservations: ReservationRow[];
  planSiteMap: Map<string, Set<string>>;
  siteLookup: Map<string, AdminSite>;
}) {
  const matchingReservations = reservations.filter(
    (reservation) =>
      reservation.check_in_date <= date &&
      reservation.check_out_date > date &&
      resolveReservationPlanId(reservation, planSiteMap, siteLookup) === planId,
  );

  return {
    matchingReservations,
    reservedSites: matchingReservations.reduce(
      (sum, reservation) => sum + getReservedSiteCount(reservation),
      0,
    ),
    concurrentReservations: matchingReservations.length,
  };
}

async function fetchOverlappingReservations(checkInDate: string, checkOutDate: string) {
  const { data, error } = await supabase
    .from('guest_reservations')
    .select('*')
    .not('status', 'eq', 'cancelled')
    .lt('check_in_date', checkOutDate)
    .gt('check_out_date', checkInDate);

  if (error) throw error;
  return data ?? [];
}

async function loadAvailabilityContext(checkInDate: string, checkOutDate: string) {
  const cacheKey = `${checkInDate}:${checkOutDate}`;
  const cached = availabilityContextCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.promise;
  }

  const promise = Promise.all([
    fetchPlans(),
    fetchSites(),
    fetchSalesRule(),
    fetchOverlappingReservations(checkInDate, checkOutDate),
  ])
    .then(([plans, sites, salesRule, reservations]) => ({
      plans,
      sites,
      salesRule,
      reservations,
    }))
    .catch((error) => {
      availabilityContextCache.delete(cacheKey);
      throw error;
    });

  availabilityContextCache.set(cacheKey, {
    expiresAt: Date.now() + AVAILABILITY_CONTEXT_TTL_MS,
    promise,
  });

  return promise;
}

export async function getPlanAvailabilityForStay(checkInDate: string, checkOutDate: string) {
  const { plans, sites, salesRule, reservations } = await loadAvailabilityContext(
    checkInDate,
    checkOutDate,
  );
  const stayDates = getStayDates(checkInDate, checkOutDate);
  const siteLookup = buildSiteLookup(sites);
  const planSiteMap = buildPlanSiteMap(plans);
  const activeReservations = reservations.filter(isActiveReservation);
  return plans.map((plan): PlanAvailabilitySummary => {
    const salesWindow = evaluatePlanBookablePeriod(plan, checkInDate, checkOutDate);
    let minAvailableSites = Number.POSITIVE_INFINITY;
    let minRemainingConcurrentReservations = Number.POSITIVE_INFINITY;

    for (const date of stayDates) {
      const { reservedSites, concurrentReservations } = getPlanReservationMetricsForDate({
        date,
        planId: plan.id,
        reservations: activeReservations,
        planSiteMap,
        siteLookup,
      });
      const capacity = getPlanCapacityForDate(plan, sites, salesRule, date);
      const remainingConcurrentReservations = Math.max(
        0,
        plan.maxConcurrentReservations - concurrentReservations,
      );
      const availableSites =
        remainingConcurrentReservations <= 0 ? 0 : Math.max(0, capacity - reservedSites);

      minAvailableSites = Math.min(minAvailableSites, availableSites);
      minRemainingConcurrentReservations = Math.min(
        minRemainingConcurrentReservations,
        remainingConcurrentReservations,
      );
    }

    const availableSites = Number.isFinite(minAvailableSites) ? minAvailableSites : 0;
    const remainingConcurrentReservations = Number.isFinite(minRemainingConcurrentReservations)
      ? minRemainingConcurrentReservations
      : 0;

    return {
      planId: plan.id,
      planName: plan.name,
      availableSites: salesWindow.isAvailable ? availableSites : 0,
      maxSiteCount: plan.maxSiteCount > 0 ? plan.maxSiteCount : plan.capacity,
      maxConcurrentReservations: plan.maxConcurrentReservations,
      maxGuestsPerReservation: plan.maxGuestsPerReservation,
      remainingConcurrentReservations: salesWindow.isAvailable ? remainingConcurrentReservations : 0,
    };
  });
}

export async function getPlanAvailabilityDays(monthDates: string[]) {
  if (monthDates.length === 0) return [];

  const firstDate = monthDates[0];
  const lastDate = monthDates[monthDates.length - 1];
  const dayAfterLastDate = new Date(`${lastDate}T00:00:00Z`);
  dayAfterLastDate.setUTCDate(dayAfterLastDate.getUTCDate() + 1);

  const { plans, sites, salesRule, reservations } = await loadAvailabilityContext(
    firstDate,
    toIsoDate(dayAfterLastDate),
  );
  const siteLookup = buildSiteLookup(sites);
  const planSiteMap = buildPlanSiteMap(plans);
  const activeReservations = reservations.filter(isActiveReservation);

  return monthDates.flatMap((date) =>
    plans.map((plan): PlanAvailabilityDay => {
      const nextDate = new Date(`${date}T00:00:00Z`);
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
      const salesWindow = evaluatePlanBookablePeriod(plan, date, toIsoDate(nextDate));
      const { reservedSites, concurrentReservations } = getPlanReservationMetricsForDate({
        date,
        planId: plan.id,
        reservations: activeReservations,
        planSiteMap,
        siteLookup,
      });
      const capacity = getPlanCapacityForDate(plan, sites, salesRule, date);
      const remainingConcurrentReservations = Math.max(
        0,
        plan.maxConcurrentReservations - concurrentReservations,
      );
      const availableSites =
        remainingConcurrentReservations <= 0 ? 0 : Math.max(0, capacity - reservedSites);
      const effectiveAvailableSites = salesWindow.isAvailable ? availableSites : 0;
      const mark: AvailabilityMark =
        effectiveAvailableSites <= 0 || capacity <= 0
          ? 'full'
          : effectiveAvailableSites / capacity < LOW_STOCK_RATIO
            ? 'triangle'
            : 'circle';

      return {
        date,
        planId: plan.id,
        capacity,
        reservedSites,
        concurrentReservations,
        remainingConcurrentReservations,
        availableSites: effectiveAvailableSites,
        mark,
      };
    }),
  );
}

export async function validateInventory(
  input: InventoryValidationInput,
): Promise<InventoryValidationResult> {
  const { plans, sites, salesRule, reservations } = await loadAvailabilityContext(
    input.checkInDate,
    input.checkOutDate,
  );
  const plan = plans.find((item) => item.id === input.planId);
  const salesWindow = plan ? evaluatePlanBookablePeriod(plan, input.checkInDate, input.checkOutDate) : null;

  if (!plan) {
    return { valid: false, errors: ['対象プランが見つかりません。'], availableSiteCount: 0 };
  }

  if (!input.skipSalesWindow && salesWindow && !salesWindow.isAvailable) {
    return {
      valid: false,
      errors: [salesWindow.reason ?? '予約可能期間外のため予約できません。'],
      availableSiteCount: 0,
    };
  }

  const selectedSiteNumbers = (input.selectedSiteNumbers ?? []).filter(Boolean);
  const requestedSiteCount = Math.max(1, input.requestedSiteCount);
  const relevantReservations = reservations.filter(
    (reservation) => reservation.id !== input.excludeReservationId,
  );
  const stayDates = getStayDates(input.checkInDate, input.checkOutDate);
  const siteLookup = buildSiteLookup(sites);
  const planSiteMap = buildPlanSiteMap(plans);
  let minAvailableSites = Number.POSITIVE_INFINITY;
  let maxConcurrentReservations = 0;

  const errors: string[] = [];

  if (input.guests > plan.maxGuestsPerReservation) {
    errors.push(`1回の予約人数は ${plan.maxGuestsPerReservation} 名までです。`);
  }

  if (requestedSiteCount > plan.maxConcurrentReservations) {
    errors.push(`同時予約上限数は ${plan.maxConcurrentReservations} サイトまでです。`);
  }

  if (selectedSiteNumbers.length > requestedSiteCount) {
    errors.push(`指定できるサイト数は ${requestedSiteCount} サイトまでです。`);
  }

  if (selectedSiteNumbers.length > 0 && selectedSiteNumbers.length !== requestedSiteCount) {
    errors.push(`サイトを ${requestedSiteCount} サイト選択するか、指定なしで進んでください。`);
  }

  const uniqueSelectedSiteNumbers = Array.from(new Set(selectedSiteNumbers));
  if (uniqueSelectedSiteNumbers.length !== selectedSiteNumbers.length) {
    errors.push('同じサイトを重複して選択することはできません。');
  }

  const targetSites = sites.filter((site) => plan.targetSiteIds.includes(site.id));
  for (const siteNumber of uniqueSelectedSiteNumbers) {
    const targetSite = targetSites.find((site) => site.siteNumber === siteNumber);
    if (!targetSite) {
      errors.push(`指定サイト ${siteNumber} はこのプランでは利用できません。`);
      continue;
    }

    const overlappingSiteReservation = relevantReservations.find(
      (reservation) =>
        getSelectedSiteNumbers(reservation).includes(siteNumber) &&
        overlaps(reservation, input.checkInDate, input.checkOutDate),
    );

    if (overlappingSiteReservation) {
      errors.push(`指定サイト ${siteNumber} は選択日程では満枠です。`);
    }
  }

  for (const date of stayDates) {
    const capacity = getPlanCapacityForDate(plan, sites, salesRule, date);
    const { reservedSites, concurrentReservations } = getPlanReservationMetricsForDate({
      date,
      planId: plan.id,
      reservations: relevantReservations,
      planSiteMap,
      siteLookup,
    });
    const remainingConcurrentReservations = Math.max(
      0,
      plan.maxConcurrentReservations - concurrentReservations,
    );
    const availableSites =
      remainingConcurrentReservations <= 0 ? 0 : Math.max(0, capacity - reservedSites);

    minAvailableSites = Math.min(minAvailableSites, availableSites);
    maxConcurrentReservations = Math.max(maxConcurrentReservations, concurrentReservations);
  }

  if (requestedSiteCount > minAvailableSites) {
    errors.push(`選択日程で予約できる残サイト数は ${Math.max(minAvailableSites, 0)} です。`);
  }

  if (maxConcurrentReservations >= plan.maxConcurrentReservations) {
    errors.push('このプランは同時予約上限に達しています。');
  }

  return {
    valid: errors.length === 0,
    errors,
    availableSiteCount: Number.isFinite(minAvailableSites)
      ? Math.max(minAvailableSites, 0)
      : 0,
  };
}
