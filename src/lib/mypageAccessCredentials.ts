import 'server-only';

import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'crypto';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';

export type MyPageAccessCredentialStatus = 'configured' | 'not_configured';

type AccessCredentialRow = {
  reservation_id: string;
  password_hash: string;
  password_fingerprint: string;
  is_active: boolean;
  passkey_enabled: boolean;
  last_verified_at: string | null;
};

interface DynamicSupabaseQuery {
  select(columns: string): DynamicSupabaseQuery;
  eq(column: string, value: unknown): DynamicSupabaseQuery;
  neq(column: string, value: unknown): DynamicSupabaseQuery;
  maybeSingle(): Promise<{ data: AccessCredentialRow | { reservation_id?: string } | null; error: Error | null }>;
  update(values: Record<string, unknown>): DynamicSupabaseQuery;
  in(column: string, values: string[]): DynamicSupabaseQuery;
  then<TResult1 = { data: unknown[] | null; error: Error | null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown[] | null; error: Error | null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
}

interface DynamicSupabaseTable {
  upsert(values: Record<string, unknown>, options?: Record<string, unknown>): Promise<{ error: Error | null }>;
  select(columns: string): DynamicSupabaseQuery;
  update(values: Record<string, unknown>): DynamicSupabaseQuery;
}

interface DynamicSupabaseClient {
  from(table: string): DynamicSupabaseTable;
}

function hashPassword(password: string, salt?: string) {
  const resolvedSalt = salt ?? randomBytes(16).toString('hex');
  const derived = scryptSync(password, resolvedSalt, 64).toString('hex');
  return `${resolvedSalt}:${derived}`;
}

function createPasswordFingerprint(password: string) {
  return createHash('sha256').update(`mypage-password:${password}`).digest('hex');
}

function parsePasswordHash(value: string) {
  const [salt, derived] = value.split(':');
  if (!salt || !derived) {
    throw new Error('マイページ用パスワード情報が不正です。');
  }
  return { salt, derived };
}

export function verifyMypagePassword(password: string, passwordHash: string) {
  const { salt, derived } = parsePasswordHash(passwordHash);
  const candidate = hashPassword(password, salt).split(':')[1];
  return timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(candidate, 'hex'));
}

export async function getMyPageAccessCredential(reservationId: string) {
  const supabase = getSupabaseAdminClient() as unknown as DynamicSupabaseClient;
  const { data, error } = await supabase
    .from('mypage_access_credentials')
    .select('reservation_id, password_hash, password_fingerprint, is_active, passkey_enabled, last_verified_at')
    .eq('reservation_id', reservationId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  return (data as AccessCredentialRow | null) ?? null;
}

export async function setMyPageAccessCredential(params: { reservationId: string; password: string }) {
  const password = params.password.trim();
  if (password.length < 4) {
    throw new Error('マイページ用パスワードは4文字以上で設定してください。');
  }

  const fingerprint = createPasswordFingerprint(password);
  const supabase = getSupabaseAdminClient() as unknown as DynamicSupabaseClient;
  const { data: duplicate, error: duplicateError } = await supabase
    .from('mypage_access_credentials')
    .select('reservation_id')
    .eq('password_fingerprint', fingerprint)
    .eq('is_active', true)
    .neq('reservation_id', params.reservationId)
    .maybeSingle();

  if (duplicateError) throw duplicateError;
  if (duplicate) {
    throw new Error('そのパスワードは別の予約ですでに使われています。別のパスワードを設定してください。');
  }

  const passwordHash = hashPassword(password);
  const { error } = await supabase.from('mypage_access_credentials').upsert(
    {
      reservation_id: params.reservationId,
      password_hash: passwordHash,
      password_fingerprint: fingerprint,
      is_active: true,
      passkey_enabled: false,
    },
    { onConflict: 'reservation_id' },
  );

  if (error) throw error;
}

export async function touchMyPageAccessCredential(reservationId: string) {
  const supabase = getSupabaseAdminClient() as unknown as DynamicSupabaseClient;
  const { error } = await supabase
    .from('mypage_access_credentials')
    .update({ last_verified_at: new Date().toISOString() })
    .eq('reservation_id', reservationId)
    .eq('is_active', true);

  if (error) throw error;
}

export async function getMyPageAccessCredentialStatusMap(reservationIds: string[]) {
  if (reservationIds.length === 0) return {};

  const supabase = getSupabaseAdminClient() as unknown as DynamicSupabaseClient;
  const { data, error } = await supabase
    .from('mypage_access_credentials')
    .select('reservation_id')
    .in('reservation_id', reservationIds)
    .eq('is_active', true);

  if (error) throw error;

  const configuredIds = new Set(
    (Array.isArray(data) ? data : [])
      .map((row) => (row && typeof row === 'object' ? (row as { reservation_id?: unknown }).reservation_id : null))
      .filter((value): value is string => typeof value === 'string' && value.length > 0),
  );

  return reservationIds.reduce<Record<string, MyPageAccessCredentialStatus>>((accumulator, reservationId) => {
    accumulator[reservationId] = configuredIds.has(reservationId) ? 'configured' : 'not_configured';
    return accumulator;
  }, {});
}
