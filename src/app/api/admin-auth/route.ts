import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, COOKIE_MAX_AGE, hasAdminSessionSecret, makeSessionToken } from "@/lib/admin/session";

const LOGIN_ATTEMPT_LIMIT = 5;
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function getClientKey(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

function getLoginAttemptState(key: string) {
  const now = Date.now();
  const current = loginAttempts.get(key);
  if (!current || current.resetAt <= now) {
    return { count: 0, resetAt: now + LOGIN_ATTEMPT_WINDOW_MS };
  }
  return current;
}

function recordFailedLogin(key: string) {
  const current = getLoginAttemptState(key);
  loginAttempts.set(key, { count: current.count + 1, resetAt: current.resetAt });
}

function clearFailedLogins(key: string) {
  loginAttempts.delete(key);
}

export async function POST(request: NextRequest) {
  const clientKey = getClientKey(request);
  const attemptState = getLoginAttemptState(clientKey);
  if (attemptState.count >= LOGIN_ATTEMPT_LIMIT) {
    return NextResponse.json({ error: "ログイン試行回数が多すぎます。しばらくしてから再試行してください" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const password = body?.password;

  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "パスワードを入力してください" }, { status: 400 });
  }

  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!adminPassword) {
    return NextResponse.json({ error: "管理者パスワードが設定されていません" }, { status: 500 });
  }

  if (!hasAdminSessionSecret()) {
    return NextResponse.json({ error: "管理者セッションシークレットが設定されていません" }, { status: 500 });
  }

  // constant-time comparison
  if (password.length !== adminPassword.length) {
    recordFailedLogin(clientKey);
    return NextResponse.json({ error: "パスワードが正しくありません" }, { status: 401 });
  }
  let diff = 0;
  for (let i = 0; i < password.length; i++) {
    diff |= password.charCodeAt(i) ^ adminPassword.charCodeAt(i);
  }
  if (diff !== 0) {
    recordFailedLogin(clientKey);
    return NextResponse.json({ error: "パスワードが正しくありません" }, { status: 401 });
  }

  clearFailedLogins(clientKey);
  const token = await makeSessionToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  return response;
}
