'use client';

import { useEffect, useState } from 'react';
import { dummyPlans } from '@/data/adminDummyData';
import {
  ADMIN_PLANS_KEY,
  readJsonStorage,
  writeJsonStorage,
} from '@/lib/admin/browserStorage';
import type { AdminPlan } from '@/types/admin';
import PlanEditPanel from '@/components/admin/PlanEditPanel';

const emptyPlan: AdminPlan = {
  id: '',
  name: '',
  description: '',
  isPublished: false,
  basePrice: 0,
  targetSiteIds: [],
  capacity: 1,
  salesStartDate: null,
  salesEndDate: null,
  imageUrl: '/site-map-placeholder.svg',
  createdAt: '',
  updatedAt: '',
};

export default function AdminPlansPage() {
  const [savedPlans, setSavedPlans] = useState<AdminPlan[]>(dummyPlans);
  const [draftPlans, setDraftPlans] = useState<AdminPlan[]>(dummyPlans);
  const [editingPlan, setEditingPlan] = useState<AdminPlan | null>(null);

  useEffect(() => {
    const initial = readJsonStorage(ADMIN_PLANS_KEY, dummyPlans);
    setSavedPlans(initial);
    setDraftPlans(initial);
  }, []);

  const hasChanges = JSON.stringify(savedPlans) !== JSON.stringify(draftPlans);

  const updateDraftPlan = (plan: AdminPlan) => {
    setDraftPlans((prev) => {
      if (!plan.id) {
        return [...prev, { ...plan, id: `plan-${Date.now()}` }];
      }

      return prev.map((item) => (item.id === plan.id ? plan : item));
    });
    setEditingPlan(null);
  };

  const handleDelete = (planId: string) => {
    setDraftPlans((prev) => prev.filter((item) => item.id !== planId));
  };

  const handleSave = () => {
    writeJsonStorage(ADMIN_PLANS_KEY, draftPlans);
    setSavedPlans(draftPlans);
    window.alert('変更を適用しました');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">プラン管理</h1>
          <p className="mt-1 text-sm text-gray-500">
            公開側のプラン表示に使う内容を編集します。変更後は保存ボタンで公開画面へ反映してください。
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setEditingPlan(emptyPlan)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            新しいプランを追加
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
          未保存の変更があります。保存するとプレビュー画面のプラン表示へ反映されます。
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {draftPlans.map((plan) => (
          <article key={plan.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <img
              src={plan.imageUrl || '/site-map-placeholder.svg'}
              alt={plan.name}
              className="h-44 w-full object-cover"
            />
            <div className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">{plan.name || 'プラン名未設定'}</h2>
                  <p className="mt-1 text-sm text-gray-500">{plan.description || '説明文は未設定です。'}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    plan.isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {plan.isPublished ? '公開中' : '非公開'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-gray-50 p-3">
                  <dt className="text-gray-500">基本料金</dt>
                  <dd className="mt-1 font-semibold text-gray-900">¥{plan.basePrice.toLocaleString()}</dd>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <dt className="text-gray-500">利用人数</dt>
                  <dd className="mt-1 font-semibold text-gray-900">{plan.capacity}名まで</dd>
                </div>
              </div>
              <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
                対象サイト: {plan.targetSiteIds.length > 0 ? `${plan.targetSiteIds.length}件` : '未設定'}
              </div>
              <p className="text-xs text-gray-500">
                販売期間:{' '}
                {plan.salesStartDate && plan.salesEndDate
                  ? `${plan.salesStartDate} 〜 ${plan.salesEndDate}`
                  : '未設定'}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => handleDelete(plan.id)}
                  className="text-sm font-medium text-red-600 hover:text-red-700"
                >
                  削除
                </button>
                <button
                  type="button"
                  onClick={() => setEditingPlan(plan)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  編集
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {editingPlan && (
        <PlanEditPanel
          plan={editingPlan}
          onClose={() => setEditingPlan(null)}
          onSave={updateDraftPlan}
        />
      )}
    </div>
  );
}
