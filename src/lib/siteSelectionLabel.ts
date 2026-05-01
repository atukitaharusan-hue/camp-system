import { getNormalizedSelectedSiteNumbers, isAutoAssignedSite } from '@/lib/siteSelectionState';

interface SiteSelectionInput {
  siteId?: string | null;
  siteNumber?: string | null;
  siteName?: string | null;
  selectedSiteNumbers?: string[] | null;
}

export function getSiteSelectionLabel(input: SiteSelectionInput) {
  const selectedSiteNumbers = getNormalizedSelectedSiteNumbers(input);

  if (selectedSiteNumbers.length > 1) {
    return `サイト番号: ${selectedSiteNumbers.join(' / ')}`;
  }

  if (selectedSiteNumbers.length === 1) {
    return `サイト番号: ${selectedSiteNumbers[0]}`;
  }

  if (isAutoAssignedSite(input)) {
    return 'サイト指定なし（自動割当）';
  }

  if (input.siteName && !input.siteNumber) {
    return `サイト情報: ${input.siteName}`;
  }

  return 'サイト情報未設定';
}
