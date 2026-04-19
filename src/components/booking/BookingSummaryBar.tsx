"use client";

import { getSiteSelectionLabel } from "@/lib/siteSelectionLabel";
import { BookingContext } from "@/types/options";

interface Props {
  booking: BookingContext;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
}

export default function BookingSummaryBar({ booking }: Props) {
  return (
    <div className="mb-6 rounded-xl border border-emerald-200 bg-white/80 px-4 py-3 backdrop-blur-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-semibold text-emerald-700">予約内容</span>
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
          <span className="font-medium">
            {getSiteSelectionLabel({
              siteId: booking.siteId,
              siteNumber: booking.siteNumber,
              siteName: booking.siteName,
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
