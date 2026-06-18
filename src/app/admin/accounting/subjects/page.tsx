'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  fetchAccountingSubjects,
  fetchSalesReportCategories,
  saveAccountingSubjects,
} from '@/lib/admin/fetchData';
import type {
  AccountingSubjectKind,
  AccountingSubjectSetting,
  SalesReportCategorySetting,
} from '@/types/admin';

const KIND_OPTIONS: Array<{ value: AccountingSubjectKind; label: string }> = [
  { value: 'lodging', label: '宿泊' },
  { value: 'entry_fee', label: '入場料' },
  { value: 'tax', label: '税' },
  { value: 'rental', label: 'レンタル' },
  { value: 'event', label: 'イベント' },
  { value: 'shop', label: '売店' },
  { value: 'other', label: 'その他' },
];

function createSubject(sortOrder: number): AccountingSubjectSetting {
  return {
    id: `subject-${Date.now()}-${sortOrder}`,
    name: '',
    defaultUnitPrice: 0,
    kind: 'other',
    sortOrder,
    isActive: true,
    notes: '',
  };
}

export default function AdminAccountingSubjectsPage() {
  const [subjects, setSubjects] = useState<AccountingSubjectSetting[]>([]);
  const [categories, setCategories] = useState<SalesReportCategorySetting[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [fetchedSubjects, fetchedCategories] = await Promise.all([
        fetchAccountingSubjects(),
        fetchSalesReportCategories(),
      ]);
      setSubjects(fetchedSubjects);
      setCategories(fetchedCategories);
    })();
  }, []);

  const sortedSubjects = useMemo(
    () => [...subjects].sort((a, b) => a.sortOrder - b.sortOrder),
    [subjects],
  );

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const normalized = sortedSubjects.map((subject, index) => ({
        ...subject,
        name: subject.name.trim(),
        sortOrder: index + 1,
      }));

      await saveAccountingSubjects(normalized);
      setSubjects(normalized);
      setMessage('保存しました。');
    } catch (error) {
      console.error('[accounting-subjects] save error', error);
      setMessage('保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-600">会計設定</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">会計科目管理</h1>
          <p className="mt-2 text-sm text-slate-500">
            売上日報の子カテゴリとして使う会計科目を管理します。
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/accounting"
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            売上日報設定へ戻る
          </Link>
          <button
            type="button"
            onClick={() => {
              setSubjects((current) => [...current, createSubject(current.length + 1)]);
              setMessage(null);
            }}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            ＋ 会計科目を追加
          </button>
        </div>
      </div>

      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <div className="space-y-4">
        {sortedSubjects.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
            会計科目がまだありません。追加ボタンから登録してください。
          </div>
        ) : null}

        {sortedSubjects.map((subject, index) => (
          <section key={subject.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">会計科目名</span>
                <input
                  type="text"
                  value={subject.name}
                  onChange={(event) =>
                    setSubjects((current) =>
                      current.map((item) =>
                        item.id === subject.id ? { ...item, name: event.target.value } : item,
                      ),
                    )
                  }
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500"
                  placeholder="例：大人料金"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">内部種別</span>
                <select
                  value={subject.kind}
                  onChange={(event) =>
                    setSubjects((current) =>
                      current.map((item) =>
                        item.id === subject.id
                          ? { ...item, kind: event.target.value as AccountingSubjectKind }
                          : item,
                      ),
                    )
                  }
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500"
                >
                  {KIND_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500">
                  宿泊・税・レンタルなどの自動分類に使う内部設定です。
                </p>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">標準単価</span>
                <input
                  type="number"
                  min={0}
                  value={subject.defaultUnitPrice}
                  onChange={(event) =>
                    setSubjects((current) =>
                      current.map((item) =>
                        item.id === subject.id
                          ? { ...item, defaultUnitPrice: Math.max(0, Number(event.target.value) || 0) }
                          : item,
                      ),
                    )
                  }
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">備考</span>
                <input
                  type="text"
                  value={subject.notes}
                  onChange={(event) =>
                    setSubjects((current) =>
                      current.map((item) =>
                        item.id === subject.id ? { ...item, notes: event.target.value } : item,
                      ),
                    )
                  }
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500"
                  placeholder="任意"
                />
              </label>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">親カテゴリ</p>
              <p className="mt-1 text-xs text-slate-500">
                売上日報でどの親カテゴリに紐付いているかを表示します。変更は売上日報設定で行ってください。
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {categories.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-500">
                    先に売上日報設定で親カテゴリを作成してください。
                  </div>
                ) : (
                  categories
                    .filter((category) => category.subjectIds.includes(subject.id))
                    .map((category) => (
                    <div
                      key={`${subject.id}-${category.id}`}
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700"
                    >
                      {category.parentCategoryName}
                    </div>
                  ))
                )}
                {categories.length > 0 &&
                categories.every((category) => !category.subjectIds.includes(subject.id)) ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-500">
                    まだ親カテゴリに紐付いていません。
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={subject.isActive}
                  onChange={(event) =>
                    setSubjects((current) =>
                      current.map((item) =>
                        item.id === subject.id ? { ...item, isActive: event.target.checked } : item,
                      ),
                    )
                  }
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                使用中
              </label>

              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">表示順: {index + 1}</span>
                <button
                  type="button"
                  onClick={() =>
                    setSubjects((current) => current.filter((item) => item.id !== subject.id))
                  }
                  className="text-sm font-semibold text-rose-500 transition hover:text-rose-600"
                >
                  削除
                </button>
              </div>
            </div>
          </section>
        ))}
      </div>

      <div className="sticky bottom-4 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-emerald-600 px-6 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
        >
          {saving ? '保存中...' : '会計科目を保存'}
        </button>
      </div>
    </div>
  );
}
