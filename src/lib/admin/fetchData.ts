import { supabase } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type {
  AdminAccountProfile,
  AccountingSubjectSetting,
  EasyModeCategorySetting,
  EasyModeFooterItemSetting,
  EasyModeInventoryOverride,
  SalesReportCategorySetting,
  SalesReportOutputSetting,
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
import { normalizeInventoryOverrides } from '@/lib/easyMode';
import {
  getGeneratedEventSubjectId,
  getGeneratedOptionSubjectId,
  getGeneratedPlanSubjectId,
  getGeneratedSiteSubjectId,
} from '@/lib/accountingSubjects';

type AdminSupabaseClient = SupabaseClient<Database>;

async function postAdminMutation(path: string, body: Record<string, unknown>, fallbackMessage: string) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = typeof payload.error === 'string' ? payload.error : fallbackMessage;
    const code = typeof payload.code === 'string' ? payload.code : 'API_ERROR';
    const details = Array.isArray(payload.details)
      ? payload.details.filter((detail: unknown): detail is string => typeof detail === 'string')
      : [];
    throw new AdminSaveError(message, code, details);
  }
}

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
    waitlist_enabled: Boolean(plan.waitlistEnabled),
    waitlist_max_count: plan.waitlistMaxCount,
    waitlist_start_date: plan.waitlistStartDate || null,
    waitlist_end_date: plan.waitlistEndDate || null,
    waitlist_message: plan.waitlistMessage.trim() || null,
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
    message.includes('is_lodging_tax_applicable') ||
    message.includes('waitlist_enabled') ||
    message.includes('waitlist_max_count') ||
    message.includes('waitlist_start_date') ||
    message.includes('waitlist_end_date') ||
    message.includes('waitlist_message')
  ) {
    return new AdminSaveError(
      'プラン管理に必要なDB列がまだ作成されていません。Supabase の migration を適用してください。',
      'MIGRATION_REQUIRED',
      ['不足している可能性がある列: max_site_count / max_concurrent_reservations / max_guests_per_booking / waitlist_enabled / waitlist_max_count / waitlist_start_date / waitlist_end_date / waitlist_message'],
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

export async function saveSitesToDatabase(supabaseClient: AdminSupabaseClient, sites: AdminSite[]): Promise<void> {
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
  const { data: existingSites, error: existingSitesError } = await supabaseClient.from('sites').select('id');
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
      supabaseClient.from('plan_sites').delete().in('site_id', deletedIds),
      supabaseClient.from('site_closures').delete().in('site_id', deletedIds),
    ]);

    if (deletePlanSitesResult.error) throw deletePlanSitesResult.error;
    if (deleteSiteClosuresResult.error) throw deleteSiteClosuresResult.error;

    const { error: deleteSitesError } = await supabaseClient.from('sites').delete().in('id', deletedIds);
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
      const { error } = await supabaseClient.from('sites').insert(row);
      if (error) throw error;
    } else {
      const { error } = await supabaseClient.from('sites').upsert({ ...row, id: s.id });
      if (error) throw error;
    }
  }
}

export async function saveSites(sites: AdminSite[]): Promise<void> {
  await postAdminMutation('/api/admin/data', { action: 'saveSites', sites }, 'サイト情報の保存に失敗しました。');

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
    .select('*, plan_sites(site_id), plan_options(option_id), waitlist_excluded_periods(id, start_date, end_date)')
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
    waitlistEnabled: row.waitlist_enabled ?? false,
    waitlistMaxCount: row.waitlist_max_count ?? 0,
    waitlistStartDate: row.waitlist_start_date,
    waitlistEndDate: row.waitlist_end_date,
    waitlistMessage: row.waitlist_message ?? '',
    waitlistExcludedPeriods: (row.waitlist_excluded_periods ?? []).map(
      (period: { id: string; start_date: string; end_date: string }) => ({
        id: period.id,
        startDate: period.start_date,
        endDate: period.end_date,
      }),
    ),
    imageUrl: row.image_url ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
  writeAdminCache('plans:all', plans);
  return plans;
}

export async function savePlans(plans: AdminPlan[]): Promise<void> {
  await postAdminMutation('/api/admin/data', { action: 'savePlans', plans }, 'プラン情報の保存に失敗しました。');

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

export async function saveEventsToDatabase(supabaseClient: AdminSupabaseClient, events: AdminEvent[]): Promise<void> {
  const { data: existingEvents, error: existingEventsError } = await supabaseClient.from('events').select('id');
  if (existingEventsError) throw existingEventsError;

  const incomingIds = new Set(
    events
      .map((event) => event.id)
      .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)),
  );
  const deletedIds = (existingEvents ?? []).map((event) => event.id).filter((id) => !incomingIds.has(id));

  if (deletedIds.length > 0) {
    const { error } = await supabaseClient.from('events').delete().in('id', deletedIds);
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
      const { error } = await supabaseClient.from('events').insert(row);
      if (error) throw error;
    } else {
      const { error } = await supabaseClient.from('events').upsert({ ...row, id: e.id });
      if (error) throw error;
    }
  }
}

export async function saveEvents(events: AdminEvent[]): Promise<void> {
  await postAdminMutation('/api/admin/data', { action: 'saveEvents', events }, 'イベント情報の保存に失敗しました。');
}

// ============================================================
// Options
// ============================================================

export async function fetchOptions(planId?: string): Promise<OptionItem[]> {
  const cacheKey = planId ? `options:plan:${planId}` : 'options:all';
  const cached = readAdminCache<OptionItem[]>(cacheKey);
  if (cached) return cached;

  type OptionRow = Database['public']['Tables']['options']['Row'];
  let rows: OptionRow[] = [];

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

  const options: OptionItem[] = rows.map((row) => ({
    id: row.id,
    category: (row.category ?? 'rental') as OptionItem['category'],
    name: row.name,
    description: row.description ?? '',
    price: Number(row.price),
    priceType: (row.price_type ?? 'per_unit') as OptionItem['priceType'],
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

export async function saveOptionsToDatabase(supabaseClient: AdminSupabaseClient, options: OptionItem[]): Promise<void> {
  const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const { data: existingOptions, error: existingOptionsError } = await supabaseClient.from('options').select('id');
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
    const { error: deleteOptionsError } = await supabaseClient.from('options').delete().in('id', deletedIds);
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
      const { error } = await supabaseClient.from('options').insert(row);
      if (error) throw error;
    } else {
      const { error } = await supabaseClient.from('options').upsert({ ...row, id: o.id });
      if (error) throw error;
    }
  }
}

export async function saveOptions(options: OptionItem[]): Promise<void> {
  await postAdminMutation('/api/admin/data', { action: 'saveOptions', options }, 'オプション情報の保存に失敗しました。');

  clearAdminCache(['options:']);
}

// ============================================================
// App Settings (key-value JSONB)
// ============================================================

async function fetchSetting<T>(key: string): Promise<T | null> {
  const response = await fetch(`/api/admin/settings?key=${encodeURIComponent(key)}`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    console.error(`fetchSetting(${key}) error:`, payload);
    return null;
  }

  const payload = await response.json().catch(() => ({}));
  return (payload?.value as T | null) ?? null;
}

async function fetchPublicSetting<T>(key: string): Promise<T | null> {
  const response = await fetch(`/api/settings?key=${encodeURIComponent(key)}`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    console.error(`fetchPublicSetting(${key}) error:`, payload);
    return null;
  }

  const payload = await response.json().catch(() => ({}));
  return (payload?.value as T | null) ?? null;
}

async function saveSetting(key: string, value: unknown): Promise<void> {
  const response = await fetch('/api/admin/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = typeof payload.error === 'string' ? payload.error : '設定の保存に失敗しました。';
    throw new Error(message);
  }
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
    (await fetchPublicSetting<PricingSettings>('pricing_settings')) ?? defaultPricingSettings,
  );
}

export async function savePricingSettings(settings: PricingSettings): Promise<void> {
  await saveSetting('pricing_settings', normalizePricingSettings(settings));
  clearAdminCache(['pricing:']);
}

export async function fetchPolicySettings(): Promise<AdminPolicySettings> {
  return (await fetchPublicSetting<AdminPolicySettings>('policy_settings')) ?? defaultPolicySettings;
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
  return (await fetchPublicSetting<AdminQrScreenSettings>('qr_screen_settings')) ?? defaultQrScreenSettings;
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
  return (await fetchPublicSetting<AdminSiteMapSettings>('site_map_settings')) ?? defaultSiteMapSettings;
}

export async function saveSiteMapSettings(settings: AdminSiteMapSettings): Promise<void> {
  return saveSetting('site_map_settings', settings);
}

// --- Calendar Display ---

const defaultCalendarDisplaySettings: CalendarDisplaySettings = {
  publicBaseUrl: '/availability-calendar',
  thresholds: { warningRatio: 0.3 },
};

function createEasyModeCategoryDefault(
  id: string,
  name: string,
  type: EasyModeCategorySetting['type'],
  icon: string,
  sortOrder: number,
): EasyModeCategorySetting {
  return {
    id,
    name,
    type,
    icon,
    color: '#3B82F6',
    sortOrder,
    isVisible: true,
    targetDevice: 'all',
    targetRole: 'all',
    targetStaffIds: [],
    displayCondition: 'always',
    config: {},
    description: '',
  };
}

function createEasyModeFooterDefault(
  id: string,
  label: string,
  actionType: EasyModeFooterItemSetting['actionType'],
  icon: string,
  sortOrder: number,
  isRequired: boolean,
): EasyModeFooterItemSetting {
  return {
    id,
    label,
    actionType,
    icon,
    sortOrder,
    isVisible: true,
    isRequired,
    customUrl: '',
  };
}

export const defaultEasyModeCategories: EasyModeCategorySetting[] = [
  createEasyModeCategoryDefault('today-guests', '今日のお客様', 'today_guests', '👥', 1),
  createEasyModeCategoryDefault('availability', '空き状況', 'availability', '📅', 2),
  createEasyModeCategoryDefault('checkout', '会計', 'checkout', '🛒', 3),
  createEasyModeCategoryDefault('inventory', '在庫状況', 'inventory', '📦', 4),
  createEasyModeCategoryDefault('staff-memos', 'やることメモ', 'staff_memos', '📝', 5),
  createEasyModeCategoryDefault('reservations', '予約一覧', 'reservations', '📋', 6),
];

export const defaultEasyModeFooterItems: EasyModeFooterItemSetting[] = [
  createEasyModeFooterDefault('home', 'ホーム', 'home', '🏠', 1, true),
  createEasyModeFooterDefault('new-reservation', '予約登録', 'new_reservation', '➕', 2, false),
  createEasyModeFooterDefault('cancel', 'キャンセル', 'cancel', '❌', 3, false),
  createEasyModeFooterDefault('site-assignment', 'サイト割振', 'site_assignment', '🗺️', 4, false),
  createEasyModeFooterDefault('checkin', 'チェックイン', 'checkin', '✅', 5, true),
  createEasyModeFooterDefault('checkout', '会計', 'checkout', '💰', 6, true),
];

function normalizeEasyModeCategories(
  value: EasyModeCategorySetting[] | null,
): EasyModeCategorySetting[] {
  if (!Array.isArray(value) || value.length === 0) {
    return defaultEasyModeCategories;
  }

  return value
    .map((item, index) => ({
      ...createEasyModeCategoryDefault(
        typeof item?.id === 'string' && item.id ? item.id : `category-${index + 1}`,
        typeof item?.name === 'string' && item.name ? item.name : `カテゴリ${index + 1}`,
        item?.type ?? 'custom_memo',
        typeof item?.icon === 'string' && item.icon ? item.icon : '🧩',
        typeof item?.sortOrder === 'number' ? item.sortOrder : index + 1,
      ),
      ...item,
      targetStaffIds: Array.isArray(item?.targetStaffIds)
        ? item.targetStaffIds.filter((staffId): staffId is string => typeof staffId === 'string')
        : [],
      config:
        item?.config && typeof item.config === 'object' && !Array.isArray(item.config)
          ? item.config
          : {},
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function normalizeEasyModeFooterItems(
  value: EasyModeFooterItemSetting[] | null,
): EasyModeFooterItemSetting[] {
  if (!Array.isArray(value) || value.length === 0) {
    return defaultEasyModeFooterItems;
  }

  return value
    .map((item, index) => ({
      ...createEasyModeFooterDefault(
        typeof item?.id === 'string' && item.id ? item.id : `footer-${index + 1}`,
        typeof item?.label === 'string' && item.label ? item.label : `項目${index + 1}`,
        item?.actionType ?? 'custom_link',
        typeof item?.icon === 'string' && item.icon ? item.icon : '🔗',
        typeof item?.sortOrder === 'number' ? item.sortOrder : index + 1,
        Boolean(item?.isRequired),
      ),
      ...item,
      customUrl: typeof item?.customUrl === 'string' ? item.customUrl : '',
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function fetchCalendarDisplaySettings(): Promise<CalendarDisplaySettings> {
  return (await fetchPublicSetting<CalendarDisplaySettings>('calendar_display_settings')) ?? defaultCalendarDisplaySettings;
}

export async function fetchEasyModeCategories(): Promise<EasyModeCategorySetting[]> {
  return normalizeEasyModeCategories(
    (await fetchSetting<EasyModeCategorySetting[]>('easy_mode_categories')) ?? null,
  );
}

export async function saveEasyModeCategories(categories: EasyModeCategorySetting[]): Promise<void> {
  await saveSetting('easy_mode_categories', categories);
}

export async function fetchEasyModeFooterItems(): Promise<EasyModeFooterItemSetting[]> {
  return normalizeEasyModeFooterItems(
    (await fetchSetting<EasyModeFooterItemSetting[]>('easy_mode_footer_items')) ?? null,
  );
}

export async function saveEasyModeFooterItems(items: EasyModeFooterItemSetting[]): Promise<void> {
  await saveSetting('easy_mode_footer_items', items);
}

export async function fetchEasyModeInventoryOverrides(): Promise<Record<string, EasyModeInventoryOverride>> {
  const value = await fetchSetting<Record<string, EasyModeInventoryOverride>>('easy_mode_inventory_overrides');
  return normalizeInventoryOverrides(value);
}

export async function saveEasyModeInventoryOverrides(
  overrides: Record<string, EasyModeInventoryOverride>,
): Promise<void> {
  await saveSetting('easy_mode_inventory_overrides', overrides);
}

function normalizeSalesReportCategories(
  value: SalesReportCategorySetting[] | null,
): SalesReportCategorySetting[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => ({
      id: typeof item?.id === 'string' && item.id ? item.id : `sales-category-${index + 1}`,
      parentCategoryName:
        typeof item?.parentCategoryName === 'string' && item.parentCategoryName.trim()
          ? item.parentCategoryName.trim()
          : 'その他売上',
      subjectIds: Array.isArray(item?.subjectIds)
        ? Array.from(
            new Set(
              item.subjectIds.filter(
                (subjectId): subjectId is string =>
                  typeof subjectId === 'string' && subjectId.trim().length > 0,
              ),
            ),
          )
        : [],
      sortOrder: typeof item?.sortOrder === 'number' ? item.sortOrder : index + 1,
      isActive: item?.isActive !== false,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function normalizeAccountingSubjects(
  value: AccountingSubjectSetting[] | null,
): AccountingSubjectSetting[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => ({
      id: typeof item?.id === 'string' && item.id ? item.id : `accounting-subject-${index + 1}`,
      name:
        typeof item?.name === 'string' && item.name.trim()
          ? item.name.trim()
          : `会計科目${index + 1}`,
      defaultUnitPrice: Number.isFinite(Number(item?.defaultUnitPrice))
        ? Number(item.defaultUnitPrice)
        : 0,
      kind:
        item?.kind === 'lodging' ||
        item?.kind === 'entry_fee' ||
        item?.kind === 'tax' ||
        item?.kind === 'rental' ||
        item?.kind === 'event' ||
        item?.kind === 'shop' ||
        item?.kind === 'other'
          ? item.kind
          : 'other',
      sortOrder: typeof item?.sortOrder === 'number' ? item.sortOrder : index + 1,
      isActive: item?.isActive !== false,
      notes: typeof item?.notes === 'string' ? item.notes : '',
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

async function buildGeneratedAccountingSubjects(): Promise<AccountingSubjectSetting[]> {
  const [plans, sites, events, options] = await Promise.all([
    fetchPlans(),
    fetchSites(),
    fetchEvents(),
    fetchOptions(),
  ]);

  const generated: AccountingSubjectSetting[] = [];

  plans.forEach((plan) => {
    if (plan.basePrice > 0) {
      generated.push({
        id: getGeneratedPlanSubjectId(plan.id, 'base'),
        name: plan.name,
        defaultUnitPrice: plan.basePrice,
        kind: 'lodging',
        sortOrder: 0,
        isActive: true,
        notes: 'プラン管理から自動反映',
      });
    }

    if (plan.adultPrice > 0) {
      generated.push({
        id: getGeneratedPlanSubjectId(plan.id, 'adult'),
        name: `${plan.name} 大人料金`,
        defaultUnitPrice: plan.adultPrice,
        kind: 'lodging',
        sortOrder: 0,
        isActive: true,
        notes: 'プラン管理から自動反映',
      });
    }

    if (plan.childPrice > 0) {
      generated.push({
        id: getGeneratedPlanSubjectId(plan.id, 'child'),
        name: `${plan.name} 子ども料金`,
        defaultUnitPrice: plan.childPrice,
        kind: 'lodging',
        sortOrder: 0,
        isActive: true,
        notes: 'プラン管理から自動反映',
      });
    }

    if (plan.infantPrice > 0) {
      generated.push({
        id: getGeneratedPlanSubjectId(plan.id, 'infant'),
        name: `${plan.name} 幼児料金`,
        defaultUnitPrice: plan.infantPrice,
        kind: 'lodging',
        sortOrder: 0,
        isActive: true,
        notes: 'プラン管理から自動反映',
      });
    }
  });

  sites.forEach((site) => {
    if (site.basePrice > 0) {
      generated.push({
        id: getGeneratedSiteSubjectId(site.id, 'base'),
        name: `${site.siteName} 基本料金`,
        defaultUnitPrice: site.basePrice,
        kind: 'lodging',
        sortOrder: 0,
        isActive: true,
        notes: 'サイト管理から自動反映',
      });
    }

    if (site.designationFee > 0) {
      generated.push({
        id: getGeneratedSiteSubjectId(site.id, 'designation'),
        name: `${site.siteName} 指定料金`,
        defaultUnitPrice: site.designationFee,
        kind: 'lodging',
        sortOrder: 0,
        isActive: true,
        notes: 'サイト管理から自動反映',
      });
    }
  });

  events.forEach((event) => {
    generated.push({
      id: getGeneratedEventSubjectId(event.id),
      name: event.title,
      defaultUnitPrice: 0,
      kind: 'event',
      sortOrder: 0,
      isActive: true,
      notes: 'イベント管理から自動反映',
    });
  });

  options.forEach((option) => {
    generated.push({
      id: getGeneratedOptionSubjectId(option.id),
      name: option.name,
      defaultUnitPrice: option.price,
      kind: option.category === 'event' ? 'event' : 'rental',
      sortOrder: 0,
      isActive: true,
      notes: 'オプション管理から自動反映',
    });
  });

  return generated;
}

function mergeAccountingSubjects(
  savedSubjects: AccountingSubjectSetting[],
  generatedSubjects: AccountingSubjectSetting[],
): AccountingSubjectSetting[] {
  const savedMap = new Map(savedSubjects.map((subject) => [subject.id, subject]));
  const manualSubjects = savedSubjects.filter((subject) => !subject.id.startsWith('generated-'));

  const mergedGenerated = generatedSubjects.map((subject, index) => {
    const saved = savedMap.get(subject.id);
    return {
      ...subject,
      kind: saved?.kind ?? subject.kind,
      sortOrder: saved?.sortOrder ?? manualSubjects.length + index + 1,
      isActive: saved?.isActive ?? subject.isActive,
      notes: saved?.notes ?? subject.notes,
    };
  });

  const mergedManual = manualSubjects.map((subject, index) => ({
    ...subject,
    sortOrder: subject.sortOrder || index + 1,
  }));

  return [...mergedManual, ...mergedGenerated].sort((a, b) => a.sortOrder - b.sortOrder);
}

function normalizeSalesReportOutputs(
  value: SalesReportOutputSetting[] | null,
): SalesReportOutputSetting[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => ({
      id: typeof item?.id === 'string' && item.id ? item.id : `sales-output-${index + 1}`,
      reportName:
        typeof item?.reportName === 'string' && item.reportName.trim()
          ? item.reportName.trim()
          : `売上日報${index + 1}`,
      includedCategories: Array.isArray(item?.includedCategories)
        ? item.includedCategories.filter((category): category is string => typeof category === 'string' && category.trim().length > 0)
        : [],
      splitByCategory: Boolean(item?.splitByCategory),
      outputFormat: 'pdf' as const,
      sortOrder: typeof item?.sortOrder === 'number' ? item.sortOrder : index + 1,
      isActive: item?.isActive !== false,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function fetchSalesReportCategories(): Promise<SalesReportCategorySetting[]> {
  return normalizeSalesReportCategories(
    (await fetchSetting<SalesReportCategorySetting[]>('sales_report_categories')) ?? null,
  );
}

export async function saveSalesReportCategories(categories: SalesReportCategorySetting[]): Promise<void> {
  await saveSetting('sales_report_categories', normalizeSalesReportCategories(categories));
}

export async function fetchAccountingSubjects(): Promise<AccountingSubjectSetting[]> {
  const savedSubjects = normalizeAccountingSubjects(
    (await fetchSetting<AccountingSubjectSetting[]>('accounting_subjects')) ?? null,
  );
  const generatedSubjects = await buildGeneratedAccountingSubjects();
  return mergeAccountingSubjects(savedSubjects, generatedSubjects);
}

export async function saveAccountingSubjects(subjects: AccountingSubjectSetting[]): Promise<void> {
  await saveSetting('accounting_subjects', normalizeAccountingSubjects(subjects));
}

export async function fetchSalesReportOutputSettings(): Promise<SalesReportOutputSetting[]> {
  return normalizeSalesReportOutputs(
    (await fetchSetting<SalesReportOutputSetting[]>('sales_report_output_settings')) ?? null,
  );
}

export async function saveSalesReportOutputSettings(settings: SalesReportOutputSetting[]): Promise<void> {
  await saveSetting('sales_report_output_settings', normalizeSalesReportOutputs(settings));
}

// --- Admin Account ---

const defaultAdminAccount: AdminAccountProfile = {
  userName: '',
  email: '',
  allowConcurrentLogin: false,
  isInitialized: false,
};

export async function fetchAdminAccount(): Promise<AdminAccountProfile> {
  const response = await fetch('/api/admin/settings?key=admin_account');
  if (!response.ok) return defaultAdminAccount;
  const payload = await response.json().catch(() => ({}));
  const value = (payload.value as Partial<AdminAccountProfile> | null) ?? null;
  return {
    ...defaultAdminAccount,
    userName: typeof value?.userName === 'string' ? value.userName : defaultAdminAccount.userName,
    email: typeof value?.email === 'string' ? value.email : defaultAdminAccount.email,
    allowConcurrentLogin: typeof value?.allowConcurrentLogin === 'boolean' ? value.allowConcurrentLogin : defaultAdminAccount.allowConcurrentLogin,
    isInitialized: typeof value?.isInitialized === 'boolean' ? value.isInitialized : defaultAdminAccount.isInitialized,
  };
}

export async function saveAdminAccount(account: AdminAccountProfile): Promise<void> {
  const sanitizedAccount: AdminAccountProfile = {
    userName: account.userName,
    email: account.email,
    allowConcurrentLogin: account.allowConcurrentLogin,
    isInitialized: account.isInitialized,
  };
  return saveSetting('admin_account', sanitizedAccount);
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

export async function saveSalesRuleToDatabase(supabaseClient: AdminSupabaseClient, rule: SalesRule): Promise<void> {
  // closed_dates を置換
  await supabaseClient.from('closed_dates').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // delete all
  if (rule.closedDates.length > 0) {
    await supabaseClient.from('closed_dates').insert(
      rule.closedDates.map((d) => ({ closed_date: d })),
    );
  }

  // closed_date_ranges を置換
  await supabaseClient.from('closed_date_ranges').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (rule.closedDateRanges.length > 0) {
    await supabaseClient.from('closed_date_ranges').insert(
      rule.closedDateRanges.map((r) => ({
        start_date: r.startDate,
        end_date: r.endDate,
        reason: r.reason,
      })),
    );
  }

  // site_closures を置換
  await supabaseClient.from('site_closures').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (rule.siteClosures.length > 0) {
    await supabaseClient.from('site_closures').insert(
      rule.siteClosures.map((c) => ({
        site_id: c.siteId,
        start_date: c.startDate,
        end_date: c.endDate,
        reason: c.reason,
      })),
    );
  }
}

export async function saveSalesRule(rule: SalesRule): Promise<void> {
  await postAdminMutation('/api/admin/data', { action: 'saveSalesRule', rule }, '販売ルールの保存に失敗しました。');

  clearAdminCache(['sales-rule']);
}

// ============================================================
// Admin Members / Invites
// ============================================================

export async function fetchAdminMembers(): Promise<AdminMember[]> {
  const response = await fetch('/api/admin/members');
  if (!response.ok) { console.error('fetchAdminMembers error:', response.statusText); return []; }
  const payload = await response.json().catch(() => ({}));
  const data = Array.isArray(payload.members) ? payload.members : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((r: any) => ({
    id: r.id,
    userName: r.user_name,
    email: r.email,
    role: r.role,
    invitedAt: r.invited_at,
    activatedAt: r.activated_at,
  }));
}

export async function fetchAdminInvites(): Promise<AdminMemberInvite[]> {
  const response = await fetch('/api/admin/members');
  if (!response.ok) { console.error('fetchAdminInvites error:', response.statusText); return []; }
  const payload = await response.json().catch(() => ({}));
  const data = Array.isArray(payload.invites) ? payload.invites : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((r: any) => ({
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

