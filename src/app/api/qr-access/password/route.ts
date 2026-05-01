import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRequest } from '@/lib/admin/requestAuth';
import {
  createPasswordSetting,
  fetchQrAccessPasswordSetting,
  saveQrAccessPasswordSetting,
} from '@/lib/qrAccessServer';

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
  const authError = await requireAdminRequest(request);
  if (authError) return authError;

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
