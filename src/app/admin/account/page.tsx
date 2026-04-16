'use client';

import { useEffect, useState } from 'react';
import { fetchAdminAccount, saveAdminAccount } from '@/lib/admin/fetchData';
import type { AdminAccountProfile } from '@/types/admin';

export default function AdminAccountPage() {
  const [account, setAccount] = useState<AdminAccountProfile>({ userName: '', email: '', password: '', isInitialized: false, allowConcurrentLogin: true });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetchAdminAccount().then(setAccount);
  }, []);

  const saveAccount = (next: AdminAccountProfile) => {
    setAccount(next);
    saveAdminAccount(next);
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900">アカウント</h1>
      <p className="mt-1 text-sm text-gray-500">登録ユーザー情報の確認と、同時ログイン設定の確認ができます。</p>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <dl className="grid gap-4">
          <div>
            <dt className="text-xs text-gray-500">登録ユーザー名</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">{account.userName}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">ログインに使っているメールアドレス</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">{account.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">パスワード</dt>
            <dd className="mt-1 flex items-center gap-3 text-sm font-medium text-gray-900">
              <span>{showPassword ? account.password : '••••••••••'}</span>
              <button onClick={() => setShowPassword((prev) => !prev)} className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">
                {showPassword ? '非表示' : '表示'}
              </button>
            </dd>
          </div>
        </dl>

        <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <label className="flex items-center justify-between gap-4 text-sm text-gray-700">
            <span>同時ログインを許可する</span>
            <input
              type="checkbox"
              checked={account.allowConcurrentLogin}
              onChange={(event) => saveAccount({ ...account, allowConcurrentLogin: event.target.checked })}
            />
          </label>
          <p className="mt-2 text-xs text-gray-500">プレビューでは制限を設けず、同時ログイン可の状態で動作します。</p>
        </div>
      </div>
    </div>
  );
}
