'use client';

import { useMemo, useState, type ReactNode } from 'react';
import type { AdminSite, ClosedDateRange, SalesRule, SiteClosure } from '@/types/admin';

interface Props {
  rule: SalesRule;
  sites: AdminSite[];
  onClose: () => void;
  onSave: (rule: SalesRule) => void;
}

function formatDate(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function getDatesInRange(startDate: string, endDate: string) {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  while (cursor <= end) {
    dates.push(formatDate(cursor.toISOString().slice(0, 10)));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

export default function RuleEditPanel({ rule, sites, onClose, onSave }: Props) {
  const [form, setForm] = useState<SalesRule>(rule);
  const [singleClosedDate, setSingleClosedDate] = useState('');
  const [rangeDraft, setRangeDraft] = useState({ startDate: '', endDate: '', reason: '受付停止' });
  const [siteDraft, setSiteDraft] = useState({
    area: '',
    siteId: '',
    startDate: '',
    endDate: '',
    reason: '受付停止',
  });

  const areaOptions = useMemo(
    () => Array.from(new Set(sites.map((site) => site.area))).filter(Boolean),
    [sites],
  );

  const selectableSites = useMemo(
    () => sites.filter((site) => !siteDraft.area || site.area === siteDraft.area),
    [siteDraft.area, sites],
  );

  const addClosedDate = () => {
    if (!singleClosedDate || form.closedDates.includes(singleClosedDate)) return;
    setForm((prev) => ({
      ...prev,
      closedDates: [...prev.closedDates, singleClosedDate].sort(),
    }));
    setSingleClosedDate('');
  };

  const addRange = () => {
    if (!rangeDraft.startDate || !rangeDraft.endDate || rangeDraft.endDate < rangeDraft.startDate) return;
    const nextRange: ClosedDateRange = {
      id: `range-${Date.now()}`,
      startDate: rangeDraft.startDate,
      endDate: rangeDraft.endDate,
      reason: rangeDraft.reason || '受付停止',
    };
    setForm((prev) => ({
      ...prev,
      closedDateRanges: [...prev.closedDateRanges, nextRange],
    }));
    setRangeDraft({ startDate: '', endDate: '', reason: '受付停止' });
  };

  const addSiteClosure = () => {
    const selectedSite = sites.find((site) => site.id === siteDraft.siteId);
    if (!selectedSite || !siteDraft.startDate || !siteDraft.endDate || siteDraft.endDate < siteDraft.startDate) {
      return;
    }

    const nextClosure: SiteClosure = {
      siteId: selectedSite.id,
      area: selectedSite.area,
      siteNumber: selectedSite.siteNumber,
      startDate: siteDraft.startDate,
      endDate: siteDraft.endDate,
      dates: getDatesInRange(siteDraft.startDate, siteDraft.endDate),
      reason: siteDraft.reason || '受付停止',
    };

    setForm((prev) => ({
      ...prev,
      siteClosures: [...prev.siteClosures, nextClosure],
    }));
    setSiteDraft({ area: siteDraft.area, siteId: '', startDate: '', endDate: '', reason: '受付停止' });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSave({
      ...form,
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative h-full w-full max-w-3xl overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <h2 className="text-base font-bold text-gray-900">販売ルールを編集</h2>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-gray-400 hover:text-gray-600">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 px-6 py-5">
          <Field label="受付停止日">
            <div className="mb-3 flex gap-2">
              <input
                type="date"
                value={singleClosedDate}
                onChange={(event) => setSingleClosedDate(event.target.value)}
                className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={addClosedDate}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                追加
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {form.closedDates.map((date) => (
                <span
                  key={date}
                  className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700"
                >
                  {date}
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        closedDates: prev.closedDates.filter((item) => item !== date),
                      }))
                    }
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </Field>

          <Field label="受付停止期間">
            <div className="grid gap-3 lg:grid-cols-[1fr,1fr,1fr,auto]">
              <input
                type="date"
                value={rangeDraft.startDate}
                onChange={(event) => setRangeDraft((prev) => ({ ...prev, startDate: event.target.value }))}
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={rangeDraft.endDate}
                onChange={(event) => setRangeDraft((prev) => ({ ...prev, endDate: event.target.value }))}
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={rangeDraft.reason}
                onChange={(event) => setRangeDraft((prev) => ({ ...prev, reason: event.target.value }))}
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
                placeholder="理由"
              />
              <button
                type="button"
                onClick={addRange}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                追加
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {form.closedDateRanges.map((range) => (
                <div key={range.id} className="flex items-center justify-between rounded-2xl border border-gray-200 px-4 py-3 text-sm">
                  <span>
                    {range.startDate} 〜 {range.endDate} / {range.reason}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        closedDateRanges: prev.closedDateRanges.filter((item) => item.id !== range.id),
                      }))
                    }
                    className="font-medium text-red-600 hover:text-red-700"
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
          </Field>

          <Field label="サイト別停止設定">
            <div className="grid gap-3 lg:grid-cols-2">
              <select
                value={siteDraft.area}
                onChange={(event) =>
                  setSiteDraft({
                    area: event.target.value,
                    siteId: '',
                    startDate: siteDraft.startDate,
                    endDate: siteDraft.endDate,
                    reason: siteDraft.reason,
                  })
                }
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">エリアを選択してください</option>
                {areaOptions.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
              <select
                value={siteDraft.siteId}
                onChange={(event) => setSiteDraft((prev) => ({ ...prev, siteId: event.target.value }))}
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">サイト番号を選択してください</option>
                {selectableSites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.siteNumber} / {site.siteName}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={siteDraft.startDate}
                onChange={(event) => setSiteDraft((prev) => ({ ...prev, startDate: event.target.value }))}
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={siteDraft.endDate}
                onChange={(event) => setSiteDraft((prev) => ({ ...prev, endDate: event.target.value }))}
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={siteDraft.reason}
                onChange={(event) => setSiteDraft((prev) => ({ ...prev, reason: event.target.value }))}
                placeholder="理由"
                className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={addSiteClosure}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                追加
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {form.siteClosures.map((closure, index) => (
                <div key={`${closure.siteId}-${closure.startDate}-${index}`} className="rounded-2xl border border-gray-200 p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {closure.area} / {closure.siteNumber}
                      </p>
                      <p className="mt-1 text-gray-600">
                        {closure.startDate} 〜 {closure.endDate} / {closure.reason}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          siteClosures: prev.siteClosures.filter((_, itemIndex) => itemIndex !== index),
                        }))
                      }
                      className="font-medium text-red-600 hover:text-red-700"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Field>

          <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              下書きに反映
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</label>
      {children}
    </div>
  );
}
