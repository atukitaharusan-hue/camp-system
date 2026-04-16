'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBookingDraftStore } from '@/stores/bookingDraftStore';
import { dummyPlans } from '@/data/adminDummyData';
import { ADMIN_PLANS_KEY, readJsonStorage } from '@/lib/admin/browserStorage';
import type { AdminPlan } from '@/types/admin';

const planCategories = [
  {
    id: 'off-season',
    name: '6月〜9月の閑散期プラン',
    description: '静かにゆったり過ごしたい方向けの期間限定プランです。',
    plans: [
      { id: 'off-season-auto', name: '閑散期オートサイト', features: 'オートサイト / 電源あり / 最大6名', price: '¥4,500', adminIndex: 0 },
      { id: 'off-season-cottage', name: '閑散期コテージ', features: 'コテージ / 冷暖房付き / 最大5名', price: '¥10,800', adminIndex: 2 },
    ],
  },
  {
    id: 'family',
    name: 'ファミリー向けプラン',
    description: '小さなお子さま連れでも使いやすいプランです。',
    plans: [
      { id: 'family-oyako', name: '親子向けファミリープラン', features: 'ファミリーサイト / 最大5名', price: '¥5,500', adminIndex: 1 },
      { id: 'family-cottage', name: 'ファミリーコテージ', features: 'コテージ / 最大6名', price: '¥12,500', adminIndex: 2 },
    ],
  },
  {
    id: 'standard',
    name: 'スタンダード宿泊プラン',
    description: '通常利用向けの基本プランです。',
    plans: [
      { id: 'standard-auto-a', name: 'オートサイト', features: 'オートサイト / 最大6名', price: '¥5,000', adminIndex: 0 },
      { id: 'standard-cottage-b', name: 'コテージB', features: 'コテージ / 最大5名', price: '¥12,000', adminIndex: 2 },
      { id: 'standard-free', name: 'フリーサイト', features: 'ファミリーエリア / 最大4名', price: '¥2,500', adminIndex: 1 },
    ],
  },
];

function formatDate(iso: string) {
  return iso.replace(/-/g, '/');
}

export default function PlansPage() {
  const router = useRouter();
  const { stay, plan, setPlan } = useBookingDraftStore();
  const [adminPlans, setAdminPlans] = useState<AdminPlan[]>(dummyPlans);

  const hasStay = !!(stay.checkIn && stay.checkOut && stay.nights > 0);
  const hasPlan = !!(plan.majorCategoryId && plan.minorPlanId);

  useEffect(() => {
    if (!hasStay) {
      router.replace('/');
    }
  }, [hasStay, router]);

  useEffect(() => {
    setAdminPlans(readJsonStorage(ADMIN_PLANS_KEY, dummyPlans));
  }, []);

  const decoratedCategories = useMemo(
    () =>
      planCategories.map((category) => ({
        ...category,
        plans: category.plans.map((item) => {
          const linkedPlan = adminPlans[item.adminIndex];
          return {
            ...item,
            imageUrl: linkedPlan?.imageUrl ?? '/site-map-placeholder.svg',
            displayPrice: linkedPlan ? `¥${linkedPlan.basePrice.toLocaleString()}` : item.price,
            isPublished: linkedPlan?.isPublished ?? true,
          };
        }),
      })),
    [adminPlans],
  );

  const handleSelectPlan = (categoryId: string, planId: string) => {
    if (plan.majorCategoryId === categoryId && plan.minorPlanId === planId) {
      setPlan({ majorCategoryId: null, minorPlanId: null });
    } else {
      setPlan({ majorCategoryId: categoryId, minorPlanId: planId });
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-md px-4 py-6 md:max-w-2xl">
        <header className="mb-6">
          <button type="button" onClick={() => router.push('/')} className="mb-3 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
            日付選択へ戻る
          </button>
          <h1 className="text-xl font-bold text-gray-800">プランからサイトを選ぶ</h1>
        </header>

        {hasStay && (
          <section className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">宿泊日:</span> {formatDate(stay.checkIn!)} 〜 {formatDate(stay.checkOut!)} / <strong>{stay.nights}泊</strong>
            </p>
          </section>
        )}

        <section className="mb-8">
          <div className="space-y-5">
            {decoratedCategories.map((category) => (
              <div key={category.id} className="overflow-hidden rounded-lg border border-gray-300">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                  <h3 className="text-sm font-bold text-gray-700">{category.name}</h3>
                  <p className="mt-0.5 text-xs text-gray-400">{category.description}</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {category.plans.map((item) => {
                    const isSelected = plan.majorCategoryId === category.id && plan.minorPlanId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={!item.isPublished}
                        onClick={() => handleSelectPlan(category.id, item.id)}
                        className={`w-full text-left transition-colors ${isSelected ? 'bg-blue-50 ring-2 ring-inset ring-blue-400' : 'hover:bg-gray-50'} ${!item.isPublished ? 'cursor-not-allowed bg-gray-100 opacity-60' : ''}`}
                      >
                        <div className="flex gap-4 px-4 py-3">
                          <img src={item.imageUrl} alt={item.name} className="h-20 w-24 rounded-lg object-cover" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium text-gray-700">{item.name}</p>
                              {isSelected && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">選択中</span>}
                              {!item.isPublished && <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">非公開</span>}
                            </div>
                            <p className="mt-1 text-xs text-gray-400">{item.features}</p>
                            <p className="mt-3 text-sm font-semibold text-gray-700">{item.displayPrice}<span className="text-xs font-normal text-gray-400"> / 泊</span></p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <button
            type="button"
            disabled={!hasPlan}
            onClick={() => router.push('/booking/sites')}
            className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
          >
            サイト選択へ
          </button>
          {!hasPlan && <p className="mt-2 text-center text-xs text-gray-400">プランを選択してください</p>}
        </section>
      </div>
    </div>
  );
}
