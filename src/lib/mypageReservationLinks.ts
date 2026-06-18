import 'server-only';

import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import type { Database } from '@/types/database';

export const MYPAGE_RESERVATION_LINKS_SETTING_KEY = 'mypage_reservation_links';

export type MyPageVerifiedLevel = 'support' | 'phone_verified' | 'password_verified';

export interface MyPageReservationLink {
  reservationId: string;
  userIdentifier: string | null;
  phone: string | null;
  email: string | null;
  verifiedLevel: MyPageVerifiedLevel;
  updatedAt: string;
}

interface MyPageReservationLinksSetting {
  version: 1;
  links: MyPageReservationLink[];
}

interface DynamicSupabaseSelectResult {
  data: unknown[] | null;
  error: Error | null;
}

interface DynamicSupabaseTable {
  select(columns: string): Promise<DynamicSupabaseSelectResult>;
  upsert(values: Record<string, unknown>, options?: Record<string, unknown>): Promise<{ error: Error | null }>;
}

interface DynamicSupabaseClient {
  from(table: string): DynamicSupabaseTable;
}

function isRecoverableLinkStorageError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === 'string' ? candidate.code : '';
  const message = typeof candidate.message === 'string' ? candidate.message : '';
  return (
    code === '42P01' ||
    code === '42703' ||
    code === '42501' ||
    message.includes('mypage_reservation_links') ||
    message.includes('mypage_access_credentials')
  );
}

type LinkStatus = 'linked' | 'support' | 'unlinked';

interface LinkStatusEntry {
  status: LinkStatus;
  lineUserId: string | null;
}

function createDefaultSetting(): MyPageReservationLinksSetting {
  return {
    version: 1,
    links: [],
  };
}

export function normalizePhone(value: string | null | undefined) {
  return (value ?? '').replace(/\D/g, '');
}

export function normalizeEmail(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

export function buildPhoneVariants(value: string) {
  const digits = normalizePhone(value);
  const variants = new Set<string>();
  if (!digits) return [] as string[];

  variants.add(digits);

  if (digits.length === 11) {
    variants.add(`${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`);
  }

  if (digits.length === 10) {
    variants.add(`${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`);
    variants.add(`${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`);
    variants.add(`${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`);
  }

  return Array.from(variants);
}

function parseLegacySetting(value: unknown): MyPageReservationLinksSetting {
  if (!value || typeof value !== 'object') return createDefaultSetting();

  const links = Array.isArray((value as { links?: unknown[] }).links)
    ? ((value as { links?: unknown[] }).links ?? [])
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null;
          const candidate = entry as Partial<MyPageReservationLink> & { source?: unknown };
          if (typeof candidate.reservationId !== 'string' || candidate.reservationId.length === 0) return null;
          return {
            reservationId: candidate.reservationId,
            userIdentifier:
              typeof candidate.userIdentifier === 'string' && candidate.userIdentifier.length > 0
                ? candidate.userIdentifier
                : null,
            phone: typeof candidate.phone === 'string' && candidate.phone.length > 0 ? candidate.phone : null,
            email: typeof candidate.email === 'string' && candidate.email.length > 0 ? candidate.email : null,
            verifiedLevel:
              candidate.verifiedLevel === 'phone_verified' || candidate.verifiedLevel === 'password_verified'
                ? candidate.verifiedLevel
                : 'support',
            updatedAt:
              typeof candidate.updatedAt === 'string' && candidate.updatedAt.length > 0
                ? candidate.updatedAt
                : new Date(0).toISOString(),
          } satisfies MyPageReservationLink;
        })
        .filter((entry): entry is MyPageReservationLink => Boolean(entry))
    : [];

  return {
    version: 1,
    links,
  };
}

async function readLegacyLinks() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', MYPAGE_RESERVATION_LINKS_SETTING_KEY)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return parseLegacySetting(data?.value ?? null);
}

async function saveLegacyLinks(setting: MyPageReservationLinksSetting) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from('app_settings').upsert({
    key: MYPAGE_RESERVATION_LINKS_SETTING_KEY,
    value: setting as unknown as Database['public']['Tables']['app_settings']['Row']['value'],
  });

  if (error) {
    throw error;
  }
}

function coerceTableLinks(rows: unknown[]): MyPageReservationLink[] {
  return rows.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const candidate = row as Record<string, unknown>;
    const reservationId = typeof candidate.reservation_id === 'string' ? candidate.reservation_id : '';
    if (!reservationId) return [];

    return [
      {
        reservationId,
        userIdentifier:
          typeof candidate.user_identifier === 'string' && candidate.user_identifier.length > 0
            ? candidate.user_identifier
            : null,
        phone: typeof candidate.phone === 'string' && candidate.phone.length > 0 ? candidate.phone : null,
        email: typeof candidate.email === 'string' && candidate.email.length > 0 ? candidate.email : null,
        verifiedLevel:
          candidate.verified_level === 'phone_verified' || candidate.verified_level === 'password_verified'
            ? candidate.verified_level
            : 'support',
        updatedAt:
          typeof candidate.updated_at === 'string' && candidate.updated_at.length > 0
            ? candidate.updated_at
            : new Date(0).toISOString(),
      } satisfies MyPageReservationLink,
    ];
  });
}

async function readTableLinks() {
  const supabase = getSupabaseAdminClient() as unknown as DynamicSupabaseClient;
  try {
    const { data, error } = await supabase
      .from('mypage_reservation_links')
      .select('reservation_id, user_identifier, phone, email, verified_level, updated_at');

    if (error) throw error;
    return coerceTableLinks(Array.isArray(data) ? data : []);
  } catch (error) {
    if (isRecoverableLinkStorageError(error)) {
      console.error('[mypage-links-storage] fallback to legacy setting', error);
      return [];
    }
    throw error;
  }
}

export async function readMyPageReservationLinks() {
  const [legacySetting, tableLinks] = await Promise.all([readLegacyLinks(), readTableLinks()]);
  const merged = new Map<string, MyPageReservationLink>();

  for (const link of legacySetting.links) {
    merged.set(link.reservationId, link);
  }

  for (const link of tableLinks) {
    merged.set(link.reservationId, link);
  }

  return {
    version: 1 as const,
    links: Array.from(merged.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    ),
  };
}

export async function upsertMyPageReservationLink(link: MyPageReservationLink) {
  const supabase = getSupabaseAdminClient() as unknown as DynamicSupabaseClient;
  try {
    const payload = {
      reservation_id: link.reservationId,
      user_identifier: link.userIdentifier,
      phone: link.phone,
      email: link.email,
      verified_level: link.verifiedLevel,
      linked_at: link.updatedAt,
      updated_at: link.updatedAt,
    };

    const { error } = await supabase.from('mypage_reservation_links').upsert(payload, {
      onConflict: 'reservation_id',
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    if (!isRecoverableLinkStorageError(error)) {
      throw error;
    }
    console.error('[mypage-links-storage] legacy-only upsert fallback', error);
  }

  const current = await readLegacyLinks();
  const nextLinks = current.links.filter((entry) => entry.reservationId !== link.reservationId);
  nextLinks.push(link);
  await saveLegacyLinks({
    version: 1,
    links: nextLinks.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
  });
}

export async function findMyPageLinkedReservationIds(criteria: {
  userId?: string;
  phone?: string;
  email?: string;
  includeSupportMatches?: boolean;
}) {
  const setting = await readMyPageReservationLinks();
  const userId = criteria.userId?.trim() ?? '';
  const phone = normalizePhone(criteria.phone);
  const email = normalizeEmail(criteria.email);
  const includeSupportMatches = criteria.includeSupportMatches ?? false;

  return setting.links
    .filter((entry) => {
      if (userId && entry.userIdentifier === userId) return true;
      if (!includeSupportMatches) return false;
      if (phone && entry.phone && normalizePhone(entry.phone) === phone) return true;
      if (email && entry.email && normalizeEmail(entry.email) === email) return true;
      return false;
    })
    .map((entry) => entry.reservationId);
}

export async function getMyPageLinkStatusMap(
  reservations: Array<{ id: string; userIdentifier?: string | null }>,
): Promise<Record<string, LinkStatusEntry>> {
  const links = await readMyPageReservationLinks();
  const linkByReservationId = new Map(links.links.map((link) => [link.reservationId, link]));

  return reservations.reduce<Record<string, LinkStatusEntry>>((accumulator, reservation) => {
    const link = linkByReservationId.get(reservation.id);
    const lineUserId =
      (typeof reservation.userIdentifier === 'string' && reservation.userIdentifier.length > 0
        ? reservation.userIdentifier
        : null) ??
      link?.userIdentifier ??
      null;

    const status: LinkStatus =
      lineUserId != null ? 'linked' : link?.phone || link?.email ? 'support' : 'unlinked';

    accumulator[reservation.id] = {
      status,
      lineUserId,
    };
    return accumulator;
  }, {});
}
