export interface AdminPlan {
  id: string;
  name: string;
  description: string;
  category: string;
  features: string;
  isPublished: boolean;
  basePrice: number;
  targetSiteIds: string[];
  capacity: number;
  salesStartDate: string | null;
  salesEndDate: string | null;
  imageUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSite {
  id: string;
  siteNumber: string;
  siteName: string;
  area: string;
  subArea: string;
  status: 'active' | 'maintenance' | 'closed';
  capacity: number;
  basePrice: number;
  designationFee: number;
  isPublished: boolean;
  slopeRating: number;
  facilityDistance: number;
  featureNote: string;
  waterAvailable: boolean;
  electricAvailable: boolean;
  sewerAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminEvent {
  id: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  location: string;
  imageUrl: string;
  isPublished: boolean;
}

export interface CalendarThresholdSettings {
  warningRatio: number;
}

export interface CalendarDisplaySettings {
  publicBaseUrl: string;
  thresholds: CalendarThresholdSettings;
}

export interface AdminPolicySettings {
  paymentNotice: string;
  eventEntryNotice: string;
  paymentMethods: Array<{
    id: string;
    label: string;
    description: string;
    isEnabled: boolean;
  }>;
  cancellationPolicies: Array<{
    period: string;
    rate: string;
  }>;
  termsSections: Array<{
    title: string;
    body: string[];
  }>;
}

export interface AdminMemberInvite {
  id: string;
  email: string;
  token: string;
  status: 'pending' | 'used';
  createdAt: string;
  usedAt: string | null;
}

export interface AdminMember {
  id: string;
  userName: string;
  email: string;
  role: 'owner' | 'admin';
  invitedAt: string;
  activatedAt: string | null;
}

export interface AdminAccountProfile {
  userName: string;
  email: string;
  password: string;
  allowConcurrentLogin: boolean;
  isInitialized: boolean;
}

export interface AdminQrScreenSettings {
  title: string;
  description: string;
  supportText: string;
  externalLinkLabel: string;
  externalLinkUrl: string;
  footerNote: string;
}

export interface AdminSiteMapSettings {
  description: string;
  imageUrls: string[];
}

export interface SalesRule {
  id: string;
  closedDates: string[];
  closedDateRanges: ClosedDateRange[];
  siteClosures: SiteClosure[];
  createdAt: string;
  updatedAt: string;
}

export interface ClosedDateRange {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface SiteClosure {
  siteId: string;
  area: string;
  siteNumber: string;
  startDate: string;
  endDate: string;
  dates: string[];
  reason: string;
}

export function getSiteStatusLabel(status: AdminSite['status']): string {
  const labels: Record<AdminSite['status'], string> = {
    active: '公開中',
    maintenance: 'メンテナンス中',
    closed: '停止中',
  };

  return labels[status];
}
