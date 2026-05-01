import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, verifySessionToken } from '@/lib/admin/session';

function isPasswordAuthEnabled() {
  return !!process.env.ADMIN_PASSWORD;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /admin/login は認証不要
  if (pathname === '/admin/login') {
    // 既に認証済みなら /admin へリダイレクト
    if (isPasswordAuthEnabled()) {
      const token = request.cookies.get(COOKIE_NAME)?.value;
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
  if (!isPasswordAuthEnabled()) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    url.searchParams.set('error', 'missing-admin-password');
    return NextResponse.redirect(url);
  }

  // パスワード認証モード
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token || !await verifySessionToken(token)) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};