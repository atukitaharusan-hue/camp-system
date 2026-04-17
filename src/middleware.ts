import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/admin/session';

const ADMIN_SESSION_COOKIE = 'admin_session';

function isPasswordAuthEnabled() {
  return !!process.env.ADMIN_PASSWORD;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /admin/login は認証不要
  if (pathname === '/admin/login') {
    // 既に認証済みなら /admin へリダイレクト
    if (isPasswordAuthEnabled()) {
      const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
      if (token && await verifySessionToken(token)) {
        const url = request.nextUrl.clone();
        url.pathname = '/admin';
        return NextResponse.redirect(url);
      }
    }
    return NextResponse.next();
  }

  // /admin 配下のみ保護
  if (pathname.startsWith('/admin')) {
    return await protectAdmin(request);
  }

  return NextResponse.next();
}

/**
 * /admin 配下を保護
 */
async function protectAdmin(request: NextRequest) {
  // パスワード認証モード
  if (isPasswordAuthEnabled()) {
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    if (!token || !await verifySessionToken(token)) {
      const url = request.nextUrl.clone();
      url.pathname = '/admin/login';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ADMIN_PASSWORD 未設定の場合はフリーアクセス（開発用）
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
