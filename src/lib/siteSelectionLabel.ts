interface SiteSelectionInput {
  siteId?: string | null;
  siteNumber?: string | null;
  siteName?: string | null;
  selectedSiteNumbers?: string[] | null;
}

export function getSiteSelectionLabel(input: SiteSelectionInput) {
  const selectedSiteNumbers = (input.selectedSiteNumbers ?? []).filter(Boolean);

  if (selectedSiteNumbers.length > 1) {
    return `サイト番号: ${selectedSiteNumbers.join(' / ')}`;
  }

  if (input.siteNumber) {
    return `サイト番号: ${input.siteNumber}`;
  }

  if (input.siteName && input.siteName.includes('指定なし')) {
    return 'サイト指定なし';
  }

  if (input.siteId === 'auto-assigned') {
    return 'サイト指定なし（自動割当）';
  }

  if (input.siteName && !input.siteNumber) {
    return `サイト名: ${input.siteName}`;
  }

  return 'サイト指定なし（自動割当）';
}
