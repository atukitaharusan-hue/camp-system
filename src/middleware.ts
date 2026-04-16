import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin/auth';

function isAdminAuthDisabled() {
  return true;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /admin/login は認証不要
  if (pathname === '/admin/login') {
    return await handleLoginPage(request);
  }

  // /admin 配下のみ保護
  if (pathname.startsWith('/admin')) {
    return await protectAdmin(request);
  }

  return NextResponse.next();
}

/**
 * ログインページ: 既にログイン済み管理者なら /admin へリダイレクト
 */
async function handleLoginPage(request: NextRequest) {
  if (isAdminAuthDisabled()) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin';
    return NextResponse.redirect(url);
  }

  const { supabase, response } = createMiddlewareClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && isAdminEmail(user.email)) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin';
    return NextResponse.redirect(url, { headers: response.headers });
  }

  return response;
}

/**
 * /admin 配下を保護
 */
async function protectAdmin(request: NextRequest) {
  if (isAdminAuthDisabled()) {
    return NextResponse.next();
  }

  const { supabase, response } = createMiddlewareClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 未ログイン → /admin/login
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url, { headers: response.headers });
  }

  // ログイン済みだが管理者でない → /admin/login?error=forbidden
  if (!isAdminEmail(user.email)) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    url.searchParams.set('error', 'forbidden');
    return NextResponse.redirect(url, { headers: response.headers });
  }

  return response;
}

/**
 * middleware 用の Supabase クライアント生成
 */
function createMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  return { supabase, response };
}

export const config = {
  matcher: ['/admin/:path*'],
};
