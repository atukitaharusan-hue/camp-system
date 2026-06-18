'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  fetchAccountingSubjects,
  fetchSalesReportCategories,
  fetchSalesReportOutputSettings,
} from '@/lib/admin/fetchData';
import { fetchReservations } from '@/lib/admin/fetchReservations';
import {
  aggregateByPaymentMethod,
  buildPreviewRegisterLogs,
  buildReservationAccountingLogs,
  buildSalesReportLinesFromLogs,
  DEFAULT_CATEGORIES,
  DEFAULT_OUTPUTS,
  DEFAULT_SUBJECTS,
  formatCurrency,
  resolveParentCategoryName,
  todayIso,
  type AccountingLogEntry,
  type AccountingLogItem,
} from '@/lib/admin/accountingReportUtils';
import {
  deletePreviewRegisterSale,
  loadPreviewRegisterSales,
  savePreviewRegisterSales,
} from '@/lib/registerSalesPreview';
import { updateReservationDetail } from '@/lib/admin/updateReservation';
import type {
  AccountingSubjectSetting,
  PreviewRegisterSale,
  RegisterSalePaymentMethod,
  SalesReportCategorySetting,
  SalesReportOutputSetting,
} from '@/types/admin';
import type { Database } from '@/types/database';
import type { PricingLineItem, ReservationPricingBreakdown } from '@/types/pricing';

type GuestReservationRow = Database['public']['Tables']['guest_reservations']['Row'];
type ReservationStatus = Database['public']['Enums']['reservation_status'];
type ReservationPaymentMethod = Database['public']['Enums']['payment_method'];
type MyPageLinkStatus = 'linked' | 'support' | 'unlinked';

type EditableAccountingLog = AccountingLogEntry & { items: AccountingLogItem[] };

function cloneLog(log: AccountingLogEntry): EditableAccountingLog {
  return {
    ...log,
    items: log.items.map((item) => ({ ...item })),
  };
}

function getRegisterPaymentMethodLabel(method: string) {
  if (method === 'cash') return '現金';
  if (method === 'card') return 'カード';
  if (method === 'paid') return '決済済み';
  if (method === 'other') return 'その他';
  return method;
}

function buildPricingLineItem(item: AccountingLogItem, fallbackId: string): PricingLineItem {
  return {
    id: fallbackId,
    label: item.accountingSubjectName,
    chargeUnit: 'guest',
    quantity: Math.max(1, item.quantity),
    unitPrice: Math.max(0, item.unitPrice),
    amount: Math.max(0, item.subtotal),
    accountingSubjectId: item.accountingSubjectId,
    accountingSubjectName: item.accountingSubjectName,
  };
}

function aggregateSingleLine(
  items: AccountingLogItem[],
  fallbackId: string,
  fallbackLabel: string,
): PricingLineItem | null {
  if (items.length === 0) return null;
  if (items.length === 1) {
    return buildPricingLineItem(items[0], fallbackId);
  }

  const quantity = items.reduce((sum, item) => sum + Math.max(1, item.quantity), 0);
  const subtotal = items.reduce((sum, item) => sum + Math.max(0, item.subtotal), 0);
  const first = items[0];

  return {
    id: fallbackId,
    label: first.accountingSubjectName || fallbackLabel,
    chargeUnit: 'guest',
    quantity,
    unitPrice: quantity > 0 ? Math.round(subtotal / quantity) : subtotal,
    amount: subtotal,
    accountingSubjectId: first.accountingSubjectId,
    accountingSubjectName: first.accountingSubjectName,
  };
}

function buildReservationOptionsJsonFromLogItems(items: AccountingLogItem[]) {
  return items
    .filter((item) => item.sourceKind === 'option')
    .map((item) => {
      if (item.optionType === 'event') {
        return {
          type: 'event',
          optionId: item.optionId ?? '',
          name: item.accountingSubjectName,
          quantity: 1,
          people: Math.max(1, item.quantity),
          subtotal: Math.max(0, item.subtotal),
          unitPrice: Math.max(0, item.unitPrice),
          accountingSubjectId: item.accountingSubjectId,
          accountingSubjectName: item.accountingSubjectName,
        };
      }

      if (item.optionType === 'purchase') {
        return {
          type: 'purchase',
          name: item.accountingSubjectName,
          quantity: Math.max(1, item.quantity),
          unitPrice: Math.max(0, item.unitPrice),
          subtotal: Math.max(0, item.subtotal),
          accountingSubjectId: item.accountingSubjectId,
          accountingSubjectName: item.accountingSubjectName,
        };
      }

      return {
        type: 'rental',
        optionId: item.optionId ?? '',
        name: item.accountingSubjectName,
        quantity: Math.max(1, item.quantity),
        days: Math.max(1, item.days ?? 1),
        subtotal: Math.max(0, item.subtotal),
        accountingSubjectId: item.accountingSubjectId,
        accountingSubjectName: item.accountingSubjectName,
      };
    });
}

function buildPricingBreakdownFromLogItems(items: AccountingLogItem[]): ReservationPricingBreakdown {
  const accommodationItems = items.filter((item) => item.sourceKind === 'accommodation');
  const designationItems = items.filter((item) => item.sourceKind === 'designation');
  const mandatoryFeeItems = items.filter((item) => item.sourceKind === 'mandatory_fee');
  const lodgingTaxItems = items.filter((item) => item.sourceKind === 'lodging_tax');
  const optionItems = items.filter((item) => item.sourceKind === 'option');

  const accommodationLines = accommodationItems.map((item, index) =>
    buildPricingLineItem(item, `accommodation-line-${index + 1}`),
  );
  const designationFeeLine = aggregateSingleLine(designationItems, 'designation-fee', 'サイト指定料金');
  const mandatoryFees = mandatoryFeeItems.map((item, index) =>
    buildPricingLineItem(item, `mandatory-fee-${index + 1}`),
  );
  const lodgingTax = aggregateSingleLine(lodgingTaxItems, 'lodging-tax', '宿泊税');
  const totalAmount = items.reduce((sum, item) => sum + Math.max(0, item.subtotal), 0);

  return {
    accommodationAmount: accommodationItems.reduce((sum, item) => sum + Math.max(0, item.subtotal), 0),
    accommodationLines,
    accommodationSubjectId: accommodationItems[0]?.accountingSubjectId ?? null,
    accommodationSubjectName: accommodationItems[0]?.accountingSubjectName ?? null,
    designationFeeAmount: designationItems.reduce((sum, item) => sum + Math.max(0, item.subtotal), 0),
    designationFeeLine,
    designationFeeSubjectId: designationItems[0]?.accountingSubjectId ?? null,
    designationFeeSubjectName: designationItems[0]?.accountingSubjectName ?? null,
    optionsAmount: optionItems.reduce((sum, item) => sum + Math.max(0, item.subtotal), 0),
    mandatoryFees,
    lodgingTax,
    totalAmount,
  };
}

function getReservationPaymentMethodOptions() {
  return [
    { value: 'cash', label: '現金' },
    { value: 'credit_card', label: 'クレジットカード' },
    { value: 'bank_transfer', label: '銀行振込' },
  ] satisfies Array<{ value: ReservationPaymentMethod; label: string }>;
}

function getRegisterPaymentMethodOptions() {
  return [
    { value: 'cash', label: '現金' },
    { value: 'card', label: 'カード' },
    { value: 'paid', label: '決済済み' },
    { value: 'other', label: 'その他' },
  ] satisfies Array<{ value: RegisterSalePaymentMethod; label: string }>;
}

export default function AdminAccountingReportsPage() {
  const [subjects, setSubjects] = useState<AccountingSubjectSetting[]>([]);
  const [categories, setCategories] = useState<SalesReportCategorySetting[]>([]);
  const [outputs, setOutputs] = useState<SalesReportOutputSetting[]>([]);
  const [reservations, setReservations] = useState<GuestReservationRow[]>([]);
  const [previewRegisterSales, setPreviewRegisterSales] = useState<PreviewRegisterSale[]>([]);
  const [dateFrom, setDateFrom] = useState(todayIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [editingLog, setEditingLog] = useState<EditableAccountingLog | null>(null);
  const [mypageStatuses, setMypageStatuses] = useState<
    Record<string, { linkStatus: MyPageLinkStatus; lineUserId: string | null }>
  >({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const [fetchedSubjects, fetchedCategories, fetchedOutputs, fetchedReservations] = await Promise.all([
        fetchAccountingSubjects(),
        fetchSalesReportCategories(),
        fetchSalesReportOutputSettings(),
        fetchReservations(),
      ]);

      setSubjects(fetchedSubjects.length > 0 ? fetchedSubjects : DEFAULT_SUBJECTS);
      setCategories(fetchedCategories.length > 0 ? fetchedCategories : DEFAULT_CATEGORIES);
      setOutputs(fetchedOutputs.length > 0 ? fetchedOutputs : DEFAULT_OUTPUTS);
      setReservations(fetchedReservations.data);
      setPreviewRegisterSales(loadPreviewRegisterSales());
    })();
  }, []);

  useEffect(() => {
    const handleUpdate = () => setPreviewRegisterSales(loadPreviewRegisterSales());
    window.addEventListener('preview-register-sales-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('preview-register-sales-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  useEffect(() => {
    if (reservations.length === 0) {
      setMypageStatuses({});
      return;
    }

    void (async () => {
      try {
        const response = await fetch('/api/admin/mypage-links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'status',
            reservationIds: reservations.map((reservation) => reservation.id),
          }),
        });

        const payload = (await response.json().catch(() => null)) as
          | {
              statuses?: Record<string, { linkStatus?: MyPageLinkStatus; lineUserId?: string | null }>;
            }
          | null;

        if (!response.ok || !payload?.statuses) {
          setMypageStatuses({});
          return;
        }

        setMypageStatuses(
          Object.entries(payload.statuses).reduce<
            Record<string, { linkStatus: MyPageLinkStatus; lineUserId: string | null }>
          >((accumulator, [reservationId, value]) => {
            accumulator[reservationId] = {
              linkStatus: value.linkStatus ?? 'unlinked',
              lineUserId: value.lineUserId ?? null,
            };
            return accumulator;
          }, {}),
        );
      } catch (error) {
        console.error('[accounting-reports] mypage status fetch error', error);
        setMypageStatuses({});
      }
    })();
  }, [reservations]);

  const activeSubjects = useMemo(
    () => subjects.filter((subject) => subject.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [subjects],
  );

  const activeCategories = useMemo(
    () => categories.filter((category) => category.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  );

  const accountingLogs = useMemo(
    () => [
      ...buildReservationAccountingLogs(reservations, activeSubjects, activeCategories, dateFrom, dateTo),
      ...buildPreviewRegisterLogs(previewRegisterSales, dateFrom, dateTo),
    ].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [activeCategories, activeSubjects, dateFrom, dateTo, previewRegisterSales, reservations],
  );

  const reportLines = useMemo(() => buildSalesReportLinesFromLogs(accountingLogs), [accountingLogs]);

  const groupedReports = useMemo(() => {
    return outputs
      .filter((output) => output.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((output) => {
        const scopedCategories =
          output.includedCategories.includes('すべてのカテゴリ')
            ? activeCategories
            : activeCategories.filter((category) => output.includedCategories.includes(category.parentCategoryName));

        const subjectToParent = new Map<string, string>();
        scopedCategories.forEach((category) => {
          category.subjectIds.forEach((subjectId) => {
            if (!subjectToParent.has(subjectId)) subjectToParent.set(subjectId, category.parentCategoryName);
          });
        });

        const scopedLines = reportLines.filter((line) => subjectToParent.has(line.subjectId));
        const parentTotals = scopedCategories.map((category) => ({
          name: category.parentCategoryName,
          subtotal: scopedLines
            .filter((line) => subjectToParent.get(line.subjectId) === category.parentCategoryName)
            .reduce((sum, line) => sum + line.subtotal, 0),
        }));

        const childTotals = scopedCategories.flatMap((category) =>
          category.subjectIds
            .map((subjectId) => {
              const subject = activeSubjects.find((item) => item.id === subjectId);
              const lines = scopedLines.filter((line) => line.subjectId === subjectId);
              if (lines.length === 0) return null;
              return {
                parentCategoryName: category.parentCategoryName,
                subjectName: subject?.name ?? lines[0].subjectName,
                quantity: lines.reduce((sum, line) => sum + line.quantity, 0),
                unitPrice: lines[0].unitPrice,
                subtotal: lines.reduce((sum, line) => sum + line.subtotal, 0),
              };
            })
            .filter(
              (
                row,
              ): row is {
                parentCategoryName: string;
                subjectName: string;
                quantity: number;
                unitPrice: number;
                subtotal: number;
              } => row !== null,
            ),
        );

        const paymentTotals = aggregateByPaymentMethod(scopedLines);
        const guestTotal = Array.from(
          new Map(
            accountingLogs
              .filter(
                (log) =>
                  log.sourceType === 'reservation' &&
                  Boolean(log.reservationId) &&
                  log.items.some((item) => subjectToParent.has(item.accountingSubjectId)),
              )
              .map((log) => [log.reservationId as string, Math.max(0, log.guests ?? 0)]),
          ).values(),
        ).reduce((sum, value) => sum + value, 0);

        return {
          output,
          parentTotals,
          childTotals,
          paymentTotals,
          guestTotal,
          total: parentTotals.reduce((sum, row) => sum + row.subtotal, 0),
        };
      });
  }, [accountingLogs, activeCategories, activeSubjects, outputs, reportLines]);

  const saveEditedLog = async () => {
    if (!editingLog) return;

    const normalizedItems = editingLog.items.map((item) => ({
      ...item,
      quantity: Math.max(1, item.quantity),
      unitPrice: Math.max(0, item.unitPrice),
      subtotal: Math.max(1, item.quantity) * Math.max(0, item.unitPrice),
    }));
    const nextTotalAmount = normalizedItems.reduce((sum, item) => sum + item.subtotal, 0);

    setSaving(true);

    if (editingLog.sourceType === 'register') {
      const nextSales = loadPreviewRegisterSales().map((sale) =>
        sale.id === editingLog.id
          ? {
              ...sale,
              customerName: editingLog.customerName,
              guests: editingLog.guests,
              adults: editingLog.adults,
              children: editingLog.children,
              infants: editingLog.infants,
              paymentMethod: editingLog.paymentMethod as RegisterSalePaymentMethod,
              siteNumber: editingLog.siteNumber,
              items: normalizedItems.map((item) => ({
                id: item.id,
                accountingSubjectId: item.accountingSubjectId,
                accountingSubjectName: item.accountingSubjectName,
                parentCategoryName: item.parentCategoryName,
                unitPrice: item.unitPrice,
                quantity: item.quantity,
                subtotal: item.subtotal,
              })),
              totalAmount: nextTotalAmount,
            }
          : sale,
      );
      savePreviewRegisterSales(nextSales);
      setPreviewRegisterSales(nextSales);
      setEditingLog(null);
      setSaving(false);
      setMessage('会計ログを更新しました。');
      return;
    }

    const reservation = reservations.find((item) => item.id === editingLog.reservationId);
    if (!reservation || !editingLog.reservationId) {
      setSaving(false);
      setMessage('予約会計ログの保存対象が見つかりませんでした。');
      return;
    }

    const result = await updateReservationDetail(
      editingLog.reservationId,
      {
        status: (reservation.status ?? 'confirmed') as ReservationStatus,
        totalAmount: nextTotalAmount,
        optionsJson: buildReservationOptionsJsonFromLogItems(normalizedItems) as Database['public']['Tables']['guest_reservations']['Row']['options_json'],
        pricingBreakdown: buildPricingBreakdownFromLogItems(normalizedItems),
        paymentMethod: editingLog.paymentMethod as ReservationPaymentMethod,
        userName: canEditReservationCustomerName ? editingLog.customerName : undefined,
        guests: editingLog.guests,
        adults: editingLog.adults,
        children: editingLog.children,
        infants: editingLog.infants,
      },
      'admin',
    );

    setSaving(false);

    if (!result.success) {
      setMessage(result.error ?? '予約会計ログの保存に失敗しました。');
      return;
    }

    setReservations((current) =>
      current.map((item) => (item.id === result.reservation.id ? result.reservation : item)),
    );
    setEditingLog(null);
    setMessage('予約会計ログを更新しました。');
  };

  const removeLog = () => {
    if (!editingLog || !editingLog.canDelete) return;
    deletePreviewRegisterSale(editingLog.id);
    const nextSales = loadPreviewRegisterSales();
    setPreviewRegisterSales(nextSales);
    setEditingLog(null);
    setMessage('会計ログを削除しました。');
  };

  const paymentMethodOptions = useMemo(() => {
    if (!editingLog) return [];
    return editingLog.sourceType === 'reservation'
      ? getReservationPaymentMethodOptions()
      : getRegisterPaymentMethodOptions();
  }, [editingLog]);

  const canEditReservationCustomerName = useMemo(() => {
    if (!editingLog || editingLog.sourceType !== 'reservation' || !editingLog.reservationId) {
      return true;
    }

    return (mypageStatuses[editingLog.reservationId]?.linkStatus ?? 'unlinked') === 'unlinked';
  }, [editingLog, mypageStatuses]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">売上日報出力</h1>
            <p className="mt-2 text-sm text-slate-500">
              予約由来の自動反映売上と、管理棟レジの会計ログをまとめて集計・修正できます。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/accounting"
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700"
            >
              売上日報設定へ
            </Link>
            <Link
              href="/admin/register"
              className="rounded-xl border border-emerald-300 px-4 py-3 text-sm font-medium text-emerald-700"
            >
              管理棟レジへ
            </Link>
          </div>
        </div>
        {message ? <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</p> : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">対象日（開始）</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">対象日（終了）</label>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">会計ログ</h2>
          <span className="text-sm text-slate-500">{accountingLogs.length}件</span>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          予約から自動反映された金額も、レジで追加した売上も、ここから修正できます。
        </p>
        <div className="mt-4 space-y-3">
          {accountingLogs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-400">
              この期間の会計ログはまだありません。
            </div>
          ) : (
            accountingLogs.map((log) => (
              <button
                key={`${log.sourceType}-${log.id}`}
                type="button"
                onClick={() => setEditingLog(cloneLog(log))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left hover:bg-slate-100"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold text-slate-900">{log.customerName}</div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          log.sourceType === 'reservation'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {log.sourceType === 'reservation' ? '予約反映' : 'レジ会計'}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {log.reservationCode ?? '予約なし'} / {log.date} / {log.paymentMethodLabel} / {log.siteNumber}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-slate-500">{log.items.length}明細</div>
                    <div className="mt-1 font-semibold text-slate-900">{formatCurrency(log.totalAmount)}</div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="space-y-6">
        {groupedReports.map((report) => (
          <div key={report.output.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{report.output.reportName}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  対象カテゴリ: {report.output.includedCategories.join(' / ')}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">全体売上</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(report.total)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">会計ログ件数</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{accountingLogs.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">会計科目数</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{report.childTotals.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">宿泊者数合計</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{report.guestTotal}名</p>
              </div>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">親カテゴリ別売上</h4>
                <table className="mt-2 w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="py-2">親カテゴリ</th>
                      <th className="py-2 text-right">小計</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.parentTotals.map((row) => (
                      <tr key={row.name} className="border-b border-slate-100">
                        <td className="py-2">{row.name}</td>
                        <td className="py-2 text-right">{formatCurrency(row.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-900">支払い方法別</h4>
                <table className="mt-2 w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="py-2">支払い方法</th>
                      <th className="py-2 text-right">小計</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.paymentTotals.map((row) => (
                      <tr key={row.name} className="border-b border-slate-100">
                        <td className="py-2">{row.name}</td>
                        <td className="py-2 text-right">{formatCurrency(row.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-5">
              <h4 className="text-sm font-semibold text-slate-900">会計科目別明細</h4>
              <div className="mt-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-4 py-3">親カテゴリ</th>
                      <th className="px-4 py-3">会計科目</th>
                      <th className="px-4 py-3 text-right">数量</th>
                      <th className="px-4 py-3 text-right">単価</th>
                      <th className="px-4 py-3 text-right">小計</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.childTotals.map((row) => (
                      <tr key={`${row.parentCategoryName}-${row.subjectName}`} className="border-t border-slate-100">
                        <td className="px-4 py-3">{row.parentCategoryName}</td>
                        <td className="px-4 py-3">{row.subjectName}</td>
                        <td className="px-4 py-3 text-right">{row.quantity}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(row.unitPrice)}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(row.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}
      </section>

      {editingLog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">会計ログを修正</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {editingLog.customerName} / {editingLog.reservationCode ?? '予約なし'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => (saving ? null : setEditingLog(null))}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                閉じる
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-4">
              <label className="text-sm font-medium text-slate-700">
                表示名
                <input
                  value={editingLog.customerName}
                  onChange={(event) => setEditingLog({ ...editingLog, customerName: event.target.value })}
                  disabled={!canEditReservationCustomerName}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                支払い方法
                <select
                  value={editingLog.paymentMethod}
                  onChange={(event) =>
                    setEditingLog({
                      ...editingLog,
                      paymentMethod: event.target.value,
                      paymentMethodLabel: editingLog.sourceType === 'reservation'
                        ? paymentMethodOptions.find((option) => option.value === event.target.value)?.label ?? event.target.value
                        : getRegisterPaymentMethodLabel(event.target.value),
                    })
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  {paymentMethodOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                サイト番号
                <input
                  value={editingLog.siteNumber}
                  onChange={(event) => setEditingLog({ ...editingLog, siteNumber: event.target.value })}
                  disabled={editingLog.sourceType === 'reservation'}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                />
              </label>
              {editingLog.sourceType === 'reservation' ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="grid gap-3 sm:grid-cols-4">
                    <label className="text-sm font-medium text-slate-700">
                      大人
                      <input
                        type="number"
                        min={0}
                        value={editingLog.adults ?? 0}
                        onChange={(event) => {
                          const adults = Math.max(0, Number(event.target.value) || 0);
                          const children = Math.max(0, editingLog.children ?? 0);
                          const infants = Math.max(0, editingLog.infants ?? 0);
                          setEditingLog({ ...editingLog, adults, guests: Math.max(1, adults + children + infants) });
                        }}
                        className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      子ども
                      <input
                        type="number"
                        min={0}
                        value={editingLog.children ?? 0}
                        onChange={(event) => {
                          const adults = Math.max(0, editingLog.adults ?? 0);
                          const children = Math.max(0, Number(event.target.value) || 0);
                          const infants = Math.max(0, editingLog.infants ?? 0);
                          setEditingLog({ ...editingLog, children, guests: Math.max(1, adults + children + infants) });
                        }}
                        className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      幼児
                      <input
                        type="number"
                        min={0}
                        value={editingLog.infants ?? 0}
                        onChange={(event) => {
                          const adults = Math.max(0, editingLog.adults ?? 0);
                          const children = Math.max(0, editingLog.children ?? 0);
                          const infants = Math.max(0, Number(event.target.value) || 0);
                          setEditingLog({ ...editingLog, infants, guests: Math.max(1, adults + children + infants) });
                        }}
                        className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <div className="text-xs text-slate-500">合計人数</div>
                      <div className="mt-2 text-lg font-semibold text-slate-900">{Math.max(1, editingLog.guests ?? 0)}名</div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {editingLog.sourceType === 'reservation' && !canEditReservationCustomerName ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                LINE連携またはマイページ連携に使われている予約のため、この画面では予約者名を変更できないようにしています。
              </div>
            ) : null}

            <div className="mt-6 space-y-3">
              {editingLog.items.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1.4fr_1.1fr_120px_120px_120px_90px]"
                >
                  <label className="text-sm text-slate-700">
                    会計科目
                    <select
                      value={item.accountingSubjectId}
                      onChange={(event) => {
                        const nextSubject = activeSubjects.find((subject) => subject.id === event.target.value);
                        if (!nextSubject) return;
                        setEditingLog({
                          ...editingLog,
                          items: editingLog.items.map((row) =>
                            row.id === item.id
                              ? {
                                  ...row,
                                  accountingSubjectId: nextSubject.id,
                                  accountingSubjectName: nextSubject.name,
                                  parentCategoryName: resolveParentCategoryName(nextSubject.id, activeCategories),
                                }
                              : row,
                          ),
                        });
                      }}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    >
                      {activeSubjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">
                    <div className="text-xs text-slate-500">親カテゴリ</div>
                    <div className="mt-1 font-medium text-slate-900">{item.parentCategoryName}</div>
                  </div>

                  <label className="text-sm text-slate-700">
                    単価
                    <input
                      type="number"
                      min={0}
                      value={item.unitPrice}
                      onChange={(event) =>
                        setEditingLog({
                          ...editingLog,
                          items: editingLog.items.map((row) =>
                            row.id === item.id
                              ? {
                                  ...row,
                                  unitPrice: Math.max(0, Number(event.target.value) || 0),
                                  subtotal: Math.max(0, Number(event.target.value) || 0) * row.quantity,
                                }
                              : row,
                          ),
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>

                  <label className="text-sm text-slate-700">
                    数量
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(event) =>
                        setEditingLog({
                          ...editingLog,
                          items: editingLog.items.map((row) =>
                            row.id === item.id
                              ? {
                                  ...row,
                                  quantity: Math.max(1, Number(event.target.value) || 1),
                                  subtotal: row.unitPrice * Math.max(1, Number(event.target.value) || 1),
                                }
                              : row,
                          ),
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>

                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">
                    <div className="text-xs text-slate-500">小計</div>
                    <div className="mt-1 font-semibold text-slate-900">{formatCurrency(item.subtotal)}</div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setEditingLog({
                        ...editingLog,
                        items: editingLog.items.filter((row) => row.id !== item.id),
                      })
                    }
                    className="rounded-2xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-sm text-slate-700">
                最終合計:{' '}
                <span className="font-semibold text-slate-900">
                  {formatCurrency(editingLog.items.reduce((sum, item) => sum + item.subtotal, 0))}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {editingLog.canDelete ? (
                  <button
                    type="button"
                    onClick={removeLog}
                    disabled={saving}
                    className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                  >
                    この会計ログを削除
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={saveEditedLog}
                  disabled={saving}
                  className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? '保存中...' : '修正を保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
