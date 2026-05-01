interface SiteSelectionStateInput {
  siteId?: string | null;
  siteNumber?: string | null;
  siteName?: string | null;
  selectedSiteNumbers?: string[] | null;
}

export function getNormalizedSelectedSiteNumbers(input: SiteSelectionStateInput) {
  const selectedSiteNumbers = (input.selectedSiteNumbers ?? []).filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  );

  if (selectedSiteNumbers.length > 0) {
    return Array.from(new Set(selectedSiteNumbers));
  }

  if (input.siteNumber && input.siteNumber.trim().length > 0) {
    return [input.siteNumber.trim()];
  }

  return [];
}

export function hasSiteSelection(input: SiteSelectionStateInput) {
  if (input.siteId === 'auto-assigned') return true;
  if (getNormalizedSelectedSiteNumbers(input).length > 0) return true;
  return Boolean(input.siteId && input.siteId.trim().length > 0);
}

export function isAutoAssignedSite(input: SiteSelectionStateInput) {
  if (input.siteId === 'auto-assigned') return true;
  return Boolean(input.siteName && input.siteName.includes('指定なし'));
}
