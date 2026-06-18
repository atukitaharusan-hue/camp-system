'use client';

type SiteCardProps = {
  title: string;
  subtitle?: string;
  statusText?: string;
  accent?: 'blue' | 'green' | 'amber' | 'red';
  onClick?: () => void;
};

const ACCENT_CLASS: Record<NonNullable<SiteCardProps['accent']>, string> = {
  blue: 'border-blue-200 bg-blue-50 text-blue-900',
  green: 'border-green-200 bg-green-50 text-green-900',
  amber: 'border-amber-200 bg-amber-50 text-amber-900',
  red: 'border-red-200 bg-red-50 text-red-900',
};

export default function SiteCard({
  title,
  subtitle,
  statusText,
  accent = 'blue',
  onClick,
}: SiteCardProps) {
  const className = `rounded-3xl border p-5 text-left shadow-sm transition ${
    ACCENT_CLASS[accent]
  } ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`;

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.95em] font-extrabold leading-tight">{title}</p>
          {subtitle ? <p className="mt-2 text-[0.84em] leading-relaxed opacity-80">{subtitle}</p> : null}
        </div>
        {statusText ? (
          <span className="rounded-full bg-white/80 px-3 py-2 text-[0.7em] font-bold leading-none">
            {statusText}
          </span>
        ) : null}
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
