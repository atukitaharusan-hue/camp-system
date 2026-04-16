'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBookingDraftStore } from '@/stores/bookingDraftStore';
import { fetchPlans } from '@/lib/admin/fetchData';
import type { AdminPlan } from '@/types/admin';

function formatDate(iso: string) {
  return iso.replace(/-/g, '/');
}

export default function PlansPage() {
  const router = useRouter();
  const { stay, plan, setPlan } = useBookingDraftStore();
  const [adminPlans, setAdminPlans] = useState<AdminPlan[]>([]);

  const hasStay = !!(stay.checkIn && stay.checkOut && stay.nights > 0);
  const hasPlan = !!(plan.majorCategoryId && plan.minorPlanId);

  useEffect(() => {
    if (!hasStay) {
      router.replace('/');
    }
  }, [hasStay, router]);

  useEffect(() => {
    fetchPlans().then(setAdminPlans);
  }, []);

  /** 公開プランをカテゴリごとにグループ化 */
  const categories = useMemo(() => {
    const grouped = new Map<string, AdminPlan[]>();
    for (const p of adminPlans) {
      if (!p.isPublished) continue;
      const cat = p.category || '未分類';
      const list = grouped.get(cat) ?? [];
      list.push(p);
      grouped.set(cat, list);
    }
    return Array.from(grouped.entries()).map(([name, plans]) => ({
      name,
      plans,
    }));
  }, [adminPlans]);

  const handleSelectPlan = (categoryName: string, p: AdminPlan) => {
    if (plan.majorCategoryId === categoryName && plan.minorPlanId === p.id) {
      setPlan({ majorCategoryId: null, minorPlanId: null, planName: null, categoryName: null });
    } else {
      setPlan({ majorCategoryId: categoryName, minorPlanId: p.id, planName: p.name, categoryName });
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
            {categories.map((category) => (
              <div key={category.name} className="overflow-hidden rounded-lg border border-gray-300">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                  <h3 className="text-sm font-bold text-gray-700">{category.name}</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {category.plans.map((item) => {
                    const isSelected = plan.majorCategoryId === category.name && plan.minorPlanId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectPlan(category.name, item)}
                        className={`w-full text-left transition-colors ${isSelected ? 'bg-blue-50 ring-2 ring-inset ring-blue-400' : 'hover:bg-gray-50'}`}
                      >
                        <div className="flex gap-4 px-4 py-3">
                          <img src={item.imageUrl || '/site-map-placeholder.svg'} alt={item.name} className="h-20 w-24 rounded-lg object-cover" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium text-gray-700">{item.name}</p>
                              {isSelected && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">選択中</span>}
                            </div>
                            {item.features && <p className="mt-1 text-xs text-gray-400">{item.features}</p>}
                            <p className="mt-3 text-sm font-semibold text-gray-700">¥{item.basePrice.toLocaleString()}<span className="text-xs font-normal text-gray-400"> / 泊</span></p>
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
