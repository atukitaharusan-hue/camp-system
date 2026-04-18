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
import type { ReservationDetail } from '@/types/reservation';
import type { SiteDetail } from '@/types/site';

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
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .order('site_number');
  if (error) { console.error('fetchSites error:', error); return []; }
  return (data ?? []).map((row) => mapSiteRow(row));
}

export async function saveSites(sites: AdminSite[]): Promise<void> {
  const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  for (const s of sites) {
    const row = {
      site_number: s.siteNumber,
      site_name: s.siteName,
      area: s.area,
      sub_area: s.subArea,
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
}

// ============================================================
// Plans
// ============================================================

export async function fetchPlans(): Promise<AdminPlan[]> {
  const { data, error } = await supabase
    .from('plans')
    .select('*, plan_sites(site_id)')
    .order('created_at');
  if (error) { console.error('fetchPlans error:', error); return []; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    category: row.category ?? '',
    features: row.features ?? '',
    isPublished: row.is_published,
    basePrice: Number(row.base_price),
    targetSiteIds: (row.plan_sites ?? []).map((ps: { site_id: string }) => ps.site_id),
    capacity: row.capacity,
    salesStartDate: row.sales_start_date,
    salesEndDate: row.sales_end_date,
    imageUrl: row.image_url ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function savePlans(plans: AdminPlan[]): Promise<void> {
  for (const plan of plans) {
    const isNew = !plan.id || !plan.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    const row = {
      name: plan.name,
      description: plan.description,
      is_published: plan.isPublished,
      base_price: plan.basePrice,
      capacity: plan.capacity,
      sales_start_date: plan.salesStartDate,
      sales_end_date: plan.salesEndDate,
      image_url: plan.imageUrl,
    };

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
    await supabase.from('plan_sites').delete().eq('plan_id', planId);
    if (plan.targetSiteIds.length > 0) {
      await supabase.from('plan_sites').insert(
        plan.targetSiteIds.map((siteId) => ({ plan_id: planId, site_id: siteId })),
      );
    }
  }
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

export async function fetchOptions(): Promise<OptionItem[]> {
  const { data, error } = await supabase
    .from('options')
    .select('*')
    .order('name');
  if (error) { console.error('fetchOptions error:', error); return []; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
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
}

export async function saveOptions(options: OptionItem[]): Promise<void> {
  const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
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

  return {
    id: 'sales-rule',
    closedDates,
    closedDateRanges,
    siteClosures,
    createdAt: '',
    updatedAt: '',
  };
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
