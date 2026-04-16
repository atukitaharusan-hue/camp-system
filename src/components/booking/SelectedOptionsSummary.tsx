"use client";

import { OptionItem, OptionSelection } from "@/types/options";

interface Props {
  selections: OptionSelection[];
  options: OptionItem[];
  totalAmount: number;
}

export default function SelectedOptionsSummary({
  selections,
  options,
  totalAmount,
}: Props) {
  const activeSelections = selections.filter((s) => s.subtotal > 0);
  const optionMap = new Map(options.map((o) => [o.id, o]));

  if (activeSelections.length === 0) {
    return (
      <div className="text-center py-4 text-gray-400 text-sm">
        オプションが選択されていません
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {activeSelections.map((sel) => {
        const opt = optionMap.get(sel.optionId);
        if (!opt) return null;

        let detail = "";
        if (opt.category === "rental") {
          if (opt.priceType === "per_day") {
            detail = `${sel.quantity}${opt.unitLabel} × ${sel.days}日`;
          } else {
            detail = `${sel.quantity}${opt.unitLabel}`;
          }
        } else {
          detail = `${sel.people}${opt.unitLabel}`;
        }

        return (
          <div
            key={sel.optionId}
            className="flex items-center justify-between text-sm"
          >
            <div className="flex-1 min-w-0">
              <span className="text-gray-700 font-medium">{opt.name}</span>
              <span className="text-gray-400 ml-2">{detail}</span>
            </div>
            <span className="font-semibold text-gray-800 shrink-0 ml-2">
              ¥{sel.subtotal.toLocaleString()}
            </span>
          </div>
        );
      })}

      <div className="border-t border-gray-200 pt-2 mt-2 flex items-center justify-between">
        <span className="font-bold text-gray-800">オプション合計</span>
        <span className="font-bold text-lg text-emerald-700">
          ¥{totalAmount.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
