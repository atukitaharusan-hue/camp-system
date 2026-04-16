'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchAdminAccount, saveAdminAccount, fetchAdminInvites, fetchAdminMembers } from '@/lib/admin/fetchData';
import type { AdminAccountProfile, AdminMember, AdminMemberInvite } from '@/types/admin';

const SECRET_PASSWORD = '0221';

export default function AdminSetupPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">読み込み中...</div>}>
      <AdminSetupContent />
    </Suspense>
  );
}

function AdminSetupContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [passwordInput, setPasswordInput] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState<AdminAccountProfile>({ userName: '', email: '', password: '', isInitialized: false, allowConcurrentLogin: true });
  const [invites, setInvites] = useState<AdminMemberInvite[]>([]);

  useEffect(() => {
    fetchAdminAccount().then(setForm);
    fetchAdminInvites().then(setInvites);
  }, []);

  const invite = useMemo(() => invites.find((item) => item.token === token), [invites, token]);

  const handleUnlock = () => {
    if (passwordInput === SECRET_PASSWORD) {
      setIsUnlocked(true);
      setMessage('');
    } else {
      setMessage('パスワードが一致しません。');
    }
  };

  const handleRegister = () => {
    const nextAccount = { ...form, isInitialized: true };
    saveAdminAccount(nextAccount);

    if (invite) {
      // TODO: save members/invites to Supabase
    }

    setMessage('初回設定を保存しました。');
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-4 py-8">
      <div className="w-full rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">初回ログイン情報登録</h1>
        <p className="mt-2 text-sm text-gray-500">このページはサービス提供者が保有するシークレットリンク用です。リンクを開くにはパスワードが必要です。</p>

        {!isUnlocked ? (
          <div className="mt-6 space-y-3">
            <label className="block text-sm text-gray-700">
              パスワード
              <input value={passwordInput} onChange={(event) => setPasswordInput(event.target.value)} type="password" className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <button onClick={handleUnlock} className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800">0221で開く</button>
          </div>
        ) : invite && invite.status === 'used' ? (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">このリンクはすでに使用済みです。再利用はできません。</div>
        ) : (
          <div className="mt-6 space-y-4">
            {invite && <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">招待先メールアドレス: {invite.email}</p>}
            <label className="block text-sm text-gray-700">
              メールアドレス
              <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <label className="block text-sm text-gray-700">
              パスワード（任意で設定）
              <input value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <label className="block text-sm text-gray-700">
              ユーザー名
              <input value={form.userName} onChange={(event) => setForm({ ...form, userName: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <button onClick={handleRegister} className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800">登録を完了する</button>
          </div>
        )}

        {message && <p className="mt-4 text-sm text-gray-600">{message}</p>}
      </div>
    </div>
  );
}
