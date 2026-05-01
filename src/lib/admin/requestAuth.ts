import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, verifySessionToken } from '@/lib/admin/session';

export async function requireAdminRequest(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD ?? '';
  if (!adminPassword) {
    return NextResponse.json(
      { error: '管理者パスワードが設定されていません。' },
      { status: 500 },
    );
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.json(
      { error: '管理画面にログインしてから操作してください。' },
      { status: 401 },
    );
  }

  return null;
}
