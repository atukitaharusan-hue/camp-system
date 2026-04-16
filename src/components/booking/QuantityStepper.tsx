"use client";

interface Props {
  label: string;
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
}

export default function QuantityStepper({
  label,
  value,
  min = 0,
  max,
  onChange,
}: Props) {
  const decrement = () => {
    if (value > min) onChange(value - 1);
  };
  const increment = () => {
    if (value < max) onChange(value + 1);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 min-w-[2rem]">{label}</span>
      <button
        type="button"
        onClick={decrement}
        disabled={value <= min}
        className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors text-lg font-medium"
        aria-label={`${label}を減らす`}
      >
        −
      </button>
      <span className="w-8 text-center font-semibold text-gray-800 tabular-nums">
        {value}
      </span>
      <button
        type="button"
        onClick={increment}
        disabled={value >= max}
        className="w-8 h-8 rounded-full border border-emerald-400 bg-emerald-50 flex items-center justify-center text-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-emerald-100 transition-colors text-lg font-medium"
        aria-label={`${label}を増やす`}
      >
        +
      </button>
    </div>
  );
}
