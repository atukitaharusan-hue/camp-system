'use client';

import { useState, useTransition } from 'react';

export default function CheckinCounterPasswordGate({
  reservationId,
}: {
  reservationId: string;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    startTransition(async () => {
      setError('');

      const response = await fetch('/api/checkin-counter/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId, password }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.error ?? 'セッション情報の取得に失敗しました。');
        return;
      }

      const redirectTo =
        typeof payload.redirectTo === 'string' && payload.redirectTo.startsWith('/')
          ? payload.redirectTo
          : `/admin/checkin-session?reservationId=${encodeURIComponent(reservationId)}`;

      window.location.href = redirectTo;
    });
  };

  return (
    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-left">
      <h2 className="text-base font-bold text-amber-950">管理人専用パスワード</h2>
      <p className="mt-2 text-sm leading-7 text-amber-900">
        管理画面の「チェックインQR画面の編集」で設定した管理人専用パスワードを入力してください。
      </p>
      <label className="mt-4 block text-sm font-semibold text-gray-700">
        パスワード
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-base"
          autoComplete="current-password"
        />
      </label>
      {error ? <p className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {isPending ? '確認中...' : 'チェックイン対応を始める'}
      </button>
    </div>
  );
}
