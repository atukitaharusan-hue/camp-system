'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  fetchRecentNotifications,
  getNotificationTypeLabel,
  getChannelLabel,
  getNotificationStatusLabel,
} from '@/lib/admin/notificationLog';
import type { Database } from '@/types/database';

type NotificationLog = Database['public']['Tables']['notification_logs']['Row'];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentNotifications(100).then((data) => {
      setNotifications(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="max-w-5xl">
      <h1 className="text-xl font-bold text-gray-900 mb-4">通知ログ</h1>

      {loading ? (
        <p className="text-sm text-gray-400">読み込み中...</p>
      ) : notifications.length === 0 ? (
        <p className="text-sm text-gray-400">通知ログはありません</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-3 py-2 text-left text-gray-600 font-medium">日時</th>
                <th className="px-3 py-2 text-left text-gray-600 font-medium">種別</th>
                <th className="px-3 py-2 text-left text-gray-600 font-medium">チャネル</th>
                <th className="px-3 py-2 text-left text-gray-600 font-medium">宛先</th>
                <th className="px-3 py-2 text-left text-gray-600 font-medium">ステータス</th>
                <th className="px-3 py-2 text-left text-gray-600 font-medium">予約</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((n) => (
                <tr key={n.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                    {new Date(n.created_at).toLocaleString('ja-JP')}
                  </td>
                  <td className="px-3 py-2 text-gray-800">
                    {getNotificationTypeLabel(n.notification_type)}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {getChannelLabel(n.channel)}
                  </td>
                  <td className="px-3 py-2 text-gray-600 max-w-[180px] truncate">
                    {n.recipient ?? '-'}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={n.status} />
                  </td>
                  <td className="px-3 py-2">
                    {n.reservation_id ? (
                      <Link
                        href={`/admin/reservations/${n.reservation_id}`}
                        className="text-blue-600 hover:underline"
                      >
                        詳細
                      </Link>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = getNotificationStatusLabel(status);
  const cls =
    status === 'sent'
      ? 'bg-green-100 text-green-700'
      : status === 'failed'
        ? 'bg-red-100 text-red-700'
        : 'bg-gray-100 text-gray-600';

  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-xs ${cls}`}>
      {label}
    </span>
  );
}
