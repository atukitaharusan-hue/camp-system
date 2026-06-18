'use client';

type MemoCardProps = {
  title: string;
  fromName: string;
  toName: string;
  statusLabel: string;
  dueText?: string;
  dimmed?: boolean;
  onClick?: () => void;
};

export default function MemoCard({
  title,
  fromName,
  toName,
  statusLabel,
  dueText,
  dimmed = false,
  onClick,
}: MemoCardProps) {
  const className =
    `w-full rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-left shadow-sm transition hover:shadow-md ${
      dimmed ? 'opacity-60' : ''
    }`;

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.95em] font-extrabold leading-tight text-emerald-950">{title}</p>
        <span className="whitespace-nowrap rounded-full bg-white/80 px-3 py-2 text-[0.68em] font-bold text-emerald-900">
          {statusLabel}
        </span>
      </div>
      <div className="mt-3 space-y-2 text-[0.82em] leading-relaxed text-emerald-900/85">
        <p>依頼した人: {fromName}</p>
        <p>対応する人: {toName}</p>
        {dueText ? <p>期限: {dueText}</p> : null}
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
