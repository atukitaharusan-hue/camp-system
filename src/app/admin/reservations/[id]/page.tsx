'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { coerceReservationPricingBreakdown } from '@/lib/pricing';
import { fetchReservationByIdAdmin } from '@/lib/admin/fetchReservations';
import { fetchPlans } from '@/lib/admin/fetchData';
import { cancelReservation } from '@/lib/admin/updateReservation';
import {
  fetchNotificationsByReservation,
  getChannelLabel,
  getNotificationStatusLabel,
  getNotificationTypeLabel,
} from '@/lib/admin/notificationLog';
import { fetchActionsByTarget, getActionLabel } from '@/lib/admin/actionLog';
import { getSiteSelectionLabel } from '@/lib/siteSelectionLabel';
import {
  calculateNights,
  generateReceptionCode,
  getPaymentMethodLabel,
  getPaymentStatusLabel,
} from '@/types/reservation';
import type { Database, Json } from '@/types/database';
import type { AdminPlan } from '@/types/admin';

type GuestReservationRow = Database['public']['Tables']['guest_reservations']['Row'];
type ReservationStatus = Database['public']['Enums']['reservation_status'];

type OptionEntry = {
  name?: string;
  quantity?: number;
  subtotal?: number;
};

type MultiPlanItem = {
  planId: string;
  siteCount: number;
  siteNumbers: string[];
};

const statusConfig: Partial<Record<ReservationStatus, { label: string; className: string }>> = {
  pending: { label: '仮予約', className: 'bg-yellow-100 text-yellow-800' },
  confirmed: { label: '予約確定', className: 'bg-green-100 text-green-800' },
  checked_in: { label: 'チェックイン済み', className: 'bg-blue-100 text-blue-800' },
  completed: { label: '完了', className: 'bg-gray-100 text-gray-700' },
  cancelled: { label: 'キャンセル', className: 'bg-red-100 text-red-800' },
};

function parseOptions(json: Json): OptionEntry[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const source = item as Record<string, unknown>;
    return [
      {
        name: typeof source.name === 'string' ? source.name : undefined,
        quantity: typeof source.quantity === 'number' ? source.quantity : undefined,
        subtotal: typeof source.subtotal === 'number' ? source.subtotal : undefined,
      },
    ];
  });
}

function getSelectedSiteNumbers(value: GuestReservationRow['selected_site_numbers']) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function parseMultiPlanItems(specialRequests: string | null): MultiPlanItem[] {
  const line = (specialRequests ?? '').split('\n').find((item) => item.startsWith('MULTI_PLAN_ITEMS:'));
  const json = line?.split(':').slice(1).join(':').trim();
  if (!json) return [];

  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const source = item as Partial<MultiPlanItem>;
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
      .filter((item): item is MultiPlanItem => Boolean(item));
  } catch {
    return [];
  }
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

function buildPlanSummary(reservation: GuestReservationRow, multiPlanItems: MultiPlanItem[], planNameMap: Map<string, string>) {
  if (multiPlanItems.length > 0) {
    return multiPlanItems
      .map((item) => {
        const planName = planNameMap.get(item.planId) ?? item.planId;
        const selectedSites = item.siteNumbers.length > 0 ? ` / ${item.siteNumbers.join(', ')}` : '';
        return `${planName} (${item.siteCount}サイト${selectedSites})`;
      })
      .join(' / ');
  }

  if (!reservation.plan_id) return '未設定';
  return planNameMap.get(reservation.plan_id) ?? reservation.plan_id;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded border border-gray-200 bg-white p-5">
      <h2 className="mb-3 border-b border-gray-100 pb-2 text-sm font-semibold text-gray-800">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start py-1.5 text-sm">
      <dt className="w-40 shrink-0 text-gray-500">{label}</dt>
      <dd className="text-gray-900">{value ?? '-'}</dd>
    </div>
  );
}

export default function AdminReservationDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [reservation, setReservation] = useState<GuestReservationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [notifications, setNotifications] = useState<Database['public']['Tables']['notification_logs']['Row'][]>([]);
  const [actionLogs, setActionLogs] = useState<Database['public']['Tables']['admin_action_logs']['Row'][]>([]);
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [syncingMyPage, setSyncingMyPage] = useState(false);
  const [myPageSyncMessage, setMyPageSyncMessage] = useState<string | null>(null);
  const [myPageLinkStatus, setMyPageLinkStatus] = useState<'linked' | 'support' | 'unlinked'>('unlinked');
  const [myPageLineUserId, setMyPageLineUserId] = useState<string | null>(null);

  const loadMyPageStatus = useCallback(async () => {
    const response = await fetch('/api/admin/mypage-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'status',
        reservationIds: [id],
      }),
    });
    const payload = (await response.json().catch(() => null)) as
      | {
          statuses?: Record<string, { linkStatus?: 'linked' | 'support' | 'unlinked'; lineUserId?: string | null }>;
        }
      | null;

    const status = payload?.statuses?.[id];
    if (!status) return;
    setMyPageLinkStatus(status.linkStatus ?? 'unlinked');
    setMyPageLineUserId(status.lineUserId ?? null);
  }, [id]);

  const loadData = useCallback(async () => {
    setLoading(true);

    const result = await fetchReservationByIdAdmin(id);
    if (result.error) {
      setError(result.error);
    } else if (!result.data) {
      setError('予約が見つかりません。');
    } else {
      setReservation(result.data);
      setError(null);
    }

    const [notifs, logs, fetchedPlans] = await Promise.all([
      fetchNotificationsByReservation(id),
      fetchActionsByTarget('reservation', id),
      fetchPlans(),
    ]);
    setNotifications(notifs);
    setActionLogs(logs);
    setPlans(fetchedPlans);
    await loadMyPageStatus();
    setLoading(false);
  }, [id, loadMyPageStatus]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCancel = async () => {
    setCancelling(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const result = await cancelReservation(id, user?.email ?? 'admin');
    if (result.success) {
      setCancelConfirm(false);
      await loadData();
    } else {
      setError(result.error ?? 'キャンセルに失敗しました。');
    }
    setCancelling(false);
  };

  const handleSyncMyPage = async () => {
    setSyncingMyPage(true);
    setMyPageSyncMessage(null);

    try {
      const response = await fetch('/api/admin/mypage-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId: id }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { success?: boolean; reason?: string; message?: string; error?: string }
        | null;

      if (!response.ok) {
        setMyPageSyncMessage(payload?.error ?? 'お客様マイページの更新に失敗しました。');
        return;
      }

      setMyPageSyncMessage(payload?.message ?? 'お客様マイページ向けの連携情報を更新しました。');
      await loadMyPageStatus();
    } finally {
      setSyncingMyPage(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl">
        <p className="py-8 text-center text-sm text-gray-400">読み込み中...</p>
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div className="max-w-3xl">
        <Link href="/admin/reservations" className="mb-4 inline-block text-sm text-blue-600 hover:underline">
          予約一覧に戻る
        </Link>
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error ?? '予約が見つかりません。'}
        </div>
      </div>
    );
  }

  const r = reservation;
  const badge =
    statusConfig[(r.status ?? 'pending') as ReservationStatus] ??
    { label: '不明', className: 'bg-slate-100 text-slate-600' };
  const nights = calculateNights(r.check_in_date, r.check_out_date);
  const options = parseOptions(r.options_json);
  const pricingBreakdown = coerceReservationPricingBreakdown(r.pricing_breakdown);
  const selectedSiteNumbers = getSelectedSiteNumbers(r.selected_site_numbers);
  const siteLabel = getSiteSelectionLabel({
    siteNumber: r.site_number,
    siteName: r.site_name,
    selectedSiteNumbers,
  });
  const multiPlanItems = parseMultiPlanItems(r.special_requests);
  const planNameMap = new Map(plans.map((plan) => [plan.id, plan.name]));
  const planSummary = buildPlanSummary(r, multiPlanItems, planNameMap);
  const noteText = stripSystemLines(r.special_requests) || 'なし';
  const myPageLinkLabel =
    myPageLinkStatus === 'linked' ? 'LINE連携済み' : myPageLinkStatus === 'support' ? '補助情報のみ' : '未連携';

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/reservations" className="text-sm text-blue-600 hover:underline">
            一覧
          </Link>
          <h1 className="text-xl font-bold text-gray-900">予約詳細: {generateReceptionCode(r.id)}</h1>
          <span className={`inline-flex min-w-24 items-center justify-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${badge.className}`}>
            {badge.label}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleSyncMyPage()}
            disabled={syncingMyPage}
            className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
          >
            {syncingMyPage ? '更新中...' : 'お客様マイページを更新'}
          </button>
          {r.status !== 'cancelled' && (
            <>
              <Link
                href={`/admin/reservations/${r.id}/edit`}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                編集
              </Link>
              {cancelConfirm ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {cancelling ? '処理中...' : 'キャンセル確定'}
                  </button>
                  <button
                    onClick={() => setCancelConfirm(false)}
                    className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    戻る
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setCancelConfirm(true)}
                  className="rounded border border-red-200 bg-white px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                >
                  キャンセル
                </button>
              )}
            </>
          )}
          <Link
            href={`/reservation/${r.id}/qr`}
            className="text-sm text-blue-600 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            QRページ
          </Link>
        </div>
      </div>

      {myPageSyncMessage ? (
        <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {myPageSyncMessage}
        </div>
      ) : null}

      <Section title="基本情報">
        <dl>
          <Field label="予約ID" value={<span className="font-mono text-xs">{r.id}</span>} />
          <Field label="受付コード" value={<span className="font-mono">{generateReceptionCode(r.id)}</span>} />
          <Field label="予約者名" value={r.user_name} />
          <Field label="メール" value={r.user_email ?? '未設定'} />
          <Field label="電話番号" value={r.user_phone ?? '未設定'} />
          <Field label="登録日時" value={new Date(r.created_at).toLocaleString('ja-JP')} />
        </dl>
      </Section>

      <Section title="マイページ連携">
        <dl>
          <Field label="LINE連携状態" value={myPageLinkLabel} />
          <Field label="予約のLINE ID" value={myPageLineUserId ?? r.user_identifier ?? '未登録'} />
        </dl>
      </Section>

      <Section title="宿泊情報">
        <dl>
          <Field label="チェックイン" value={r.check_in_date} />
          <Field label="チェックアウト" value={r.check_out_date} />
          <Field label="宿泊数" value={`${nights}泊`} />
          <Field label="合計人数" value={`${r.guests}名`} />
          <Field label="人数内訳" value={`大人 ${r.adults ?? 0} / 子ども ${r.children ?? 0} / 幼児 ${r.infants ?? 0}`} />
          <Field label="プラン" value={planSummary} />
          <Field label="サイト情報" value={siteLabel} />
          <Field label="備考" value={noteText} />
        </dl>
      </Section>

      <Section title="オプション">
        {options.length === 0 ? (
          <p className="text-sm text-gray-400">オプションはありません。</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500">
                <th className="py-2 text-left">項目名</th>
                <th className="py-2 text-right">数量</th>
                <th className="py-2 text-right">金額</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {options.map((opt, index) => (
                <tr key={index}>
                  <td className="py-2 text-gray-900">{opt.name ?? '-'}</td>
                  <td className="py-2 text-right text-gray-700">{opt.quantity ?? '-'}</td>
                  <td className="py-2 text-right text-gray-700">{opt.subtotal != null ? `${Number(opt.subtotal).toLocaleString()}円` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="支払い情報">
        <dl>
          <Field label="合計金額" value={`${Number(r.total_amount).toLocaleString()}円`} />
          {pricingBreakdown && (
            <>
              <Field label="宿泊料金" value={`${pricingBreakdown.accommodationAmount.toLocaleString()}円`} />
              <Field label="指定料金" value={`${pricingBreakdown.designationFeeAmount.toLocaleString()}円`} />
              <Field label="追加項目合計" value={`${pricingBreakdown.optionsAmount.toLocaleString()}円`} />
            </>
          )}
          <Field label="支払い方法" value={getPaymentMethodLabel(r.payment_method)} />
          <Field label="支払い状態" value={getPaymentStatusLabel(r.payment_status)} />
        </dl>
      </Section>

      <Section title="チェックイン">
        <dl>
          <Field label="チェックイン日時" value={r.checked_in_at ? new Date(r.checked_in_at).toLocaleString('ja-JP') : '未チェックイン'} />
        </dl>
      </Section>

      {actionLogs.length > 0 ? (
        <Section title="操作履歴">
          <div className="space-y-2">
            {actionLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 border-b border-gray-50 pb-2 text-xs">
                <span className="w-32 shrink-0 text-gray-400">{new Date(log.created_at).toLocaleString('ja-JP')}</span>
                <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">{getActionLabel(log.action_type)}</span>
                <span className="truncate text-gray-500">{log.admin_email}</span>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {notifications.length > 0 ? (
        <Section title="通知履歴">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-gray-500">
                <th className="py-1.5 text-left">日時</th>
                <th className="py-1.5 text-left">種別</th>
                <th className="py-1.5 text-left">チャネル</th>
                <th className="py-1.5 text-left">宛先</th>
                <th className="py-1.5 text-left">状態</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((notification) => (
                <tr key={notification.id} className="border-b border-gray-50">
                  <td className="py-1.5 text-gray-400">{new Date(notification.created_at).toLocaleString('ja-JP')}</td>
                  <td className="py-1.5 text-gray-700">{getNotificationTypeLabel(notification.notification_type)}</td>
                  <td className="py-1.5 text-gray-600">{getChannelLabel(notification.channel)}</td>
                  <td className="py-1.5 text-gray-600">{notification.recipient ?? '-'}</td>
                  <td className="py-1.5">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                        notification.status === 'sent'
                          ? 'bg-green-100 text-green-700'
                          : notification.status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {getNotificationStatusLabel(notification.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}
    </div>
  );
}
