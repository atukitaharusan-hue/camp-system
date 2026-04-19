import type {
  GuestCountInput,
  LodgingTaxSetting,
  MandatoryFeeChargeUnit,
  MandatoryFeeSetting,
  PlanAccommodationResult,
  PlanPricingContext,
  PlanPricingInput,
  PricingLineItem,
  PricingSettings,
  ReservationPricingBreakdown,
  ReservationPricingInput,
} from '@/types/pricing';
import type { GuestBandPriceTier, GuestBandSeasonRule } from '@/types/admin';

export const defaultPricingSettings: PricingSettings = {
  mandatoryFees: [],
  lodgingTax: {
    enabled: false,
    name: '宿泊税',
    unitPrice: 0,
    chargeUnit: 'guest',
    applyToLodgingTaxApplicablePlansOnly: true,
  },
};

function normalizeLineItemAmount(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

function normalizeChargeUnit(value: unknown): MandatoryFeeChargeUnit {
  if (value === 'adult' || value === 'child' || value === 'infant' || value === 'guest') {
    return value;
  }
  return 'guest';
}

function normalizeMandatoryFee(input: Partial<MandatoryFeeSetting>, index: number): MandatoryFeeSetting {
  return {
    id: typeof input.id === 'string' && input.id.trim() ? input.id : `mandatory-fee-${index + 1}`,
    enabled: Boolean(input.enabled),
    name: typeof input.name === 'string' ? input.name.trim() : '',
    chargeUnit: normalizeChargeUnit(input.chargeUnit),
    unitPrice: normalizeLineItemAmount(input.unitPrice),
  };
}

function normalizeLodgingTax(input: Partial<LodgingTaxSetting> | undefined): LodgingTaxSetting {
  return {
    enabled: Boolean(input?.enabled),
    name: typeof input?.name === 'string' && input.name.trim() ? input.name.trim() : '宿泊税',
    unitPrice: normalizeLineItemAmount(input?.unitPrice),
    chargeUnit: normalizeChargeUnit(input?.chargeUnit),
    applyToLodgingTaxApplicablePlansOnly:
      input?.applyToLodgingTaxApplicablePlansOnly === undefined
        ? true
        : Boolean(input.applyToLodgingTaxApplicablePlansOnly),
  };
}

export function normalizePricingSettings(input: Partial<PricingSettings> | null | undefined): PricingSettings {
  return {
    mandatoryFees: Array.isArray(input?.mandatoryFees)
      ? input.mandatoryFees.map((fee, index) => normalizeMandatoryFee(fee, index))
      : [],
    lodgingTax: normalizeLodgingTax(input?.lodgingTax),
  };
}

function resolveQuantity(
  chargeUnit: MandatoryFeeChargeUnit,
  adults: number,
  children: number,
  infants: number,
) {
  if (chargeUnit === 'adult') return adults;
  if (chargeUnit === 'child') return children;
  if (chargeUnit === 'infant') return infants;
  return adults + children + infants;
}

function createLineItem(
  id: string,
  label: string,
  chargeUnit: MandatoryFeeChargeUnit,
  quantity: number,
  unitPrice: number,
): PricingLineItem {
  return {
    id,
    label,
    chargeUnit,
    quantity,
    unitPrice,
    amount: quantity * unitPrice,
  };
}

function normalizeMonthValues(months: number[] | undefined) {
  return Array.from(
    new Set(
      (months ?? [])
        .map((value) => Math.trunc(Number(value)))
        .filter((value) => value >= 1 && value <= 12),
    ),
  ).sort((left, right) => left - right);
}

function normalizeGuestBandTiers(bands: GuestBandPriceTier[] | undefined) {
  return (bands ?? [])
    .map((band, index) => ({
      id: typeof band.id === 'string' && band.id.trim() ? band.id : `guest-band-tier-${index + 1}`,
      maxGuests: Math.max(1, Math.trunc(Number(band.maxGuests ?? 0))),
      price: normalizeLineItemAmount(band.price),
    }))
    .sort((left, right) => left.maxGuests - right.maxGuests);
}

export function normalizeGuestBandRules(input: GuestBandSeasonRule[] | null | undefined): GuestBandSeasonRule[] {
  return (input ?? []).map((rule, index) => ({
    id: typeof rule?.id === 'string' && rule.id.trim() ? rule.id : `guest-band-rule-${index + 1}`,
    label: typeof rule?.label === 'string' && rule.label.trim() ? rule.label.trim() : `特別料金 ${index + 1}`,
    periodMode: rule?.periodMode === 'date_range' ? 'date_range' : 'months',
    months: normalizeMonthValues(rule?.months),
    startDate: typeof rule?.startDate === 'string' && rule.startDate ? rule.startDate : null,
    endDate: typeof rule?.endDate === 'string' && rule.endDate ? rule.endDate : null,
    bands: normalizeGuestBandTiers(rule?.bands),
  }));
}

function matchesGuestBandRule(rule: GuestBandSeasonRule, checkInDate: string | null | undefined) {
  if (!checkInDate) return false;

  if (rule.periodMode === 'date_range') {
    if (!rule.startDate || !rule.endDate) return false;
    return checkInDate >= rule.startDate && checkInDate <= rule.endDate;
  }

  const month = new Date(`${checkInDate}T00:00:00+09:00`).getMonth() + 1;
  return rule.months.includes(month);
}

export function resolvePlanAccommodationAmount(
  plan: PlanPricingInput,
  guests: GuestCountInput,
  context: PlanPricingContext = {},
): PlanAccommodationResult {
  const adults = Math.max(0, Math.trunc(Number(guests.adults ?? 0)));
  const children = Math.max(0, Math.trunc(Number(guests.children ?? 0)));
  const infants = Math.max(0, Math.trunc(Number(guests.infants ?? 0)));

  if (plan.pricingMode === 'per_person') {
    return {
      amount:
        normalizeLineItemAmount(plan.adultPrice) * adults +
        normalizeLineItemAmount(plan.childPrice) * children +
        normalizeLineItemAmount(plan.infantPrice) * infants,
      valid: true,
      reason: null,
      appliedRuleLabel: null,
      usedFallback: false,
    };
  }

  if (plan.pricingMode !== 'guest_band') {
    return {
      amount: normalizeLineItemAmount(plan.basePrice),
      valid: true,
      reason: null,
      appliedRuleLabel: null,
      usedFallback: false,
    };
  }

  const guestBandRules = normalizeGuestBandRules(plan.guestBandRules);
  const totalGuests = adults + children + infants;
  const matchedRule = guestBandRules.find((rule) => matchesGuestBandRule(rule, context.checkInDate));

  if (!matchedRule) {
    return {
      amount: normalizeLineItemAmount(plan.basePrice),
      valid: true,
      reason: null,
      appliedRuleLabel: null,
      usedFallback: true,
    };
  }

  const matchedTier = matchedRule.bands.find((band) => totalGuests <= band.maxGuests);
  if (!matchedTier) {
    return {
      amount: 0,
      valid: false,
      reason: `${matchedRule.label} の人数帯に ${totalGuests} 名が含まれていません。`,
      appliedRuleLabel: matchedRule.label,
      usedFallback: false,
    };
  }

  return {
    amount: normalizeLineItemAmount(matchedTier.price),
    valid: true,
    reason: null,
    appliedRuleLabel: matchedRule.label,
    usedFallback: false,
  };
}

export function calculateAccommodationAmount(basePrice: number, requestedSiteCount: number) {
  const normalizedBasePrice = normalizeLineItemAmount(basePrice);
  const normalizedSiteCount = Math.max(1, Math.trunc(Number(requestedSiteCount || 1)));
  return normalizedBasePrice * normalizedSiteCount;
}

export function calculatePlanAccommodationAmount(
  plan: PlanPricingInput,
  guests: GuestCountInput,
  context: PlanPricingContext = {},
) {
  return resolvePlanAccommodationAmount(plan, guests, context).amount;
}

export function calculateReservationPricing(
  settingsInput: Partial<PricingSettings> | null | undefined,
  input: ReservationPricingInput,
): ReservationPricingBreakdown {
  const settings = normalizePricingSettings(settingsInput);
  const accommodationAmount = normalizeLineItemAmount(input.accommodationAmount);
  const designationFeeAmount = normalizeLineItemAmount(input.designationFeeAmount);
  const optionsAmount = normalizeLineItemAmount(input.optionsAmount);
  const adults = Math.max(0, Math.trunc(input.adults));
  const children = Math.max(0, Math.trunc(input.children));
  const infants = Math.max(0, Math.trunc(input.infants));

  const mandatoryFees = settings.mandatoryFees
    .filter((fee) => fee.enabled && fee.name && fee.unitPrice > 0)
    .map((fee) =>
      createLineItem(
        fee.id,
        fee.name,
        fee.chargeUnit,
        resolveQuantity(fee.chargeUnit, adults, children, infants),
        fee.unitPrice,
      ),
    )
    .filter((line) => line.amount > 0);

  const shouldApplyLodgingTax =
    settings.lodgingTax.enabled &&
    settings.lodgingTax.unitPrice > 0 &&
    (!settings.lodgingTax.applyToLodgingTaxApplicablePlansOnly || input.isLodgingTaxApplicable);

  const lodgingTax = shouldApplyLodgingTax
    ? createLineItem(
        'lodging-tax',
        settings.lodgingTax.name,
        settings.lodgingTax.chargeUnit,
        resolveQuantity(settings.lodgingTax.chargeUnit, adults, children, infants),
        settings.lodgingTax.unitPrice,
      )
    : null;

  const totalAmount =
    accommodationAmount +
    designationFeeAmount +
    optionsAmount +
    mandatoryFees.reduce((sum, line) => sum + line.amount, 0) +
    (lodgingTax?.amount ?? 0);

  return {
    accommodationAmount,
    designationFeeAmount,
    optionsAmount,
    mandatoryFees,
    lodgingTax: lodgingTax && lodgingTax.amount > 0 ? lodgingTax : null,
    totalAmount,
  };
}

export function coerceReservationPricingBreakdown(
  value: unknown,
): ReservationPricingBreakdown | null {
  if (!value || typeof value !== 'object') return null;

  const input = value as Partial<ReservationPricingBreakdown>;
  const mandatoryFees = Array.isArray(input.mandatoryFees)
    ? input.mandatoryFees
        .map((line, index) => {
          if (!line || typeof line !== 'object') return null;
          const candidate = line as Partial<PricingLineItem>;
          return createLineItem(
            typeof candidate.id === 'string' && candidate.id ? candidate.id : `mandatory-fee-${index + 1}`,
            typeof candidate.label === 'string' ? candidate.label : '必須料金',
            normalizeChargeUnit(candidate.chargeUnit),
            Math.max(0, Math.trunc(Number(candidate.quantity ?? 0))),
            normalizeLineItemAmount(candidate.unitPrice),
          );
        })
        .filter((line): line is PricingLineItem => Boolean(line))
    : [];

  const lodgingTax =
    input.lodgingTax && typeof input.lodgingTax === 'object'
      ? createLineItem(
          typeof input.lodgingTax.id === 'string' ? input.lodgingTax.id : 'lodging-tax',
          typeof input.lodgingTax.label === 'string' ? input.lodgingTax.label : '宿泊税',
          normalizeChargeUnit(input.lodgingTax.chargeUnit),
          Math.max(0, Math.trunc(Number(input.lodgingTax.quantity ?? 0))),
          normalizeLineItemAmount(input.lodgingTax.unitPrice),
        )
      : null;

  return {
    accommodationAmount: normalizeLineItemAmount(input.accommodationAmount),
    designationFeeAmount: normalizeLineItemAmount(input.designationFeeAmount),
    optionsAmount: normalizeLineItemAmount(input.optionsAmount),
    mandatoryFees,
    lodgingTax: lodgingTax && lodgingTax.amount > 0 ? lodgingTax : null,
    totalAmount: normalizeLineItemAmount(input.totalAmount),
  };
}
