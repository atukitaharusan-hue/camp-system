'use client';

type ReservationCardProps = {
  title: string;
  lines: string[];
  statusLabel?: string;
  onClick?: () => void;
};

export default function ReservationCard({
  title,
  lines,
  statusLabel,
  onClick,
}: ReservationCardProps) {
  const className =
    'w-full rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:shadow-md';

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.95em] font-extrabold leading-tight text-slate-900">{title}</p>
        {statusLabel ? (
          <span className="whitespace-nowrap rounded-full bg-slate-100 px-3 py-2 text-[0.68em] font-bold text-slate-700">
            {statusLabel}
          </span>
        ) : null}
      </div>
      <div className="mt-3 space-y-2 text-[0.82em] leading-relaxed text-slate-600">
        {lines.map((line, index) => (
          <p key={`${title}-${index}`}>{line}</p>
        ))}
      </div>
    </>
  );

  if (!onClick) {
    return <article className={className}>{content}</article>;
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      {content}
    </button>
  );
}
