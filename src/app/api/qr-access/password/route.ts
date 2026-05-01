import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, verifySessionToken } from '@/lib/admin/session';
import {
  createPasswordSetting,
  fetchQrAccessPasswordSetting,
  saveQrAccessPasswordSetting,
} from '@/lib/qrAccessServer';

async function isAdminRequest(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD ?? '';
  if (!adminPassword) return true;

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifySessionToken(token);
}

export async function GET() {
  try {
    const setting = await fetchQrAccessPasswordSetting();
    return NextResponse.json({
      configured: Boolean(setting),
      updatedAt: setting?.updatedAt ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'QR閲覧用パスワード設定の確認に失敗しました。';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: '管理画面にログインしてから設定してください。' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === 'string' ? body.password.trim() : '';

  if (password.length < 6) {
    return NextResponse.json({ error: 'QR閲覧用パスワードは6文字以上で設定してください。' }, { status: 400 });
  }

  try {
    const setting = createPasswordSetting(password);
    await saveQrAccessPasswordSetting(setting);
    return NextResponse.json({
      ok: true,
      configured: true,
      updatedAt: setting.updatedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'QR閲覧用パスワードの保存に失敗しました。';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
