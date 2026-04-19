import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type {
  AdminAccountProfile,
  AdminEvent,
  AdminMember,
  AdminMemberInvite,
  AdminPlan,
  AdminPolicySettings,
  AdminQrScreenSettings,
  AdminSite,
  AdminSiteMapSettings,
  CalendarDisplaySettings,
  SalesRule,
} from '@/types/admin';
import type { OptionItem } from '@/types/options';
import type { PricingSettings } from '@/types/pricing';
import type { ReservationDetail } from '@/types/reservation';
import type { SiteDetail } from '@/types/site';
import {
  coerceReservationPricingBreakdown,
  defaultPricingSettings,
  normalizeGuestBandRules,
  normalizePricingSettings,
} from '@/lib/pricing';

export class AdminSaveError extends Error {
  code: string;
  details: string[];

  constructor(message: string, code = 'UNKNOWN', details: string[] = []) {
    super(message);
    this.name = 'AdminSaveError';
    this.code = code;
    this.details = details;
  }
}

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const ADMIN_DATA_CACHE_TTL_MS = 5_000;
const adminDataCache = new Map<string, CacheEntry<unknown>>();

function readAdminCache<T>(key: string): T | null {
  const entry = adminDataCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    adminDataCache.delete(key);
    return null;
  }
  return entry.value as T;
}

function writeAdminCache<T>(key: string, value: T) {
  adminDataCache.set(key, {
    value,
    expiresAt: Date.now() + ADMIN_DATA_CACHE_TTL_MS,
  });
}

function clearAdminCache(prefixes: string[]) {
  for (const key of adminDataCache.keys()) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      adminDataCache.delete(key);
    }
  }
}

function isNetworkFetchError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.toLowerCase().includes('failed to fetch')
  );
}

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

function buildPlanValidationErrors(plans: AdminPlan[]) {
  const errors: string[] = [];

  plans.forEach((plan, index) => {
    const label = plan.name.trim() || `プラン${index + 1}`;

    if (!plan.name.trim()) errors.push(`${label}: プラン名は必須です。`);
    if (!plan.description.trim()) errors.push(`${label}: 説明は必須です。`);
    if (!Number.isFinite(plan.basePrice) || plan.basePrice < 0) errors.push(`${label}: 基本料金は0以上で入力してください。`);
    if (plan.pricingMode !== 'per_group' && plan.pricingMode !== 'per_person') {
      errors.push(`${label}: 料金計算パターンを選択してください。`);
    }
    if (plan.pricingMode === 'per_person') {
      if (!Number.isFinite(plan.adultPrice) || plan.adultPrice < 0) {
        errors.push(`${label}: 大人(中学生以上)単価は0円以上で入力してください。`);
      }
      if (!Number.isFinite(plan.childPrice) || plan.childPrice < 0) {
        errors.push(`${label}: 子ども単価は0円以上で入力してください。`);
      }
      if (!Number.isFinite(plan.infantPrice) || plan.infantPrice < 0) {
        errors.push(`${label}: 幼児単価は0円以上で入力してください。`);
      }
    }
    if (!Number.isInteger(plan.maxSiteCount) || plan.maxSiteCount < 1) errors.push(`${label}: 上限サイト数は1以上の整数で入力してください。`);
    if (!Number.isInteger(plan.maxConcurrentReservations) || plan.maxConcurrentReservations < 1) {
      errors.push(`${label}: 同時予約上限数は1以上の整数で入力してください。`);
    }
    if (!Number.isInteger(plan.maxGuestsPerReservation) || plan.maxGuestsPerReservation < 1) {
      errors.push(`${label}: 1度の予約にあたる上限定員数は1以上の整数で入力してください。`);
    }
    if (
      plan.salesStartDate &&
      plan.salesEndDate &&
      new Date(plan.salesStartDate).getTime() > new Date(plan.salesEndDate).getTime()
    ) {
      errors.push(`${label}: 予約可能期間の終了日は開始日以降にしてください。`);
    }
  });

  return errors;
}

function toAdminSaveError(error: unknown, fallbackMessage: string): AdminSaveError {
  if (error instanceof AdminSaveError) return error;

  const message =
    typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
      ? error.message
      : fallbackMessage;
  const code =
    typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : 'UNKNOWN';

  if (
    code === '42703' ||
    message.includes('max_site_count') ||
    message.includes('max_concurrent_reservations') ||
    message.includes('max_guests_per_booking') ||
    message.includes('is_lodging_tax_applicable')
  ) {
    return new AdminSaveError(
      'プラン管理に必要なDB列がまだ作成されていません。Supabase の migration を適用してください。',
      'MIGRATION_REQUIRED',
      ['不足している可能性がある列: max_site_count / max_concurrent_reservations / max_guests_per_booking'],
    );
  }

  if (code === '23502') {
    return new AdminSaveError('必須項目が不足しているため保存できません。入力内容を確認してください。', code);
  }

  if (code === '23503') {
    return new AdminSaveError('関連するサイト情報との紐付けに失敗しました。対象サイトが存在するか確認してください。', code);
  }

  return new AdminSaveError(message || fallbackMessage, code);
}

// ============================================================
// Sites
// ============================================================

type SiteRow = Database['public']['Tables']['sites']['Row'];

function mapSiteRow(row: SiteRow): AdminSite {
  const feat = row.features as { water?: boolean; electricity?: boolean; sewer?: boolean } | null;
  return {
    id: row.id,
    siteNumber: row.site_number,
    siteName: row.site_name ?? '',
    area: row.area ?? '',
    subArea: row.sub_area ?? '',
    status: (row.site_status as AdminSite['status']) ?? 'active',
    capacity: row.capacity,
    basePrice: Number(row.price_per_night),
    designationFee: Number(row.designation_fee ?? 0),
    isPublished: row.is_published ?? true,
    slopeRating: row.slope_rating ?? 3,
    facilityDistance: row.distance_to_facilities ?? 0,
    featureNote: row.feature_note ?? row.description ?? '',
    waterAvailable: feat?.water ?? false,
    electricAvailable: feat?.electricity ?? false,
    sewerAvailable: feat?.sewer ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchSites(): Promise<AdminSite[]> {
  const cached = readAdminCache<AdminSite[]>('sites:all');
  if (cached) return cached;
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .order('site_number');
  if (error) { console.error('fetchSites error:', error); return []; }
  const sites = (data ?? []).map((row) => mapSiteRow(row));
  writeAdminCache('sites:all', sites);
  return sites;
}

export async function saveSites(sites: AdminSite[]): Promise<void> {
  const normalizedSiteNumbers = new Set<string>();
  for (const site of sites) {
    const siteLabel = site.siteNumber?.trim() || site.siteName?.trim() || 'サイト';

    if (!site.siteNumber?.trim()) {
      throw new AdminSaveError(`${siteLabel}: サイト番号を入力してください。`, 'VALIDATION_ERROR');
    }
    if (!site.siteName?.trim()) {
      throw new AdminSaveError(`${siteLabel}: サイト名を入力してください。`, 'VALIDATION_ERROR');
    }
    if (normalizedSiteNumbers.has(site.siteNumber.trim())) {
      throw new AdminSaveError(
        `${site.siteNumber.trim()}: 同じサイト番号が重複しています。`,
        'DUPLICATE_SITE_NUMBER',
      );
    }
    normalizedSiteNumbers.add(site.siteNumber.trim());
  }

  const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const { data: existingSites, error: existingSitesError } = await supabase.from('sites').select('id');
  if (existingSitesError) throw existingSitesError;

  const incomingIds = new Set(
    sites
      .map((site) => site.id)
      .filter((id) => isUuid(id)),
  );
  const deletedIds = (existingSites ?? [])
    .map((site) => site.id)
    .filter((id) => !incomingIds.has(id));

  if (deletedIds.length > 0) {
    const [deletePlanSitesResult, deleteSiteClosuresResult] = await Promise.all([
      supabase.from('plan_sites').delete().in('site_id', deletedIds),
      supabase.from('site_closures').delete().in('site_id', deletedIds),
    ]);

    if (deletePlanSitesResult.error) throw deletePlanSitesResult.error;
    if (deleteSiteClosuresResult.error) throw deleteSiteClosuresResult.error;

    const { error: deleteSitesError } = await supabase.from('sites').delete().in('id', deletedIds);
    if (deleteSitesError) throw deleteSitesError;
  }

  for (const s of sites) {
    const row = {
      site_number: s.siteNumber.trim(),
      site_name: s.siteName.trim(),
      area: s.area.trim(),
      sub_area: s.subArea.trim(),
      site_status: s.status,
      capacity: s.capacity,
      price_per_night: s.basePrice,
      designation_fee: s.designationFee,
      is_published: s.isPublished,
      slope_rating: s.slopeRating,
      distance_to_facilities: s.facilityDistance,
      feature_note: s.featureNote,
      features: { water: s.waterAvailable, electricity: s.electricAvailable, sewer: s.sewerAvailable },
    };

    if (!s.id || !isUuid(s.id)) {
      const { error } = await supabase.from('sites').insert(row);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('sites').upsert({ ...row, id: s.id });
      if (error) throw error;
    }
  }

  clearAdminCache(['sites:']);
}

// ============================================================
// Plans
// ============================================================

export async function fetchPlans(): Promise<AdminPlan[]> {
  const cached = readAdminCache<AdminPlan[]>('plans:all');
  if (cached) return cached;
  const { data, error } = await supabase
    .from('plans')
    .select('*, plan_sites(site_id), plan_options(option_id)')
    .order('created_at');
  if (error) { console.error('fetchPlans error:', error); return []; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plans = (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    category: row.category ?? '',
    features: row.features ?? '',
    isPublished: row.is_published,
    pricingMode:
      row.pricing_mode === 'per_person' || row.pricing_mode === 'guest_band'
        ? row.pricing_mode
        : 'per_group',
    basePrice: Number(row.base_price),
    adultPrice: Number(row.adult_price ?? 0),
    childPrice: Number(row.child_price ?? 0),
    infantPrice: Number(row.infant_price ?? 0),
    guestBandRules: normalizeGuestBandRules((row.guest_band_rules as AdminPlan['guestBandRules'] | null) ?? []),
    targetSiteIds: (row.plan_sites ?? []).map((ps: { site_id: string }) => ps.site_id),
    applicableOptionIds: (row.plan_options ?? []).map((po: { option_id: string }) => po.option_id),
    capacity: row.capacity,
    maxSiteCount: row.max_site_count ?? row.capacity,
    maxConcurrentReservations: row.max_concurrent_reservations ?? row.capacity,
    maxGuestsPerReservation: row.max_guests_per_booking ?? row.capacity,
    isLodgingTaxApplicable: row.is_lodging_tax_applicable ?? false,
    salesStartDate: row.sales_start_date,
    salesEndDate: row.sales_end_date,
    imageUrl: row.image_url ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
  writeAdminCache('plans:all', plans);
  return plans;
}

export async function savePlans(plans: AdminPlan[]): Promise<void> {
  const { data: existingPlans, error: existingPlansError } = await supabase.from('plans').select('id');
  if (existingPlansError) throw existingPlansError;

  const incomingIds = new Set(
    plans
      .map((plan) => plan.id)
      .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)),
  );
  const deletedIds = (existingPlans ?? []).map((plan) => plan.id).filter((id) => !incomingIds.has(id));

  if (deletedIds.length > 0) {
    const { error } = await supabase.from('plans').delete().in('id', deletedIds);
    if (error) throw error;
  }

  for (const plan of plans) {
    const isNew = !plan.id || !plan.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    const row = normalizePlanRow(plan);

    let planId = plan.id;

    if (isNew) {
      const { data, error } = await supabase.from('plans').insert(row).select('id').single();
      if (error) throw error;
      planId = data.id;
    } else {
      const { error } = await supabase.from('plans').upsert({ ...row, id: plan.id });
      if (error) throw error;
    }

    // plan_sites 再構築
    const { error: deletePlanSitesError } = await supabase.from('plan_sites').delete().eq('plan_id', planId);
    if (deletePlanSitesError) throw deletePlanSitesError;
    if (plan.targetSiteIds.length > 0) {
      const { error: insertPlanSitesError } = await supabase.from('plan_sites').insert(
        plan.targetSiteIds.map((siteId) => ({ plan_id: planId, site_id: siteId })),
      );
      if (insertPlanSitesError) throw insertPlanSitesError;
    }

    const { error: deletePlanOptionsError } = await supabase
      .from('plan_options')
      .delete()
      .eq('plan_id', planId);
    if (deletePlanOptionsError) throw deletePlanOptionsError;

    if (plan.applicableOptionIds.length > 0) {
      const { error: insertPlanOptionsError } = await supabase.from('plan_options').insert(
        plan.applicableOptionIds.map((optionId) => ({ plan_id: planId, option_id: optionId })),
      );
      if (insertPlanOptionsError) throw insertPlanOptionsError;
    }
  }

  clearAdminCache(['plans:', 'options:']);
}

// ============================================================
// Events
// ============================================================

export async function fetchEvents(): Promise<AdminEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('start_at');
  if (error) { console.error('fetchEvents error:', error); return []; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    startAt: row.start_at,
    endAt: row.end_at,
    location: row.location ?? '',
    imageUrl: row.image_url ?? '',
    isPublished: row.is_published,
  }));
}

export async function saveEvents(events: AdminEvent[]): Promise<void> {
  const { data: existingEvents, error: existingEventsError } = await supabase.from('events').select('id');
  if (existingEventsError) throw existingEventsError;

  const incomingIds = new Set(
    events
      .map((event) => event.id)
      .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)),
  );
  const deletedIds = (existingEvents ?? []).map((event) => event.id).filter((id) => !incomingIds.has(id));

  if (deletedIds.length > 0) {
    const { error } = await supabase.from('events').delete().in('id', deletedIds);
    if (error) throw error;
  }

  const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  for (const e of events) {
    const row = {
      title: e.title,
      description: e.description,
      start_at: e.startAt,
      end_at: e.endAt,
      location: e.location,
      image_url: e.imageUrl,
      is_published: e.isPublished,
    };
    if (!e.id || !isUuid(e.id)) {
      const { error } = await supabase.from('events').insert(row);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('events').upsert({ ...row, id: e.id });
      if (error) throw error;
    }
  }
}

// ============================================================
// Options
// ============================================================

export async function fetchOptions(planId?: string): Promise<OptionItem[]> {
  const cacheKey = planId ? `options:plan:${planId}` : 'options:all';
  const cached = readAdminCache<OptionItem[]>(cacheKey);
  if (cached) return cached;

  let rows: any[] = [];

  if (planId) {
    const { data: planOptionRows, error: planOptionError } = await supabase
      .from('plan_options')
      .select('option_id')
      .eq('plan_id', planId);
    if (planOptionError) { console.error('fetchOptions(plan) error:', planOptionError); return []; }

    const optionIds = Array.from(
      new Set(
        (planOptionRows ?? [])
          .map((row: { option_id: string | null }) => row.option_id)
          .filter((value): value is string => typeof value === 'string' && value.length > 0),
      ),
    );

    if (optionIds.length === 0) {
      writeAdminCache(cacheKey, []);
      return [];
    }

    const { data: optionRows, error: optionError } = await supabase
      .from('options')
      .select('*')
      .in('id', optionIds)
      .order('name');

    if (optionError) { console.error('fetchOptions(plan details) error:', optionError); return []; }
    rows = optionRows ?? [];
  } else {
    const { data, error } = await supabase
      .from('options')
      .select('*')
      .order('name');
    if (error) { console.error('fetchOptions error:', error); return []; }
    rows = data ?? [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options = rows.map((row: any) => ({
    id: row.id,
    category: row.category ?? 'rental',
    name: row.name,
    description: row.description ?? '',
    price: Number(row.price),
    priceType: row.price_type ?? 'per_unit',
    unitLabel: row.unit_label ?? '個',
    maxQuantity: row.max_quantity ?? 1,
    isActive: row.is_active ?? true,
    imageUrl: row.image_url ?? undefined,
    eventDate: row.event_date ?? undefined,
    duration: row.duration ?? undefined,
    location: row.location ?? undefined,
    capacity: row.capacity ?? undefined,
    currentParticipants: row.current_participants ?? undefined,
  }));
  writeAdminCache(cacheKey, options);
  return options;
}

export async function saveOptions(options: OptionItem[]): Promise<void> {
  const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const { data: existingOptions, error: existingOptionsError } = await supabase.from('options').select('id');
  if (existingOptionsError) throw existingOptionsError;

  const incomingIds = new Set(
    options
      .map((option) => option.id)
      .filter((id) => isUuid(id)),
  );

  const deletedIds = (existingOptions ?? [])
    .map((option) => option.id)
    .filter((id) => !incomingIds.has(id));

  if (deletedIds.length > 0) {
    const { error: deleteOptionsError } = await supabase.from('options').delete().in('id', deletedIds);
    if (deleteOptionsError) throw deleteOptionsError;
  }

  for (const o of options) {
    const row = {
      name: o.name,
      description: o.description,
      price: o.price,
      is_active: o.isActive,
      category: o.category,
      price_type: o.priceType,
      unit_label: o.unitLabel,
      max_quantity: o.maxQuantity,
      image_url: o.imageUrl ?? null,
      event_date: o.eventDate ?? null,
      duration: o.duration ?? null,
      location: o.location ?? null,
      capacity: o.capacity ?? null,
      current_participants: o.currentParticipants ?? 0,
    };
    if (!o.id || !isUuid(o.id)) {
      const { error } = await supabase.from('options').insert(row);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('options').upsert({ ...row, id: o.id });
      if (error) throw error;
    }
  }

  clearAdminCache(['options:']);
}

// ============================================================
// App Settings (key-value JSONB)
// ============================================================

async function fetchSetting<T>(key: string): Promise<T | null> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .single();
  if (error) { console.error(`fetchSetting(${key}) error:`, error); return null; }
  return data.value as T;
}

async function saveSetting(key: string, value: unknown): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key, value: value as Database['public']['Tables']['app_settings']['Row']['value'] });
  if (error) throw error;
}

// --- Policy ---

const defaultPolicySettings: AdminPolicySettings = {
  paymentNotice: '',
  eventEntryNotice: '',
  paymentMethods: [],
  cancellationPolicies: [],
  termsSections: [],
};

export async function fetchPricingSettings(): Promise<PricingSettings> {
  return normalizePricingSettings(
    (await fetchSetting<PricingSettings>('pricing_settings')) ?? defaultPricingSettings,
  );
}

export async function savePricingSettings(settings: PricingSettings): Promise<void> {
  await saveSetting('pricing_settings', normalizePricingSettings(settings));
  clearAdminCache(['pricing:']);
}

export async function fetchPolicySettings(): Promise<AdminPolicySettings> {
  return (await fetchSetting<AdminPolicySettings>('policy_settings')) ?? defaultPolicySettings;
}

export async function savePolicySettings(settings: AdminPolicySettings): Promise<void> {
  return saveSetting('policy_settings', settings);
}

// --- QR Screen ---

const defaultQrScreenSettings: AdminQrScreenSettings = {
  title: '',
  description: '',
  supportText: '',
  externalLinkLabel: '',
  externalLinkUrl: '',
  footerNote: '',
};

export async function fetchQrScreenSettings(): Promise<AdminQrScreenSettings> {
  return (await fetchSetting<AdminQrScreenSettings>('qr_screen_settings')) ?? defaultQrScreenSettings;
}

export async function saveQrScreenSettings(settings: AdminQrScreenSettings): Promise<void> {
  return saveSetting('qr_screen_settings', settings);
}

// --- Site Map ---

const defaultSiteMapSettings: AdminSiteMapSettings = {
  description: '',
  imageUrls: [],
};

export async function fetchSiteMapSettings(): Promise<AdminSiteMapSettings> {
  return (await fetchSetting<AdminSiteMapSettings>('site_map_settings')) ?? defaultSiteMapSettings;
}

export async function saveSiteMapSettings(settings: AdminSiteMapSettings): Promise<void> {
  return saveSetting('site_map_settings', settings);
}

// --- Calendar Display ---

const defaultCalendarDisplaySettings: CalendarDisplaySettings = {
  publicBaseUrl: '/availability-calendar',
  thresholds: { warningRatio: 0.3 },
};

export async function fetchCalendarDisplaySettings(): Promise<CalendarDisplaySettings> {
  return (await fetchSetting<CalendarDisplaySettings>('calendar_display_settings')) ?? defaultCalendarDisplaySettings;
}

// --- Admin Account ---

const defaultAdminAccount: AdminAccountProfile = {
  userName: '',
  email: '',
  password: '',
  allowConcurrentLogin: false,
  isInitialized: false,
};

export async function fetchAdminAccount(): Promise<AdminAccountProfile> {
  return (await fetchSetting<AdminAccountProfile>('admin_account')) ?? defaultAdminAccount;
}

export async function saveAdminAccount(account: AdminAccountProfile): Promise<void> {
  return saveSetting('admin_account', account);
}

// ============================================================
// Sales Rule (closed_dates + closed_date_ranges + site_closures)
// ============================================================

export async function fetchSalesRule(): Promise<SalesRule> {
  const cached = readAdminCache<SalesRule>('sales-rule');
  if (cached) return cached;
  const [datesRes, rangesRes, closuresRes] = await Promise.all([
    supabase.from('closed_dates').select('*').order('closed_date'),
    supabase.from('closed_date_ranges').select('*').order('start_date'),
    supabase.from('site_closures').select('*, sites(site_number, area)').order('start_date'),
  ]);

  const closedDates = (datesRes.data ?? []).map((r: { closed_date: string }) => r.closed_date);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const closedDateRanges = (rangesRes.data ?? []).map((r: any) => ({
    id: r.id,
    startDate: r.start_date,
    endDate: r.end_date,
    reason: r.reason ?? '',
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const siteClosures = (closuresRes.data ?? []).map((r: any) => {
    const start = new Date(r.start_date);
    const end = new Date(r.end_date);
    const dates: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().slice(0, 10));
    }
    return {
      siteId: r.site_id,
      area: r.sites?.area ?? '',
      siteNumber: r.sites?.site_number ?? '',
      startDate: r.start_date,
      endDate: r.end_date,
      dates,
      reason: r.reason ?? '',
    };
  });

  const salesRule = {
    id: 'sales-rule',
    closedDates,
    closedDateRanges,
    siteClosures,
    createdAt: '',
    updatedAt: '',
  };
  writeAdminCache('sales-rule', salesRule);
  return salesRule;
}

export async function saveSalesRule(rule: SalesRule): Promise<void> {
  // closed_dates を置換
  await supabase.from('closed_dates').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // delete all
  if (rule.closedDates.length > 0) {
    await supabase.from('closed_dates').insert(
      rule.closedDates.map((d) => ({ closed_date: d })),
    );
  }

  // closed_date_ranges を置換
  await supabase.from('closed_date_ranges').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (rule.closedDateRanges.length > 0) {
    await supabase.from('closed_date_ranges').insert(
      rule.closedDateRanges.map((r) => ({
        start_date: r.startDate,
        end_date: r.endDate,
        reason: r.reason,
      })),
    );
  }

  // site_closures を置換
  await supabase.from('site_closures').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (rule.siteClosures.length > 0) {
    await supabase.from('site_closures').insert(
      rule.siteClosures.map((c) => ({
        site_id: c.siteId,
        start_date: c.startDate,
        end_date: c.endDate,
        reason: c.reason,
      })),
    );
  }

  clearAdminCache(['sales-rule']);
}

// ============================================================
// Admin Members / Invites
// ============================================================

export async function fetchAdminMembers(): Promise<AdminMember[]> {
  const { data, error } = await supabase
    .from('admin_members')
    .select('*')
    .order('created_at');
  if (error) { console.error('fetchAdminMembers error:', error); return []; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.id,
    userName: r.user_name,
    email: r.email,
    role: r.role,
    invitedAt: r.invited_at,
    activatedAt: r.activated_at,
  }));
}

export async function fetchAdminInvites(): Promise<AdminMemberInvite[]> {
  const { data, error } = await supabase
    .from('admin_invites')
    .select('*')
    .order('created_at');
  if (error) { console.error('fetchAdminInvites error:', error); return []; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.id,
    email: r.email,
    token: r.token,
    status: r.status,
    createdAt: r.created_at,
    usedAt: r.used_at,
  }));
}

// ============================================================
// Reservation (guest_reservations)
// ============================================================

export async function fetchReservationById(id: string): Promise<ReservationDetail | null> {
  const { data, error } = await supabase
    .from('guest_reservations')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = data as any;
  return {
    id: r.id,
    status: r.status,
    checkInDate: r.check_in_date,
    checkOutDate: r.check_out_date,
    guests: r.guests,
    adults: r.adults,
    children: r.children,
    infants: r.infants,
    totalAmount: Number(r.total_amount),
    specialRequests: r.special_requests,
    createdAt: r.created_at,
    qrToken: r.qr_token,
    checkedInAt: r.checked_in_at,
    userName: r.user_name,
    userEmail: r.user_email ?? '',
    siteNumber: r.site_number ?? '',
    siteType: r.site_type ?? 'standard',
    campgroundName: r.campground_name ?? '',
    paymentMethod: r.payment_method,
    paymentStatus: r.payment_status,
    optionsJson: Array.isArray(r.options_json) ? r.options_json : null,
    pricingBreakdown: coerceReservationPricingBreakdown(r.pricing_breakdown),
  };
}

// ============================================================
// SiteDetail (公開側サイト情報)
// ============================================================

export async function fetchSiteDetails(planSiteMap?: Map<string, string[]>): Promise<SiteDetail[]> {
  const sites = await fetchSites();
  let planMap = planSiteMap;
  if (!planMap) {
    const plans = await fetchPlans();
    planMap = new Map<string, string[]>();
    for (const plan of plans) {
      for (const siteId of plan.targetSiteIds) {
        const existing = planMap.get(siteId) ?? [];
        existing.push(plan.id);
        planMap.set(siteId, existing);
      }
    }
  }

  return sites.map((s): SiteDetail => {
    let type: 'auto' | 'family' | 'cottage' = 'auto';
    if (s.subArea.includes('コテージ')) type = 'cottage';
    else if (s.subArea.includes('ファミリー') || s.area.includes('Bエリア')) type = 'family';

    return {
      id: s.id,
      siteNumber: s.siteNumber,
      type,
      areaName: s.area,
      subAreaName: s.subArea,
      siteName: s.siteName,
      description: s.featureNote,
      capacity: s.capacity,
      price: s.basePrice,
      designationFee: s.designationFee,
      features: {
        water: s.waterAvailable,
        electricity: s.electricAvailable,
        sewer: s.sewerAvailable,
      },
      slope: s.slopeRating,
      distance: s.facilityDistance,
      available: s.status === 'active' && s.isPublished,
      imageUrl: '/site-map-placeholder.svg',
      compatiblePlanIds: planMap?.get(s.id) ?? [],
    };
  });
}
