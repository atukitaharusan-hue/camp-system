import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "admin_session";
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours

function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD ?? "";
}

function makeSessionToken(password: string): string {
  const secret = process.env.ADMIN_PASSWORD ?? "fallback";
  return createHmac("sha256", secret).update(password).digest("hex");
}

export function verifySessionToken(token: string): boolean {
  const expected = makeSessionToken(getAdminPassword());
  if (token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const password = body?.password;

  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "パスワードを入力してください" }, { status: 400 });
  }

  const adminPassword = getAdminPassword();
  if (!adminPassword) {
    return NextResponse.json({ error: "管理者パスワードが設定されていません" }, { status: 500 });
  }

  const passwordBuffer = Buffer.from(password);
  const expectedBuffer = Buffer.from(adminPassword);
  if (passwordBuffer.length !== expectedBuffer.length || !timingSafeEqual(passwordBuffer, expectedBuffer)) {
    return NextResponse.json({ error: "パスワードが正しくありません" }, { status: 401 });
  }

  const token = makeSessionToken(password);
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
