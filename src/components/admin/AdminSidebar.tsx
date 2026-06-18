'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const menuItems = [
  { href: '/admin', label: 'ダッシュボード' },
  { href: '/admin/reservations', label: '予約一覧' },
  { href: '/admin/reservations/availability', label: '空き状況カレンダー' },
  { href: '/admin/reservations/site-assignments', label: 'サイト割り振り' },
  { href: '/admin/events', label: 'イベント管理' },
  { href: '/admin/reservations/new', label: '新規予約登録' },
  { href: '/admin/options', label: 'オプション設定' },
  { href: '/admin/plans', label: 'プラン管理' },
  { href: '/admin/sites', label: 'サイト管理' },
  { href: '/admin/rules', label: '販売ルール' },
  { href: '/admin/policies', label: '利用規約・ポリシー設定' },
  { href: '/admin/import', label: '外部データインポート' },
  { href: '/admin/qr-screen', label: 'チェックインQR画面' },
  { href: '/admin/qr-scan', label: 'QRコード読み取り' },
  { href: '/admin/register', label: '管理棟レジ' },
  { href: '/admin/accounting', label: '売上日報設定' },
  { href: '/admin/accounting/reports', label: '売上日報出力' },
  { href: '/admin/accounting/subjects', label: '会計科目管理' },
  { href: '/admin/settings/easy-mode', label: 'かんたんモード設定' },
  { href: '/admin/members', label: '管理メンバー設定' },
  { href: '/admin/notifications', label: '通知ログ' },
];

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function AdminSidebar({ isOpen, onClose }: Props) {
  const pathname = usePathname();

  return (
    <>
      <div
        aria-hidden={!isOpen}
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-slate-900/35 transition ${isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col border-r border-gray-200 bg-white shadow-2xl transition-transform duration-200 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-5">
          <div>
            <h1 className="text-base font-bold tracking-wide text-gray-900">キャンプ場管理画面</h1>
            <p className="mt-1 text-xs text-gray-500">必要な画面へすぐ移動できます。</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="メニューを閉じる"
            className="rounded-full border border-gray-200 p-2 text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
              <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12 5.7 16.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4Z" />
            </svg>
          </button>
        </div>

        <nav className="mt-2 flex-1 overflow-y-auto px-3 py-2">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const isActive = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={`block rounded-xl px-4 py-3 text-sm transition-colors ${
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
    </>
  );
}
