'use client';

import { useEffect, useMemo, useState } from 'react';
import ReservationCard from '@/components/easy-mode/shared/ReservationCard';
import { fetchReservations } from '@/lib/admin/fetchReservations';
import { fetchPlans } from '@/lib/admin/fetchData';
import { toCustomReservationsConfig, todayIsoJst } from '@/lib/easyMode';
import type { Database } from '@/types/database';
import type { EasyModeCategorySetting } from '@/types/admin';

type ReservationRow = Database['public']['Tables']['guest_reservations']['Row'];

function statusLabel(status: ReservationRow['status']) {
  switch (status) {
    case 'confirmed':
      return '予約確定';
    case 'checked_in':
      return 'チェックイン済み';
    case 'completed':
      return '完了';
    case 'cancelled':
      return 'キャンセル';
    default:
      return status === 'pending' ? '未到着' : '予約中';
  }
}

export default function CustomReservationsCategory({
  category,
  onOpenReservation,
}: {
  category: EasyModeCategorySetting;
  onOpenReservation?: (reservationId: string) => void;
}) {
  const config = toCustomReservationsConfig(category.config);
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [planNames, setPlanNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    Promise.all([fetchReservations(), fetchPlans()]).then(([result, plans]) => {
      if (!mounted) return;
      setReservations(result.data);
      setPlanNames(Object.fromEntries(plans.map((plan) => [plan.id, plan.name])));
    });
    return () => {
      mounted = false;
    };
  }, []);

  const filteredReservations = useMemo(() => {
    const targetDate = config.date === 'today' ? todayIsoJst() : config.date === 'tomorrow' ? todayIsoJst(1) : null;

    return reservations.filter((reservation) => {
      if (targetDate && reservation.check_in_date !== targetDate) return false;
      switch (config.filter) {
        case 'arrived_pending':
          return reservation.status === 'confirmed';
        case 'not_arrived':
          return reservation.status === 'pending';
        case 'checked_in':
          return reservation.status === 'checked_in';
        case 'needs_attention':
          return Boolean(reservation.special_requests) || reservation.status === 'pending';
        default:
          return true;
      }
    });
  }, [config.date, config.filter, reservations]);

  return (
    <section className="easy-mode-panel-card">
      <div className="space-y-4">
        <p className="text-[1.05em] font-extrabold text-slate-900">{category.name}</p>
        {filteredReservations.length === 0 ? (
          <p className="rounded-3xl bg-slate-50 px-5 py-6 text-[0.9em] text-slate-500">
            条件に合う予約はありません。
          </p>
        ) : (
          <div className="space-y-4">
            {filteredReservations.map((reservation) => (
              <ReservationCard
                key={reservation.id}
                title={`${reservation.user_name || '予約者'} 様`}
                statusLabel={statusLabel(reservation.status)}
                lines={[
                  `${reservation.check_in_date} 〜 ${reservation.check_out_date}`,
                  `プラン: ${reservation.plan_id ? planNames[reservation.plan_id] ?? '未設定' : '未設定'}`,
                  `サイト: ${reservation.site_number ?? '指定なし'}`,
                ]}
                onClick={onOpenReservation ? () => onOpenReservation(reservation.id) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
