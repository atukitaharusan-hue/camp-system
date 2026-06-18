'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  fetchAccountingSubjects,
  fetchSalesReportCategories,
  fetchSalesReportOutputSettings,
  saveSalesReportCategories,
  saveSalesReportOutputSettings,
} from '@/lib/admin/fetchData';
import {
  createCategory,
  createOutput,
  DEFAULT_CATEGORIES,
  DEFAULT_OUTPUTS,
  DEFAULT_SUBJECTS,
} from '@/lib/admin/accountingReportUtils';
import type {
  AccountingSubjectSetting,
  SalesReportCategorySetting,
  SalesReportOutputSetting,
} from '@/types/admin';

export default function AdminAccountingSettingsPage() {
  const [subjects, setSubjects] = useState<AccountingSubjectSetting[]>([]);
  const [categories, setCategories] = useState<SalesReportCategorySetting[]>([]);
  const [outputs, setOutputs] = useState<SalesReportOutputSetting[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [fetchedSubjects, fetchedCategories, fetchedOutputs] = await Promise.all([
        fetchAccountingSubjects(),
        fetchSalesReportCategories(),
        fetchSalesReportOutputSettings(),
      ]);

      setSubjects(fetchedSubjects.length > 0 ? fetchedSubjects : DEFAULT_SUBJECTS);
      setCategories(fetchedCategories.length > 0 ? fetchedCategories : DEFAULT_CATEGORIES);
      setOutputs(fetchedOutputs.length > 0 ? fetchedOutputs : DEFAULT_OUTPUTS);
    })();
  }, []);

  const sortedSubjects = useMemo(
    () => [...subjects].sort((a, b) => a.sortOrder - b.sortOrder),
    [subjects],
  );

  const activeCategories = useMemo(
    () => categories.filter((category) => category.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  );

  const availableParentNames = useMemo(
    () => activeCategories.map((category) => category.parentCategoryName),
    [activeCategories],
  );

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await Promise.all([
        saveSalesReportCategories(categories),
        saveSalesReportOutputSettings(outputs),
      ]);
      setMessage('売上日報設定を保存しました。');
    } catch {
      setMessage('売上日報設定の保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">売上日報設定</h1>
            <p className="mt-2 text-sm text-slate-500">
              親カテゴリは日報の大分類、子カテゴリ相当は会計科目マスタから選ぶ集計対象です。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/accounting/reports"
              className="rounded-xl border border-emerald-300 px-4 py-3 text-sm font-medium text-emerald-700"
            >
              売上日報出力へ
            </Link>
            <Link
              href="/admin/accounting/subjects"
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700"
            >
              会計科目管理へ
            </Link>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? '保存中...' : '設定を保存'}
            </button>
          </div>
        </div>
        {message ? <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</p> : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">売上日報カテゴリ設定</h2>
            <button
              type="button"
              onClick={() => setCategories((current) => [...current, createCategory(current.length + 1)])}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              ＋ 親カテゴリを追加
            </button>
          </div>
          <div className="mt-4 space-y-4">
            {categories.map((category, index) => (
              <div key={category.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <input
                    value={category.parentCategoryName}
                    onChange={(event) =>
                      setCategories((current) =>
                        current.map((item) =>
                          item.id === category.id ? { ...item, parentCategoryName: event.target.value } : item,
                        ),
                      )
                    }
                    placeholder="親カテゴリ名"
                    className="min-w-[240px] flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={category.isActive}
                        onChange={(event) =>
                          setCategories((current) =>
                            current.map((item) =>
                              item.id === category.id ? { ...item, isActive: event.target.checked } : item,
                            ),
                          )
                        }
                      />
                      PDF出力対象
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setCategories((current) =>
                          current
                            .filter((item) => item.id !== category.id)
                            .map((item, itemIndex) => ({ ...item, sortOrder: itemIndex + 1 })),
                        )
                      }
                      className="rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
                    >
                      削除
                    </button>
                  </div>
                </div>
                <p className="mt-3 text-sm font-medium text-slate-700">会計科目を選択</p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {sortedSubjects.map((subject) => (
                    <label key={subject.id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
                      <input
                        type="checkbox"
                        checked={category.subjectIds.includes(subject.id)}
                        onChange={(event) =>
                          setCategories((current) =>
                            current.map((item) => {
                              if (item.id !== category.id) return item;
                              const nextSubjectIds = event.target.checked
                                ? [...item.subjectIds, subject.id]
                                : item.subjectIds.filter((subjectId) => subjectId !== subject.id);
                              return { ...item, subjectIds: Array.from(new Set(nextSubjectIds)) };
                            }),
                          )
                        }
                        className="mt-1"
                      />
                      <span>
                        <span className="block font-medium text-slate-900">{subject.name}</span>
                        <span className="block text-xs text-slate-500">
                          {subject.kind}
                          {!subject.isActive ? ' / 非表示中' : ''}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate-500">表示順: {index + 1}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">売上日報出力設定</h2>
            <button
              type="button"
              onClick={() => setOutputs((current) => [...current, createOutput(current.length + 1)])}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              ＋ 出力設定を追加
            </button>
          </div>
          <div className="mt-4 space-y-4">
            {outputs.map((output, index) => (
              <div key={output.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={output.reportName}
                    onChange={(event) =>
                      setOutputs((current) =>
                        current.map((item) => (item.id === output.id ? { ...item, reportName: event.target.value } : item)),
                      )
                    }
                    placeholder="出力グループ名"
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                  <label className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={output.splitByCategory}
                      onChange={(event) =>
                        setOutputs((current) =>
                          current.map((item) =>
                            item.id === output.id ? { ...item, splitByCategory: event.target.checked } : item,
                          ),
                        )
                      }
                    />
                    カテゴリ別にページ分け
                  </label>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
                    <input
                      type="checkbox"
                      checked={output.includedCategories.includes('すべてのカテゴリ')}
                      onChange={(event) =>
                        setOutputs((current) =>
                          current.map((item) =>
                            item.id === output.id
                              ? {
                                  ...item,
                                  includedCategories: event.target.checked ? ['すべてのカテゴリ'] : [],
                                }
                              : item,
                          ),
                        )
                      }
                    />
                    すべてのカテゴリ
                  </label>
                  {availableParentNames.map((parentName) => (
                    <label key={`${output.id}-${parentName}`} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
                      <input
                        type="checkbox"
                        checked={output.includedCategories.includes(parentName)}
                        disabled={output.includedCategories.includes('すべてのカテゴリ')}
                        onChange={(event) =>
                          setOutputs((current) =>
                            current.map((item) => {
                              if (item.id !== output.id) return item;
                              const nextIncluded = event.target.checked
                                ? [...item.includedCategories.filter((name) => name !== 'すべてのカテゴリ'), parentName]
                                : item.includedCategories.filter((name) => name !== parentName);
                              return { ...item, includedCategories: Array.from(new Set(nextIncluded)) };
                            }),
                          )
                        }
                      />
                      {parentName}
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={output.isActive}
                      onChange={(event) =>
                        setOutputs((current) =>
                          current.map((item) => (item.id === output.id ? { ...item, isActive: event.target.checked } : item)),
                        )
                      }
                    />
                    使用中
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setOutputs((current) =>
                        current
                          .filter((item) => item.id !== output.id)
                          .map((item, itemIndex) => ({ ...item, sortOrder: itemIndex + 1 })),
                      )
                    }
                    className="rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
                  >
                    削除
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500">表示順: {index + 1}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
