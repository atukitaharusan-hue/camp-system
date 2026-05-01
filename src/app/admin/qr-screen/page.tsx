'use client';

import { useEffect, useState } from 'react';
import { fetchQrScreenSettings, saveQrScreenSettings } from '@/lib/admin/fetchData';
import type { AdminQrScreenSettings } from '@/types/admin';

type PasswordStatus = {
  configured: boolean;
  updatedAt: string | null;
};

const defaultQrScreenSettings: AdminQrScreenSettings = {
  title: '',
  description: '',
  supportText: '',
  externalLinkLabel: '',
  externalLinkUrl: '',
  footerNote: '',
};

export default function AdminQrScreenPage() {
  const [form, setForm] = useState<AdminQrScreenSettings>(defaultQrScreenSettings);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<PasswordStatus>({ configured: false, updatedAt: null });
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    fetchQrScreenSettings().then(setForm);
    fetch('/api/qr-access/password', { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload) => {
        setPasswordStatus({
          configured: Boolean(payload.configured),
          updatedAt: payload.updatedAt ?? null,
        });
      })
      .catch(() => {
        setPasswordError('QR閲覧用パスワード設定の確認に失敗しました。');
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await saveQrScreenSettings(form);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'QR画面設定の保存に失敗しました。';
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSave = async () => {
    setPasswordError('');
    setPasswordMessage('');

    if (password.length < 6) {
      setPasswordError('QR閲覧用パスワードは6文字以上で設定してください。');
      return;
    }
    if (password !== passwordConfirm) {
      setPasswordError('確認用パスワードが一致していません。');
      return;
    }

    setPasswordSaving(true);
    const response = await fetch('/api/qr-access/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const payload = await response.json().catch(() => ({}));
    setPasswordSaving(false);

    if (!response.ok) {
      setPasswordError(payload.error ?? 'QR閲覧用パスワードの保存に失敗しました。');
      return;
    }

    setPassword('');
    setPasswordConfirm('');
    setPasswordStatus({
      configured: true,
      updatedAt: payload.updatedAt ?? new Date().toISOString(),
    });
    setPasswordMessage('QR閲覧用パスワードを保存しました。');
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">チェックインQR画面の編集</h1>
        <p className="mt-1 text-sm text-gray-500">
          ユーザーのQRコードを読み取った後に表示する画面文言と、管理人専用パスワードを設定できます。
        </p>
      </div>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-amber-950">QR閲覧用 管理人専用パスワード</h2>
            <p className="mt-1 text-sm leading-6 text-amber-800">
              ユーザーのQRコードをスマホで開いた際、個人情報を表示する前にこのパスワードを要求します。
              パスワードは平文では保存せず、ハッシュ化して保存します。
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${passwordStatus.configured ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
            {passwordStatus.configured ? '設定済み' : '未設定'}
          </span>
        </div>

        {passwordStatus.updatedAt && (
          <p className="mt-3 text-xs text-amber-700">
            最終更新: {new Date(passwordStatus.updatedAt).toLocaleString('ja-JP')}
          </p>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm font-semibold text-gray-700">
            新しいパスワード
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              autoComplete="new-password"
            />
          </label>
          <label className="text-sm font-semibold text-gray-700">
            確認用パスワード
            <input
              type="password"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              autoComplete="new-password"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handlePasswordSave}
            disabled={passwordSaving}
            className="rounded bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
          >
            {passwordSaving ? '保存中...' : 'パスワードを保存'}
          </button>
          {passwordMessage && <span className="text-sm text-emerald-700">{passwordMessage}</span>}
          {passwordError && <span className="text-sm text-red-700">{passwordError}</span>}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-900">QR表示画面の文言</h2>
          <div className="mt-4 grid gap-4">
            <label className="text-sm text-gray-700">
              タイトル
              <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <label className="text-sm text-gray-700">
              説明文
              <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <label className="text-sm text-gray-700">
              補足文
              <textarea value={form.supportText} onChange={(event) => setForm({ ...form, supportText: event.target.value })} rows={3} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <label className="text-sm text-gray-700">
              外部URLのラベル
              <input value={form.externalLinkLabel} onChange={(event) => setForm({ ...form, externalLinkLabel: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <label className="text-sm text-gray-700">
              外部URL
              <input value={form.externalLinkUrl} onChange={(event) => setForm({ ...form, externalLinkUrl: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <label className="text-sm text-gray-700">
              フッター文
              <input value={form.footerNote} onChange={(event) => setForm({ ...form, footerNote: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={handleSave} disabled={saving} className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50">
              {saving ? '保存中...' : '保存'}
            </button>
            {saved && <span className="text-sm text-green-600">保存しました</span>}
            {saveError && <span className="text-sm text-red-600">{saveError}</span>}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-semibold text-gray-800">プレビュー</p>
          <div className="mt-4 rounded-xl bg-gray-50 p-5 text-center">
            <h2 className="text-lg font-bold text-gray-900">{form.title || 'QRチェックイン'}</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{form.description}</p>
            <div className="mx-auto mt-5 flex h-40 w-40 items-center justify-center rounded-xl bg-white text-xs text-gray-400 shadow-sm">
              QR preview
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm text-gray-600">{form.supportText}</p>
            {form.externalLinkUrl && (
              <a href={form.externalLinkUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-full bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
                {form.externalLinkLabel || '外部リンクを開く'}
              </a>
            )}
            <p className="mt-4 text-xs text-gray-500">{form.footerNote}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
