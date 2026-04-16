'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { fetchPlans } from '@/lib/admin/fetchData';
import { fetchReservations } from '@/lib/admin/fetchReservations';
import { generateReceptionCode, getPaymentMethodLabel, getPaymentStatusLabel } from '@/types/reservation';
import type { Database } from '@/types/database';
import type { AdminPlan } from '@/types/admin';

type GuestReservationRow = Database['public']['Tables']['guest_reservations']['Row'];
type ReservationStatus = Database['public']['Enums']['reservation_status'];

type ParsedCustomerMeta = {
  planId: string;
  gender: string;
  occupation: string;
  postalCode: string;
  prefecture: string;
  city: string;
  addressLine: string;
  buildingName: string;
  lineDisplayName: string;
  lineId: string;
  referralSource: string;
  note: string;
};

type ReservationView = {
  row: GuestReservationRow;
  planLabel: string;
  meta: ParsedCustomerMeta;
};

const EMPTY_META: ParsedCustomerMeta = {
  planId: '',
  gender: '',
  occupation: '',
  postalCode: '',
  prefecture: '',
  city: '',
  addressLine: '',
  buildingName: '',
  lineDisplayName: '',
  lineId: '',
  referralSource: '',
  note: '',
};

const STATUS_OPTIONS: { value: ReservationStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: 'pending', label: '確認待ち' },
  { value: 'confirmed', label: '予約成立' },
  { value: 'checked_in', label: 'チェックイン済み' },
  { value: 'completed', label: '利用完了' },
  { value: 'cancelled', label: 'キャンセル' },
];

const statusBadge: Record<ReservationStatus, { label: string; className: string }> = {
  pending: { label: '確認待ち', className: 'bg-yellow-100 text-yellow-800' },
  confirmed: { label: '予約成立', className: 'bg-green-100 text-green-800' },
  checked_in: { label: 'チェックイン済み', className: 'bg-blue-100 text-blue-800' },
  completed: { label: '利用完了', className: 'bg-gray-100 text-gray-600' },
  cancelled: { label: 'キャンセル', className: 'bg-red-100 text-red-800' },
};

function parseCustomerMeta(memo: string | null): ParsedCustomerMeta {
  const source = memo ?? '';
  const lines = source.split('\n');
  const meta = { ...EMPTY_META };

  for (const line of lines) {
    const [rawKey, ...rest] = line.split(':');
    if (!rawKey || rest.length === 0) continue;
    const key = rawKey.trim();
    const value = rest.join(':').trim();

    switch (key) {
      case 'プランID':
        meta.planId = value;
        break;
      case '性別':
        meta.gender = value;
        break;
      case '職業':
        meta.occupation = value;
        break;
      case '郵便番号':
        meta.postalCode = value;
        break;
      case '都道府県':
        meta.prefecture = value;
        break;
      case '市区町村':
        meta.city = value;
        break;
      case '番地':
        meta.addressLine = value;
        break;
      case '建物名・部屋番号':
        meta.buildingName = value;
        break;
      case 'LINEアカウント名':
        meta.lineDisplayName = value;
        break;
      case 'LINE ID':
        meta.lineId = value;
        break;
      case '知ったきっかけ':
        meta.referralSource = value;
        break;
      case '備考':
        meta.note = value;
        break;
      default:
        break;
    }
  }

  return meta;
}

function uniqueOptions(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ja'));
}

function extractPlanLabel(planId: string, plans: AdminPlan[]) {
  const plan = plans.find((item) => item.id === planId);
  return plan?.name ?? '未設定';
}

function exportReservationsCsv(rows: ReservationView[]) {
  const headers = ['受付コード', '名前', '性別', '電話番号', '職業', 'メールアドレス', '郵便番号', '都道府県', '市区町村', '番地', '建物名・部屋番号', 'LINEアカウント名', 'LINEアカウントID', '知ったきっかけ', 'チェックイン日', 'チェックアウト日', '宿泊数', 'サイト', 'プラン', '人数', '支払い方法', '支払い状況', 'ステータス'];
  const lines = rows.map(({ row, meta, planLabel }) => [
    generateReceptionCode(row.id),
    row.user_name ?? '',
    meta.gender,
    row.user_phone ?? '',
    meta.occupation,
    row.user_email ?? '',
    meta.postalCode,
    meta.prefecture,
    meta.city,
    meta.addressLine,
    meta.buildingName,
    meta.lineDisplayName,
    meta.lineId,
    meta.referralSource,
    row.check_in_date ?? '',
    row.check_out_date ?? '',
    String(row.nights ?? 0),
    row.site_number ?? '',
    planLabel,
    String(row.guests ?? 0),
    getPaymentMethodLabel(row.payment_method),
    getPaymentStatusLabel(row.payment_status),
    statusBadge[row.status ?? 'pending']?.label ?? row.status,
  ]);

  const csv = [headers, ...lines].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'reservations-export.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export default function AdminReservationsPage() {
  const [reservations, setReservations] = useState<GuestReservationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<ReservationStatus | 'all'>('all');
  const [nameKeyword, setNameKeyword] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');
  const [occupationFilter, setOccupationFilter] = useState('all');
  const [prefectureKeyword, setPrefectureKeyword] = useState('');
  const [cityKeyword, setCityKeyword] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [siteFilter, setSiteFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [referralKeyword, setReferralKeyword] = useState('');

  const [allPlans, setAllPlans] = useState<AdminPlan[]>([]);

  const loadReservations = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchReservations();
    if (result.error) setError(result.error);
    else setReservations(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadReservations();
    fetchPlans().then(setAllPlans);
  }, [loadReservations]);

  const reservationViews = useMemo<ReservationView[]>(
    () =>
      reservations.map((row) => {
        const meta = parseCustomerMeta(row.special_requests);
        return { row, meta, planLabel: extractPlanLabel(meta.planId, allPlans) };
      }),
    [reservations, allPlans],
  );

  const dropdowns = useMemo(
    () => ({
      genders: uniqueOptions(reservationViews.map((item) => item.meta.gender)),
      occupations: uniqueOptions(reservationViews.map((item) => item.meta.occupation)),
      plans: uniqueOptions(reservationViews.map((item) => item.planLabel)),
      sites: uniqueOptions(reservationViews.map((item) => item.row.site_number ?? '')),
      paymentMethods: uniqueOptions(reservationViews.map((item) => getPaymentMethodLabel(item.row.payment_method))),
      paymentStatuses: uniqueOptions(reservationViews.map((item) => getPaymentStatusLabel(item.row.payment_status))),
    }),
    [reservationViews],
  );

  const filteredReservations = useMemo(
    () =>
      reservationViews.filter((item) => {
        if (statusFilter !== 'all' && item.row.status !== statusFilter) return false;
        if (nameKeyword && !(item.row.user_name ?? '').toLowerCase().includes(nameKeyword.toLowerCase())) return false;
        if (genderFilter !== 'all' && item.meta.gender !== genderFilter) return false;
        if (occupationFilter !== 'all' && item.meta.occupation !== occupationFilter) return false;
        if (prefectureKeyword && !item.meta.prefecture.toLowerCase().includes(prefectureKeyword.toLowerCase())) return false;
        if (cityKeyword && !item.meta.city.toLowerCase().includes(cityKeyword.toLowerCase())) return false;
        if (planFilter !== 'all' && item.planLabel !== planFilter) return false;
        if (siteFilter !== 'all' && (item.row.site_number ?? '') !== siteFilter) return false;
        if (paymentMethodFilter !== 'all' && getPaymentMethodLabel(item.row.payment_method) !== paymentMethodFilter) return false;
        if (paymentStatusFilter !== 'all' && getPaymentStatusLabel(item.row.payment_status) !== paymentStatusFilter) return false;
        if (referralKeyword && !item.meta.referralSource.toLowerCase().includes(referralKeyword.toLowerCase())) return false;
        return true;
      }),
    [reservationViews, statusFilter, nameKeyword, genderFilter, occupationFilter, prefectureKeyword, cityKeyword, planFilter, siteFilter, paymentMethodFilter, paymentStatusFilter, referralKeyword],
  );

  return (
    <div className="max-w-7xl">
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/admin/reservations" className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white">予約一覧</Link>
        <Link href="/admin/reservations/availability" className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700">空き状況カレンダー</Link>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">予約一覧</h1>
          <p className="mt-1 text-sm text-gray-500">自由入力検索とプルダウン検索を組み合わせて絞り込みできます。CSV/Excel向けにエクスポートも可能です。</p>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
          <FilterField label="ステータス"><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ReservationStatus | 'all')} className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm">{STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></FilterField>
          <FilterField label="名前（自由入力）"><input value={nameKeyword} onChange={(e) => setNameKeyword(e.target.value)} placeholder="部分一致で検索" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" /></FilterField>
          <SelectFilter label="性別" value={genderFilter} onChange={setGenderFilter} options={dropdowns.genders} />
          <SelectFilter label="職業" value={occupationFilter} onChange={setOccupationFilter} options={dropdowns.occupations} />
          <FilterField label="都道府県（自由入力）"><input value={prefectureKeyword} onChange={(e) => setPrefectureKeyword(e.target.value)} placeholder="部分一致で検索" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" /></FilterField>
          <FilterField label="市区町村（自由入力）"><input value={cityKeyword} onChange={(e) => setCityKeyword(e.target.value)} placeholder="部分一致で検索" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" /></FilterField>
          <SelectFilter label="プラン" value={planFilter} onChange={setPlanFilter} options={dropdowns.plans} />
          <SelectFilter label="サイト" value={siteFilter} onChange={setSiteFilter} options={dropdowns.sites} />
          <SelectFilter label="支払い方法" value={paymentMethodFilter} onChange={setPaymentMethodFilter} options={dropdowns.paymentMethods} />
          <SelectFilter label="支払い状況" value={paymentStatusFilter} onChange={setPaymentStatusFilter} options={dropdowns.paymentStatuses} />
          <FilterField label="知ったきっかけ（自由入力）"><input value={referralKeyword} onChange={(e) => setReferralKeyword(e.target.value)} placeholder="部分一致で検索" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" /></FilterField>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setNameKeyword('');
              setGenderFilter('all');
              setOccupationFilter('all');
              setPrefectureKeyword('');
              setCityKeyword('');
              setPlanFilter('all');
              setSiteFilter('all');
              setPaymentMethodFilter('all');
              setPaymentStatusFilter('all');
              setReferralKeyword('');
            }}
            className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            フィルターをクリア
          </button>
          <button type="button" onClick={() => exportReservationsCsv(filteredReservations)} className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700">
            CSV/Excel向けにエクスポート
          </button>
        </div>
      </div>

      {loading && <div className="rounded border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">読み込み中...</div>}
      {!loading && error && <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">予約一覧の取得に失敗しました: {error}</div>}
      {!loading && !error && filteredReservations.length === 0 && <div className="rounded border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">条件に合う予約はありません</div>}

      {!loading && !error && filteredReservations.length > 0 && (
        <div className="overflow-x-auto rounded border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">受付コード</th>
                <th className="px-4 py-3">予約者名</th>
                <th className="px-4 py-3">顧客情報</th>
                <th className="px-4 py-3">宿泊情報</th>
                <th className="px-4 py-3">プラン/サイト</th>
                <th className="px-4 py-3">支払い</th>
                <th className="px-4 py-3">ステータス</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredReservations.map((item) => {
                const badge = statusBadge[item.row.status ?? 'pending'];
                return (
                  <tr key={item.row.id} className="transition-colors hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/reservations/${item.row.id}`} className="font-mono text-blue-600 hover:underline">
                        {generateReceptionCode(item.row.id)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-900">{item.row.user_name}</td>
                    <td className="px-4 py-3 text-xs leading-5 text-gray-600">
                      <div>性別: {item.meta.gender || '-'}</div>
                      <div>職業: {item.meta.occupation || '-'}</div>
                      <div>電話: {item.row.user_phone || '-'}</div>
                      <div>メール: {item.row.user_email || '-'}</div>
                      <div>住所: {[item.meta.prefecture, item.meta.city, item.meta.addressLine].filter(Boolean).join(' ') || '-'}</div>
                      <div>LINE: {item.meta.lineDisplayName || item.meta.lineId || '-'}</div>
                      <div>きっかけ: {item.meta.referralSource || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-xs leading-5 text-gray-600">
                      <div>チェックイン: {item.row.check_in_date}</div>
                      <div>チェックアウト: {item.row.check_out_date}</div>
                      <div>宿泊数: {item.row.nights}泊</div>
                      <div>人数: {item.row.guests}名</div>
                    </td>
                    <td className="px-4 py-3 text-xs leading-5 text-gray-600">
                      <div>プラン: {item.planLabel}</div>
                      <div>サイト: {item.row.site_number ?? '未指定'}</div>
                    </td>
                    <td className="px-4 py-3 text-xs leading-5 text-gray-600">
                      <div>{getPaymentMethodLabel(item.row.payment_method)}</div>
                      <div>{getPaymentStatusLabel(item.row.payment_status)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span>
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

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-gray-500">{label}</label>
      {children}
    </div>
  );
}

function SelectFilter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <FilterField label={label}>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm">
        <option value="all">すべて</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </FilterField>
  );
}
