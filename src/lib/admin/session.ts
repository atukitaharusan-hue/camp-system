/**
 * 管理者セッションの生成・検証（Edge Runtime 互換）
 */

const COOKIE_NAME = "admin_session";
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours

export { COOKIE_NAME, COOKIE_MAX_AGE };

async function hmacSha256(secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function makeSessionToken(password: string): Promise<string> {
  const secret = process.env.ADMIN_PASSWORD ?? "fallback";
  return hmacSha256(secret, password);
}

export async function verifySessionToken(token: string): Promise<boolean> {
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!adminPassword) return false;
  const expected = await makeSessionToken(adminPassword);
  if (token.length !== expected.length) return false;
  // constant-time comparison
  let result = 0;
  for (let i = 0; i < token.length; i++) {
    result |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return result === 0;
}
