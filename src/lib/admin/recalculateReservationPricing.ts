import { fetchOptions, fetchPlans, fetchPricingSettings, fetchSiteDetails } from '@/lib/admin/fetchData';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  calculateReservationPricing,
  coerceReservationPricingBreakdown,
  resolvePlanAccommodationAmount,
} from '@/lib/pricing';
import type { Database, Json } from '@/types/database';
import type { OptionItem, PriceType } from '@/types/options';
import type { ReservationPricingBreakdown } from '@/types/pricing';
import type { SiteDetail } from '@/types/site';

type GuestReservationRow = Database['public']['Tables']['guest_reservations']['Row'];
type AdminSupabaseClient = SupabaseClient<Database>;

interface StoredOptionEntry {
  type?: 'rental' | 'event';
  optionId: string;
  quantity: number;
  days?: number;
  people?: number;
  subtotal: number;
  name?: string;
}

export interface RecalculateReservationResult {
  id: string;
  success: boolean;
  skipped: boolean;
  error: string | null;
  totalAmount: number | null;
}

function calculateNights(checkIn: string, checkOut: string) {
  const inDate = new Date(`${checkIn}T00:00:00+09:00`);
  const outDate = new Date(`${checkOut}T00:00:00+09:00`);
  const nights = Math.ceil((outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24));
  return Number.isFinite(nights) ? Math.max(0, nights) : 0;
}

function parseSpecialRequestValue(specialRequests: string | null | undefined, key: string) {
  const memo = specialRequests ?? '';
  const line = memo.split('\n').find((item) => item.startsWith(`${key}:`));
  return line?.split(':').slice(1).join(':').trim() ?? '';
}

function asStringArray(value: Json | null) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function readNumber(value: unknown, fallback = 0) {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) ? number : fallback;
}

function parseStoredOptions(value: Json | null): StoredOptionEntry[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, Json> => typeof item === 'object' && item !== null && !Array.isArray(item))
    .map((item): StoredOptionEntry => {
      const optionId = typeof item.optionId === 'string' ? item.optionId : '';
      const type = item.type === 'event' ? 'event' : 'rental';
      return {
        type,
        optionId,
        quantity: Math.max(0, Math.trunc(readNumber(item.quantity, type === 'event' ? 1 : 0))),
        days: item.days === null || item.days === undefined ? undefined : Math.max(0, Math.trunc(readNumber(item.days))),
        people: item.people === null || item.people === undefined ? undefined : Math.max(0, Math.trunc(readNumber(item.people))),
        subtotal: readNumber(item.subtotal),
        name: typeof item.name === 'string' ? item.name : undefined,
      };
    })
    .filter((item) => item.optionId.length > 0);
}

function calculateOptionSubtotal(option: OptionItem | undefined, stored: StoredOptionEntry) {
  if (!option) return stored.subtotal;

  const priceType = option.priceType as PriceType;
  const quantity = Math.max(0, Math.trunc(stored.quantity ?? 0));
  const days = Math.max(0, Math.trunc(stored.days ?? 0));
  const people = Math.max(0, Math.trunc(stored.people ?? 0));

  if (priceType === 'per_day') return option.price * quantity * days;
  if (priceType === 'per_person') return option.price * people;
  if (priceType === 'fixed') return quantity > 0 ? option.price : 0;
  return option.price * quantity;
}

function recalculateOptions(optionsJson: Json | null, optionMap: Map<string, OptionItem>) {
  const recalculated = parseStoredOptions(optionsJson).map((stored) => {
    const current = optionMap.get(stored.optionId);
    return {
      ...stored,
      name: current?.name ?? stored.name,
      subtotal: calculateOptionSubtotal(current, stored),
    };
  });

  return {
    optionsJson: recalculated,
    optionsAmount: recalculated.reduce((sum, item) => sum + item.subtotal, 0),
  };
}

function getDesignationFee(
  reservation: GuestReservationRow,
  sitesByNumber: Map<string, SiteDetail>,
  existingBreakdown: ReservationPricingBreakdown | null,
) {
  const selectedNumbers = asStringArray(reservation.selected_site_numbers);
  const siteNumbers = selectedNumbers.length > 0
    ? selectedNumbers
    : reservation.site_number
      ? [reservation.site_number]
      : [];

  if (siteNumbers.length === 0) return 0;

  let hasMissingSite = false;
  const amount = siteNumbers.reduce((sum, siteNumber) => {
    const site = sitesByNumber.get(siteNumber);
    if (!site) {
      hasMissingSite = true;
      return sum;
    }
    return sum + site.designationFee;
  }, 0);

  return hasMissingSite ? existingBreakdown?.designationFeeAmount ?? amount : amount;
}

export async function recalculateReservationsPricing(
  reservations: GuestReservationRow[],
): Promise<RecalculateReservationResult[]> {
  const response = await fetch('/api/admin/reservations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'recalculatePricing', reservations }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(typeof payload.error === 'string' ? payload.error : '料金再計算に失敗しました。');
  }

  const payload = await response.json();
  return Array.isArray(payload.results) ? payload.results : [];
}

export async function recalculateReservationsPricingInDatabase(
  supabase: AdminSupabaseClient,
  reservations: GuestReservationRow[],
): Promise<RecalculateReservationResult[]> {
  const [plans, pricingSettings, options, sites] = await Promise.all([
    fetchPlans(),
    fetchPricingSettings(),
    fetchOptions(),
    fetchSiteDetails(),
  ]);

  const planMap = new Map(plans.map((plan) => [plan.id, plan]));
  const optionMap = new Map(options.map((option) => [option.id, option]));
  const sitesByNumber = new Map(sites.map((site) => [site.siteNumber, site]));
  const results: RecalculateReservationResult[] = [];

  for (const reservation of reservations) {
    const planId = reservation.plan_id ?? parseSpecialRequestValue(reservation.special_requests, 'PLAN_ID');
    const plan = planId ? planMap.get(planId) : null;

    if (!plan) {
      results.push({
        id: reservation.id,
        success: false,
        skipped: true,
        error: 'プラン情報が見つからないため再計算をスキップしました',
        totalAmount: null,
      });
      continue;
    }

    const nights = reservation.nights > 0
      ? reservation.nights
      : calculateNights(reservation.check_in_date, reservation.check_out_date);
    const requestedSiteCount = Math.max(1, reservation.reserved_site_count ?? 1);
    const adults = reservation.adults ?? Math.max((reservation.guests ?? 1) - (reservation.children ?? 0) - (reservation.infants ?? 0), 1);
    const children = reservation.children ?? 0;
    const infants = reservation.infants ?? 0;
    const existingBreakdown = coerceReservationPricingBreakdown(reservation.pricing_breakdown);

    if (!reservation.check_in_date || !reservation.check_out_date || nights <= 0) {
      results.push({
        id: reservation.id,
        success: false,
        skipped: true,
        error: '宿泊日または泊数が不足しているため再計算をスキップしました',
        totalAmount: null,
      });
      continue;
    }

    const accommodationResult = resolvePlanAccommodationAmount(
      {
        pricingMode: plan.pricingMode,
        basePrice: plan.basePrice,
        adultPrice: plan.adultPrice,
        childPrice: plan.childPrice,
        infantPrice: plan.infantPrice,
        guestBandRules: plan.guestBandRules,
      },
      { adults, children, infants },
      {
        checkInDate: reservation.check_in_date,
        nights,
        requestedSiteCount,
      },
    );

    if (!accommodationResult.valid) {
      results.push({
        id: reservation.id,
        success: false,
        skipped: true,
        error: accommodationResult.reason ?? '料金ルールに一致しないため再計算をスキップしました',
        totalAmount: null,
      });
      continue;
    }

    const recalculatedOptions = recalculateOptions(reservation.options_json, optionMap);
    const pricingBreakdown = calculateReservationPricing(pricingSettings, {
      adults,
      children,
      infants,
      accommodationAmount: accommodationResult.amount,
      designationFeeAmount: getDesignationFee(reservation, sitesByNumber, existingBreakdown),
      optionsAmount: recalculatedOptions.optionsAmount,
        isLodgingTaxApplicable: plan.isLodgingTaxApplicable ?? false,
    });

    const { error } = await supabase
      .from('guest_reservations')
      .update({
        nights,
        adults,
        children,
        infants,
        guests: adults + children + infants,
        reserved_site_count: requestedSiteCount,
        options_json: recalculatedOptions.optionsJson as unknown as Database['public']['Tables']['guest_reservations']['Update']['options_json'],
        pricing_breakdown: pricingBreakdown as unknown as Database['public']['Tables']['guest_reservations']['Update']['pricing_breakdown'],
        total_amount: pricingBreakdown.totalAmount,
      })
      .eq('id', reservation.id);

    results.push({
      id: reservation.id,
      success: !error,
      skipped: false,
      error: error?.message ?? null,
      totalAmount: error ? null : pricingBreakdown.totalAmount,
    });
  }

  return results;
}
