'use client';

import { useEffect, useState } from 'react';
import { dummySalesRule, dummySites } from '@/data/adminDummyData';
import {
  ADMIN_RULES_KEY,
  ADMIN_SITES_KEY,
  readJsonStorage,
  writeJsonStorage,
} from '@/lib/admin/browserStorage';
import type { SalesRule } from '@/types/admin';
import RuleEditPanel from '@/components/admin/RuleEditPanel';

export default function AdminRulesPage() {
  const [savedRule, setSavedRule] = useState<SalesRule>(dummySalesRule);
  const [draftRule, setDraftRule] = useState<SalesRule>(dummySalesRule);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const initial = readJsonStorage(ADMIN_RULES_KEY, dummySalesRule);
    setSavedRule(initial);
    setDraftRule(initial);
  }, []);

  const hasChanges = JSON.stringify(savedRule) !== JSON.stringify(draftRule);

  const handleSave = () => {
    writeJsonStorage(ADMIN_RULES_KEY, draftRule);
    setSavedRule(draftRule);
    window.alert('変更を適用しました');
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">販売ルール</h1>
          <p className="mt-1 text-sm text-gray-500">
            受付停止日、停止期間、サイト別停止設定を管理します。保存後に予約受付の判定へ反映されます。
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            編集
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            保存
          </button>
        </div>
      </div>

      {hasChanges && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          未保存の変更があります。保存すると予約受付の判定に反映されます。
        </div>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-gray-900">受付停止日</h2>
        {draftRule.closedDates.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {draftRule.closedDates.map((date) => (
              <span key={date} className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                {date}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">設定はありません。</p>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-gray-900">受付停止期間</h2>
        <div className="space-y-2">
          {draftRule.closedDateRanges.length > 0 ? (
            draftRule.closedDateRanges.map((range) => (
              <div key={range.id} className="rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-700">
                {range.startDate} 〜 {range.endDate} / {range.reason}
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">設定はありません。</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-gray-900">サイト別停止設定</h2>
        <div className="space-y-2">
          {draftRule.siteClosures.length > 0 ? (
            draftRule.siteClosures.map((closure, index) => (
              <div key={`${closure.siteId}-${index}`} className="rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-700">
                <p className="font-semibold text-gray-900">
                  {closure.area} / {closure.siteNumber}
                </p>
                <p className="mt-1">
                  {closure.startDate} 〜 {closure.endDate} / {closure.reason}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">設定はありません。</p>
          )}
        </div>
      </section>

      {isEditing && (
        <RuleEditPanel
          rule={draftRule}
          sites={readJsonStorage(ADMIN_SITES_KEY, dummySites)}
          onClose={() => setIsEditing(false)}
          onSave={setDraftRule}
        />
      )}
    </div>
  );
}
