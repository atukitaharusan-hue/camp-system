'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchOptions } from '@/lib/admin/fetchData';
import type { ReservationDetail } from '@/types/reservation';
import {
  calculateNights,
  getPaymentMethodLabel,
  getPaymentStatusLabel,
  getSiteTypeLabel,
} from '@/types/reservation';
import ReservationStatusBadge from './ReservationStatusBadge';

interface ReservationSummaryCardProps {
  reservation: ReservationDetail;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
}

function formatCurrency(amount: number) {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

export default function ReservationSummaryCard({
  reservation,
}: ReservationSummaryCardProps) {
  const [optionNames, setOptionNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let active = true;

    if (!reservation.optionsJson?.length) {
      setOptionNames(new Map());
      return () => {
        active = false;
      };
    }

    fetchOptions().then((options) => {
      if (!active) return;
      setOptionNames(new Map(options.map((option) => [option.id, option.name])));
    });

    return () => {
      active = false;
    };
  }, [reservation.optionsJson]);

  const nights = calculateNights(reservation.checkInDate, reservation.checkOutDate);

  const summaryRows = useMemo(
    () => [
      { label: '予約番号', value: reservation.id.slice(0, 8).toUpperCase() },
      { label: '予約者名', value: reservation.userName },
      { label: 'チェックイン', value: formatDate(reservation.checkInDate) },
      { label: 'チェックアウト', value: formatDate(reservation.checkOutDate) },
      { label: '宿泊数', value: `${nights}泊` },
      {
        label: 'サイト',
        value: reservation.siteNumber
          ? `${reservation.siteNumber} / ${getSiteTypeLabel(reservation.siteType)}`
          : getSiteTypeLabel(reservation.siteType),
      },
      {
        label: '人数',
      value: `大人(中学生以上) ${reservation.adults}名 / 子ども ${reservation.children}名 / 幼児 ${reservation.infants}名`,
      },
      { label: '支払い方法', value: getPaymentMethodLabel(reservation.paymentMethod) },
      { label: '支払い状況', value: getPaymentStatusLabel(reservation.paymentStatus) },
      { label: '合計金額', value: formatCurrency(reservation.totalAmount) },
    ],
    [nights, reservation],
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-gray-800">予約情報</h2>
        <ReservationStatusBadge
          status={reservation.status}
          checkedInAt={reservation.checkedInAt}
        />
      </div>

      <div className="divide-y divide-gray-50 px-5">
        {summaryRows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-4 py-3"
          >
            <span className="text-sm text-gray-500">{row.label}</span>
            <span className="text-right text-sm font-medium text-gray-800">
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {reservation.campgroundName && (
        <div className="border-t border-gray-100 px-5 py-3">
          <p className="text-xs text-gray-400">{reservation.campgroundName}</p>
        </div>
      )}

      {reservation.optionsJson && reservation.optionsJson.length > 0 && (
        <div className="border-t border-gray-100 px-5 py-4">
          <h3 className="mb-2 text-xs font-semibold text-gray-500">
            選択したオプション
          </h3>
          <div className="space-y-1.5">
            {reservation.optionsJson.map((option, index) => {
              const optionName = optionNames.get(option.optionId) ?? option.optionId;
              const suffix: string[] = [];

              if (option.type === 'rental' && option.quantity > 1) {
                suffix.push(`${option.quantity}点`);
              }
              if (option.type === 'rental' && option.days && option.days > 1) {
                suffix.push(`${option.days}日`);
              }
              if (option.type === 'event' && option.people && option.people > 1) {
                suffix.push(`${option.people}名`);
              }

              return (
                <div
                  key={`${option.optionId}-${index}`}
                  className="flex items-center justify-between gap-4 text-sm"
                >
                  <span className="text-gray-600">
                    {optionName}
                    {suffix.length > 0 ? ` (${suffix.join(' / ')})` : ''}
                  </span>
                  <span className="font-medium text-gray-800">
                    {formatCurrency(option.subtotal)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
