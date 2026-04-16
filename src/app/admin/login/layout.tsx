import { Suspense } from 'react';

export const metadata = {
  title: 'ログイン - キャンプ場管理',
};

export default function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
