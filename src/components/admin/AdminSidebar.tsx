'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const menuItems = [
  { href: '/admin', label: 'ダッシュボード' },
  { href: '/admin/reservations', label: '予約一覧' },
  { href: '/admin/reservations/availability', label: '空き状況カレンダー' },
  { href: '/admin/events', label: 'イベント設定' },
  { href: '/admin/reservations/new', label: '手動予約登録' },
  { href: '/admin/options', label: 'オプション設定' },
  { href: '/admin/plans', label: 'プラン管理' },
  { href: '/admin/sites', label: 'サイト管理' },
  { href: '/admin/rules', label: '販売ルール' },
  { href: '/admin/policies', label: '規約・同意設定' },
  { href: '/admin/import', label: '顧客データアップロード' },
  { href: '/admin/qr-screen', label: 'チェックインQRコード画面の編集' },
  { href: '/admin/qr-scan', label: 'QRコード読み取り' },
  { href: '/admin/members', label: '管理者メンバーの追加' },
  { href: '/admin/notifications', label: '通知ログ' },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex min-h-screen w-72 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-5 py-5">
        <h1 className="text-base font-bold tracking-wide text-gray-900">キャンプ場管理画面</h1>
        <p className="mt-1 text-xs text-gray-500">プレビュー内では保存内容がそのまま画面へ反映されます。</p>
      </div>
      <nav className="mt-2 flex-1 px-3 py-2">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const isActive = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-gray-100 font-semibold text-gray-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
