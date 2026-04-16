'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fetchRecentActions, getActionLabel } from '@/lib/admin/actionLog';
import { fetchRecentNotifications, getChannelLabel, getNotificationStatusLabel, getNotificationTypeLabel } from '@/lib/admin/notificationLog';
import type { Database } from '@/types/database';

type ImportJob = Database['public']['Tables']['import_jobs']['Row'];
type ActionLog = Database['public']['Tables']['admin_action_logs']['Row'];
type NotificationLog = Database['public']['Tables']['notification_logs']['Row'];

interface DashboardStats {
  todayCheckins: number;
  todayCreatedReservations: number;
  unpaidCount: number;
  todayCancelledReservations: number;
}

function dayRangeIso(date = new Date()) {
  const local = new Date(date);
  const yyyy = local.getFullYear();
  const mm = String(local.getMonth() + 1).padStart(2, '0');
  const dd = String(local.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentImports, setRecentImports] = useState<ImportJob[]>([]);
  const [recentActions, setRecentActions] = useState<ActionLog[]>([]);
  const [recentNotifications, setRecentNotifications] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const today = dayRangeIso();
      const tomorrow = dayRangeIso(new Date(Date.now() + 24 * 60 * 60 * 1000));

      const [
        { count: todayCheckins },
        { count: todayCreatedReservations },
        { count: unpaidCount },
        { count: todayCancelledReservations },
        { data: imports },
        actions,
        notifications,
      ] = await Promise.all([
        supabase.from('guest_reservations').select('*', { count: 'exact', head: true }).eq('check_in_date', today).not('status', 'eq', 'cancelled'),
        supabase.from('guest_reservations').select('*', { count: 'exact', head: true }).gte('created_at', `${today}T00:00:00`).lt('created_at', `${tomorrow}T00:00:00`).not('status', 'eq', 'cancelled'),
        supabase.from('guest_reservations').select('*', { count: 'exact', head: true }).eq('payment_status', 'pending').not('status', 'eq', 'cancelled'),
        supabase.from('guest_reservations').select('*', { count: 'exact', head: true }).eq('status', 'cancelled').gte('updated_at', `${today}T00:00:00`).lt('updated_at', `${tomorrow}T00:00:00`),
        supabase.from('import_jobs').select('*').order('created_at', { ascending: false }).limit(5),
        fetchRecentActions(5),
        fetchRecentNotifications(5),
      ]);

      setStats({
        todayCheckins: todayCheckins ?? 0,
        todayCreatedReservations: todayCreatedReservations ?? 0,
        unpaidCount: unpaidCount ?? 0,
        todayCancelledReservations: todayCancelledReservations ?? 0,
      });
      setRecentImports(imports ?? []);
      setRecentActions(actions);
      setRecentNotifications(notifications);
      setLoading(false);
    }

    load();
  }, []);

  return (
    <div className="max-w-5xl">
      <h1 className="mb-4 text-xl font-bold text-gray-900">ダッシュボード</h1>

      {loading ? (
        <p className="text-sm text-gray-400">読み込み中...</p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="本日のチェックイン" value={stats?.todayCheckins ?? 0} />
            <StatCard label="今日の予約成立件数" value={stats?.todayCreatedReservations ?? 0} />
            <StatCard label="未決済数" value={stats?.unpaidCount ?? 0} color={stats?.unpaidCount ? 'yellow' : undefined} />
            <StatCard label="本日予約分のキャンセル件数" value={stats?.todayCancelledReservations ?? 0} color={stats?.todayCancelledReservations ? 'red' : undefined} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800">顧客データアップロード</h2>
                <Link href="/admin/import" className="text-xs text-blue-600 hover:underline">一覧</Link>
              </div>
              {recentImports.length === 0 ? (
                <p className="text-xs text-gray-400">アップロード履歴はまだありません。</p>
              ) : (
                <div className="space-y-2">
                  {recentImports.map((job) => (
                    <Link key={job.id} href={`/admin/import/${job.id}`} className="block rounded border border-gray-100 p-2 text-xs hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <span className="max-w-[160px] truncate font-medium text-gray-800">{job.file_name}</span>
                        <span className="text-gray-400">{new Date(job.created_at).toLocaleDateString('ja-JP')}</span>
                      </div>
                      <div className="mt-1 flex gap-3 text-gray-500"><span>成功 {job.success_count}</span>{job.error_count > 0 && <span className="text-red-600">失敗 {job.error_count}</span>}</div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded border border-gray-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-gray-800">直近の操作ログ</h2>
              {recentActions.length === 0 ? (
                <p className="text-xs text-gray-400">操作ログはまだありません。</p>
              ) : (
                <div className="space-y-2">
                  {recentActions.map((log) => (
                    <div key={log.id} className="flex items-start gap-2 border-b border-gray-50 pb-2 text-xs">
                      <span className="w-28 shrink-0 text-gray-400">{new Date(log.created_at).toLocaleString('ja-JP')}</span>
                      <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">{getActionLabel(log.action_type)}</span>
                      <span className="truncate text-gray-500">{log.admin_email}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 rounded border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">通知ログ</h2>
              <Link href="/admin/notifications" className="text-xs text-blue-600 hover:underline">一覧</Link>
            </div>
            {recentNotifications.length === 0 ? (
              <p className="text-xs text-gray-400">通知ログはまだありません。</p>
            ) : (
              <div className="space-y-2">
                {recentNotifications.map((notification) => (
                  <div key={notification.id} className="flex items-start gap-2 border-b border-gray-50 pb-2 text-xs">
                    <span className="w-28 shrink-0 text-gray-400">{new Date(notification.created_at).toLocaleString('ja-JP')}</span>
                    <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">{getNotificationTypeLabel(notification.notification_type)}</span>
                    <span className="shrink-0 rounded bg-gray-50 px-1.5 py-0.5 text-gray-500">{getChannelLabel(notification.channel)}</span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 ${notification.status === 'sent' ? 'bg-green-100 text-green-700' : notification.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{getNotificationStatusLabel(notification.status)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: 'yellow' | 'red' }) {
  const colorClass = color === 'yellow' ? 'border-yellow-200 bg-yellow-50' : color === 'red' ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white';
  const textColor = color === 'yellow' ? 'text-yellow-800' : color === 'red' ? 'text-red-800' : 'text-gray-900';

  return (
    <div className={`rounded border p-4 ${colorClass}`}>
      <p className="mb-1 text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${textColor}`}>{value}</p>
    </div>
  );
}
