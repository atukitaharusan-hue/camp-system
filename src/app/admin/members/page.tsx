'use client';

import { useEffect, useMemo, useState } from 'react';
import { dummyAdminInvites, dummyAdminMembers } from '@/data/adminDummyData';
import { ADMIN_INVITES_KEY, ADMIN_MEMBERS_KEY, readJsonStorage, writeJsonStorage } from '@/lib/admin/browserStorage';
import type { AdminMember, AdminMemberInvite } from '@/types/admin';

function createToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function AdminMembersPage() {
  const [email, setEmail] = useState('');
  const [members, setMembers] = useState<AdminMember[]>(dummyAdminMembers);
  const [invites, setInvites] = useState<AdminMemberInvite[]>(dummyAdminInvites);

  useEffect(() => {
    setMembers(readJsonStorage(ADMIN_MEMBERS_KEY, dummyAdminMembers));
    setInvites(readJsonStorage(ADMIN_INVITES_KEY, dummyAdminInvites));
  }, []);

  const baseUrl = typeof window === 'undefined' ? '' : `${window.location.origin}/admin/setup`;

  const saveInvites = (nextInvites: AdminMemberInvite[]) => {
    setInvites(nextInvites);
    writeJsonStorage(ADMIN_INVITES_KEY, nextInvites);
  };

  const handleInvite = () => {
    if (!email.trim()) return;
    const invite: AdminMemberInvite = {
      id: `invite-${Date.now()}`,
      email: email.trim(),
      token: createToken(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      usedAt: null,
    };
    saveInvites([invite, ...invites]);
    setEmail('');
    const link = `${baseUrl}?token=${invite.token}`;
    window.open(`mailto:${invite.email}?subject=${encodeURIComponent('管理画面の権限追加依頼')}&body=${encodeURIComponent(`以下のリンクから管理者登録を完了してください。\n${link}\n\nリンクを開く際のパスワード: 0221`)}`, '_blank');
  };

  const pendingInvites = useMemo(() => invites.filter((invite) => invite.status === 'pending'), [invites]);

  return (
    <div className="max-w-5xl">
      <h1 className="text-xl font-bold text-gray-900">管理者メンバーの追加</h1>
      <p className="mt-1 text-sm text-gray-500">メールアドレスを追加すると、権限追加依頼用のメール作成画面を開きます。リンクは一度使うと再利用できません。</p>

      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-800">招待メールを作成</h2>
        <div className="mt-3 flex gap-3">
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="member@example.com" className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm" />
          <button onClick={handleInvite} className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800">招待リンクを作成</button>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-800">管理者メンバー</h2>
          <div className="mt-3 space-y-3">
            {members.map((member) => (
              <div key={member.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <strong className="text-gray-900">{member.userName}</strong>
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">{member.role}</span>
                </div>
                <p className="mt-1 text-gray-500">{member.email}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-800">未使用の招待リンク</h2>
          <div className="mt-3 space-y-3">
            {pendingInvites.length === 0 && <p className="text-sm text-gray-400">未使用の招待リンクはありません。</p>}
            {pendingInvites.map((invite) => {
              const inviteUrl = `${baseUrl}?token=${invite.token}`;
              return (
                <div key={invite.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                  <p className="font-medium text-gray-900">{invite.email}</p>
                  <p className="mt-1 break-all text-xs text-gray-500">{inviteUrl}</p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => navigator.clipboard.writeText(inviteUrl)} className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">リンクをコピー</button>
                    <button onClick={() => window.open(`mailto:${invite.email}?subject=${encodeURIComponent('管理画面の権限追加依頼')}&body=${encodeURIComponent(`以下のリンクから管理者登録を完了してください。\n${inviteUrl}\n\nリンクを開く際のパスワード: 0221`)}`, '_blank')} className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">メールを再作成</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
