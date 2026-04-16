'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type ImportJob = Database['public']['Tables']['import_jobs']['Row'];
type ImportJobRow = Database['public']['Tables']['import_job_rows']['Row'];

export default function ImportJobDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [job, setJob] = useState<ImportJob | null>(null);
  const [rows, setRows] = useState<ImportJobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'success' | 'error'>('all');

  useEffect(() => {
    async function load() {
      const [jobRes, rowsRes] = await Promise.all([
        supabase.from('import_jobs').select('*').eq('id', id).single(),
        supabase
          .from('import_job_rows')
          .select('*')
          .eq('import_job_id', id)
          .order('row_number', { ascending: true }),
      ]);
      setJob(jobRes.data);
      setRows(rowsRes.data ?? []);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return <div className="p-4 text-sm text-gray-500">読み込み中...</div>;
  }

  if (!job) {
    return (
      <div className="p-4">
        <p className="text-sm text-red-600 mb-4">
          取込ジョブが見つかりません。
        </p>
        <Link
          href="/admin/import"
          className="text-sm text-blue-600 hover:underline"
        >
          取込管理に戻る
        </Link>
      </div>
    );
  }

  const d = new Date(job.created_at);
  const dateStr = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  const filteredRows =
    filter === 'all' ? rows : rows.filter((r) => r.status === filter);
  const successCount = rows.filter((r) => r.status === 'success').length;
  const errorCount = rows.filter((r) => r.status === 'error').length;

  return (
    <div className="max-w-5xl">
      {/* パンくず */}
      <div className="flex items-center gap-2 mb-4 text-sm">
        <Link
          href="/admin/import"
          className="text-gray-500 hover:text-gray-700"
        >
          取込管理
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900">取込詳細</h1>
      </div>

      {/* 概要 */}
      <div className="bg-white border border-gray-200 rounded p-4 mb-4">
        <h2 className="text-sm font-medium text-gray-800 mb-3">取込概要</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt className="text-gray-500">ファイル名</dt>
          <dd className="text-gray-800 font-medium">{job.file_name}</dd>
          <dt className="text-gray-500">実行日時</dt>
          <dd className="text-gray-800">{dateStr}</dd>
          <dt className="text-gray-500">実行者</dt>
          <dd className="text-gray-800">{job.executed_by}</dd>
          <dt className="text-gray-500">総行数</dt>
          <dd className="text-gray-800">{job.total_rows}行</dd>
        </dl>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="p-3 border rounded text-center bg-green-50 border-green-200 text-green-800">
            <p className="text-2xl font-bold">{job.success_count}</p>
            <p className="text-xs mt-1">成功</p>
          </div>
          <div className="p-3 border rounded text-center bg-red-50 border-red-200 text-red-800">
            <p className="text-2xl font-bold">{job.error_count}</p>
            <p className="text-xs mt-1">失敗</p>
          </div>
        </div>
      </div>

      {/* フィルター */}
      <div className="flex items-center gap-2 mb-3">
        <FilterButton
          label={`すべて (${rows.length})`}
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        <FilterButton
          label={`成功 (${successCount})`}
          active={filter === 'success'}
          onClick={() => setFilter('success')}
        />
        <FilterButton
          label={`エラー (${errorCount})`}
          active={filter === 'error'}
          onClick={() => setFilter('error')}
        />
      </div>

      {/* 行テーブル */}
      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-2 text-left font-medium text-gray-700 w-16">
                行
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-700 w-20">
                状態
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">
                内容
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">
                エラー理由
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => {
              const rawData = row.raw_data_json as Record<string, unknown>;
              const userName = (rawData.userName ??
                rawData['予約者名'] ??
                '') as string;
              const siteNumber = (rawData.siteNumber ??
                rawData['サイト番号'] ??
                '') as string;
              const checkIn = (rawData.checkInDate ??
                rawData['チェックイン日'] ??
                '') as string;

              return (
                <tr key={row.id} className="border-b border-gray-100">
                  <td className="px-3 py-2 text-gray-500">
                    {row.row_number}
                  </td>
                  <td className="px-3 py-2">
                    {row.status === 'success' ? (
                      <span className="inline-block px-1.5 py-0.5 text-xs rounded bg-green-100 text-green-700">
                        成功
                      </span>
                    ) : (
                      <span className="inline-block px-1.5 py-0.5 text-xs rounded bg-red-100 text-red-700">
                        エラー
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-800">
                    {userName && <span>{userName}</span>}
                    {siteNumber && (
                      <span className="ml-2 text-gray-500">
                        サイト {siteNumber}
                      </span>
                    )}
                    {checkIn && (
                      <span className="ml-2 text-gray-500">{checkIn}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-red-600">
                    {row.error_message || '-'}
                  </td>
                </tr>
              );
            })}
            {filteredRows.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-6 text-center text-gray-400 text-sm"
                >
                  該当する行がありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs rounded border transition-colors ${
        active
          ? 'bg-gray-900 text-white border-gray-900'
          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );
}
