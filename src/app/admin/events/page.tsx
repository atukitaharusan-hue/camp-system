'use client';

import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import { fetchEvents, saveEvents } from '@/lib/admin/fetchData';
import type { AdminEvent } from '@/types/admin';

function createEmptyEvent(): AdminEvent {
  return {
    id: '',
    title: '',
    description: '',
    startAt: '2026-04-16T10:00:00+09:00',
    endAt: '2026-04-16T12:00:00+09:00',
    location: '',
    imageUrl: '/site-map-placeholder.svg',
    isPublished: true,
  };
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminEventsPage() {
  const [savedEvents, setSavedEvents] = useState<AdminEvent[]>([]);
  const [draftEvents, setDraftEvents] = useState<AdminEvent[]>([]);
  const [editingEvent, setEditingEvent] = useState<AdminEvent | null>(null);

  useEffect(() => {
    fetchEvents().then((initial) => {
      setSavedEvents(initial);
      setDraftEvents(initial);
    });
  }, []);

  const [previewEventLink, setPreviewEventLink] = useState('/');
  useEffect(() => {
    setPreviewEventLink(`${window.location.origin}/`);
  }, []);

  const hasChanges = JSON.stringify(savedEvents) !== JSON.stringify(draftEvents);

  const applyEventDraft = (event: AdminEvent) => {
    setDraftEvents((prev) => {
      if (!event.id) {
        return [...prev, { ...event, id: `event-${Date.now()}` }];
      }

      return prev.map((item) => (item.id === event.id ? event : item));
    });
    setEditingEvent(null);
  };

  const handleDelete = (id: string) => {
    setDraftEvents((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSave = () => {
    saveEvents(draftEvents);
    setSavedEvents(draftEvents);
    window.alert('変更を適用しました');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">イベント設定</h1>
          <p className="mt-1 text-sm text-gray-500">
            公開側に表示する開催イベントをまとめて編集します。内容を変更したあとは最後に保存ボタンを押してください。
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setEditingEvent(createEmptyEvent())}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            イベントを追加
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            disabled={!hasChanges}
          >
            保存
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">プレビューURL</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <code className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">{previewEventLink}</code>
          <a
            href={previewEventLink}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            公開画面を開く
          </a>
        </div>
      </div>

      {hasChanges && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          未保存の変更があります。公開画面へ反映するには保存ボタンを押してください。
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {draftEvents.map((event) => (
          <article key={event.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">{event.title || 'イベント名未設定'}</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {formatDateTime(event.startAt)} - {formatDateTime(event.endAt)}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  event.isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {event.isPublished ? '公開中' : '非公開'}
              </span>
            </div>
            <div className="mb-4 overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
              <img
                src={event.imageUrl || '/site-map-placeholder.svg'}
                alt={event.title || 'イベント画像'}
                className="h-40 w-full object-cover"
              />
            </div>
            <p className="mb-3 text-sm leading-6 text-gray-600">{event.description || '説明文は未設定です。'}</p>
            <p className="text-sm text-gray-500">開催場所: {event.location || '未設定'}</p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => handleDelete(event.id)}
                className="text-sm font-medium text-red-600 hover:text-red-700"
              >
                削除
              </button>
              <button
                type="button"
                onClick={() => setEditingEvent(event)}
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                編集
              </button>
            </div>
          </article>
        ))}
      </div>

      {editingEvent && (
        <EventEditor
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSave={applyEventDraft}
        />
      )}
    </div>
  );
}

function EventEditor({
  event,
  onClose,
  onSave,
}: {
  event: AdminEvent;
  onClose: () => void;
  onSave: (event: AdminEvent) => void;
}) {
  const [form, setForm] = useState<AdminEvent>(event);

  const handleChange = (nextEvent: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = nextEvent.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (nextEvent.target as HTMLInputElement).checked : value,
    }));
  };

  const handleImageChange = (nextEvent: ChangeEvent<HTMLInputElement>) => {
    const file = nextEvent.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const imageUrl = reader.result;
        setForm((prev) => ({ ...prev, imageUrl }));
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <h2 className="text-base font-bold text-gray-900">{form.id ? 'イベントを編集' : 'イベントを追加'}</h2>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-gray-400 hover:text-gray-600">
            ×
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <FormField label="イベント名">
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="開始日時">
              <input
                type="datetime-local"
                value={form.startAt.slice(0, 16)}
                onChange={(nextEvent) =>
                  setForm((prev) => ({ ...prev, startAt: `${nextEvent.target.value}:00+09:00` }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </FormField>
            <FormField label="終了日時">
              <input
                type="datetime-local"
                value={form.endAt.slice(0, 16)}
                onChange={(nextEvent) =>
                  setForm((prev) => ({ ...prev, endAt: `${nextEvent.target.value}:00+09:00` }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </FormField>
          </div>
          <FormField label="開催場所">
            <input
              type="text"
              name="location"
              value={form.location}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </FormField>
          <FormField label="説明文">
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={5}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </FormField>
          <FormField label="イベント画像">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="block w-full text-sm text-gray-600"
            />
          </FormField>
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
            <img
              src={form.imageUrl || '/site-map-placeholder.svg'}
              alt={form.title || 'イベント画像'}
              className="h-44 w-full object-cover"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              name="isPublished"
              checked={form.isPublished}
              onChange={handleChange}
              className="rounded border-gray-300"
            />
            公開画面に表示する
          </label>

          <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={() => onSave(form)}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              下書きに反映
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</label>
      {children}
    </div>
  );
}
