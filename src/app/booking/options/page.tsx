"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OptionItem, OptionSelection, OptionsPayload, BookingContext, STORAGE_KEY_OPTIONS_PAYLOAD } from "@/types/options";
import { fetchOptions } from '@/lib/admin/fetchData';
import { useBookingDraftStore } from "@/stores/bookingDraftStore";
import BookingSummaryBar from "@/components/booking/BookingSummaryBar";
import RentalOptionCard from "@/components/booking/RentalOptionCard";
import EventOptionCard from "@/components/booking/EventOptionCard";
import SelectedOptionsSummary from "@/components/booking/SelectedOptionsSummary";

// --- 小計計算ヘルパー ---

function calcSubtotal(option: OptionItem, sel: OptionSelection): number {
  switch (option.priceType) {
    case "per_day":
      return option.price * sel.quantity * sel.days;
    case "per_person":
      return option.price * sel.people;
    case "per_unit":
      return option.price * sel.quantity;
    case "fixed":
      return sel.quantity > 0 ? option.price : 0;
    default:
      return 0;
  }
}

// --- デフォルトの selection を生成 ---

function defaultSelection(optionId: string, nights: number): OptionSelection {
  return { optionId, quantity: 0, days: nights, people: 0, subtotal: 0 };
}

export default function OptionsPage() {
  const router = useRouter();
  const stay = useBookingDraftStore((s) => s.stay);
  const site = useBookingDraftStore((s) => s.site);
  const setOptions = useBookingDraftStore((s) => s.setOptions);

  // ガード: 宿泊日未入力 → TOP、サイト未選択 → サイト選択
  const hasStay = !!(stay.checkIn && stay.checkOut && stay.nights > 0);
  const hasSite = !!site.siteId;

  useEffect(() => {
    if (!hasStay) {
      router.replace("/");
    } else if (!hasSite) {
      router.replace("/booking/sites");
    }
  }, [hasStay, hasSite, router]);

  const booking: BookingContext = useMemo(
    () => ({
      checkInDate: stay.checkIn ?? "2026-05-02",
      checkOutDate: stay.checkOut ?? "2026-05-04",
      nights: stay.nights || 2,
      guests: stay.adults + stay.children || 4,
      siteId: site.siteId ?? "",
      siteNumber: site.siteNumber ?? "未選択",
      siteName: site.siteName ?? "未選択",
      sitePrice: site.sitePrice ?? 0,
      designationFee: site.designationFee ?? 0,
      areaName: site.areaName ?? "",
      subAreaName: site.subAreaName ?? "",
    }),
    [stay, site]
  );

  const [optionsSource, setOptionsSource] = useState<OptionItem[]>([]);

  useEffect(() => {
    fetchOptions().then(setOptionsSource);
  }, []);

  const options = optionsSource.filter((o) => o.isActive);

  const rentalOptions = useMemo(
    () => options.filter((o) => o.category === "rental"),
    [options]
  );
  const eventOptions = useMemo(
    () => options.filter((o) => o.category === "event"),
    [options]
  );
  const optionMap = useMemo(
    () => new Map(options.map((o) => [o.id, o])),
    [options]
  );

  // --- 選択状態 ---
  const [selections, setSelections] = useState<Map<string, OptionSelection>>(
    () => new Map()
  );

  /** selection を更新して小計を再計算するヘルパー */
  const updateSelection = useCallback(
    (
      optionId: string,
      updater: (prev: OptionSelection) => Partial<OptionSelection>
    ) => {
      setSelections((prev) => {
        const next = new Map(prev);
        const current =
          next.get(optionId) ?? defaultSelection(optionId, booking.nights);
        const updated = { ...current, ...updater(current) };
        const opt = optionMap.get(optionId);
        updated.subtotal = opt ? calcSubtotal(opt, updated) : 0;
        next.set(optionId, updated);
        return next;
      });
    },
    [booking.nights, optionMap]
  );

  // --- イベントハンドラ ---

  const handleQuantityChange = useCallback(
    (optionId: string, quantity: number) => {
      updateSelection(optionId, (prev) => ({
        quantity,
        days: quantity === 0 ? booking.nights : prev.days,
      }));
    },
    [updateSelection, booking.nights]
  );

  const handleDaysChange = useCallback(
    (optionId: string, days: number) => {
      updateSelection(optionId, () => ({ days }));
    },
    [updateSelection]
  );

  const handlePeopleChange = useCallback(
    (optionId: string, people: number) => {
      updateSelection(optionId, () => ({ people }));
    },
    [updateSelection]
  );

  // --- 集計 ---

  const activeSelections = useMemo(
    () => Array.from(selections.values()).filter((s) => s.subtotal > 0),
    [selections]
  );

  const totalAmount = useMemo(
    () => activeSelections.reduce((sum, s) => sum + s.subtotal, 0),
    [activeSelections]
  );

  // --- 確認画面への payload 生成 ---

  const buildPayload = (): OptionsPayload => ({
    booking,
    selectedOptions: activeSelections,
    optionsTotalAmount: totalAmount,
  });

  const handleNext = () => {
    const payload = buildPayload();
    sessionStorage.setItem(STORAGE_KEY_OPTIONS_PAYLOAD, JSON.stringify(payload));

    // Zustand store にもオプション選択を保存（confirmation ページで参照）
    const rentals = activeSelections
      .filter((s) => optionMap.get(s.optionId)?.category === "rental")
      .map((s) => ({ optionId: s.optionId, quantity: s.quantity, days: s.days, subtotal: s.subtotal }));
    const events = activeSelections
      .filter((s) => optionMap.get(s.optionId)?.category === "event")
      .map((s) => ({ optionId: s.optionId, people: s.people, subtotal: s.subtotal }));
    setOptions({ rentals, events });

    router.push("/booking/terms-payment");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-amber-50/30">
      <div className="max-w-lg mx-auto px-4 py-6 pb-56">
        {/* ヘッダー */}
        <div className="text-center mb-4">
          <p className="text-xs text-gray-400 tracking-wide mb-1">
            STEP 3 / 4
          </p>
          <h1 className="text-xl font-bold text-gray-800">
            オプション・体験を選ぶ
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            必要なものだけ追加できます。スキップもOK！
          </p>
        </div>

        {/* 予約サマリー */}
        <BookingSummaryBar booking={booking} />

        {/* レンタル / オプション */}
        <section className="mb-8">
          <div className="mb-3">
            <h2 className="text-base font-bold text-gray-800">
              レンタル / オプション
            </h2>
          </div>
          <div className="space-y-3">
            {rentalOptions.map((opt) => (
              <RentalOptionCard
                key={opt.id}
                option={opt}
                selection={selections.get(opt.id)}
                nights={booking.nights}
                onChangeQuantity={handleQuantityChange}
                onChangeDays={handleDaysChange}
              />
            ))}
          </div>
        </section>

        {/* イベント / 体験 */}
        <section className="mb-8">
          <div className="mb-3">
            <h2 className="text-base font-bold text-gray-800">
              イベント / 体験
            </h2>
          </div>
          <div className="space-y-3">
            {eventOptions.map((opt) => (
              <EventOptionCard
                key={opt.id}
                option={opt}
                selection={selections.get(opt.id)}
                onChangePeople={handlePeopleChange}
              />
            ))}
          </div>
        </section>
      </div>

      {/* ===== フッター固定エリア ===== */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-gray-200 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
        <div className="max-w-lg mx-auto px-4 py-3">
          {/* 選択内容まとめ */}
          {activeSelections.length > 0 && (
            <div className="mb-3 max-h-36 overflow-y-auto">
              <SelectedOptionsSummary
                selections={activeSelections}
                options={options}
                totalAmount={totalAmount}
              />
            </div>
          )}

          {activeSelections.length === 0 && (
            <p className="text-center text-sm text-gray-400 mb-3">
              オプションなしでも次へ進めます
            </p>
          )}

          {/* ナビゲーションボタン */}
          <div className="flex gap-3">
            <Link
              href="/booking/sites"
              className="flex-1 text-center py-3 rounded-xl border border-gray-300 text-gray-600 font-medium hover:bg-gray-50 transition-colors text-sm"
            >
              ← 前へ
            </Link>
            <button
              type="button"
              onClick={handleNext}
              className="flex-[2] py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors text-sm shadow-sm"
            >
              次へ → 確認画面
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
