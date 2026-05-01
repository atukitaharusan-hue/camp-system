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

function formatOptionQuantity(option: NonNullable<ReservationDetail['optionsJson']>[number]) {
  if (option.type === 'event') return `${option.people ?? option.quantity ?? 1}名`;
  const parts = [`${option.quantity ?? 1}個`];
  if (option.days && option.days > 1) parts.push(`${option.days}日`);
  return parts.join(' / ');
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-right text-sm font-medium text-gray-800">{value}</span>
    </div>
  );
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

    fetchOptions()
      .then((options) => {
        if (!active) return;
        setOptionNames(new Map(options.map((option) => [option.id, option.name])));
      })
      .catch(() => {
        if (!active) return;
        setOptionNames(new Map());
      });

    return () => {
      active = false;
    };
  }, [reservation.optionsJson]);

  const nights = reservation.nights || calculateNights(reservation.checkInDate, reservation.checkOutDate);
  const pricingBreakdown = reservation.pricingBreakdown;
  const optionsTotal =
    pricingBreakdown?.optionsAmount ??
    reservation.optionsJson?.reduce((sum, option) => sum + option.subtotal, 0) ??
    0;

  const summaryRows = useMemo(
    () => [
      { label: '予約番号', value: reservation.id.slice(0, 8).toUpperCase() },
      { label: '予約者名', value: reservation.userName },
      { label: '予約日時', value: formatDate(reservation.createdAt) },
      { label: 'プラン名', value: reservation.planName || '-' },
      { label: 'チェックイン日', value: formatDate(reservation.checkInDate) },
      { label: 'チェックアウト日', value: formatDate(reservation.checkOutDate) },
      { label: '泊数', value: `${nights}泊` },
      {
        label: 'サイト',
        value: reservation.siteNumber
          ? `${reservation.siteNumber}${reservation.siteName ? ` / ${reservation.siteName}` : ''}`
          : getSiteTypeLabel(reservation.siteType),
      },
      {
        label: '人数',
        value: `大人(中学生以上) ${reservation.adults}名 / 子供 ${reservation.children}名 / 幼児 ${reservation.infants}名`,
      },
      { label: '支払い方法', value: getPaymentMethodLabel(reservation.paymentMethod) },
      { label: '支払い状況', value: getPaymentStatusLabel(reservation.paymentStatus) },
      { label: '合計金額', value: formatCurrency(pricingBreakdown?.totalAmount ?? reservation.totalAmount) },
    ],
    [nights, pricingBreakdown?.totalAmount, reservation],
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
          <DetailRow key={row.label} label={row.label} value={row.value} />
        ))}
      </div>

      <div className="border-t border-gray-100 px-5 py-4">
        <h3 className="mb-2 text-xs font-semibold text-gray-500">オプション内容</h3>
        {reservation.optionsJson && reservation.optionsJson.length > 0 ? (
          <div className="space-y-1.5">
            {reservation.optionsJson.map((option, index) => {
              const optionName = optionNames.get(option.optionId) ?? option.optionId;

              return (
                <div
                  key={`${option.optionId}-${index}`}
                  className="flex items-center justify-between gap-4 text-sm"
                >
                  <span className="text-gray-600">
                    {optionName} × {formatOptionQuantity(option)}
                  </span>
                  <span className="font-medium text-gray-800">{formatCurrency(option.subtotal)}</span>
                </div>
              );
            })}
            <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-sm font-semibold">
              <span className="text-gray-700">オプション合計</span>
              <span className="text-gray-900">{formatCurrency(optionsTotal)}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">オプションなし</p>
        )}
      </div>

      {pricingBreakdown && (
        <div className="border-t border-gray-100 px-5 py-4">
          <h3 className="mb-2 text-xs font-semibold text-gray-500">料金明細</h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">基本料金</span>
              <span className="font-medium text-gray-800">{formatCurrency(pricingBreakdown.accommodationAmount)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">サイト指定料金</span>
              <span className="font-medium text-gray-800">{formatCurrency(pricingBreakdown.designationFeeAmount)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">オプション料金</span>
              <span className="font-medium text-gray-800">{formatCurrency(pricingBreakdown.optionsAmount)}</span>
            </div>
            {pricingBreakdown.mandatoryFees.map((fee) => (
              <div key={fee.id} className="flex justify-between gap-4">
                <span className="text-gray-600">{fee.label}</span>
                <span className="font-medium text-gray-800">{formatCurrency(fee.amount)}</span>
              </div>
            ))}
            {pricingBreakdown.lodgingTax && (
              <div className="flex justify-between gap-4">
                <span className="text-gray-600">{pricingBreakdown.lodgingTax.label}</span>
                <span className="font-medium text-gray-800">{formatCurrency(pricingBreakdown.lodgingTax.amount)}</span>
              </div>
            )}
            <div className="flex justify-between gap-4 border-t border-gray-100 pt-2 text-base font-bold">
              <span className="text-gray-900">合計金額</span>
              <span className="text-emerald-700">{formatCurrency(pricingBreakdown.totalAmount)}</span>
            </div>
          </div>
        </div>
      )}

      {reservation.campgroundName && (
        <div className="border-t border-gray-100 px-5 py-3">
          <p className="text-xs text-gray-400">{reservation.campgroundName}</p>
        </div>
      )}
    </div>
  );
}
