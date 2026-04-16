'use client';

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { checkRequiredColumns, parseFileToRows, validateAllRows } from '@/lib/admin/importParser';
import type {
  ImportDuplicate,
  ImportExecutionResult,
  ImportParsedRow,
  ImportRowError,
} from '@/types/import';
import type { Database } from '@/types/database';

type Step = 'upload' | 'validate' | 'result';
type ImportJob = Database['public']['Tables']['import_jobs']['Row'];

const TEMPLATE_HEADERS = [
  '予約者名',
  '性別',
  '電話番号',
  '職業',
  'メールアドレス',
  '郵便番号',
  '都道府県',
  '市区町村',
  '番地',
  '建物名部屋番号',
  'LINEアカウント名',
  'LINEアカウントID',
  '知ったきっかけ',
  'チェックイン日',
  'チェックアウト日',
  '人数',
  'サイト番号',
  '支払い方法',
  '備考',
];

const TEMPLATE_SAMPLE = [
  '山田太郎',
  '男性',
  '090-1234-5678',
  '会社員',
  'taro@example.com',
  '123-4567',
  '北海道',
  '札幌市中央区',
  '北一条1-2-3',
  'サンプルマンション101',
  'taro_camp',
  '@taro',
  'Instagram',
  '2026-07-20',
  '2026-07-21',
  '2',
  'A-01',
  '現地払い',
  '初回利用',
];

function TopTabs() {
  return (
    <div className="mb-6 flex gap-2 border-b border-gray-200 pb-3">
      <Link
        href="/admin/reservations/new"
        className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
      >
        手動予約登録
      </Link>
      <Link
        href="/admin/import"
        className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white"
      >
        顧客データアップロード
      </Link>
    </div>
  );
}

function downloadTemplate() {
  const csv = ['\ufeff' + TEMPLATE_HEADERS.join(','), TEMPLATE_SAMPLE.map((cell) => `"${cell}"`).join(',')].join(
    '\r\n',
  );
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'customer-upload-template.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export default function AdminImportPage() {
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [validRows, setValidRows] = useState<ImportParsedRow[]>([]);
  const [errorRows, setErrorRows] = useState<ImportRowError[]>([]);
  const [duplicateRows, setDuplicateRows] = useState<ImportDuplicate[]>([]);
  const [parseError, setParseError] = useState('');
  const [execResult, setExecResult] = useState<ImportExecutionResult | null>(null);
  const [historyJobs, setHistoryJobs] = useState<ImportJob[]>([]);

  const fetchHistory = useCallback(async () => {
    const { data } = await supabase
      .from('import_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setHistoryJobs(data);
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleFileUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setParseError('');
    setIsProcessing(true);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const { rows, error } = parseFileToRows(buffer, file.name);
      if (error) {
        setParseError(error);
        return;
      }
      if (rows.length === 0) {
        setParseError('データ行がありません');
        return;
      }

      const headers = Object.keys(rows[0]);
      const { ok, missing } = checkRequiredColumns(headers);
      if (!ok) {
        setParseError(`必須列が不足しています: ${missing.join(', ')}`);
        return;
      }

      const { data: existingData } = await supabase
        .from('guest_reservations')
        .select('site_number, check_in_date, check_out_date')
        .not('status', 'eq', 'cancelled');
      const existing = (existingData ?? []).map((row) => ({
        site_number: row.site_number ?? '',
        check_in_date: row.check_in_date,
        check_out_date: row.check_out_date,
      }));

      const result = validateAllRows(rows, existing);
      setValidRows(result.validRows);
      setErrorRows(result.errorRows);
      setDuplicateRows(result.duplicateRows);
      setStep('validate');
    } catch {
      setParseError('ファイルの読み込み中にエラーが発生しました');
    } finally {
      setIsProcessing(false);
    }
  }, []);

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
          fileName,
          executedBy: user?.email ?? '不明',
        }),
      });

      if (!response.ok) {
        const body = await response.json();
        setParseError(body.error ?? '取り込みに失敗しました');
        return;
      }

      const result: ImportExecutionResult = await response.json();
      setExecResult(result);
      setStep('result');
      fetchHistory();
    } catch {
      setParseError('取り込み実行中にエラーが発生しました');
    } finally {
      setIsProcessing(false);
    }
  }, [validRows, errorRows, duplicateRows, fileName, fetchHistory]);

  const handleReset = () => {
    setStep('upload');
    setFileName('');
    setValidRows([]);
    setErrorRows([]);
    setDuplicateRows([]);
    setParseError('');
    setExecResult(null);
  };

  const summaryCards = useMemo(
    () => [
      { label: '正常', value: validRows.length, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
      { label: 'エラー', value: errorRows.length, color: 'text-red-700 bg-red-50 border-red-200' },
      { label: '重複', value: duplicateRows.length, color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
    ],
    [validRows.length, errorRows.length, duplicateRows.length],
  );

  return (
    <div className="max-w-6xl">
      <TopTabs />
      <h1 className="mb-2 text-xl font-bold text-gray-900">顧客データアップロード</h1>
      <p className="mb-6 text-sm text-gray-500">
        顧客情報と予約情報をまとめて CSV / Excel から取り込めます。
      </p>

      {parseError && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {parseError}
        </div>
      )}

      {step === 'upload' && (
        <div className="space-y-4">
          <div className="rounded border border-gray-200 bg-white p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium text-gray-800">ファイル選択</h2>
                <p className="mt-1 text-xs text-gray-500">対応形式: .csv, .xlsx, .xls</p>
              </div>
              <button
                type="button"
                onClick={downloadTemplate}
                className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                テンプレートをダウンロード
              </button>
            </div>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              disabled={isProcessing}
              className="block w-full text-sm text-gray-500 file:mr-4 file:rounded file:border file:border-gray-300 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-50 disabled:opacity-50"
            />
            {isProcessing && <p className="mt-3 text-sm text-gray-500">ファイルを読み込み中...</p>}
          </div>

          <div className="rounded border border-gray-200 bg-white p-6">
            <h2 className="mb-3 text-sm font-medium text-gray-800">テンプレート列</h2>
            <div className="overflow-x-auto">
              <table className="w-full border border-gray-200 text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border-b border-gray-200 px-3 py-2 text-left font-medium text-gray-700">列名</th>
                    <th className="border-b border-gray-200 px-3 py-2 text-left font-medium text-gray-700">サンプル</th>
                  </tr>
                </thead>
                <tbody>
                  {TEMPLATE_HEADERS.map((header, index) => (
                    <tr key={header} className="border-b border-gray-100">
                      <td className="px-3 py-1.5 font-mono text-gray-800">{header}</td>
                      <td className="px-3 py-1.5 text-gray-500">{TEMPLATE_SAMPLE[index]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {step === 'validate' && (
        <div className="space-y-4">
          <div className="rounded border border-gray-200 bg-white p-4">
            <p className="mb-3 text-sm text-gray-600">
              ファイル: <span className="font-medium text-gray-800">{fileName}</span>
            </p>
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
            <h3 className="mb-3 text-sm font-medium text-gray-800">取り込み対象 {validRows.length}件</h3>
            <div className="overflow-x-auto">
              <table className="w-full border border-gray-200 text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border-b px-2 py-1.5 text-left">行</th>
                    <th className="border-b px-2 py-1.5 text-left">予約者名</th>
                    <th className="border-b px-2 py-1.5 text-left">職業</th>
                    <th className="border-b px-2 py-1.5 text-left">知ったきっかけ</th>
                    <th className="border-b px-2 py-1.5 text-left">サイト</th>
                    <th className="border-b px-2 py-1.5 text-left">チェックイン</th>
                    <th className="border-b px-2 py-1.5 text-left">チェックアウト</th>
                  </tr>
                </thead>
                <tbody>
                  {validRows.map((row) => (
                    <tr key={row.rowIndex} className="border-b border-gray-100">
                      <td className="px-2 py-1.5">{row.rowIndex}</td>
                      <td className="px-2 py-1.5">{row.userName}</td>
                      <td className="px-2 py-1.5">{row.occupation || '-'}</td>
                      <td className="px-2 py-1.5">{row.referralSource || '-'}</td>
                      <td className="px-2 py-1.5">{row.siteNumber || '-'}</td>
                      <td className="px-2 py-1.5">{row.checkInDate}</td>
                      <td className="px-2 py-1.5">{row.checkOutDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {errorRows.length > 0 && (
            <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              エラー行があります。先にファイルを修正してください。
            </div>
          )}
          {duplicateRows.length > 0 && (
            <div className="rounded border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-700">
              重複候補があります。内容を確認してください。
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              やり直す
            </button>
            <button
              type="button"
              onClick={handleExecute}
              disabled={isProcessing || validRows.length === 0}
              className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {isProcessing ? '取り込み中...' : '取り込み実行'}
            </button>
          </div>
        </div>
      )}

      {step === 'result' && execResult && (
        <div className="space-y-4">
          <div className="rounded border border-gray-200 bg-white p-6">
            <h2 className="mb-3 text-sm font-medium text-gray-800">取り込み結果</h2>
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
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            別ファイルを取り込む
          </button>
        </div>
      )}

      <section className="mt-8 rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">アップロード履歴</h2>
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
                <span className="text-xs text-gray-400">
                  {new Date(job.created_at).toLocaleString('ja-JP')}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
