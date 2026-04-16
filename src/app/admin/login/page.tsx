'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { dummyAdminAccount } from '@/data/adminDummyData';
import { ADMIN_ACCOUNT_KEY, readJsonStorage } from '@/lib/admin/browserStorage';

export default function AdminLoginPage() {
  const router = useRouter();

  useEffect(() => {
    const account = readJsonStorage(ADMIN_ACCOUNT_KEY, dummyAdminAccount);
    router.replace(account.isInitialized ? '/admin' : '/admin/setup');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">管理画面へ移動中</h1>
        <p className="mt-2 text-sm text-gray-500">初回設定の有無を確認しています。</p>
      </div>
    </div>
  );
}
