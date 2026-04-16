'use client';

import { useEffect, useState } from 'react';
import { fetchPolicySettings, savePolicySettings } from '@/lib/admin/fetchData';
import type { AdminPolicySettings } from '@/types/admin';

function createPaymentMethod() {
  return {
    id: `payment-${Date.now()}`,
    label: '',
    description: '',
    isEnabled: true,
  };
}

export default function AdminPoliciesPage() {
  const [savedSettings, setSavedSettings] = useState<AdminPolicySettings>({ paymentNotice: '', eventEntryNotice: '', paymentMethods: [], cancellationPolicies: [], termsSections: [] });
  const [draftSettings, setDraftSettings] = useState<AdminPolicySettings>({ paymentNotice: '', eventEntryNotice: '', paymentMethods: [], cancellationPolicies: [], termsSections: [] });

  useEffect(() => {
    fetchPolicySettings().then((initial) => {
      setSavedSettings(initial);
      setDraftSettings(initial);
    });
  }, []);

  const hasChanges = JSON.stringify(savedSettings) !== JSON.stringify(draftSettings);

  const handleSave = () => {
    savePolicySettings(draftSettings);
    setSavedSettings(draftSettings);
    window.alert('変更を適用しました');
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">規約・同意設定</h1>
          <p className="mt-1 text-sm text-gray-500">
            利用規約、キャンセルポリシー、決済方法の表示内容をまとめて設定します。最後に保存すると公開画面へ反映されます。
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          保存
        </button>
      </div>

      {hasChanges && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          未保存の変更があります。公開画面へ反映するには保存してください。
        </div>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-gray-900">お支払いに関する注意事項</h2>
        <textarea
          value={draftSettings.paymentNotice}
          onChange={(event) =>
            setDraftSettings((prev) => ({ ...prev, paymentNotice: event.target.value }))
          }
          rows={4}
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
        />
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">表示する決済方法</h2>
            <p className="mt-1 text-sm text-gray-500">公開画面に出す決済方法を自由な文言で追加できます。</p>
          </div>
          <button
            type="button"
            onClick={() =>
              setDraftSettings((prev) => ({
                ...prev,
                paymentMethods: [...prev.paymentMethods, createPaymentMethod()],
              }))
            }
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            決済方法を追加
          </button>
        </div>
        <div className="space-y-3">
          {draftSettings.paymentMethods.map((method, index) => (
            <article key={method.id} className="rounded-2xl border border-gray-200 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-gray-800">決済方法 {index + 1}</p>
                <button
                  type="button"
                  onClick={() =>
                    setDraftSettings((prev) => ({
                      ...prev,
                      paymentMethods: prev.paymentMethods.filter((item) => item.id !== method.id),
                    }))
                  }
                  className="text-sm font-medium text-red-600 hover:text-red-700"
                >
                  削除
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">表示名</span>
                  <input
                    type="text"
                    value={method.label}
                    onChange={(event) =>
                      setDraftSettings((prev) => ({
                        ...prev,
                        paymentMethods: prev.paymentMethods.map((item) =>
                          item.id === method.id ? { ...item, label: event.target.value } : item,
                        ),
                      }))
                    }
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">説明文</span>
                  <input
                    type="text"
                    value={method.description}
                    onChange={(event) =>
                      setDraftSettings((prev) => ({
                        ...prev,
                        paymentMethods: prev.paymentMethods.map((item) =>
                          item.id === method.id ? { ...item, description: event.target.value } : item,
                        ),
                      }))
                    }
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={method.isEnabled}
                  onChange={(event) =>
                    setDraftSettings((prev) => ({
                      ...prev,
                      paymentMethods: prev.paymentMethods.map((item) =>
                        item.id === method.id ? { ...item, isEnabled: event.target.checked } : item,
                      ),
                    }))
                  }
                  className="rounded border-gray-300"
                />
                公開画面に表示する
              </label>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-gray-900">イベント案内文</h2>
        <textarea
          value={draftSettings.eventEntryNotice}
          onChange={(event) =>
            setDraftSettings((prev) => ({ ...prev, eventEntryNotice: event.target.value }))
          }
          rows={3}
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
        />
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900">キャンセルポリシー</h2>
          <button
            type="button"
            onClick={() =>
              setDraftSettings((prev) => ({
                ...prev,
                cancellationPolicies: [...prev.cancellationPolicies, { period: '', rate: '' }],
              }))
            }
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            ポリシーを追加
          </button>
        </div>
        <div className="space-y-3">
          {draftSettings.cancellationPolicies.map((policy, index) => (
            <div key={`${policy.period}-${index}`} className="grid gap-3 md:grid-cols-[1fr,1fr,auto]">
              <input
                type="text"
                value={policy.period}
                onChange={(event) =>
                  setDraftSettings((prev) => ({
                    ...prev,
                    cancellationPolicies: prev.cancellationPolicies.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, period: event.target.value } : item,
                    ),
                  }))
                }
                placeholder="例: 6日前〜3日前"
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={policy.rate}
                onChange={(event) =>
                  setDraftSettings((prev) => ({
                    ...prev,
                    cancellationPolicies: prev.cancellationPolicies.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, rate: event.target.value } : item,
                    ),
                  }))
                }
                placeholder="例: 宿泊料金の50%"
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() =>
                  setDraftSettings((prev) => ({
                    ...prev,
                    cancellationPolicies: prev.cancellationPolicies.filter((_, itemIndex) => itemIndex !== index),
                  }))
                }
                className="rounded-xl border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                削除
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900">規約・同意項目</h2>
          <button
            type="button"
            onClick={() =>
              setDraftSettings((prev) => ({
                ...prev,
                termsSections: [...prev.termsSections, { title: '新しい項目', body: [''] }],
              }))
            }
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            項目を追加
          </button>
        </div>
        <div className="space-y-4">
          {draftSettings.termsSections.map((section, index) => (
            <article key={`${section.title}-${index}`} className="rounded-2xl border border-gray-200 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <input
                  type="text"
                  value={section.title}
                  onChange={(event) =>
                    setDraftSettings((prev) => ({
                      ...prev,
                      termsSections: prev.termsSections.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, title: event.target.value } : item,
                      ),
                    }))
                  }
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium"
                />
                <button
                  type="button"
                  onClick={() =>
                    setDraftSettings((prev) => ({
                      ...prev,
                      termsSections: prev.termsSections.filter((_, itemIndex) => itemIndex !== index),
                    }))
                  }
                  className="text-sm font-medium text-red-600 hover:text-red-700"
                >
                  削除
                </button>
              </div>
              <textarea
                value={section.body.join('\n')}
                onChange={(event) =>
                  setDraftSettings((prev) => ({
                    ...prev,
                    termsSections: prev.termsSections.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, body: event.target.value.split('\n') }
                        : item,
                    ),
                  }))
                }
                rows={6}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
