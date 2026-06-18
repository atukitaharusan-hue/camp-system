export type PlanPricingMode = 'per_group' | 'per_person' | 'guest_band';

export type GuestBandPeriodMode = 'months' | 'date_range';

export interface WaitlistExcludedPeriod {
  id: string;
  startDate: string;
  endDate: string;
}

export interface GuestBandPriceTier {
  id: string;
  maxGuests: number;
  price: number;
}

export interface GuestBandSeasonRule {
  id: string;
  label: string;
  periodMode: GuestBandPeriodMode;
  months: number[];
  startDate: string | null;
  endDate: string | null;
  bands: GuestBandPriceTier[];
}

export interface AdminPlan {
  id: string;
  name: string;
  description: string;
  category: string;
  features: string;
  isPublished: boolean;
  isLodgingTaxApplicable?: boolean;
  pricingMode: PlanPricingMode;
  basePrice: number;
  adultPrice: number;
  childPrice: number;
  infantPrice: number;
  guestBandRules: GuestBandSeasonRule[];
  targetSiteIds: string[];
  applicableOptionIds: string[];
  capacity: number;
  maxSiteCount: number;
  maxConcurrentReservations: number;
  maxGuestsPerReservation: number;
  salesStartDate: string | null;
  salesEndDate: string | null;
  waitlistEnabled: boolean;
  waitlistMaxCount: number;
  waitlistStartDate: string | null;
  waitlistEndDate: string | null;
  waitlistMessage: string;
  waitlistExcludedPeriods: WaitlistExcludedPeriod[];
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

export type EasyModeCategoryType =
  | 'today_guests'
  | 'availability'
  | 'checkout'
  | 'inventory'
  | 'staff_memos'
  | 'reservations'
  | 'sales_report'
  | 'events'
  | 'custom_memo'
  | 'custom_link'
  | 'custom_checklist'
  | 'custom_products'
  | 'custom_events'
  | 'custom_reservations';

export type EasyModeDeviceTarget = 'all' | 'mobile' | 'tablet' | 'pc';
export type EasyModeRoleTarget = 'all' | 'admin_only' | 'staff_only' | 'specific';
export type EasyModeDisplayCondition =
  | 'always'
  | 'today_only'
  | 'has_reservations'
  | 'has_events'
  | 'low_stock'
  | 'has_pending_memos';

export interface EasyModeCategorySetting {
  id: string;
  name: string;
  type: EasyModeCategoryType;
  icon: string;
  color: string;
  sortOrder: number;
  isVisible: boolean;
  targetDevice: EasyModeDeviceTarget;
  targetRole: EasyModeRoleTarget;
  targetStaffIds: string[];
  displayCondition: EasyModeDisplayCondition;
  config: Record<string, unknown>;
  description: string;
}

export interface EasyModeChecklistItem {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  dueAt: string;
  isCompleted: boolean;
  completedAt: string | null;
  sortOrder: number;
  resetDaily: boolean;
}

export interface EasyModeCustomMemoConfig {
  content: string;
  lastUpdatedBy: string;
  updatedAt: string;
}

export interface EasyModeCustomLinkItem {
  id: string;
  title: string;
  url: string;
  icon: string;
  description: string;
}

export interface EasyModeCustomLinkConfig {
  links: EasyModeCustomLinkItem[];
}

export interface EasyModeChecklistConfig {
  items: EasyModeChecklistItem[];
  lastResetDate: string;
}

export interface EasyModeCustomProductsConfig {
  optionCategory: string;
  titleContains: string;
  showStock: boolean;
  showPrice: boolean;
  allowCheckout: boolean;
}

export interface EasyModeCustomEventsConfig {
  filter: 'today' | 'this_week' | 'upcoming';
  showParticipants: boolean;
  showNotes: boolean;
}

export interface EasyModeCustomReservationsConfig {
  filter: 'arrived_pending' | 'not_arrived' | 'checked_in' | 'needs_attention';
  date: 'today' | 'tomorrow' | 'all';
}

export type EasyModeFooterActionType =
  | 'home'
  | 'new_reservation'
  | 'cancel'
  | 'site_assignment'
  | 'checkin'
  | 'checkout'
  | 'custom_link';

export interface EasyModeFooterItemSetting {
  id: string;
  label: string;
  actionType: EasyModeFooterActionType;
  icon: string;
  sortOrder: number;
  isVisible: boolean;
  isRequired: boolean;
  customUrl: string;
}

export type AccountingSubjectKind =
  | 'lodging'
  | 'entry_fee'
  | 'tax'
  | 'rental'
  | 'event'
  | 'shop'
  | 'other';

export interface AccountingSubjectSetting {
  id: string;
  name: string;
  defaultUnitPrice: number;
  kind: AccountingSubjectKind;
  sortOrder: number;
  isActive: boolean;
  notes: string;
}

export interface SalesReportCategorySetting {
  id: string;
  parentCategoryName: string;
  subjectIds: string[];
  sortOrder: number;
  isActive: boolean;
}

export interface SalesReportOutputSetting {
  id: string;
  reportName: string;
  includedCategories: string[];
  splitByCategory: boolean;
  outputFormat: 'pdf';
  sortOrder: number;
  isActive: boolean;
}

export type RegisterSalePaymentMethod = 'cash' | 'card' | 'paid' | 'other';

export interface PreviewRegisterSaleItem {
  id: string;
  accountingSubjectId: string;
  accountingSubjectName: string;
  parentCategoryName: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

export interface PreviewRegisterSale {
  id: string;
  reservationId: string | null;
  reservationCode: string | null;
  customerName: string;
  siteNumber: string;
  checkInDate: string | null;
  planName: string;
  guests?: number;
  adults?: number;
  children?: number;
  infants?: number;
  saleType: 'register' | 'additional' | 'adjustment' | 'refund';
  paymentMethod: RegisterSalePaymentMethod;
  totalAmount: number;
  receivedAmount: number | null;
  changeAmount: number | null;
  createdAt: string;
  items: PreviewRegisterSaleItem[];
}

export type EasyModeInventoryStatus = 'available' | 'sold_out' | 'inactive';

export interface EasyModeInventoryOverride {
  optionId: string;
  status: EasyModeInventoryStatus;
  remaining: number | null;
  updatedAt: string;
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
