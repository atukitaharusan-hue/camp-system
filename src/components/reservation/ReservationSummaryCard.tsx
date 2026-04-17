'use client';

import type { ReservationDetail } from '@/types/reservation';
import {
  calculateNights,
  getSiteTypeLabel,
  getPaymentMethodLabel,
  getPaymentStatusLabel,
} from '@/types/reservation';
import ReservationStatusBadge from './ReservationStatusBadge';
import { useEffect, useState } from 'react';
import { fetchOptions } from '@/lib/admin/fetchData';

interface ReservationSummaryCardProps {
  reservation: ReservationDetail;
}

/** 日付を "YYYY/MM/DD（曜日）" 形式にフォーマット */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const w = weekdays[date.getDay()];
  return `${y}/${m}/${d}（${w}）`;
}

export default function ReservationSummaryCard({
  reservation,
}: ReservationSummaryCardProps) {
  const [optionNames, setOptionNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!reservation.optionsJson?.length) return;
    fetchOptions().then((opts) => {
      setOptionNames(new Map(opts.map((o) => [o.id, o.name])));
    });
  }, [reservation.optionsJson]);

  const nights = calculateNights(
    reservation.checkInDate,
    reservation.checkOutDate
  );

  const items: { label: string; value: string | React.ReactNode }[] = [
    {
      label: '予約番号',
      value: (
        <span className="font-mono text-sm">
          {reservation.id.substring(0, 8).toUpperCase()}
        </span>
      ),
    },
    { label: '利用者名', value: reservation.userName },
    { label: 'チェックイン', value: formatDate(reservation.checkInDate) },
    { label: 'チェックアウト', value: formatDate(reservation.checkOutDate) },
    { label: '宿泊数', value: `${nights}泊` },
    {
      label: 'サイト',
      value: `${reservation.siteNumber}（${getSiteTypeLabel(reservation.siteType)}）`,
    },
    { label: '人数', value: `${reservation.guests}名` },
    {
      label: '支払い方法',
      value: getPaymentMethodLabel(reservation.paymentMethod),
    },
    {
      label: '決済状況',
      value: getPaymentStatusLabel(reservation.paymentStatus),
    },
  ];

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* ヘッダー */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-gray-800">予約情報</h2>
        <ReservationStatusBadge
          status={reservation.status}
          checkedInAt={reservation.checkedInAt}
        />
      </div>

      {/* 情報一覧 */}
      <div className="divide-y divide-gray-50 px-5">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between py-3"
          >
            <span className="text-sm text-gray-500">{item.label}</span>
            <span className="text-sm font-medium text-gray-800">
              {item.value}
            </span>
          </div>
        ))}
      </div>

      {/* キャンプ場名 */}
      <div className="border-t border-gray-100 px-5 py-3">
        <p className="text-xs text-gray-400">{reservation.campgroundName}</p>
      </div>

      {/* オプション */}
      {reservation.optionsJson && reservation.optionsJson.length > 0 && (
        <div className="border-t border-gray-100 px-5 py-4">
          <h3 className="mb-2 text-xs font-semibold text-gray-500">選択オプション</h3>
          <div className="space-y-1.5">
            {reservation.optionsJson.map((opt) => (
              <div key={opt.optionId} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {optionNames.get(opt.optionId) ?? opt.optionId}
                  {opt.type === 'rental' && opt.quantity > 1 && ` ×${opt.quantity}`}
                  {opt.type === 'rental' && opt.days && opt.days > 1 && ` (${opt.days}日間)`}
                  {opt.type === 'event' && opt.people && opt.people > 1 && ` ×${opt.people}名`}
                </span>
                <span className="font-medium text-gray-800">¥{opt.subtotal.toLocaleString('ja-JP')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
