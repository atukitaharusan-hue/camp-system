import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, COOKIE_MAX_AGE, makeSessionToken, verifySessionToken } from "@/lib/admin/session";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const password = body?.password;

  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "パスワードを入力してください" }, { status: 400 });
  }

  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!adminPassword) {
    return NextResponse.json({ error: "管理者パスワードが設定されていません" }, { status: 500 });
  }

  // constant-time comparison
  if (password.length !== adminPassword.length) {
    return NextResponse.json({ error: "パスワードが正しくありません" }, { status: 401 });
  }
  let diff = 0;
  for (let i = 0; i < password.length; i++) {
    diff |= password.charCodeAt(i) ^ adminPassword.charCodeAt(i);
  }
  if (diff !== 0) {
    return NextResponse.json({ error: "パスワードが正しくありません" }, { status: 401 });
  }

  const token = await makeSessionToken(password);
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
