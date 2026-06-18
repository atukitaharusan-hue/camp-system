'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fetchOptions, fetchPlans, fetchSites } from '@/lib/admin/fetchData';
import { fetchReservations } from '@/lib/admin/fetchReservations';
import { updateReservationDetail } from '@/lib/admin/updateReservation';
import type { AdminPlan, AdminSite } from '@/types/admin';
import type { Database } from '@/types/database';
import type { OptionItem } from '@/types/options';
import type { ReservationPricingBreakdown } from '@/types/pricing';
import { generateReceptionCode } from '@/types/reservation';
import { ReservationDetailEditorModal } from '@/components/admin/ReservationDetailEditorModal';

type GuestReservationRow = Database['public']['Tables']['guest_reservations']['Row'];
type ReservationStatus = Database['public']['Enums']['reservation_status'];

type SiteAssignmentRow = {
  siteId: string;
  siteNumber: string;
  siteName: string;
  reservation: GuestReservationRow | null;
};

const ALL_PLANS_VALUE = '__all__';
function todayIso() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getSelectedSiteNumbers(reservation: GuestReservationRow) {
  if (Array.isArray(reservation.selected_site_numbers)) {
    const selected = reservation.selected_site_numbers.filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    );
    if (selected.length > 0) return selected;
  }

  return reservation.site_number ? [reservation.site_number] : [];
}

function getOriginalSpecifiedSiteNumbers(reservation: GuestReservationRow) {
  const memo = reservation.special_requests ?? '';
  const match = memo.match(/^SELECTED_SITE_NUMBERS:\s*(.*)$/m);
  if (!match) return getSelectedSiteNumbers(reservation);

  return match[1]
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function getSiteSelectionLabel(reservation: GuestReservationRow) {
  return getOriginalSpecifiedSiteNumbers(reservation).length > 0 ? '指定あり' : '指定なし';
}

function shuffleSiteNumbers(values: string[]) {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function isActiveOnDate(reservation: GuestReservationRow, date: string) {
  return reservation.status !== 'cancelled' && reservation.check_in_date <= date && reservation.check_out_date > date;
}

function extractPlanId(reservation: GuestReservationRow) {
  if (reservation.plan_id) return reservation.plan_id;

  const memo = reservation.special_requests ?? '';
  const directMatch = memo.match(/PLAN_ID:\s*([A-Za-z0-9-]+)/);
  if (directMatch?.[1]) return directMatch[1];

  const multiMatch = memo.match(/^MULTI_PLAN_ITEMS:\s*(.+)$/m);
  if (!multiMatch) return null;

  try {
    const parsed = JSON.parse(multiMatch[1]) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const first = parsed[0] as { planId?: unknown } | null;
    return first && typeof first.planId === 'string' ? first.planId : null;
  } catch {
    return null;
  }
}

function resolveReservationPlanId(reservation: GuestReservationRow, plans: AdminPlan[], sites: AdminSite[]) {
  const explicitPlanId = extractPlanId(reservation);
  if (explicitPlanId) return explicitPlanId;

  const selected = getSelectedSiteNumbers(reservation);
  if (selected.length === 0) return null;

  const matchedPlan = plans.find((plan) =>
    plan.targetSiteIds.some((siteId) => {
      const site = sites.find((item) => item.id === siteId);
      return site ? selected.includes(site.siteNumber) : false;
    }),
  );

  return matchedPlan?.id ?? null;
}

function getGuestCount(reservation: GuestReservationRow) {
  return reservation.guests ?? 0;
}

function getReservationSortKey(reservation: GuestReservationRow) {
  return reservation.created_at ?? reservation.check_in_date ?? reservation.id;
}

export default function AdminSiteAssignmentsPage() {
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [sites, setSites] = useState<AdminSite[]>([]);
  const [options, setOptions] = useState<OptionItem[]>([]);
  const [reservations, setReservations] = useState<GuestReservationRow[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState(ALL_PLANS_VALUE);
  const [loading, setLoading] = useState(true);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [editingReservation, setEditingReservation] = useState<GuestReservationRow | null>(null);
  const [editingSaving, setEditingSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [fetchedPlans, fetchedSites, fetchedOptions, fetchedReservationsResult] = await Promise.all([
      fetchPlans(),
      fetchSites(),
      fetchOptions(),
      fetchReservations(),
    ]);

    setPlans(fetchedPlans);
    setSites(fetchedSites);
    setOptions(fetchedOptions);
    setReservations(fetchedReservationsResult.data);
    setSelectedPlanId((current) => current || ALL_PLANS_VALUE);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedPlan = useMemo(
    () => (selectedPlanId === ALL_PLANS_VALUE ? null : plans.find((plan) => plan.id === selectedPlanId) ?? null),
    [plans, selectedPlanId],
  );

  const siteById = useMemo(() => new Map(sites.map((site) => [site.id, site])), [sites]);

  const getReservationPlanName = useCallback(
    (reservation: GuestReservationRow) => {
      const planId = resolveReservationPlanId(reservation, plans, sites);
      return plans.find((plan) => plan.id === planId)?.name ?? '未設定';
    },
    [plans, sites],
  );

  const planSites = useMemo(() => {
    if (selectedPlanId === ALL_PLANS_VALUE) {
      return [...sites].sort((a, b) => a.siteNumber.localeCompare(b.siteNumber, 'ja'));
    }

    if (!selectedPlan) return [];

    return sites
      .filter((site) => selectedPlan.targetSiteIds.includes(site.id))
      .sort((a, b) => a.siteNumber.localeCompare(b.siteNumber, 'ja'));
  }, [selectedPlan, selectedPlanId, sites]);

  const activePlanReservations = useMemo(() => {
    return reservations
      .filter((reservation) => {
        if (!isActiveOnDate(reservation, selectedDate)) return false;
        if (selectedPlanId === ALL_PLANS_VALUE) return true;
        return resolveReservationPlanId(reservation, plans, sites) === selectedPlan?.id;
      })
      .sort((a, b) => getReservationSortKey(a).localeCompare(getReservationSortKey(b), 'ja'));
  }, [plans, reservations, selectedDate, selectedPlan?.id, selectedPlanId, sites]);

  const assignmentRows = useMemo<SiteAssignmentRow[]>(() => {
    return planSites.map((site) => ({
      siteId: site.id,
      siteNumber: site.siteNumber,
      siteName: site.siteName,
      reservation:
        activePlanReservations.find((reservation) => getSelectedSiteNumbers(reservation).includes(site.siteNumber)) ??
        null,
    }));
  }, [activePlanReservations, planSites]);

  const unassignedReservations = useMemo(() => {
    return activePlanReservations.filter((reservation) => {
      const selectedSiteNumbers = getSelectedSiteNumbers(reservation);
      const requiredSites = Math.max(1, reservation.reserved_site_count ?? 1);
      return selectedSiteNumbers.length < requiredSites;
    });
  }, [activePlanReservations]);

  const siteNameMap = useMemo(() => new Map(sites.map((site) => [site.siteNumber, site.siteName || ''])), [sites]);

  const sitePlanNameMap = useMemo(() => {
    const map = new Map<string, string[]>();

    sites.forEach((site) => {
      const relatedPlanNames = plans.filter((plan) => plan.targetSiteIds.includes(site.id)).map((plan) => plan.name);
      map.set(site.siteNumber, relatedPlanNames);
    });

    return map;
  }, [plans, sites]);

  const assignedCount = assignmentRows.filter((row) => row.reservation).length;
  const emptyCount = assignmentRows.length - assignedCount;
  const totalRequestedSiteCount = activePlanReservations.reduce(
    (sum, reservation) => sum + Math.max(1, reservation.reserved_site_count ?? 1),
    0,
  );

  const resolveRowPlanName = useCallback(
    (row: SiteAssignmentRow) => {
      if (selectedPlan) return selectedPlan.name;
      if (row.reservation) return getReservationPlanName(row.reservation);
      const planNames = sitePlanNameMap.get(row.siteNumber) ?? [];
      return planNames.length > 0 ? planNames.join(' / ') : '未設定';
    },
    [getReservationPlanName, selectedPlan, sitePlanNameMap],
  );

  const editingPlan = useMemo(() => {
    if (!editingReservation) return null;
    const reservationPlanId = resolveReservationPlanId(editingReservation, plans, sites);
    return plans.find((plan) => plan.id === reservationPlanId) ?? null;
  }, [editingReservation, plans, sites]);

  const editableOptions = useMemo(() => {
    if (!editingPlan) return [];
    return options.filter((option) => editingPlan.applicableOptionIds.includes(option.id));
  }, [editingPlan, options]);

  const handleExcelExport = useCallback(async () => {
    if (assignmentRows.length === 0) return;

    setExportingExcel(true);
    setActionMessage(null);

    try {
      const XLSX = await import('xlsx');
      const rows = assignmentRows.map((row) => ({
        日付: selectedDate,
        プラン: resolveRowPlanName(row),
        指定有無: row.reservation ? getSiteSelectionLabel(row.reservation) : '',
        サイト番号: row.siteNumber,
        状態: row.reservation ? '使用中' : '空き',
        サイト名: row.siteName || '',
        受付コード: row.reservation ? generateReceptionCode(row.reservation.id) : '',
        宿泊者名: row.reservation?.user_name ?? '',
        電話番号: row.reservation?.user_phone ?? '',
        チェックイン日: row.reservation?.check_in_date ?? '',
        チェックアウト日: row.reservation?.check_out_date ?? '',
        人数: row.reservation ? getGuestCount(row.reservation) : '',
        必要サイト数: row.reservation ? Math.max(1, row.reservation.reserved_site_count ?? 1) : '',
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet['!cols'] = [
        { wch: 14 },
        { wch: 24 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 20 },
        { wch: 16 },
        { wch: 18 },
        { wch: 18 },
        { wch: 14 },
        { wch: 14 },
        { wch: 8 },
        { wch: 12 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'サイト割り振り表');
      const timestamp = selectedDate.replaceAll('-', '');
      const filePlanName = selectedPlan?.name ?? 'すべてのプラン';
      XLSX.writeFile(workbook, `サイト割り振り表_${filePlanName}_${timestamp}.xlsx`, { bookType: 'xlsx' });
      setActionMessage('サイト割り振り表をExcel形式で出力しました。');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Excel出力に失敗しました。';
      setActionMessage(`Excel出力に失敗しました: ${message}`);
    } finally {
      setExportingExcel(false);
    }
  }, [assignmentRows, resolveRowPlanName, selectedDate, selectedPlan]);

  const handleAutoAssign = useCallback(async () => {
    if (unassignedReservations.length === 0) {
      setActionMessage('未割り振りの予約はありません。');
      return;
    }

    if (!window.confirm(`${unassignedReservations.length}件の未割り振り予約に自動でサイトを割り当てます。よろしいですか？`)) {
      return;
    }

    setAssigning(true);
    setActionMessage(null);

    const occupiedSiteNumbers = new Set(
      assignmentRows.filter((row) => row.reservation).map((row) => row.siteNumber),
    );
    const failedMessages: string[] = [];
    let successCount = 0;

    for (const reservation of unassignedReservations) {
      const reservationPlanId = resolveReservationPlanId(reservation, plans, sites);
      if (!reservationPlanId) {
        failedMessages.push(`${generateReceptionCode(reservation.id)} は対象プランを判定できませんでした。`);
        continue;
      }

      const reservationPlan = plans.find((plan) => plan.id === reservationPlanId);
      if (!reservationPlan) {
        failedMessages.push(`${generateReceptionCode(reservation.id)} のプラン設定が見つかりませんでした。`);
        continue;
      }

      const currentSelected = getSelectedSiteNumbers(reservation);
      const hasOriginalSpecifiedSites = getOriginalSpecifiedSiteNumbers(reservation).length > 0;
      const requiredSites = Math.max(1, reservation.reserved_site_count ?? 1);
      const missingSites = requiredSites - currentSelected.length;

      if (missingSites <= 0) continue;

      const candidateSiteNumbers = reservationPlan.targetSiteIds
        .map((siteId) => siteById.get(siteId))
        .filter((site): site is AdminSite => Boolean(site))
        .map((site) => site.siteNumber)
        .filter((siteNumber) => !occupiedSiteNumbers.has(siteNumber) && !currentSelected.includes(siteNumber))
        .sort((a, b) => a.localeCompare(b, 'ja'));

      const assignableSiteNumbers = hasOriginalSpecifiedSites
        ? candidateSiteNumbers
        : shuffleSiteNumbers(candidateSiteNumbers);

      if (assignableSiteNumbers.length < missingSites) {
        failedMessages.push(`${generateReceptionCode(reservation.id)} は空きサイトが足りないため割り振りできませんでした。`);
        continue;
      }

      const appendedSiteNumbers = assignableSiteNumbers.slice(0, missingSites);
      const assignedSiteNumbers = [...currentSelected, ...appendedSiteNumbers];
      const primarySiteNumber = assignedSiteNumbers[0] ?? null;
      const primarySiteName = primarySiteNumber ? siteNameMap.get(primarySiteNumber) ?? null : null;

      const { error } = await supabase
        .from('guest_reservations')
        .update({
          selected_site_numbers: assignedSiteNumbers,
          site_number: primarySiteNumber,
          site_name: primarySiteName,
        })
        .eq('id', reservation.id);

      if (error) {
        failedMessages.push(`${generateReceptionCode(reservation.id)} の更新に失敗しました: ${error.message}`);
        continue;
      }

      appendedSiteNumbers.forEach((siteNumber) => occupiedSiteNumbers.add(siteNumber));
      successCount += 1;
    }

    await loadData();

    if (failedMessages.length === 0) {
      setActionMessage(`${successCount}件の予約に自動でサイトを割り振りました。`);
    } else {
      setActionMessage(
        `${successCount}件の予約を割り振りました。失敗 ${failedMessages.length}件: ${failedMessages.join(' / ')}`,
      );
    }

    setAssigning(false);
  }, [assignmentRows, loadData, plans, siteById, siteNameMap, sites, unassignedReservations]);

  const openReservationEditor = useCallback((reservation: GuestReservationRow) => {
    setEditingReservation(reservation);
  }, []);

  const closeReservationEditor = useCallback(() => {
    if (editingSaving) return;
    setEditingReservation(null);
  }, [editingSaving]);

  const handleSaveReservationDetail = useCallback(
    async (payload: {
      status: ReservationStatus;
      optionsJson: Database['public']['Tables']['guest_reservations']['Row']['options_json'];
      totalAmount: number;
      additionalItemsCount: number;
      pricingBreakdown: ReservationPricingBreakdown;
      guests: number;
      adults: number;
      children: number;
      infants: number;
    }) => {
      if (!editingReservation) {
        return { success: false, error: '予約が見つかりません。' };
      }

      setEditingSaving(true);

      const result = await updateReservationDetail(
        editingReservation.id,
        {
          status: payload.status,
          optionsJson: payload.optionsJson,
          totalAmount: payload.totalAmount,
          pricingBreakdown: payload.pricingBreakdown,
          guests: payload.guests,
          adults: payload.adults,
          children: payload.children,
          infants: payload.infants,
        },
        'admin',
      );

      setEditingSaving(false);

      if (!result.success) {
        const message =
          payload.additionalItemsCount > 0 ? '追加項目の保存に失敗しました。' : '予約情報を保存できませんでした。';
        return { success: false, error: result.error ?? message };
      }

      setActionMessage('保存しました');
      await loadData();
      setEditingReservation(null);
      return { success: true };
    },
    [editingReservation, loadData],
  );

  return (
    <div className="max-w-7xl space-y-4">
      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/reservations"
          className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
        >
          予約一覧
        </Link>
        <Link
          href="/admin/reservations/availability"
          className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
        >
          空き状況カレンダー
        </Link>
        <Link
          href="/admin/reservations/site-assignments"
          className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white"
        >
          サイト割り振り
        </Link>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">サイト割り振り</h1>
            <p className="mt-1 text-sm text-gray-500">
              全サイト番号を表で確認しながら、使用中・空き・未割り振り予約をまとめて確認できます。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExcelExport}
              disabled={loading || exportingExcel || assignmentRows.length === 0}
              className="rounded-full border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exportingExcel ? 'Excel出力中...' : 'Excelエクスポート'}
            </button>
            <button
              type="button"
              onClick={handleAutoAssign}
              disabled={loading || assigning || unassignedReservations.length === 0}
              className="rounded-full border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {assigning ? '自動割り振り中...' : '自動割り振り'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 lg:flex-row lg:items-end">
        <div className="space-y-1">
          <label htmlFor="site-assignment-date" className="text-sm font-medium text-gray-700">
            日付
          </label>
          <input
            id="site-assignment-date"
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="w-full max-w-[220px] space-y-1">
          <label htmlFor="site-assignment-plan" className="text-sm font-medium text-gray-700">
            プラン
          </label>
          <select
            id="site-assignment-plan"
            value={selectedPlanId}
            onChange={(event) => setSelectedPlanId(event.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value={ALL_PLANS_VALUE}>すべてのプラン</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </div>
        {(selectedPlan || selectedPlanId === ALL_PLANS_VALUE) && (
          <div className="grid gap-2 sm:grid-cols-5 lg:ml-auto">
            <SummaryCard label="対象サイト数" value={planSites.length} tone="default" />
            <SummaryCard label="使用中" value={assignedCount} tone="blue" />
            <SummaryCard label="空き" value={emptyCount} tone="green" />
            <SummaryCard label="要求サイト数" value={totalRequestedSiteCount} tone="default" />
            <SummaryCard label="未割り振り予約" value={unassignedReservations.length} tone="amber" />
          </div>
        )}
      </div>

      {actionMessage ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {actionMessage}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
          読み込み中...
        </div>
      ) : !(selectedPlan || selectedPlanId === ALL_PLANS_VALUE) ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
          プランがありません。
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">日付</th>
                  <th className="px-4 py-3">プラン</th>
                  <th className="px-4 py-3">指定有無</th>
                  <th className="px-4 py-3">サイト番号</th>
                  <th className="px-4 py-3">状態</th>
                  <th className="px-4 py-3">サイト名</th>
                  <th className="px-4 py-3">人数</th>
                  <th className="px-4 py-3">宿泊者名</th>
                  <th className="px-4 py-3">電話番号</th>
                  <th className="px-4 py-3">日程</th>
                  <th className="px-4 py-3">予約番号</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {assignmentRows.map((row) => (
                  <tr
                    key={row.siteId}
                    className={`${row.reservation ? 'bg-amber-50/30' : 'bg-emerald-50/30'} ${
                      row.reservation ? 'cursor-pointer hover:bg-amber-100/50' : ''
                    }`}
                    onClick={() => {
                      if (!row.reservation) return;
                      openReservationEditor(row.reservation);
                    }}
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">{selectedDate}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">{resolveRowPlanName(row)}</td>
                    <td className="px-4 py-3">
                      {row.reservation ? (
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            getSiteSelectionLabel(row.reservation) === '指定あり'
                              ? 'bg-sky-100 text-sky-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {getSiteSelectionLabel(row.reservation)}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-gray-900">{row.siteNumber}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          row.reservation ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {row.reservation ? '使用中' : '空き'}
                      </span>
                    </td>
                    <td className="min-w-[220px] px-4 py-3 text-gray-700">{row.siteName || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {row.reservation ? `${getGuestCount(row.reservation)}名` : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-900">{row.reservation?.user_name || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{row.reservation?.user_phone || '-'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {row.reservation ? `${row.reservation.check_in_date} - ${row.reservation.check_out_date}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-blue-600">
                      {row.reservation ? (
                        <div className="flex flex-wrap items-center gap-2" onClick={(event) => event.stopPropagation()}>
                          <Link
                            href={`/admin/reservations/${row.reservation.id}`}
                            className="font-medium text-blue-700 hover:underline"
                          >
                            {generateReceptionCode(row.reservation.id)}
                          </Link>
                          <button
                            type="button"
                            onClick={() => openReservationEditor(row.reservation!)}
                            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            詳細・修正
                          </button>
                          <Link
                            href={`/admin/reservations/${row.reservation.id}/edit`}
                            className="rounded-full border border-blue-200 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                          >
                            予約編集
                          </Link>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <h2 className="text-base font-bold text-gray-900">未割り振り予約</h2>
            <p className="mt-1 text-sm text-gray-500">
              指定がない予約や、必要サイト数に対して割り振りが足りていない予約です。
            </p>
            {unassignedReservations.length === 0 ? (
              <p className="mt-4 rounded-xl bg-slate-50 px-4 py-4 text-sm text-slate-500">
                未割り振りの予約はありません。
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {unassignedReservations.map((reservation) => {
                  const selectedSiteNumbers = getSelectedSiteNumbers(reservation);
                  const requiredSites = Math.max(1, reservation.reserved_site_count ?? 1);
                  return (
                    <div key={reservation.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1 text-sm text-slate-700">
                          <p className="text-base font-semibold text-slate-900">
                            {reservation.user_name || '宿泊者名未設定'}
                          </p>
                          <p>予約番号: {generateReceptionCode(reservation.id)}</p>
                          <p>プラン: {getReservationPlanName(reservation)}</p>
                          <p>指定有無: {getSiteSelectionLabel(reservation)}</p>
                          <p>必要サイト数: {requiredSites}サイト</p>
                          <p>現在の割り振り: {selectedSiteNumbers.length > 0 ? selectedSiteNumbers.join(', ') : 'なし'}</p>
                          <p>人数: {getGuestCount(reservation)}名</p>
                        </div>
                        <Link
                          href={`/admin/reservations/${reservation.id}/edit`}
                          className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                        >
                          予約を編集
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {editingReservation && (
        <ReservationDetailEditorModal
          key={editingReservation.id}
          reservation={editingReservation}
          options={editableOptions}
          plan={editingPlan}
          primarySiteId={
            sites.find(
              (site) =>
                site.siteNumber === getSelectedSiteNumbers(editingReservation)[0] ||
                site.siteNumber === editingReservation.site_number,
            )?.id ?? null
          }
          planName={editingPlan?.name ?? getReservationPlanName(editingReservation)}
          siteLabel={
            getSelectedSiteNumbers(editingReservation).join(', ') ||
            editingReservation.site_number ||
            '指定なし'
          }
          onClose={closeReservationEditor}
          onSave={handleSaveReservationDetail}
        />
      )}

    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'default' | 'blue' | 'green' | 'amber';
}) {
  const colorClass =
    tone === 'blue'
      ? 'border-blue-200 bg-blue-50 text-blue-900'
      : tone === 'green'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
        : tone === 'amber'
          ? 'border-amber-200 bg-amber-50 text-amber-900'
          : 'border-slate-200 bg-slate-50 text-slate-900';

  return (
    <div className={`rounded-xl border px-4 py-3 ${colorClass}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

