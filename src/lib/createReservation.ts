import { supabase } from '@/lib/supabase';
import {
  calculatePlanAccommodationAmount,
  calculateReservationPricing,
  coerceReservationPricingBreakdown,
  resolvePlanAccommodationAmount,
} from '@/lib/pricing';
import { fetchPlans, fetchPricingSettings } from '@/lib/admin/fetchData';
import { validateReservation } from '@/lib/validateReservation';
import type { Database } from '@/types/database';

type GuestReservationInsert = Database['public']['Tables']['guest_reservations']['Insert'];
type GuestReservationRow = Database['public']['Tables']['guest_reservations']['Row'];

export type CreateReservationResult =
  | { success: true; reservation: GuestReservationRow }
  | { success: false; error: string };

function parseSpecialRequestValue(specialRequests: string | null | undefined, key: string) {
  const memo = specialRequests ?? '';
  const line = memo.split('\n').find((item) => item.startsWith(`${key}:`));
  return line?.split(':').slice(1).join(':').trim() ?? '';
}

export async function createReservation(
  payload: GuestReservationInsert,
): Promise<CreateReservationResult> {
  const planId = payload.plan_id ?? null;
  const requestedSiteCount = payload.reserved_site_count ?? 1;
  const selectedSiteNumbers = Array.isArray(payload.selected_site_numbers)
    ? payload.selected_site_numbers.filter((value): value is string => typeof value === 'string')
    : [];

  if (planId) {
    const validation = await validateReservation({
      siteNumber: payload.site_number ?? '',
      checkInDate: payload.check_in_date,
      checkOutDate: payload.check_out_date,
      guests: payload.guests ?? 1,
      source: 'web',
      planId,
      requestedSiteCount,
      selectedSiteNumbers,
    });

    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.map((item) => item.message).join('\n'),
      };
    }
  }

  const [pricingSettings, plans] = await Promise.all([fetchPricingSettings(), fetchPlans()]);
  const selectedPlan = planId ? plans.find((plan) => plan.id === planId) ?? null : null;
  const submittedBreakdown = coerceReservationPricingBreakdown(payload.pricing_breakdown);
  const accommodationResult = selectedPlan
    ? resolvePlanAccommodationAmount(
        {
          pricingMode: selectedPlan.pricingMode,
          basePrice: selectedPlan.basePrice,
          adultPrice: selectedPlan.adultPrice,
          childPrice: selectedPlan.childPrice,
          infantPrice: selectedPlan.infantPrice,
          guestBandRules: selectedPlan.guestBandRules,
        },
        {
          adults: payload.adults ?? payload.guests ?? 0,
          children: payload.children ?? 0,
          infants: payload.infants ?? 0,
        },
        {
          checkInDate: payload.check_in_date,
        },
      )
    : null;

  if (accommodationResult && !accommodationResult.valid) {
    return {
      success: false,
      error: accommodationResult.reason ?? '人数帯料金に該当しないため予約を確定できません。',
    };
  }

  const serverPricingBreakdown = calculateReservationPricing(pricingSettings, {
    adults: payload.adults ?? payload.guests ?? 0,
    children: payload.children ?? 0,
    infants: payload.infants ?? 0,
    accommodationAmount: accommodationResult?.amount ?? submittedBreakdown?.accommodationAmount ?? 0,
    designationFeeAmount: submittedBreakdown?.designationFeeAmount ?? 0,
    optionsAmount: submittedBreakdown?.optionsAmount ?? 0,
    isLodgingTaxApplicable: selectedPlan?.isLodgingTaxApplicable ?? false,
  });
  payload.total_amount = serverPricingBreakdown.totalAmount;
  payload.pricing_breakdown =
    serverPricingBreakdown as unknown as Database['public']['Tables']['guest_reservations']['Insert']['pricing_breakdown'];

  const { data, error } = await supabase
    .from('guest_reservations')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('[createReservation] Supabase error:', error);
    return {
      success: false,
      error: error.message ?? '予約保存に失敗しました。',
    };
  }

  const missingPlanId = !data.plan_id;
  if (missingPlanId) {
    const memoPlanId = parseSpecialRequestValue(data.special_requests, 'PLAN_ID');
    if (memoPlanId) {
      await supabase.from('guest_reservations').update({ plan_id: memoPlanId }).eq('id', data.id);
    }
  }

  return { success: true, reservation: data };
}
