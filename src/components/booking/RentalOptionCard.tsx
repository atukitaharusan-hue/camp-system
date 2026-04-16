"use client";

import Image from "next/image";
import { OptionItem, OptionSelection } from "@/types/options";
import QuantityStepper from "./QuantityStepper";

interface Props {
  option: OptionItem;
  selection: OptionSelection | undefined;
  nights: number;
  onChangeQuantity: (optionId: string, quantity: number) => void;
  onChangeDays: (optionId: string, days: number) => void;
}

function priceLabel(option: OptionItem): string {
  switch (option.priceType) {
    case "per_unit":
      return `¥${option.price.toLocaleString()} / ${option.unitLabel}`;
    case "per_day":
      return `¥${option.price.toLocaleString()} / ${option.unitLabel}・日`;
    case "fixed":
      return `¥${option.price.toLocaleString()}`;
    default:
      return `¥${option.price.toLocaleString()}`;
  }
}

function OptionImage({ src, alt }: { src?: string; alt: string }) {
  if (src) {
    return (
      <Image
        src={src}
        alt={alt}
        width={400}
        height={200}
        className="object-cover w-full h-full rounded-xl"
      />
    );
  }
  return (
    <div className="w-full h-full rounded-xl bg-gray-100 flex items-center justify-center">
      <span className="text-xs text-gray-400">画像準備中</span>
    </div>
  );
}

export default function RentalOptionCard({
  option,
  selection,
  nights,
  onChangeQuantity,
  onChangeDays,
}: Props) {
  const qty = selection?.quantity ?? 0;
  const days = selection?.days ?? nights;
  const isSelected = qty > 0;
  const subtotal = selection?.subtotal ?? 0;

  const showDaysSelector = option.priceType === "per_day" && qty > 0;

  return (
    <div
      className={`rounded-xl border-2 overflow-hidden transition-all duration-200 ${
        isSelected
          ? "border-emerald-400 bg-emerald-50/50 shadow-sm"
          : "border-gray-100 bg-white hover:border-gray-200"
      }`}
    >
      {/* モバイル: 縦並び / md以上: 横並び */}
      <div className="flex flex-col md:flex-row">
        {/* 写真エリア */}
        <div className="relative w-full md:w-36 h-36 md:h-auto shrink-0 p-2 md:p-2">
          <OptionImage src={option.imageUrl} alt={option.name} />
        </div>

        {/* 情報エリア */}
        <div className="flex-1 min-w-0 p-4 pt-2 md:pt-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-gray-800 text-base">{option.name}</h4>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                {option.description}
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-emerald-700 font-bold text-base">
                {priceLabel(option)}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <QuantityStepper
                label="数量"
                value={qty}
                max={option.maxQuantity}
                onChange={(v) => onChangeQuantity(option.id, v)}
              />
              {showDaysSelector && (
                <QuantityStepper
                  label="日数"
                  value={days}
                  min={1}
                  max={nights}
                  onChange={(v) => onChangeDays(option.id, v)}
                />
              )}
            </div>

            {isSelected && (
              <div className="text-sm font-semibold text-emerald-700 bg-emerald-100 rounded-lg px-3 py-1">
                小計 ¥{subtotal.toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
