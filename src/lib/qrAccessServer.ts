import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import type { Database, Json } from '@/types/database';

type GuestReservationRow = Database['public']['Tables']['guest_reservations']['Row'];

export const QR_ACCESS_COOKIE = 'qr_access_session';
export const CUSTOMER_CHECKIN_COOKIE = 'customer_checkin_session';
export const QR_ACCESS_MAX_AGE_SECONDS = 60 * 60 * 2;
const QR_ACCESS_SETTING_KEY = 'qr_access_password';
const PBKDF2_ITERATIONS = 210_000;

export interface QrAccessPasswordSetting {
  version: 1;
  algorithm: 'pbkdf2-sha256';
  iterations: number;
  salt: string;
  hash: string;
  updatedAt: string;
}

function getSessionSecret() {
  return process.env.ADMIN_PASSWORD || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'qr-access-fallback';
}

function signSessionPayload(payload: Record<string, unknown>) {
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = createHmac('sha256', getSessionSecret()).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

function decodeVerifiedPayload(token: string) {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const expectedSignature = createHmac('sha256', getSessionSecret()).update(encodedPayload).digest('base64url');
  if (
    signature.length !== expectedSignature.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function createPasswordSetting(password: string): QrAccessPasswordSetting {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha256').toString('hex');
  return {
    version: 1,
    algorithm: 'pbkdf2-sha256',
    iterations: PBKDF2_ITERATIONS,
    salt,
    hash,
    updatedAt: new Date().toISOString(),
  };
}

export function verifyPassword(password: string, setting: QrAccessPasswordSetting) {
  const actual = pbkdf2Sync(password, setting.salt, setting.iterations, 32, 'sha256');
  const expected = Buffer.from(setting.hash, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function fetchQrAccessPasswordSetting() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', QR_ACCESS_SETTING_KEY)
    .maybeSingle();

  if (error) throw error;
  return (data?.value ?? null) as QrAccessPasswordSetting | null;
}

export async function saveQrAccessPasswordSetting(setting: QrAccessPasswordSetting) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: QR_ACCESS_SETTING_KEY, value: setting as unknown as Json });

  if (error) throw error;
}

export function makeQrAccessSessionToken(identity: { reservationId?: string | null; qrToken?: string | null }) {
  const payload = {
    reservationId: identity.reservationId ?? null,
    qrToken: identity.qrToken ?? null,
    exp: Math.floor(Date.now() / 1000) + QR_ACCESS_MAX_AGE_SECONDS,
  };
  return signSessionPayload(payload);
}

export function makeCustomerCheckinSessionToken(identity: { reservationId: string; source?: string | null }) {
  return signSessionPayload({
    reservationId: identity.reservationId,
    source: identity.source ?? 'customer',
    exp: Math.floor(Date.now() / 1000) + QR_ACCESS_MAX_AGE_SECONDS,
  });
}

export function verifyQrAccessSessionToken(
  token: string | undefined,
  identity: { reservationId?: string | null; qrToken?: string | null },
) {
  if (!token) return false;
  const payload = decodeVerifiedPayload(token) as
    | { reservationId?: string | null; qrToken?: string | null; exp?: number }
    | null;
  if (!payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) return false;
  if (identity.reservationId && payload.reservationId !== identity.reservationId) return false;
  if (identity.qrToken && payload.qrToken !== identity.qrToken) return false;
  return true;
}

export function verifyCustomerCheckinSessionToken(
  token: string | undefined,
  identity: { reservationId?: string | null },
) {
  if (!token) return false;
  const payload = decodeVerifiedPayload(token) as
    | { reservationId?: string | null; exp?: number }
    | null;
  if (!payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) return false;
  if (identity.reservationId && payload.reservationId !== identity.reservationId) return false;
  return true;
}

function normalizeComparableValue(value: string | null | undefined) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function isSameQrAccessCustomer(target: GuestReservationRow, candidate: GuestReservationRow) {
  if (target.id === candidate.id) return true;

  const targetIdentifier = normalizeComparableValue(target.user_identifier);
  const candidateIdentifier = normalizeComparableValue(candidate.user_identifier);
  if (targetIdentifier && candidateIdentifier && targetIdentifier === candidateIdentifier) return true;

  const targetEmail = normalizeComparableValue(target.user_email)?.toLowerCase() ?? null;
  const candidateEmail = normalizeComparableValue(candidate.user_email)?.toLowerCase() ?? null;
  if (targetEmail && candidateEmail && targetEmail === candidateEmail) return true;

  const targetPhone = normalizeComparableValue(target.user_phone);
  const candidatePhone = normalizeComparableValue(candidate.user_phone);
  if (targetPhone && candidatePhone && targetPhone === candidatePhone) return true;

  return false;
}

export function getQrAccessSupabaseClient() {
  return getSupabaseAdminClient();
}
