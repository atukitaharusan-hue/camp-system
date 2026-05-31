'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fetchOptions, fetchPlans, fetchSiteDetails } from '@/lib/admin/fetchData';
import { fetchReservations } from '@/lib/admin/fetchReservations';
import { recalculateReservationsPricing } from '@/lib/admin/recalculateReservationPricing';
import { cancelReservation, promoteWaitlistReservation } from '@/lib/admin/updateReservation';
import { coerceReservationPricingBreakdown } from '@/lib/pricing';
import { getSiteSelectionLabel } from '@/lib/siteSelectionLabel';
import { getWaitlistStatusLabel } from '@/lib/waitlist';
import { generateReceptionCode, getPaymentMethodLabel, getPaymentStatusLabel } from '@/types/reservation';
import type { Database, Json } from '@/types/database';
import type { AdminPlan } from '@/types/admin';
import type { OptionItem } from '@/types/options';
import type { SiteDetail } from '@/types/site';

type GuestReservationRow = Database['public']['Tables']['guest_reservations']['Row'];
type ReservationStatus = Database['public']['Enums']['reservation_status'];

const STATUS_OPTIONS: Array<{ value: ReservationStatus | 'all'; label: string }> = [
  { value: 'all', label: 'すべて' },
  { value: 'pending', label: '仮予約' },
  { value: 'confirmed', label: '予約確定' },
  { value: 'checked_in', label: 'チェックイン済み' },
  { value: 'completed', label: '利用完了' },
  { value: 'cancelled', label: 'キャンセル' },
  { value: 'waitlisted', label: 'キャンセル待ち' },
];

const STATUS_BADGES: Record<ReservationStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-emerald-100 text-emerald-700',
  checked_in: 'bg-blue-100 text-blue-700',
  completed: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-700',
  waitlisted: 'bg-amber-100 text-amber-800',
};

function getSelectedSiteNumbers(value: Database['public']['Tables']['guest_reservations']['Row']['selected_site_numbers']) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function getGuestBreakdown(reservation: GuestReservationRow) {
  const adults = reservation.adults ?? Math.max((reservation.guests ?? 1) - (reservation.children ?? 0) - (reservation.infants ?? 0), 1);
  const children = reservation.children ?? 0;
  const infants = reservation.infants ?? 0;
  return { adults, children, infants };
}

function getStatusLabel(status: ReservationStatus | null) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status ?? '未設定';
}

interface ReservationOptionEntry {
  type?: string;
  optionId?: string;
  name?: string;
  quantity?: number;
  days?: number;
  people?: number;
  subtotal?: number;
}

interface ReservationMemoFields {
  gender?: string;
  occupation?: string;
  postalCode?: string;
  prefecture?: string;
  city?: string;
  addressLine?: string;
  buildingName?: string;
  lineDisplayName?: string;
  lineId?: string;
  referralSource?: string;
  note?: string;
  planItems?: Array<{ planId: string; siteCount: number; siteNumbers: string[] }>;
}

function parseReservationOptions(value: Json | null): ReservationOptionEntry[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, Json> => typeof item === 'object' && item !== null && !Array.isArray(item))
    .map((item) => ({
      type: typeof item.type === 'string' ? item.type : undefined,
      optionId: typeof item.optionId === 'string' ? item.optionId : undefined,
      name: typeof item.name === 'string' ? item.name : undefined,
      quantity: typeof item.quantity === 'number' ? item.quantity : undefined,
      days: typeof item.days === 'number' ? item.days : undefined,
      people: typeof item.people === 'number' ? item.people : undefined,
      subtotal: typeof item.subtotal === 'number' ? item.subtotal : undefined,
    }));
}

function getOptionQuantityLabel(option: ReservationOptionEntry) {
  const quantity = option.type === 'event' ? option.people ?? option.quantity ?? 1 : option.quantity ?? 1;
  const daysLabel = option.days && option.days > 1 ? ` / ${option.days}日` : '';
  return `${quantity}${option.type === 'event' ? '名' : '個'}${daysLabel}`;
}

function getOptionsTotal(reservation: GuestReservationRow, options: ReservationOptionEntry[]) {
  const pricingBreakdown = coerceReservationPricingBreakdown(reservation.pricing_breakdown);
  return pricingBreakdown?.optionsAmount ?? options.reduce((sum, option) => sum + (option.subtotal ?? 0), 0);
}

function parseMemoFields(value: string | null): ReservationMemoFields {
  const fields: ReservationMemoFields = {};
  const keyMap: Record<string, keyof ReservationMemoFields> = {
    GENDER: 'gender',
    OCCUPATION: 'occupation',
    POSTAL_CODE: 'postalCode',
    PREFECTURE: 'prefecture',
    CITY: 'city',
    ADDRESS_LINE: 'addressLine',
    BUILDING: 'buildingName',
    LINE_NAME: 'lineDisplayName',
    LINE_ID: 'lineId',
    REFERRAL_SOURCE: 'referralSource',
    NOTE: 'note',
  };

  for (const rawLine of (value ?? '').split('\n')) {
    const separatorIndex = rawLine.indexOf(':');
    if (separatorIndex < 0) continue;

    const key = rawLine.slice(0, separatorIndex).trim();
    const content = rawLine.slice(separatorIndex + 1).trim();

    if (key === 'MULTI_PLAN_ITEMS') {
      try {
        const parsed = JSON.parse(content) as unknown;
        if (Array.isArray(parsed)) {
          fields.planItems = parsed
            .map((item) => {
              if (!item || typeof item !== 'object') return null;
              const source = item as { planId?: unknown; siteCount?: unknown; siteNumbers?: unknown };
              const planId = typeof source.planId === 'string' ? source.planId : '';
              if (!planId) return null;
              return {
                planId,
                siteCount: Math.max(1, Number(source.siteCount ?? 1)),
                siteNumbers: Array.isArray(source.siteNumbers)
                  ? source.siteNumbers.filter((siteNumber): siteNumber is string => typeof siteNumber === 'string')
                  : [],
              };
            })
            .filter((item): item is { planId: string; siteCount: number; siteNumbers: string[] } => Boolean(item));
        }
      } catch {
        // Ignore malformed legacy memo JSON.
      }
      continue;
    }

    const mappedKey = keyMap[key];
    if (mappedKey && mappedKey !== 'planItems') {
      fields[mappedKey] = content;
    }
  }

  return fields;
}

function getGenderLabel(value: string | undefined) {
  const labels: Record<string, string> = {
    male: '男性',
    female: '女性',
    other: 'その他',
    no_answer: '回答しない',
  };
  return value ? labels[value] ?? value : '';
}

function buildAddress(fields: ReservationMemoFields) {
  return [fields.prefecture, fields.city, fields.addressLine, fields.buildingName].filter(Boolean).join('');
}

function stripSystemLines(value: string | null) {
  const systemPrefixes = [
    'PLAN_ID:',
    'REQUESTED_SITE_COUNT:',
    'SELECTED_SITE_NUMBERS:',
    'MULTI_PLAN_ITEMS:',
    'GENDER:',
    'OCCUPATION:',
    'POSTAL_CODE:',
    'PREFECTURE:',
    'CITY:',
    'ADDRESS_LINE:',
    'BUILDING:',
    'LINE_NAME:',
    'LINE_ID:',
    'REFERRAL_SOURCE:',
  ];

  return (value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => !systemPrefixes.some((prefix) => line.startsWith(prefix)))
    .map((line) => (line.startsWith('NOTE:') ? line.slice(5).trim() : line))
    .filter(Boolean)
    .join('\n');
}

export default function AdminReservationsPage() {
  const [reservations, setReservations] = useState<GuestReservationRow[]>([]);
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [siteDetails, setSiteDetails] = useState<SiteDetail[]>([]);
  const [options, setOptions] = useState<OptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | 'all'>('all');
  const [keyword, setKeyword] = useState('');
  const [selectedReservationIds, setSelectedReservationIds] = useState<string[]>([]);

  const loadReservations = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await fetchReservations();
    if (result.error) {
      setError(result.error);
    } else {
      setReservations(result.data);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadReservations();
    fetchPlans().then(setPlans);
    fetchSiteDetails().then(setSiteDetails);
    fetchOptions().then(setOptions);
  }, [loadReservations]);

  const filteredReservations = useMemo(
    () =>
      reservations.filter((reservation) => {
        if (statusFilter !== 'all' && reservation.status !== statusFilter) return false;
        if (!keyword) return true;

        const lowerKeyword = keyword.toLowerCase();
        const searchable = [
          reservation.user_name,
          reservation.user_email,
          reservation.user_phone,
          reservation.site_number,
          reservation.site_name,
          reservation.plan_id,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchable.includes(lowerKeyword);
      }),
    [keyword, reservations, statusFilter],
  );

  const filteredReservationIds = useMemo(
    () => filteredReservations.map((reservation) => reservation.id),
    [filteredReservations],
  );

  const selectedCount = selectedReservationIds.length;
  const allFilteredSelected =
    filteredReservationIds.length > 0 && filteredReservationIds.every((reservationId) => selectedReservationIds.includes(reservationId));

  const toggleReservationSelection = useCallback((reservationId: string) => {
    setSelectedReservationIds((current) =>
      current.includes(reservationId) ? current.filter((id) => id !== reservationId) : [...current, reservationId],
    );
  }, []);

  const toggleSelectAllFiltered = useCallback(() => {
    setSelectedReservationIds((current) => {
      if (allFilteredSelected) {
        return current.filter((reservationId) => !filteredReservationIds.includes(reservationId));
      }

      const next = new Set(current);
      filteredReservationIds.forEach((reservationId) => next.add(reservationId));
      return Array.from(next);
    });
  }, [allFilteredSelected, filteredReservationIds]);

  const getPlanName = useCallback(
    (planId: string | null) => plans.find((plan) => plan.id === planId)?.name ?? '未設定',
    [plans],
  );

  const optionNameMap = useMemo(
    () => new Map(options.map((option) => [option.id, option.name])),
    [options],
  );

  const siteNameMap = useMemo(
    () => new Map(siteDetails.map((site) => [site.siteNumber, site.siteName])),
    [siteDetails],
  );

  const handleExcelExport = useCallback(async () => {
    if (filteredReservations.length === 0) {
      setActionMessage('エクスポートできる予約がありません。検索条件を確認してください。');
      return;
    }

    setExportingExcel(true);
    setActionMessage(null);

    try {
      const XLSX = await import('xlsx');
      const rows = filteredReservations.map((reservation) => {
        const memoFields = parseMemoFields(reservation.special_requests);
        const selectedSiteNumbers = getSelectedSiteNumbers(reservation.selected_site_numbers);
        const fallbackSiteNumbers = selectedSiteNumbers.length > 0 ? selectedSiteNumbers : reservation.site_number ? [reservation.site_number] : [];
        const optionEntries = parseReservationOptions(reservation.options_json);
        const optionTotal = getOptionsTotal(reservation, optionEntries);
        const { adults, children, infants } = getGuestBreakdown(reservation);
        const planNames =
          memoFields.planItems && memoFields.planItems.length > 0
            ? memoFields.planItems
                .map((item) => `${getPlanName(item.planId)}（${item.siteCount}サイト）`)
                .join(' / ')
            : getPlanName(reservation.plan_id);
        const siteNumbers =
          memoFields.planItems && memoFields.planItems.length > 0
            ? memoFields.planItems
                .map((item) => (item.siteNumbers.length > 0 ? item.siteNumbers.join(', ') : '指定なし'))
                .join(' / ')
            : fallbackSiteNumbers.length > 0
              ? fallbackSiteNumbers.join(', ')
              : '指定なし';
        const siteNames = fallbackSiteNumbers
          .map((siteNumber) => siteNameMap.get(siteNumber) ?? (siteNumber === reservation.site_number ? reservation.site_name : null))
          .filter(Boolean)
          .join(', ');
        const optionSummary =
          optionEntries.length > 0
            ? optionEntries
                .map((option) => {
                  const optionName =
                    option.name ?? (option.optionId ? optionNameMap.get(option.optionId) : undefined) ?? 'オプション';
                  return `${optionName} × ${getOptionQuantityLabel(option)} 小計 ${option.subtotal ?? 0}円`;
                })
                .join('\n')
            : 'オプションなし';

        return {
          予約番号: generateReceptionCode(reservation.id),
          予約日時: reservation.created_at ? new Date(reservation.created_at).toLocaleString('ja-JP') : '',
          予約ステータス: getStatusLabel(reservation.status),
          予約者名: reservation.user_name,
          性別: getGenderLabel(memoFields.gender),
          電話番号: reservation.user_phone ?? '',
          メールアドレス: reservation.user_email ?? '',
          郵便番号: memoFields.postalCode ?? '',
          住所: buildAddress(memoFields),
          LINE表示名: memoFields.lineDisplayName ?? '',
          LINE_ID: memoFields.lineId ?? '',
          プラン名: planNames,
          サイト番号: siteNumbers,
          サイト名: siteNames || reservation.site_name || '',
          チェックイン日: reservation.check_in_date,
          チェックアウト日: reservation.check_out_date,
          泊数: reservation.nights ?? '',
          大人: adults,
          子供: children,
          幼児: infants,
          合計人数: reservation.guests ?? adults + children + infants,
          支払い方法: getPaymentMethodLabel(reservation.payment_method),
          オプション内容: optionSummary,
          オプション合計金額: optionTotal,
          合計金額: Number(reservation.total_amount ?? 0),
          備考: memoFields.note ?? stripSystemLines(reservation.special_requests),
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet['!cols'] = [
        { wch: 14 },
        { wch: 20 },
        { wch: 14 },
        { wch: 16 },
        { wch: 10 },
        { wch: 16 },
        { wch: 26 },
        { wch: 12 },
        { wch: 34 },
        { wch: 18 },
        { wch: 20 },
        { wch: 28 },
        { wch: 18 },
        { wch: 22 },
        { wch: 14 },
        { wch: 14 },
        { wch: 8 },
        { wch: 8 },
        { wch: 8 },
        { wch: 8 },
        { wch: 10 },
        { wch: 18 },
        { wch: 42 },
        { wch: 14 },
        { wch: 14 },
        { wch: 34 },
      ];
      worksheet['!autofilter'] = { ref: worksheet['!ref'] ?? 'A1:Z1' };

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '予約一覧');
      const date = new Date();
      const timestamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`;
      XLSX.writeFile(workbook, `予約一覧_${timestamp}.xlsx`, { bookType: 'xlsx' });
      setActionMessage(`${filteredReservations.length}件の予約データをExcel形式でエクスポートしました。`);
    } catch (exportError) {
      const message = exportError instanceof Error ? exportError.message : 'Excelエクスポートに失敗しました。';
      setActionMessage(`Excelエクスポートに失敗しました: ${message}`);
    } finally {
      setExportingExcel(false);
    }
  }, [filteredReservations, getPlanName, optionNameMap, siteNameMap]);

  const handleDelete = useCallback(
    async (reservationId: string) => {
      if (!window.confirm('この予約を削除します。よろしいですか？')) return;

      setActionMessage(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const result = await cancelReservation(reservationId, user?.email ?? 'admin');
      if (!result.success) {
        window.alert(result.error ?? '予約の削除に失敗しました。');
        return;
      }

      setSelectedReservationIds((current) => current.filter((id) => id !== reservationId));
      setActionMessage('予約を削除しました。空き枠にも反映されています。');
      await loadReservations();
    },
    [loadReservations],
  );

  const handlePromoteWaitlist = useCallback(
    async (reservationId: string) => {
      setActionMessage(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const result = await promoteWaitlistReservation(reservationId, user?.email ?? 'admin');
      if (!result.success) {
        window.alert(result.error ?? 'キャンセル待ちの繰り上げに失敗しました。');
        return;
      }

      setActionMessage('キャンセル待ち予約を通常予約へ繰り上げました。');
      await loadReservations();
    },
    [loadReservations],
  );

  const handleBulkDelete = useCallback(async () => {
    if (selectedReservationIds.length === 0) {
      setActionMessage('一括削除する予約を選択してください。');
      return;
    }

    if (!window.confirm(`選択した ${selectedReservationIds.length} 件の予約を削除します。よろしいですか？`)) return;

    setBulkDeleting(true);
    setActionMessage(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const failedReservations: Array<{ code: string; error: string }> = [];

    for (const reservationId of selectedReservationIds) {
      const result = await cancelReservation(reservationId, user?.email ?? 'admin');
      if (!result.success) {
        failedReservations.push({
          code: generateReceptionCode(reservationId),
          error: result.error ?? '削除に失敗しました。',
        });
      }
    }

    await loadReservations();

    if (failedReservations.length === 0) {
      setSelectedReservationIds([]);
      setActionMessage(`${selectedReservationIds.length} 件の予約を削除しました。空き枠にも反映されています。`);
      setBulkDeleting(false);
      return;
    }

    const failedCodes = failedReservations.map((item) => `${item.code}: ${item.error}`).join(' / ');
    const failedCodeSet = new Set(failedReservations.map((item) => item.code));
    setSelectedReservationIds((current) =>
      current.filter((reservationId) => failedCodeSet.has(generateReceptionCode(reservationId))),
    );
    setActionMessage(
      `一括削除は一部失敗しました。成功 ${selectedReservationIds.length - failedReservations.length} 件 / 失敗 ${failedReservations.length} 件 (${failedCodes})`,
    );
    setBulkDeleting(false);
  }, [loadReservations, selectedReservationIds]);

  const handleRecalculatePricing = useCallback(async () => {
    const targetReservations =
      selectedReservationIds.length > 0
        ? reservations.filter((reservation) => selectedReservationIds.includes(reservation.id))
        : reservations;

    if (targetReservations.length === 0) {
      setActionMessage('再計算する予約がありません。');
      return;
    }

    const label = selectedReservationIds.length > 0 ? '選択中の予約' : 'すべての予約';
    if (!window.confirm(`${label} ${targetReservations.length} 件の料金を最新ロジックで再計算します。よろしいですか？`)) return;

    setRecalculating(true);
    setActionMessage(null);

    try {
      const results = await recalculateReservationsPricing(targetReservations);
      await loadReservations();

      const succeeded = results.filter((result) => result.success).length;
      const skipped = results.filter((result) => result.skipped).length;
      const failed = results.filter((result) => !result.success && !result.skipped).length;
      const firstError = results.find((result) => result.error)?.error;

      setActionMessage(
        `料金再計算が完了しました。成功 ${succeeded} 件 / スキップ ${skipped} 件 / 失敗 ${failed} 件${
          firstError ? `（例: ${firstError}）` : ''
        }`,
      );
    } catch (recalculateError) {
      const message = recalculateError instanceof Error ? recalculateError.message : '料金再計算に失敗しました。';
      setActionMessage(`料金再計算に失敗しました: ${message}`);
    } finally {
      setRecalculating(false);
    }
  }, [loadReservations, reservations, selectedReservationIds]);

  return (
    <div className="max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">予約一覧</h1>
          <p className="mt-1 text-sm text-gray-500">
            予約内容の確認、編集、キャンセルができます。人数内訳やサイト選択状況もここで確認できます。
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/reservations/availability"
            className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
          >
            空き状況カレンダー
          </Link>
          <Link href="/admin/reservations/new" className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white">
            新規予約登録
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="grid gap-4 md:grid-cols-[220px,1fr]">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as ReservationStatus | 'all')}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="予約者名 / メール / 電話番号 / サイト番号で検索"
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {!loading && !error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-600">
            選択中: <span className="font-semibold text-gray-900">{selectedCount}</span> 件
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExcelExport}
              disabled={filteredReservations.length === 0 || exportingExcel}
              className="rounded-full border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exportingExcel ? 'Excel作成中...' : 'Excelエクスポート'}
            </button>
            <button
              type="button"
              onClick={toggleSelectAllFiltered}
              className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {allFilteredSelected ? '表示中の選択を解除' : '表示中をすべて選択'}
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={selectedCount === 0 || bulkDeleting}
              className="rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bulkDeleting ? '削除中...' : '一括削除'}
            </button>
            <button
              type="button"
              onClick={handleRecalculatePricing}
              disabled={recalculating}
              className="rounded-full border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {recalculating ? '料金再計算中...' : selectedCount > 0 ? '選択予約の料金再計算' : '料金を一括再計算'}
            </button>
          </div>
        </div>
      )}

      {loading && <div className="rounded border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">読み込み中...</div>}
      {!loading && error && <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {!loading && !error && actionMessage && (
        <div className="rounded border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">{actionMessage}</div>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto rounded border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAllFiltered}
                    aria-label="表示中の予約をすべて選択"
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3">受付コード</th>
                <th className="px-4 py-3">予約者情報</th>
                <th className="px-4 py-3">宿泊情報</th>
                <th className="px-4 py-3">プラン / サイト</th>
                <th className="px-4 py-3">オプション</th>
                <th className="px-4 py-3">支払い</th>
                <th className="px-4 py-3">状態</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredReservations.map((reservation) => {
                const { adults, children, infants } = getGuestBreakdown(reservation);
                const siteLabel = getSiteSelectionLabel({
                  siteNumber: reservation.site_number,
                  siteName: reservation.site_name,
                  selectedSiteNumbers: getSelectedSiteNumbers(reservation.selected_site_numbers),
                });
                const reservationOptions = parseReservationOptions(reservation.options_json);
                const optionsTotal = getOptionsTotal(reservation, reservationOptions);

                return (
                  <tr key={reservation.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedReservationIds.includes(reservation.id)}
                        onChange={() => toggleReservationSelection(reservation.id)}
                        aria-label={`${reservation.user_name} の予約を選択`}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-blue-600">
                      <Link href={`/admin/reservations/${reservation.id}`}>{generateReceptionCode(reservation.id)}</Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{reservation.user_name}</div>
                      <div className="text-xs text-gray-500">{reservation.user_email || '-'}</div>
                      <div className="text-xs text-gray-500">{reservation.user_phone || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-xs leading-5 text-gray-600">
                      <div>
                        {reservation.check_in_date} - {reservation.check_out_date}
                      </div>
                      <div>
                        合計 {reservation.guests} 名 / {reservation.reserved_site_count ?? 1} サイト
                      </div>
                      <div>
                        大人(中学生以上) {adults} / 子ども {children} / 幼児 {infants}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs leading-5 text-gray-600">
                      <div>{getPlanName(reservation.plan_id)}</div>
                      <div>{siteLabel}</div>
                    </td>
                    <td className="min-w-56 px-4 py-3 text-xs leading-5 text-gray-600">
                      {reservationOptions.length === 0 ? (
                        <span className="text-gray-400">オプションなし</span>
                      ) : (
                        <div className="space-y-1.5">
                          {reservationOptions.slice(0, 3).map((option, index) => {
                            const optionName =
                              option.name ??
                              (option.optionId ? optionNameMap.get(option.optionId) : undefined) ??
                              'オプション';

                            return (
                              <div key={`${option.optionId ?? 'option'}-${index}`} className="rounded-lg bg-gray-50 px-2 py-1">
                                <div className="flex justify-between gap-2">
                                  <span className="font-medium text-gray-800">{optionName}</span>
                                  <span className="text-gray-500">× {getOptionQuantityLabel(option)}</span>
                                </div>
                                <div className="text-right text-gray-500">¥{(option.subtotal ?? 0).toLocaleString()}</div>
                              </div>
                            );
                          })}
                          {reservationOptions.length > 3 && (
                            <div className="text-[11px] text-gray-400">ほか {reservationOptions.length - 3} 件</div>
                          )}
                          <div className="border-t border-gray-100 pt-1 font-semibold text-gray-900">
                            オプション合計: ¥{optionsTotal.toLocaleString()}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs leading-5 text-gray-600">
                      <div>{getPaymentMethodLabel(reservation.payment_method)}</div>
                      <div>{getPaymentStatusLabel(reservation.payment_status)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGES[reservation.status ?? 'pending']}`}>
                        {getStatusLabel(reservation.status)}
                      </span>
                      {reservation.status === 'waitlisted' && (
                        <div className="mt-1 text-[11px] font-medium text-amber-700">
                          {getWaitlistStatusLabel(reservation.waitlist_status)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link
                          href={`/admin/reservations/${reservation.id}/edit`}
                          className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          編集
                        </Link>
                        {reservation.status === 'waitlisted' && reservation.waitlist_status === 'candidate' && (
                          <button
                            type="button"
                            onClick={() => handlePromoteWaitlist(reservation.id)}
                            className="rounded border border-amber-200 px-3 py-1 text-xs text-amber-700 hover:bg-amber-50"
                          >
                            繰り上げ
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(reservation.id)}
                          className="rounded border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
