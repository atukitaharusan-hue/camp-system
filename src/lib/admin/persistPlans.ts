import { supabase } from '@/lib/supabase';
import { normalizeGuestBandRules } from '@/lib/pricing';
import type { AdminPlan } from '@/types/admin';
import type { Database } from '@/types/database';

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function normalizePlanRow(plan: AdminPlan) {
  return {
    name: plan.name.trim(),
    description: plan.description.trim(),
    category: plan.category.trim() || null,
    features: plan.features.trim() || null,
    is_published: plan.isPublished,
    is_lodging_tax_applicable: Boolean(plan.isLodgingTaxApplicable),
    pricing_mode: plan.pricingMode,
    base_price: plan.basePrice,
    adult_price: plan.adultPrice,
    child_price: plan.childPrice,
    infant_price: plan.infantPrice,
    guest_band_rules:
      normalizeGuestBandRules(plan.guestBandRules) as unknown as Database['public']['Tables']['plans']['Insert']['guest_band_rules'],
    capacity: plan.maxSiteCount,
    max_site_count: plan.maxSiteCount,
    max_concurrent_reservations: plan.maxConcurrentReservations,
    max_guests_per_booking: plan.maxGuestsPerReservation,
    sales_start_date: plan.salesStartDate || null,
    sales_end_date: plan.salesEndDate || null,
    image_url: plan.imageUrl || null,
  };
}

function toUniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function getAddedValues(currentValues: string[], nextValues: string[]) {
  const current = new Set(currentValues);
  return nextValues.filter((value) => !current.has(value));
}

function getRemovedValues(currentValues: string[], nextValues: string[]) {
  const next = new Set(nextValues);
  return currentValues.filter((value) => !next.has(value));
}

export async function persistPlans(plans: AdminPlan[]) {
  const { data: existingPlans, error: existingPlansError } = await supabase.from('plans').select('id');
  if (existingPlansError) throw existingPlansError;

  const incomingIds = new Set(plans.map((plan) => plan.id).filter((id) => isUuid(id)));
  const deletedIds = (existingPlans ?? []).map((plan) => plan.id).filter((id) => !incomingIds.has(id));

  if (deletedIds.length > 0) {
    const { error } = await supabase.from('plans').delete().in('id', deletedIds);
    if (error) throw error;
  }

  const existingPlanRows = plans.filter((plan) => isUuid(plan.id));
  const newPlans = plans.filter((plan) => !isUuid(plan.id));
  const resolvedPlanIds = new Map<string, string>();

  if (existingPlanRows.length > 0) {
    const { error: upsertExistingPlansError } = await supabase.from('plans').upsert(
      existingPlanRows.map((plan) => ({
        ...normalizePlanRow(plan),
        id: plan.id,
      })),
    );
    if (upsertExistingPlansError) throw upsertExistingPlansError;

    existingPlanRows.forEach((plan) => {
      resolvedPlanIds.set(plan.id, plan.id);
    });
  }

  for (const plan of newPlans) {
    const { data, error } = await supabase.from('plans').insert(normalizePlanRow(plan)).select('id').single();
    if (error) throw error;
    resolvedPlanIds.set(plan.id, data.id);
  }

  const savedPlanIds = Array.from(resolvedPlanIds.values());
  if (savedPlanIds.length === 0) return;

  const [existingPlanSitesResult, existingPlanOptionsResult] = await Promise.all([
    supabase.from('plan_sites').select('plan_id, site_id').in('plan_id', savedPlanIds),
    supabase.from('plan_options').select('plan_id, option_id').in('plan_id', savedPlanIds),
  ]);

  if (existingPlanSitesResult.error) throw existingPlanSitesResult.error;
  if (existingPlanOptionsResult.error) throw existingPlanOptionsResult.error;

  const existingSiteMap = new Map<string, string[]>();
  for (const row of existingPlanSitesResult.data ?? []) {
    const items = existingSiteMap.get(row.plan_id) ?? [];
    items.push(row.site_id);
    existingSiteMap.set(row.plan_id, items);
  }

  const existingOptionMap = new Map<string, string[]>();
  for (const row of existingPlanOptionsResult.data ?? []) {
    const items = existingOptionMap.get(row.plan_id) ?? [];
    items.push(row.option_id);
    existingOptionMap.set(row.plan_id, items);
  }

  for (const plan of plans) {
    const planId = resolvedPlanIds.get(plan.id);
    if (!planId) continue;

    const currentSiteIds = toUniqueSorted(existingSiteMap.get(planId) ?? []);
    const nextSiteIds = toUniqueSorted(plan.targetSiteIds);
    const removedSiteIds = getRemovedValues(currentSiteIds, nextSiteIds);
    const addedSiteIds = getAddedValues(currentSiteIds, nextSiteIds);

    if (removedSiteIds.length > 0) {
      const { error } = await supabase.from('plan_sites').delete().eq('plan_id', planId).in('site_id', removedSiteIds);
      if (error) throw error;
    }

    if (addedSiteIds.length > 0) {
      const { error } = await supabase.from('plan_sites').insert(
        addedSiteIds.map((siteId) => ({ plan_id: planId, site_id: siteId })),
      );
      if (error) throw error;
    }

    const currentOptionIds = toUniqueSorted(existingOptionMap.get(planId) ?? []);
    const nextOptionIds = toUniqueSorted(plan.applicableOptionIds);
    const removedOptionIds = getRemovedValues(currentOptionIds, nextOptionIds);
    const addedOptionIds = getAddedValues(currentOptionIds, nextOptionIds);

    if (removedOptionIds.length > 0) {
      const { error } = await supabase
        .from('plan_options')
        .delete()
        .eq('plan_id', planId)
        .in('option_id', removedOptionIds);
      if (error) throw error;
    }

    if (addedOptionIds.length > 0) {
      const { error } = await supabase.from('plan_options').insert(
        addedOptionIds.map((optionId) => ({ plan_id: planId, option_id: optionId })),
      );
      if (error) throw error;
    }
  }
}
