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
}

export interface ReservationPricingBreakdown {
  accommodationAmount: number;
  designationFeeAmount: number;
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
}

export interface PlanAccommodationResult {
  amount: number;
  valid: boolean;
  reason: string | null;
  appliedRuleLabel: string | null;
  usedFallback: boolean;
}
