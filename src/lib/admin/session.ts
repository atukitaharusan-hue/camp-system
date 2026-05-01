/**
 * 管理者セッションの生成・検証（Edge Runtime 互換）
 */

const COOKIE_NAME = 'admin_session';
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours
const SESSION_VERSION = 1;
const MAX_CLOCK_SKEW_SECONDS = 60;

export { COOKIE_NAME, COOKIE_MAX_AGE };

type AdminSessionPayload = {
  version: 1;
  sub: 'admin';
  iat: number;
  exp: number;
  jti: string;
};

function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET ?? '';
}

function base64UrlEncode(value: string | Uint8Array) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}

async function hmacSha256(secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return base64UrlEncode(new Uint8Array(signature));
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

export function hasAdminSessionSecret() {
  return getSessionSecret().length > 0;
}

export async function makeSessionToken(): Promise<string> {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error('ADMIN_SESSION_SECRET is not configured');
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: AdminSessionPayload = {
    version: SESSION_VERSION,
    sub: 'admin',
    iat: issuedAt,
    exp: issuedAt + COOKIE_MAX_AGE,
    jti: crypto.randomUUID(),
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await hmacSha256(secret, encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export async function verifySessionToken(token: string): Promise<boolean> {
  const secret = getSessionSecret();
  if (!secret) return false;

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return false;

  const expectedSignature = await hmacSha256(secret, encodedPayload);
  if (!constantTimeEqual(signature, expectedSignature)) return false;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<AdminSessionPayload>;
    const now = Math.floor(Date.now() / 1000);
    if (payload.version !== SESSION_VERSION) return false;
    if (payload.sub !== 'admin') return false;
    if (typeof payload.iat !== 'number' || payload.iat > now + MAX_CLOCK_SKEW_SECONDS) return false;
    if (typeof payload.exp !== 'number' || payload.exp <= now) return false;
    if (typeof payload.jti !== 'string' || payload.jti.length === 0) return false;
    return true;
  } catch {
    return false;
  }
}
