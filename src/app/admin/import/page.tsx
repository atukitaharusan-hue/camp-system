'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fetchPlans, fetchSites } from '@/lib/admin/fetchData';
import {
  createTemplateClipboardText,
  getFieldErrorMap,
  getRowErrorMessages,
  parseClipboardTable,
  validateAllRows,
  type ExistingReservation,
} from '@/lib/admin/importParser';
import {
  IMPORT_COLUMNS,
  IMPORT_SAMPLE_ROW,
  type ImportDuplicate,
  type ImportExecutionResult,
  type ImportParsedRow,
  type ImportRawRow,
  type ImportRowError,
} from '@/types/import';
import type { Database } from '@/types/database';

type Step = 'paste' | 'review' | 'result';
type ImportJob = Database['public']['Tables']['import_jobs']['Row'];

function TopTabs() {
  return (
    <div className="mb-6 flex gap-2 border-b border-gray-200 pb-3">
      <Link
        href="/admin/reservations/new"
        className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
      >
        新規予約登録
      </Link>
      <Link
        href="/admin/import"
        className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white"
      >
        顧客データ一括登録
      </Link>
    </div>
  );
}

function createEmptyRow(): ImportRawRow {
  return {
    ...IMPORT_SAMPLE_ROW,
    userName: '',
    planName: '',
    siteNumber: '',
    siteName: '',
    checkInDate: '',
    checkOutDate: '',
    guests: '',
    paymentMethod: '',
    specialRequests: '',
    userPhone: '',
    occupation: '',
    userEmail: '',
    postalCode: '',
    prefecture: '',
    city: '',
    addressLine: '',
    buildingName: '',
    lineDisplayName: '',
    lineId: '',
    referralSource: '',
    gender: '',
  };
}

function createInitialRows() {
  return [createEmptyRow(), createEmptyRow(), createEmptyRow()];
}

export default function AdminImportPage() {
  const [step, setStep] = useState<Step>('paste');
  const [pasteValue, setPasteValue] = useState('');
  const [rows, setRows] = useState<ImportRawRow[]>(createInitialRows());
  const [isProcessing, setIsProcessing] = useState(false);
  const [validRows, setValidRows] = useState<ImportParsedRow[]>([]);
  const [errorRows, setErrorRows] = useState<ImportRowError[]>([]);
  const [duplicateRows, setDuplicateRows] = useState<ImportDuplicate[]>([]);
  const [parseError, setParseError] = useState('');
  const [execResult, setExecResult] = useState<ImportExecutionResult | null>(null);
  const [historyJobs, setHistoryJobs] = useState<ImportJob[]>([]);

  const fetchHistory = useCallback(async () => {
    const { data } = await supabase.from('import_jobs').select('*').order('created_at', { ascending: false }).limit(20);
    if (data) setHistoryJobs(data);
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const appendRowsFromText = useCallback((text: string) => {
    const parsed = parseClipboardTable(text);
    if (parsed.length === 0) {
      setParseError('貼り付けデータが空です。');
      return;
    }

    setRows((prev) => {
      const baseRows = prev.filter((row) => Object.values(row).some((value) => value.trim().length > 0));
      return [...baseRows, ...parsed];
    });
    setPasteValue('');
    setParseError('');
  }, []);

  const handleValidate = useCallback(async () => {
    const filledRows = rows.filter((row) => Object.values(row).some((value) => value.trim().length > 0));
    if (filledRows.length === 0) {
      setParseError('取り込むデータがありません。表に入力するか、貼り付けてください。');
      return;
    }

    setIsProcessing(true);
    setParseError('');

    try {
      const [plans, sites] = await Promise.all([fetchPlans(), fetchSites()]);
      const { data: existingData } = await supabase
        .from('guest_reservations')
        .select('site_number, check_in_date, check_out_date')
        .not('status', 'eq', 'cancelled');

      const existingReservations: ExistingReservation[] = (existingData ?? []).map((row) => ({
        site_number: row.site_number ?? '',
        check_in_date: row.check_in_date,
        check_out_date: row.check_out_date,
      }));

      const result = validateAllRows(filledRows, existingReservations, { plans, sites });
      setRows(filledRows);
      setValidRows(result.validRows);
      setErrorRows(result.errorRows);
      setDuplicateRows(result.duplicateRows);
      setStep('review');
    } catch {
      setParseError('入力内容の検証中にエラーが発生しました。');
    } finally {
      setIsProcessing(false);
    }
  }, [rows]);

  const handleExecute = useCallback(async () => {
    if (validRows.length === 0) return;
    setIsProcessing(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const response = await fetch('/api/import-reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: validRows,
          errorRows,
          duplicateRows,
          fileName: 'table-paste',
          executedBy: user?.email ?? 'admin',
        }),
      });

      if (!response.ok) {
        const body = await response.json();
        setParseError(body.error ?? '登録に失敗しました。');
        return;
      }

      const result: ImportExecutionResult = await response.json();
      setExecResult(result);
      setStep('result');
      fetchHistory();
    } catch {
      setParseError('登録処理中にエラーが発生しました。');
    } finally {
      setIsProcessing(false);
    }
  }, [duplicateRows, errorRows, fetchHistory, validRows]);

  const handleReset = useCallback(() => {
    setStep('paste');
    setPasteValue('');
    setRows(createInitialRows());
    setValidRows([]);
    setErrorRows([]);
    setDuplicateRows([]);
    setParseError('');
    setExecResult(null);
  }, []);

  const fieldErrorMap = useMemo(() => getFieldErrorMap(errorRows, duplicateRows), [duplicateRows, errorRows]);
  const rowErrorMap = useMemo(() => getRowErrorMessages(errorRows, duplicateRows), [duplicateRows, errorRows]);

  const summaryCards = useMemo(
    () => [
      { label: '登録可能', value: validRows.length, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
      { label: '入力エラー', value: errorRows.length, color: 'text-red-700 bg-red-50 border-red-200' },
      { label: '重複', value: duplicateRows.length, color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
    ],
    [duplicateRows.length, errorRows.length, validRows.length],
  );

  const templateText = useMemo(() => createTemplateClipboardText(), []);

  return (
    <div className="max-w-7xl">
      <TopTabs />
      <h1 className="mb-2 text-xl font-bold text-gray-900">顧客データ一括登録</h1>
      <p className="mb-6 text-sm text-gray-500">
        Excel やスプレッドシートから、複数行・複数列をそのまま貼り付けて一括登録できます。
      </p>

      {parseError && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{parseError}</div>
      )}

      {step === 'paste' && (
        <div className="space-y-4">
          <div className="rounded border border-gray-200 bg-white p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-medium text-gray-800">貼り付け入力</h2>
                <p className="mt-1 text-xs text-gray-500">
                  Excel / Google スプレッドシートからコピーした表を、そのまま貼り付けできます。
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(templateText)}
                className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                テンプレートをコピー
              </button>
            </div>

            <textarea
              value={pasteValue}
              onChange={(event) => setPasteValue(event.target.value)}
              placeholder="ここに表データを貼り付けてください"
              className="min-h-40 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            />

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => appendRowsFromText(pasteValue)}
                className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                表へ展開する
              </button>
              <button
                type="button"
                onClick={() => setRows((prev) => [...prev, createEmptyRow()])}
                className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                行を追加
              </button>
              <button
                type="button"
                onClick={handleValidate}
                disabled={isProcessing}
                className="rounded border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
              >
                {isProcessing ? '検証中...' : '入力内容を検証する'}
              </button>
            </div>
          </div>

          <div className="rounded border border-gray-200 bg-white p-6">
            <h2 className="mb-3 text-sm font-medium text-gray-800">入力表</h2>
            <div className="overflow-auto">
              <table className="min-w-[1600px] border border-gray-200 text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border-b border-r px-2 py-2 text-left font-medium text-gray-700">行</th>
                    {IMPORT_COLUMNS.map((column) => (
                      <th key={column.key} className="border-b border-r px-2 py-2 text-left font-medium text-gray-700">
                        {column.label}
                        {column.required && <span className="ml-1 text-red-500">*</span>}
                      </th>
                    ))}
                    <th className="border-b px-2 py-2 text-left font-medium text-gray-700">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={`row-${rowIndex}`} className="border-b border-gray-100">
                      <td className="border-r px-2 py-2 align-top text-gray-500">{rowIndex + 1}</td>
                      {IMPORT_COLUMNS.map((column) => (
                        <td key={`${rowIndex}-${column.key}`} className="border-r px-2 py-2 align-top">
                          <input
                            value={row[column.key]}
                            onChange={(event) =>
                              setRows((prev) =>
                                prev.map((item, index) =>
                                  index === rowIndex ? { ...item, [column.key]: event.target.value } : item,
                                ),
                              )
                            }
                            placeholder={column.placeholder}
                            className="w-40 rounded border border-gray-300 px-2 py-1.5 text-xs outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                          />
                        </td>
                      ))}
                      <td className="px-2 py-2 align-top">
                        <button
                          type="button"
                          onClick={() => setRows((prev) => prev.filter((_, index) => index !== rowIndex))}
                          className="text-red-600 hover:text-red-700"
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-4">
          <div className="rounded border border-gray-200 bg-white p-4">
            <div className="grid grid-cols-3 gap-4">
              {summaryCards.map((item) => (
                <div key={item.label} className={`rounded border p-4 ${item.color}`}>
                  <p className="text-xs">{item.label}</p>
                  <p className="text-xl font-bold">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-gray-800">確認・修正</h3>
              <button
                type="button"
                onClick={() => setStep('paste')}
                className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                入力画面へ戻る
              </button>
            </div>

            <div className="overflow-auto">
              <table className="min-w-[1600px] border border-gray-200 text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border-b border-r px-2 py-2 text-left font-medium text-gray-700">行</th>
                    {IMPORT_COLUMNS.map((column) => (
                      <th key={column.key} className="border-b border-r px-2 py-2 text-left font-medium text-gray-700">
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => {
                    const currentRowIndex = rowIndex + 1;
                    const fieldErrors = fieldErrorMap[currentRowIndex] ?? {};
                    const rowMessages = rowErrorMap[currentRowIndex] ?? [];

                    return (
                      <tr key={`review-${currentRowIndex}`} className="border-b border-gray-100 align-top">
                        <td className="border-r px-2 py-2">
                          <div className="font-medium text-gray-700">{currentRowIndex}</div>
                          {rowMessages.length > 0 && (
                            <ul className="mt-2 space-y-1 text-[11px] text-red-600">
                              {rowMessages.map((message) => (
                                <li key={message}>{message}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                        {IMPORT_COLUMNS.map((column) => {
                          const hasError = Boolean(fieldErrors[column.key]);
                          return (
                            <td key={`${currentRowIndex}-${column.key}`} className="border-r px-2 py-2">
                              <input
                                value={row[column.key]}
                                onChange={(event) =>
                                  setRows((prev) =>
                                    prev.map((item, index) =>
                                      index === rowIndex ? { ...item, [column.key]: event.target.value } : item,
                                    ),
                                  )
                                }
                                className={`w-40 rounded px-2 py-1.5 text-xs outline-none transition ${
                                  hasError
                                    ? 'border border-red-300 bg-red-50 text-red-800 focus:border-red-400 focus:ring-2 focus:ring-red-100'
                                    : 'border border-gray-300 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'
                                }`}
                              />
                              {hasError && <p className="mt-1 text-[11px] text-red-600">{fieldErrors[column.key]}</p>}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              クリア
            </button>
            <button
              type="button"
              onClick={handleValidate}
              disabled={isProcessing}
              className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              再検証
            </button>
            <button
              type="button"
              onClick={handleExecute}
              disabled={isProcessing || validRows.length === 0}
              className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {isProcessing ? '登録中...' : '登録を実行する'}
            </button>
          </div>
        </div>
      )}

      {step === 'result' && execResult && (
        <div className="space-y-4">
          <div className="rounded border border-gray-200 bg-white p-6">
            <h2 className="mb-3 text-sm font-medium text-gray-800">登録結果</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs text-emerald-700">成功</p>
                <p className="text-xl font-bold text-emerald-800">{execResult.insertedCount}</p>
              </div>
              <div className="rounded border border-red-200 bg-red-50 p-4">
                <p className="text-xs text-red-700">失敗</p>
                <p className="text-xl font-bold text-red-800">{execResult.failedCount}</p>
              </div>
            </div>
            {execResult.failures.length > 0 && (
              <div className="mt-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <ul className="space-y-1">
                  {execResult.failures.map((failure) => (
                    <li key={`${failure.rowIndex}-${failure.error}`}>
                      {failure.rowIndex} 行目: {failure.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            新しいデータを登録する
          </button>
        </div>
      )}

      <section className="mt-8 rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">登録履歴</h2>
        {historyJobs.length === 0 ? (
          <p className="text-sm text-gray-400">まだ履歴はありません。</p>
        ) : (
          <div className="space-y-2">
            {historyJobs.map((job) => (
              <Link
                key={job.id}
                href={`/admin/import/${job.id}`}
                className="flex items-center justify-between rounded border border-gray-100 px-3 py-3 text-sm hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium text-gray-800">{job.file_name}</p>
                  <p className="text-xs text-gray-500">
                    成功 {job.success_count} / 失敗 {job.error_count}
                  </p>
                </div>
                <span className="text-xs text-gray-400">{new Date(job.created_at).toLocaleString('ja-JP')}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
