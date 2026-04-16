import type { Database } from '@/types/database';

type ReservationStatus = Database['public']['Enums']['reservation_status'];

interface ReservationStatusBadgeProps {
  status: ReservationStatus;
  checkedInAt?: string | null;
}

const statusConfig: Record<
  ReservationStatus,
  { label: string; bg: string; text: string }
> = {
  pending: {
    label: '確認待ち',
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
  },
  confirmed: {
    label: '予約確定',
    bg: 'bg-green-100',
    text: 'text-green-800',
  },
  checked_in: {
    label: 'チェックイン済み',
    bg: 'bg-blue-100',
    text: 'text-blue-800',
  },
  completed: {
    label: 'ご利用済み',
    bg: 'bg-gray-100',
    text: 'text-gray-600',
  },
  cancelled: {
    label: 'キャンセル済み',
    bg: 'bg-red-100',
    text: 'text-red-800',
  },
};

export default function ReservationStatusBadge({
  status,
  checkedInAt,
}: ReservationStatusBadgeProps) {
  const config = statusConfig[status];

  // confirmed でも checkedInAt がある場合はチェックイン済みとして表示
  const displayConfig =
    status === 'confirmed' && checkedInAt ? statusConfig.checked_in : config;

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${displayConfig.bg} ${displayConfig.text}`}
    >
      {displayConfig.label}
    </span>
  );
}
