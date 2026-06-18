import type { AccountingSubjectKind } from '@/types/admin';

export type GeneratedPlanSubjectType = 'base' | 'adult' | 'child' | 'infant';
export type GeneratedSiteSubjectType = 'base' | 'designation';

export function getGeneratedPlanSubjectId(planId: string, type: GeneratedPlanSubjectType) {
  return `generated-plan-${type}-${planId}`;
}

export function getGeneratedSiteSubjectId(siteId: string, type: GeneratedSiteSubjectType) {
  return `generated-site-${type}-${siteId}`;
}

export function getGeneratedEventSubjectId(eventId: string) {
  return `generated-event-${eventId}`;
}

export function getGeneratedOptionSubjectId(optionId: string) {
  return `generated-option-${optionId}`;
}

export function resolveAccountingSubjectKindFromOptionType(
  type: 'rental' | 'event' | 'purchase',
): AccountingSubjectKind {
  if (type === 'event') return 'event';
  if (type === 'purchase') return 'shop';
  return 'rental';
}
