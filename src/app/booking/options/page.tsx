"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  OptionItem,
  OptionSelection,
  OptionsPayload,
  BookingContext,
  STORAGE_KEY_OPTIONS_PAYLOAD,
} from "@/types/options";
import { fetchOptions } from "@/lib/admin/fetchData";
import { calculatePlanAccommodationAmount } from "@/lib/pricing";
import { getSiteSelectionLabel } from "@/lib/siteSelectionLabel";
import { useBookingDraftStore } from "@/stores/bookingDraftStore";
import BookingSummaryBar from "@/components/booking/BookingSummaryBar";
import RentalOptionCard from "@/components/booking/RentalOptionCard";
import EventOptionCard from "@/components/booking/EventOptionCard";
import SelectedOptionsSummary from "@/components/booking/SelectedOptionsSummary";

function calcSubtotal(option: OptionItem, selection: OptionSelection): number {
  switch (option.priceType) {
    case "per_day":
      return option.price * selection.quantity * selection.days;
    case "per_person":
      return option.price * selection.people;
    case "per_unit":
      return option.price * selection.quantity;
    case "fixed":
      return selection.quantity > 0 ? option.price : 0;
    default:
      return 0;
  }
}

function defaultSelection(optionId: string, nights: number): OptionSelection {
  return { optionId, quantity: 0, days: nights, people: 0, subtotal: 0 };
}

export default function OptionsPage() {
  const router = useRouter();
  const stay = useBookingDraftStore((state) => state.stay);
  const plan = useBookingDraftStore((state) => state.plan);
  const site = useBookingDraftStore((state) => state.site);
  const setOptions = useBookingDraftStore((state) => state.setOptions);

  const hasStay = !!(stay.checkIn && stay.checkOut && stay.nights > 0);
  const hasSite = !!site.siteId;
  const accommodationAmount =
    plan.minorPlanId
      ? calculatePlanAccommodationAmount(
          {
            pricingMode: plan.pricingMode,
            basePrice: plan.basePrice,
            adultPrice: plan.adultPrice,
            childPrice: plan.childPrice,
            infantPrice: plan.infantPrice,
            guestBandRules: plan.guestBandRules,
          },
          {
            adults: stay.adults,
            children: stay.children,
            infants: stay.infants,
          },
          {
            checkInDate: stay.checkIn,
          },
        )
      : site.sitePrice ?? 0;

  useEffect(() => {
    if (!hasStay) {
      router.replace("/");
    } else if (!hasSite) {
      router.replace("/booking/sites");
    }
  }, [hasSite, hasStay, router]);

  const booking: BookingContext = useMemo(
    () => ({
      checkInDate: stay.checkIn ?? "",
      checkOutDate: stay.checkOut ?? "",
      nights: stay.nights || 0,
      guests: stay.adults + stay.children + stay.infants || 0,
      adults: stay.adults,
      children: stay.children,
      infants: stay.infants,
      planPricingMode: plan.pricingMode,
      planBasePrice: plan.basePrice ?? 0,
      planAdultPrice: plan.adultPrice ?? 0,
      planChildPrice: plan.childPrice ?? 0,
      planInfantPrice: plan.infantPrice ?? 0,
      planGuestBandRules: plan.guestBandRules ?? [],
      requestedSiteCount: plan.requestedSiteCount ?? 1,
      siteId: site.siteId ?? "",
      siteNumber: site.siteNumber ?? "",
      siteName: site.siteName ?? "",
      sitePrice: accommodationAmount,
      designationFee: site.designationFee ?? 0,
      areaName: site.areaName ?? "",
      subAreaName: site.subAreaName ?? "",
    }),
    [accommodationAmount, plan.adultPrice, plan.basePrice, plan.childPrice, plan.guestBandRules, plan.infantPrice, plan.pricingMode, plan.requestedSiteCount, site, stay],
  );

  const [optionsSource, setOptionsSource] = useState<OptionItem[]>([]);

  useEffect(() => {
    let active = true;

    if (!plan.minorPlanId) {
      setOptionsSource([]);
      return () => {
        active = false;
      };
    }

    fetchOptions(plan.minorPlanId).then((items) => {
      if (!active) return;
      setOptionsSource(items);
    });

    return () => {
      active = false;
    };
  }, [plan.minorPlanId]);

  const options = useMemo(
    () => optionsSource.filter((option) => option.isActive),
    [optionsSource],
  );
  const rentalOptions = useMemo(
    () => options.filter((option) => option.category === "rental"),
    [options],
  );
  const eventOptions = useMemo(
    () => options.filter((option) => option.category === "event"),
    [options],
  );
  const optionMap = useMemo(
    () => new Map(options.map((option) => [option.id, option])),
    [options],
  );

  const [selections, setSelections] = useState<Map<string, OptionSelection>>(
    () => new Map(),
  );

  useEffect(() => {
    setSelections((previous) => {
      if (previous.size === 0) return previous;

      const availableIds = new Set(options.map((option) => option.id));
      const next = new Map<string, OptionSelection>();

      previous.forEach((selection, optionId) => {
        if (availableIds.has(optionId)) {
          next.set(optionId, selection);
        }
      });

      return next;
    });
  }, [options]);

  const updateSelection = useCallback(
    (
      optionId: string,
      updater: (previous: OptionSelection) => Partial<OptionSelection>,
    ) => {
      setSelections((previous) => {
        const next = new Map(previous);
        const current =
          next.get(optionId) ?? defaultSelection(optionId, booking.nights);
        const updated = { ...current, ...updater(current) };
        const option = optionMap.get(optionId);
        updated.subtotal = option ? calcSubtotal(option, updated) : 0;
        next.set(optionId, updated);
        return next;
      });
    },
    [booking.nights, optionMap],
  );

  const handleQuantityChange = useCallback(
    (optionId: string, quantity: number) => {
      updateSelection(optionId, (previous) => ({
        quantity,
        days: quantity === 0 ? booking.nights : previous.days,
      }));
    },
    [booking.nights, updateSelection],
  );

  const handleDaysChange = useCallback(
    (optionId: string, days: number) => {
      updateSelection(optionId, () => ({ days }));
    },
    [updateSelection],
  );

  const handlePeopleChange = useCallback(
    (optionId: string, people: number) => {
      updateSelection(optionId, () => ({ people }));
    },
    [updateSelection],
  );

  const activeSelections = useMemo(
    () =>
      Array.from(selections.values()).filter(
        (selection) => selection.subtotal > 0,
      ),
    [selections],
  );

  const totalAmount = useMemo(
    () =>
      activeSelections.reduce((sum, selection) => sum + selection.subtotal, 0),
    [activeSelections],
  );

  const buildPayload = (): OptionsPayload => ({
    booking,
    selectedOptions: activeSelections,
    optionsTotalAmount: totalAmount,
  });

  const handleNext = () => {
    const payload = buildPayload();
    sessionStorage.setItem(STORAGE_KEY_OPTIONS_PAYLOAD, JSON.stringify(payload));

    const rentals = activeSelections
      .filter(
        (selection) => optionMap.get(selection.optionId)?.category === "rental",
      )
      .map((selection) => ({
        optionId: selection.optionId,
        quantity: selection.quantity,
        days: selection.days,
        subtotal: selection.subtotal,
      }));

    const events = activeSelections
      .filter(
        (selection) => optionMap.get(selection.optionId)?.category === "event",
      )
      .map((selection) => ({
        optionId: selection.optionId,
        people: selection.people,
        subtotal: selection.subtotal,
      }));

    setOptions({ rentals, events });
    router.push("/booking/user-info");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-amber-50/30">
      <div className="mx-auto max-w-lg px-4 py-6 pb-56">
        <div className="mb-4 text-center">
          <p className="mb-1 text-xs tracking-wide text-gray-400">STEP 3 / 4</p>
          <h1 className="text-xl font-bold text-gray-800">オプションを選ぶ</h1>
          <p className="mt-1 text-sm text-gray-500">
            選択中のプランに適用されているオプションのみ表示しています。
          </p>
        </div>

        <BookingSummaryBar booking={booking} />

        <section className="mb-8">
          <div className="mb-3">
            <h2 className="text-base font-bold text-gray-800">
              レンタルオプション
            </h2>
          </div>
          {rentalOptions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white/80 px-4 py-5 text-sm text-gray-500">
              このプランで選択できるレンタルオプションはありません。
            </div>
          ) : (
            <div className="space-y-3">
              {rentalOptions.map((option) => (
                <RentalOptionCard
                  key={option.id}
                  option={option}
                  selection={selections.get(option.id)}
                  nights={booking.nights}
                  onChangeQuantity={handleQuantityChange}
                  onChangeDays={handleDaysChange}
                />
              ))}
            </div>
          )}
        </section>

        <section className="mb-8">
          <div className="mb-3">
            <h2 className="text-base font-bold text-gray-800">
              イベントオプション
            </h2>
          </div>
          {eventOptions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white/80 px-4 py-5 text-sm text-gray-500">
              このプランで選択できるイベントオプションはありません。
            </div>
          ) : (
            <div className="space-y-3">
              {eventOptions.map((option) => (
                <EventOptionCard
                  key={option.id}
                  option={option}
                  selection={selections.get(option.id)}
                  onChangePeople={handlePeopleChange}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white/95 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur">
        <div className="mx-auto max-w-lg px-4 py-3">
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
            <p className="mb-3 text-center text-sm text-gray-400">
              オプションなしでも次へ進めます。
            </p>
          )}

          <div className="flex gap-3">
            <Link
              href="/booking/sites"
              className="flex-1 rounded-xl border border-gray-300 py-3 text-center text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              戻る
            </Link>
            <button
              type="button"
              onClick={handleNext}
              className="flex-[2] rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
            >
              次へ: お客様情報
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
