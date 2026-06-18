'use client';

import { useEffect, useMemo, useState } from 'react';
import MemoCard from '@/components/easy-mode/shared/MemoCard';
import { fetchAdminMembers } from '@/lib/admin/fetchData';

type StaffMemo = {
  id: string;
  from_name: string;
  to_name: string;
  title: string;
  body: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  due_at: string | null;
  completed_at: string | null;
  response_comment: string | null;
  created_at: string;
  updated_at: string;
};

function statusLabel(status: StaffMemo['status']) {
  switch (status) {
    case 'in_progress':
      return '対応中';
    case 'completed':
      return '完了';
    default:
      return '未対応';
  }
}

export default function StaffMemosCategory() {
  const [memos, setMemos] = useState<StaffMemo[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedMemo, setSelectedMemo] = useState<StaffMemo | null>(null);
  const [draft, setDraft] = useState({
    fromName: '',
    toName: '',
    title: '',
    body: '',
    dueAt: '',
  });

  async function load() {
    const [membersData, memosResponse] = await Promise.all([
      fetchAdminMembers(),
      fetch('/api/admin/easy-mode-memos', { cache: 'no-store' }).then((response) =>
        response.ok ? response.json() : { memos: [] },
      ),
    ]);

    setMembers(membersData.map((member) => member.userName));
    setMemos(Array.isArray(memosResponse.memos) ? memosResponse.memos : []);
    setLoading(false);
  }

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetchAdminMembers(),
      fetch('/api/admin/easy-mode-memos', { cache: 'no-store' }).then((response) =>
        response.ok ? response.json() : { memos: [] },
      ),
    ]).then(([membersData, memosResponse]) => {
      if (!mounted) return;
      setMembers(membersData.map((member) => member.userName));
      setMemos(Array.isArray(memosResponse.memos) ? memosResponse.memos : []);
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const canSubmit = useMemo(
    () => draft.fromName.trim() && draft.toName.trim() && draft.title.trim(),
    [draft],
  );

  const handleCreate = async () => {
    if (!canSubmit) return;

    setLoading(true);
    const response = await fetch('/api/admin/easy-mode-memos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromName: draft.fromName.trim(),
        toName: draft.toName.trim(),
        title: draft.title.trim(),
        body: draft.body.trim(),
        dueAt: draft.dueAt || null,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      window.alert(typeof payload.error === 'string' ? payload.error : 'メモの保存に失敗しました。');
      setLoading(false);
      return;
    }

    setComposeOpen(false);
    setDraft({ fromName: '', toName: '', title: '', body: '', dueAt: '' });
    await load();
  };

  const handleStatusUpdate = async (memo: StaffMemo, status: StaffMemo['status']) => {
    setLoading(true);
    const response = await fetch('/api/admin/easy-mode-memos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: memo.id,
        status,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      window.alert(typeof payload.error === 'string' ? payload.error : 'メモの更新に失敗しました。');
      setLoading(false);
      return;
    }

    await load();
    setSelectedMemo(null);
  };

  return (
    <section className="easy-mode-panel-card">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[1.05em] font-extrabold text-slate-900">やることメモ</p>
            <p className="mt-2 text-[0.86em] leading-relaxed text-slate-600">
              スタッフどうしのお願いや共有事項を付箋のように見たり、進行状態を変えたりできます。
            </p>
          </div>
          <button
            type="button"
            className="min-h-16 rounded-2xl bg-emerald-600 px-5 py-4 text-[0.9em] font-bold text-white"
            onClick={() => setComposeOpen(true)}
          >
            メモを追加する
          </button>
        </div>

        {loading ? (
          <p className="rounded-2xl bg-slate-50 px-4 py-5 text-[0.84em] text-slate-500">読み込み中です。</p>
        ) : memos.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 px-4 py-5 text-[0.84em] text-slate-500">まだメモはありません。</p>
        ) : (
          <div className="space-y-4">
            {memos.map((memo) => (
              <MemoCard
                key={memo.id}
                title={`${memo.to_name}へ：${memo.title}`}
                fromName={memo.from_name}
                toName={memo.to_name}
                statusLabel={statusLabel(memo.status)}
                dueText={memo.due_at ? memo.due_at.slice(0, 10) : undefined}
                dimmed={memo.status === 'completed'}
                onClick={() => setSelectedMemo(memo)}
              />
            ))}
          </div>
        )}
      </div>

      {composeOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-2xl rounded-[32px] bg-white p-6 shadow-2xl">
            <div className="space-y-4">
              <p className="text-[1.05em] font-extrabold text-slate-900">メモを追加する</p>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="min-h-16 rounded-2xl border-2 border-slate-200 px-4 text-[0.84em]"
                  placeholder="誰から"
                  value={draft.fromName}
                  onChange={(event) => setDraft((current) => ({ ...current, fromName: event.target.value }))}
                  list="easy-mode-members"
                />
                <input
                  className="min-h-16 rounded-2xl border-2 border-slate-200 px-4 text-[0.84em]"
                  placeholder="誰へ"
                  value={draft.toName}
                  onChange={(event) => setDraft((current) => ({ ...current, toName: event.target.value }))}
                  list="easy-mode-members"
                />
                <input
                  className="min-h-16 rounded-2xl border-2 border-slate-200 px-4 text-[0.84em] md:col-span-2"
                  placeholder="見出し"
                  value={draft.title}
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                />
                <textarea
                  className="min-h-40 rounded-2xl border-2 border-slate-200 px-4 py-4 text-[0.84em] md:col-span-2"
                  placeholder="本文"
                  value={draft.body}
                  onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
                />
                <input
                  type="date"
                  className="min-h-16 rounded-2xl border-2 border-slate-200 px-4 text-[0.84em] md:col-span-2"
                  value={draft.dueAt}
                  onChange={(event) => setDraft((current) => ({ ...current, dueAt: event.target.value }))}
                />
              </div>
              <datalist id="easy-mode-members">
                {members.map((member) => (
                  <option key={member} value={member} />
                ))}
              </datalist>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <button
                type="button"
                className="min-h-16 rounded-2xl bg-emerald-600 px-5 py-4 text-[0.9em] font-bold text-white disabled:opacity-60"
                onClick={() => void handleCreate()}
                disabled={!canSubmit}
              >
                保存する
              </button>
              <button
                type="button"
                className="min-h-16 rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-4 text-[0.9em] font-bold text-slate-800"
                onClick={() => setComposeOpen(false)}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedMemo ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-2xl rounded-[32px] bg-white p-6 shadow-2xl">
            <div className="space-y-3">
              <p className="text-[1.05em] font-extrabold text-slate-900">{selectedMemo.title}</p>
              <p className="text-[0.86em] leading-relaxed text-slate-700">誰から: {selectedMemo.from_name}</p>
              <p className="text-[0.86em] leading-relaxed text-slate-700">誰へ: {selectedMemo.to_name}</p>
              <p className="text-[0.86em] leading-relaxed text-slate-700">状態: {statusLabel(selectedMemo.status)}</p>
              {selectedMemo.body ? (
                <p className="rounded-2xl bg-slate-50 px-4 py-4 text-[0.84em] leading-relaxed text-slate-700">
                  {selectedMemo.body}
                </p>
              ) : null}
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <button
                type="button"
                className="min-h-16 rounded-2xl bg-amber-500 px-5 py-4 text-[0.86em] font-bold text-white"
                onClick={() => void handleStatusUpdate(selectedMemo, 'in_progress')}
              >
                対応中にする
              </button>
              <button
                type="button"
                className="min-h-16 rounded-2xl bg-emerald-600 px-5 py-4 text-[0.86em] font-bold text-white"
                onClick={() => void handleStatusUpdate(selectedMemo, 'completed')}
              >
                完了しました
              </button>
              <button
                type="button"
                className="min-h-16 rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-4 text-[0.86em] font-bold text-slate-800"
                onClick={() => setSelectedMemo(null)}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
