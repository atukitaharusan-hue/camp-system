'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fetchReservationByIdAdmin } from '@/lib/admin/fetchReservations';
import { cancelReservation } from '@/lib/admin/updateReservation';
import { fetchNotificationsByReservation, getNotificationTypeLabel, getChannelLabel, getNotificationStatusLabel } from '@/lib/admin/notificationLog';
import { fetchActionsByTarget, getActionLabel } from '@/lib/admin/actionLog';
import {
  generateReceptionCode,
  calculateNights,
  getSiteTypeLabel,
  getPaymentMethodLabel,
  getPaymentStatusLabel,
} from '@/types/reservation';
import type { Database, Json } from '@/types/database';

type GuestReservationRow = Database['public']['Tables']['guest_reservations']['Row'];
type ReservationStatus = Database['public']['Enums']['reservation_status'];

const statusConfig: Record<ReservationStatus, { label: string; className: string }> = {
  pending: { label: '確認待ち', className: 'bg-yellow-100 text-yellow-800' },
  confirmed: { label: '予約確定', className: 'bg-green-100 text-green-800' },
  checked_in: { label: 'チェックイン済み', className: 'bg-blue-100 text-blue-800' },
  completed: { label: 'ご利用済み', className: 'bg-gray-100 text-gray-600' },
  cancelled: { label: 'キャンセル済み', className: 'bg-red-100 text-red-800' },
};

interface OptionEntry {
  name?: string;
  quantity?: number;
  subtotal?: number;
  [key: string]: Json | undefined;
}

function parseOptions(json: Json): OptionEntry[] {
  if (Array.isArray(json)) {
    return json as OptionEntry[];
  }
  return [];
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 rounded p-5 mb-4">
      <h2 className="text-sm font-semibold text-gray-800 mb-3 border-b border-gray-100 pb-2">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start py-1.5 text-sm">
      <dt className="w-36 shrink-0 text-gray-500">{label}</dt>
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

  const loadData = useCallback(async () => {
    setLoading(true);
    const result = await fetchReservationByIdAdmin(id);
    if (result.error) {
      setError(result.error);
    } else if (!result.data) {
      setError('予約が見つかりません');
    } else {
      setReservation(result.data);
    }
    const [notifs, logs] = await Promise.all([
      fetchNotificationsByReservation(id),
      fetchActionsByTarget('reservation', id),
    ]);
    setNotifications(notifs);
    setActionLogs(logs);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCancel = async () => {
    setCancelling(true);
    const { data: { user } } = await supabase.auth.getUser();
    const result = await cancelReservation(id, user?.email ?? '不明');
    if (result.success) {
      setCancelConfirm(false);
      await loadData();
    } else {
      setError(result.error ?? 'キャンセルに失敗しました');
    }
    setCancelling(false);
  };

  if (loading) {
    return (
      <div className="max-w-3xl">
        <p className="text-sm text-gray-400 py-8 text-center">読み込み中...</p>
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div className="max-w-3xl">
        <Link
          href="/admin/reservations"
          className="text-sm text-blue-600 hover:underline mb-4 inline-block"
        >
          &larr; 予約一覧に戻る
        </Link>
        <div className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-700">
          {error ?? '予約が見つかりません'}
        </div>
      </div>
    );
  }

  const r = reservation;
  const badge = statusConfig[r.status];
  const nights = calculateNights(r.check_in_date, r.check_out_date);
  const options = parseOptions(r.options_json);

  return (
    <div className="max-w-3xl">
      {/* ヘッダ */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/reservations"
            className="text-sm text-blue-600 hover:underline"
          >
            &larr; 一覧
          </Link>
          <h1 className="text-xl font-bold text-gray-900">
            予約詳細: {generateReceptionCode(r.id)}
          </h1>
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {r.status !== 'cancelled' && (
            <>
              <Link
                href={`/admin/reservations/${r.id}/edit`}
                className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
              >
                編集
              </Link>
              {cancelConfirm ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="px-3 py-1.5 text-sm text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
                  >
                    {cancelling ? '処理中...' : 'キャンセル確定'}
                  </button>
                  <button
                    onClick={() => setCancelConfirm(false)}
                    className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50"
                  >
                    戻す
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setCancelConfirm(true)}
                  className="px-3 py-1.5 text-sm text-red-600 bg-white border border-red-200 rounded hover:bg-red-50"
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

      {/* 基本情報 */}
      <Section title="基本情報">
        <dl>
          <Field label="予約ID" value={<span className="font-mono text-xs">{r.id}</span>} />
          <Field label="受付コード" value={<span className="font-mono">{generateReceptionCode(r.id)}</span>} />
          <Field label="予約者名" value={r.user_name} />
          <Field label="メール" value={r.user_email ?? '未設定'} />
          <Field label="チェックイン" value={r.check_in_date} />
          <Field label="チェックアウト" value={r.check_out_date} />
          <Field label="泊数" value={`${nights}泊`} />
          <Field label="人数" value={`${r.guests}名`} />
          <Field label="サイト番号" value={r.site_number ?? '-'} />
          <Field label="サイト名" value={r.site_name ?? '-'} />
          <Field label="サイトタイプ" value={getSiteTypeLabel(r.site_type)} />
          <Field label="キャンプ場" value={r.campground_name ?? '-'} />
          <Field label="特記事項" value={r.special_requests ?? 'なし'} />
          <Field label="予約日時" value={new Date(r.created_at).toLocaleString('ja-JP')} />
        </dl>
      </Section>

      {/* オプション */}
      <Section title="オプション">
        {options.length === 0 ? (
          <p className="text-sm text-gray-400">オプションなし</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500">
                <th className="text-left py-2">項目名</th>
                <th className="text-right py-2">数量</th>
                <th className="text-right py-2">小計</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {options.map((opt, i) => (
                <tr key={i}>
                  <td className="py-2 text-gray-900">{opt.name ?? '-'}</td>
                  <td className="py-2 text-right text-gray-700">{opt.quantity ?? '-'}</td>
                  <td className="py-2 text-right text-gray-700">
                    {opt.subtotal != null ? `${Number(opt.subtotal).toLocaleString()}円` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* 同意情報 */}
      <Section title="同意情報">
        <dl>
          <Field
            label="キャンセルポリシー"
            value={r.agreed_cancellation ? '同意済み' : '未同意'}
          />
          <Field
            label="利用規約"
            value={r.agreed_terms ? '同意済み' : '未同意'}
          />
          <Field
            label="SNS掲載"
            value={r.agreed_sns ? '同意済み' : '未同意'}
          />
        </dl>
      </Section>

      {/* 支払い情報 */}
      <Section title="支払い情報">
        <dl>
          <Field label="合計金額" value={`${Number(r.total_amount).toLocaleString()}円`} />
          <Field label="支払い方法" value={getPaymentMethodLabel(r.payment_method)} />
          <Field label="決済状況" value={getPaymentStatusLabel(r.payment_status)} />
        </dl>
      </Section>

      {/* チェックイン */}
      <Section title="チェックイン">
        <dl>
          <Field
            label="チェックイン日時"
            value={
              r.checked_in_at
                ? new Date(r.checked_in_at).toLocaleString('ja-JP')
                : '未チェックイン'
            }
          />
        </dl>
      </Section>

      {/* 操作履歴 */}
      {actionLogs.length > 0 && (
        <Section title="操作履歴">
          <div className="space-y-2">
            {actionLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 text-xs border-b border-gray-50 pb-2">
                <span className="text-gray-400 shrink-0 w-32">
                  {new Date(log.created_at).toLocaleString('ja-JP')}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 shrink-0">
                  {getActionLabel(log.action_type)}
                </span>
                <span className="text-gray-500 truncate">{log.admin_email}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 通知履歴 */}
      {notifications.length > 0 && (
        <Section title="通知履歴">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-gray-500">
                <th className="text-left py-1.5">日時</th>
                <th className="text-left py-1.5">種別</th>
                <th className="text-left py-1.5">チャネル</th>
                <th className="text-left py-1.5">宛先</th>
                <th className="text-left py-1.5">状態</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((n) => (
                <tr key={n.id} className="border-b border-gray-50">
                  <td className="py-1.5 text-gray-400">{new Date(n.created_at).toLocaleString('ja-JP')}</td>
                  <td className="py-1.5 text-gray-700">{getNotificationTypeLabel(n.notification_type)}</td>
                  <td className="py-1.5 text-gray-600">{getChannelLabel(n.channel)}</td>
                  <td className="py-1.5 text-gray-600">{n.recipient ?? '-'}</td>
                  <td className="py-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      n.status === 'sent' ? 'bg-green-100 text-green-700'
                      : n.status === 'failed' ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-600'
                    }`}>
                      {getNotificationStatusLabel(n.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </div>
  );
}
