import type { GuestBandSeasonRule, PlanPricingMode } from './admin';

export type MandatoryFeeChargeUnit = 'adult' | 'child' | 'infant' | 'guest';

export interface MandatoryFeeSetting {
  id: string;
  enabled: boolean;
  name: string;
  chargeUnit: MandatoryFeeChargeUnit;
  unitPrice: number;
}

export interface LodgingTaxSetting {
  enabled: boolean;
  name: string;
  unitPrice: number;
  chargeUnit: MandatoryFeeChargeUnit;
  applyToLodgingTaxApplicablePlansOnly: boolean;
}

export interface PricingSettings {
  mandatoryFees: MandatoryFeeSetting[];
  lodgingTax: LodgingTaxSetting;
}

export interface PricingLineItem {
  id: string;
  label: string;
  chargeUnit: MandatoryFeeChargeUnit;
  quantity: number;
  unitPrice: number;
  amount: number;
  accountingSubjectId?: string | null;
  accountingSubjectName?: string | null;
}

export interface ReservationPricingBreakdown {
  accommodationAmount: number;
  accommodationLines?: PricingLineItem[];
  accommodationSubjectId?: string | null;
  accommodationSubjectName?: string | null;
  designationFeeAmount: number;
  designationFeeLine?: PricingLineItem | null;
  designationFeeSubjectId?: string | null;
  designationFeeSubjectName?: string | null;
  optionsAmount: number;
  mandatoryFees: PricingLineItem[];
  lodgingTax: PricingLineItem | null;
  totalAmount: number;
}

export interface ReservationPricingInput {
  adults: number;
  children: number;
  infants: number;
  accommodationAmount: number;
  designationFeeAmount: number;
  optionsAmount: number;
  isLodgingTaxApplicable: boolean;
}

export interface PlanPricingInput {
  pricingMode: PlanPricingMode;
  basePrice: number;
  adultPrice: number;
  childPrice: number;
  infantPrice: number;
  guestBandRules: GuestBandSeasonRule[];
}

export interface GuestCountInput {
  adults: number;
  children: number;
  infants: number;
}

export interface PlanPricingContext {
  checkInDate?: string | null;
  nights?: number | null;
  requestedSiteCount?: number | null;
}

export interface PlanAccommodationResult {
  amount: number;
  valid: boolean;
  reason: string | null;
  appliedRuleLabel: string | null;
  usedFallback: boolean;
}
