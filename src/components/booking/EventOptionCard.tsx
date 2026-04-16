"use client";

import { OptionItem, OptionSelection } from "@/types/options";
import QuantityStepper from "./QuantityStepper";

interface Props {
  option: OptionItem;
  selection: OptionSelection | undefined;
  onChangePeople: (optionId: string, people: number) => void;
}

function formatEventDate(dateStr?: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${m}/${day} ${h}:${min}〜`;
}

export default function EventOptionCard({
  option,
  selection,
  onChangePeople,
}: Props) {
  const people = selection?.people ?? 0;
  const isSelected = people > 0;
  const subtotal = selection?.subtotal ?? 0;

  const remaining =
    option.capacity && option.currentParticipants != null
      ? option.capacity - option.currentParticipants
      : undefined;

  const effectiveMax =
    remaining !== undefined
      ? Math.min(option.maxQuantity, remaining)
      : option.maxQuantity;

  return (
    <div
      className={`rounded-xl border-2 p-4 transition-all duration-200 ${
        isSelected
          ? "border-amber-400 bg-amber-50/50 shadow-sm"
          : "border-gray-100 bg-white hover:border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-800 text-base">{option.name}</h4>
          <p className="text-sm text-gray-500 mt-1 leading-relaxed">
            {option.description}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-amber-700 font-bold text-base">
            ¥{option.price.toLocaleString()} / {option.unitLabel}
          </div>
        </div>
      </div>

      {/* イベント詳細情報 */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
        {option.eventDate && (
          <span className="flex items-center gap-1">
            <span className="text-gray-400">日時:</span> {formatEventDate(option.eventDate)}
          </span>
        )}
        {option.duration && (
          <span className="flex items-center gap-1">
            <span className="text-gray-400">時間:</span> {option.duration}
          </span>
        )}
        {option.location && (
          <span className="flex items-center gap-1">
            <span className="text-gray-400">場所:</span> {option.location}
          </span>
        )}
        {remaining !== undefined && (
          <span
            className={`flex items-center gap-1 font-medium ${
              remaining <= 3 ? "text-red-500" : "text-gray-500"
            }`}
          >
            残り{remaining}名
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <QuantityStepper
          label="人数"
          value={people}
          max={effectiveMax}
          onChange={(v) => onChangePeople(option.id, v)}
        />

        {isSelected && (
          <div className="text-sm font-semibold text-amber-700 bg-amber-100 rounded-lg px-3 py-1">
            小計 ¥{subtotal.toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}
