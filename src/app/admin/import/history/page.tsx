'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useImportHistoryStore } from '@/stores/importHistoryStore';
import type { ImportHistoryEntry, ImportHistoryError } from '@/types/importHistory';

export default function ImportHistoryPage() {
  const entries = useImportHistoryStore((s) => s.entries);
  const clearAll = useImportHistoryStore((s) => s.clearAll);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const selected = selectedId
    ? entries.find((e) => e.id === selectedId) ?? null
    : null;

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">取込履歴</h1>
          <p className="text-sm text-gray-500 mt-1">
            スプレッドシート取込の実行履歴とエラーログを確認できます。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/import"
            className="px-3 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            取込画面へ
          </Link>
          {entries.length > 0 && (
            confirmClear ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { clearAll(); setConfirmClear(false); setSelectedId(null); }}
                  className="px-3 py-2 text-sm text-white bg-red-600 rounded hover:bg-red-700"
                >
                  削除する
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="px-3 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50"
                >
                  キャンセル
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className="px-3 py-2 text-sm text-red-600 bg-white border border-red-200 rounded hover:bg-red-50"
              >
                全履歴削除
              </button>
            )
          )}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded p-8 text-center">
          <p className="text-sm text-gray-400">取込履歴はまだありません。</p>
        </div>
      ) : (
        <div className="flex gap-4">
          {/* 左: 履歴一覧 */}
          <div className="w-80 shrink-0 space-y-2">
            {entries.map((entry) => (
              <HistoryCard
                key={entry.id}
                entry={entry}
                isSelected={entry.id === selectedId}
                onClick={() => setSelectedId(entry.id === selectedId ? null : entry.id)}
              />
            ))}
          </div>

          {/* 右: 詳細 */}
          <div className="flex-1 min-w-0">
            {selected ? (
              <HistoryDetail entry={selected} />
            ) : (
              <div className="bg-white border border-gray-200 rounded p-8 text-center">
                <p className="text-sm text-gray-400">
                  左の履歴を選択すると詳細が表示されます。
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── サブコンポーネント ───

function HistoryCard({
  entry,
  isSelected,
  onClick,
}: {
  entry: ImportHistoryEntry;
  isSelected: boolean;
  onClick: () => void;
}) {
  const d = new Date(entry.executedAt);
  const dateStr = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const hasErrors = entry.failedCount > 0 || entry.validationErrorCount > 0 || entry.duplicateCount > 0;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded border transition-colors ${
        isSelected
          ? 'bg-gray-50 border-gray-400'
          : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500">{dateStr}</span>
        {hasErrors ? (
          <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">
            エラーあり
          </span>
        ) : (
          <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">
            正常
          </span>
        )}
      </div>
      <p className="text-sm font-medium text-gray-800 truncate">{entry.fileName}</p>
      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
        <span>成功 {entry.insertedCount}</span>
        {entry.failedCount > 0 && (
          <span className="text-red-600">失敗 {entry.failedCount}</span>
        )}
        {entry.validationErrorCount > 0 && (
          <span className="text-red-600">検証NG {entry.validationErrorCount}</span>
        )}
        {entry.duplicateCount > 0 && (
          <span className="text-yellow-600">重複 {entry.duplicateCount}</span>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-1 truncate">{entry.executedBy}</p>
    </button>
  );
}

function HistoryDetail({ entry }: { entry: ImportHistoryEntry }) {
  const d = new Date(entry.executedAt);
  const dateStr = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;

  const validationErrors = entry.errors.filter((e) => e.phase === 'validation');
  const duplicateErrors = entry.errors.filter((e) => e.phase === 'duplicate');
  const insertErrors = entry.errors.filter((e) => e.phase === 'insert');

  return (
    <div className="space-y-4">
      {/* 基本情報 */}
      <div className="bg-white border border-gray-200 rounded p-4">
        <h2 className="text-sm font-medium text-gray-800 mb-3">取込概要</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-gray-500">ファイル名</dt>
          <dd className="text-gray-800 font-medium">{entry.fileName}</dd>
          <dt className="text-gray-500">実行日時</dt>
          <dd className="text-gray-800">{dateStr}</dd>
          <dt className="text-gray-500">実行者</dt>
          <dd className="text-gray-800">{entry.executedBy}</dd>
          <dt className="text-gray-500">総行数</dt>
          <dd className="text-gray-800">{entry.totalRows}行</dd>
        </dl>

        <div className="grid grid-cols-4 gap-3 mt-4">
          <MiniCard label="取込成功" count={entry.insertedCount} color="green" />
          <MiniCard label="INSERT失敗" count={entry.failedCount} color="red" />
          <MiniCard label="検証NGスキップ" count={entry.validationErrorCount} color="red" />
          <MiniCard label="重複スキップ" count={entry.duplicateCount} color="yellow" />
        </div>
      </div>

      {/* エラー無し */}
      {entry.errors.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded p-4 text-center">
          <p className="text-sm text-green-700">すべての行が正常に取り込まれました。</p>
        </div>
      )}

      {/* バリデーションエラー */}
      {validationErrors.length > 0 && (
        <ErrorSection
          title="バリデーションエラー"
          description="ファイル検証段階で除外された行です。取込は試行されていません。"
          errors={validationErrors}
          color="red"
        />
      )}

      {/* 重複エラー */}
      {duplicateErrors.length > 0 && (
        <ErrorSection
          title="重複スキップ"
          description="既存予約またはファイル内の別行と日程が重複していたため除外された行です。"
          errors={duplicateErrors}
          color="yellow"
        />
      )}

      {/* INSERT失敗 */}
      {insertErrors.length > 0 && (
        <ErrorSection
          title="INSERT失敗"
          description="バリデーション通過後、データベースへの書き込み時にエラーが発生した行です。"
          errors={insertErrors}
          color="red"
        />
      )}
    </div>
  );
}

function ErrorSection({
  title,
  description,
  errors,
  color,
}: {
  title: string;
  description: string;
  errors: ImportHistoryError[];
  color: 'red' | 'yellow';
}) {
  const borderColor = color === 'red' ? 'border-red-200' : 'border-yellow-200';
  const bgColor = color === 'red' ? 'bg-red-50' : 'bg-yellow-50';
  const titleColor = color === 'red' ? 'text-red-700' : 'text-yellow-700';
  const textColor = color === 'red' ? 'text-red-600' : 'text-yellow-600';
  const rowBg = color === 'red' ? 'bg-red-50 border-red-100' : 'bg-yellow-50 border-yellow-100';

  return (
    <div className={`bg-white border ${borderColor} rounded p-4`}>
      <h3 className={`text-sm font-medium ${titleColor} mb-1`}>
        {title}（{errors.length}件）
      </h3>
      <p className={`text-xs ${textColor} mb-3`}>{description}</p>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {errors.map((err, i) => (
          <div
            key={i}
            className={`p-2 ${rowBg} border rounded text-xs`}
          >
            <p className={`font-medium ${color === 'red' ? 'text-red-800' : 'text-yellow-800'} mb-1`}>
              行 {err.rowIndex}: {err.userName} / サイト {err.siteNumber}
            </p>
            <ul className={`list-disc list-inside ${textColor} space-y-0.5`}>
              {err.reasons.map((r, j) => (
                <li key={j}>{r}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniCard({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: 'green' | 'red' | 'yellow';
}) {
  const styles = {
    green: 'bg-green-50 border-green-200 text-green-800',
    red: 'bg-red-50 border-red-200 text-red-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  };

  return (
    <div className={`p-2 border rounded text-center ${styles[color]}`}>
      <p className="text-lg font-bold">{count}</p>
      <p className="text-[10px] mt-0.5 leading-tight">{label}</p>
    </div>
  );
}
