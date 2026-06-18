'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import AdminSidebar from '@/components/admin/AdminSidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (pathname === '/admin/login' || pathname.startsWith('/admin/easy-mode')) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <button
        type="button"
        onClick={() => setSidebarOpen((current) => !current)}
        aria-label={sidebarOpen ? 'メニューを閉じる' : 'メニューを開く'}
        aria-expanded={sidebarOpen}
        className="fixed left-4 top-4 z-50 flex h-14 min-w-14 items-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 shadow-lg transition hover:bg-gray-50"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
          {sidebarOpen ? (
            <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12 5.7 16.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4Z" />
          ) : (
            <path d="M4 7a1 1 0 0 1 1-1h14a1 1 0 1 1 0 2H5A1 1 0 0 1 4 7Zm0 5a1 1 0 0 1 1-1h14a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Zm1 4a1 1 0 1 0 0 2h14a1 1 0 1 0 0-2H5Z" />
          )}
        </svg>
        <span>{sidebarOpen ? 'メニューを閉じる' : 'メニューを開く'}</span>
      </button>

      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-gray-200 bg-white px-6 py-3">
          <Link
            href="/admin/easy-mode"
            className="mr-3 flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100"
          >
            <span className="text-base" aria-hidden="true">
              簡
            </span>
            <span>かんたんモードへ</span>
          </Link>
          <Link
            href="/admin/account"
            className="flex items-center gap-2 rounded-full border border-gray-200 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-white">
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />
              </svg>
            </span>
            <span>アカウント</span>
          </Link>
        </header>
        <main className="flex-1 p-6 pt-20">{children}</main>
      </div>
    </div>
  );
}
