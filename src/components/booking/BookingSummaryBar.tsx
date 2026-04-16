"use client";

import { BookingContext } from "@/types/options";

interface Props {
  booking: BookingContext;
}

/** 日付をyyyy/MM/dd形式にフォーマット */
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const w = weekdays[d.getDay()];
  return `${y}/${m}/${day}（${w}）`;
}

export default function BookingSummaryBar({ booking }: Props) {
  return (
    <div className="bg-white/80 backdrop-blur-sm border border-emerald-200 rounded-xl px-4 py-3 mb-6">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-emerald-700 text-sm font-semibold">予約内容</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-700">
        <div className="flex justify-between">
          <span className="text-gray-500">利用日</span>
          <span className="font-medium">{formatDate(booking.checkInDate)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">宿泊数</span>
          <span className="font-medium">{booking.nights}泊</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">人数</span>
          <span className="font-medium">{booking.guests}名</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">サイト</span>
          <span className="font-medium">{booking.siteNumber}</span>
        </div>
      </div>
    </div>
  );
}
