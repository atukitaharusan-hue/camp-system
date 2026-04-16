'use client';

import { useEffect, useState } from 'react';
import { fetchQrScreenSettings, saveQrScreenSettings } from '@/lib/admin/fetchData';
import type { AdminQrScreenSettings } from '@/types/admin';

export default function AdminQrScreenPage() {
  const [form, setForm] = useState<AdminQrScreenSettings>({ title: '', description: '', supportText: '', externalLinkLabel: '', externalLinkUrl: '', footerNote: '' });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchQrScreenSettings().then(setForm);
  }, []);

  const handleSave = () => {
    saveQrScreenSettings(form);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-bold text-gray-900">チェックインQRコード画面の編集</h1>
      <p className="mt-1 text-sm text-gray-500">QRコード以外に表示する文章や案内リンクをここでカスタマイズできます。</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="grid gap-4">
            <label className="text-sm text-gray-700">タイトル<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" /></label>
            <label className="text-sm text-gray-700">説明文<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" /></label>
            <label className="text-sm text-gray-700">補足文<textarea value={form.supportText} onChange={(event) => setForm({ ...form, supportText: event.target.value })} rows={3} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" /></label>
            <label className="text-sm text-gray-700">外部URLのラベル<input value={form.externalLinkLabel} onChange={(event) => setForm({ ...form, externalLinkLabel: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" /></label>
            <label className="text-sm text-gray-700">外部URL<input value={form.externalLinkUrl} onChange={(event) => setForm({ ...form, externalLinkUrl: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" /></label>
            <label className="text-sm text-gray-700">フッター文<input value={form.footerNote} onChange={(event) => setForm({ ...form, footerNote: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" /></label>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button onClick={handleSave} className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800">保存</button>
            {saved && <span className="text-sm text-green-600">保存しました</span>}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-semibold text-gray-800">プレビュー</p>
          <div className="mt-4 rounded-xl bg-gray-50 p-5 text-center">
            <h2 className="text-lg font-bold text-gray-900">{form.title}</h2>
            <p className="mt-2 text-sm text-gray-600">{form.description}</p>
            <div className="mx-auto mt-5 h-40 w-40 rounded-xl bg-white shadow-sm" />
            <p className="mt-4 text-sm text-gray-600">{form.supportText}</p>
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
