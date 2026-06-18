import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRequest } from '@/lib/admin/requestAuth';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { logAdminActionServer } from '@/lib/admin/actionLogServer';
import { createAdminReservationInDatabase } from '@/lib/admin/createAdminReservation';
import {
  notifyReservationCancelledServer,
  notifyReservationCreatedServer,
  notifyReservationUpdatedServer,
} from '@/lib/admin/notificationLogServer';
import {
  cancelReservationInDatabase,
  promoteWaitlistReservationInDatabase,
  type ReservationDetailUpdateInput,
  type UpdateReservationInput,
  updateReservationDetailInDatabase,
  updateReservationInDatabase,
} from '@/lib/admin/updateReservation';
import { getMyPageLinkStatusMap } from '@/lib/mypageReservationLinks';
import { recalculateReservationsPricingInDatabase } from '@/lib/admin/recalculateReservationPricing';
import type { AdminReservationInput } from '@/lib/admin/createAdminReservation';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminRequest(request);
  if (authError) return authError;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = typeof body?.action === 'string' ? body.action : '';
  const supabase = getSupabaseAdminClient();

  try {
    if (action === 'create') {
      if (!body?.input || typeof body.input !== 'object') {
        return jsonError('予約作成に必要な情報が不足しています。');
      }

      const result = await createAdminReservationInDatabase(supabase, body.input as AdminReservationInput, {
        logAdminAction: logAdminActionServer,
        notifyReservationCreated: notifyReservationCreatedServer,
      });
      return NextResponse.json(result);
    }

    if (action === 'update') {
      const id = typeof body?.id === 'string' ? body.id : '';
      const adminEmail = typeof body?.adminEmail === 'string' ? body.adminEmail : 'admin';
      if (!id || !body?.input || typeof body.input !== 'object') {
        return jsonError('予約更新に必要な情報が不足しています。');
      }

      const result = await updateReservationInDatabase(supabase, id, body.input as UpdateReservationInput, adminEmail, {
        logAdminAction: logAdminActionServer,
        notifyReservationUpdated: notifyReservationUpdatedServer,
      });
      return NextResponse.json(result);
    }

    if (action === 'detail-update') {
      const id = typeof body?.id === 'string' ? body.id : '';
      const adminEmail = typeof body?.adminEmail === 'string' ? body.adminEmail : 'admin';
      if (!id || !body?.input || typeof body.input !== 'object') {
        return jsonError('予約詳細更新に必要な情報が不足しています。');
      }

      const detailInput = { ...(body.input as ReservationDetailUpdateInput) };
      if (typeof detailInput.userName === 'string' && detailInput.userName.trim()) {
        const { data: reservation, error: reservationError } = await supabase
          .from('guest_reservations')
          .select('id, user_identifier')
          .eq('id', id)
          .maybeSingle();

        if (reservationError) {
          return jsonError(reservationError.message, 500);
        }

        if (reservation) {
          const linkStatusMap = await getMyPageLinkStatusMap([
            {
              id: reservation.id,
              userIdentifier: reservation.user_identifier,
            },
          ]);

          if ((linkStatusMap[reservation.id]?.status ?? 'unlinked') !== 'unlinked') {
            delete detailInput.userName;
          }
        }
      }

      const result = await updateReservationDetailInDatabase(
        supabase,
        id,
        detailInput,
        adminEmail,
        {
          logAdminAction: logAdminActionServer,
          notifyReservationUpdated: notifyReservationUpdatedServer,
        },
      );
      return NextResponse.json(result);
    }

    if (action === 'cancel') {
      const id = typeof body?.id === 'string' ? body.id : '';
      const adminEmail = typeof body?.adminEmail === 'string' ? body.adminEmail : 'admin';
      if (!id) return jsonError('キャンセル対象の予約IDが不足しています。');

      const result = await cancelReservationInDatabase(supabase, id, adminEmail, {
        logAdminAction: logAdminActionServer,
        notifyReservationCancelled: notifyReservationCancelledServer,
      });
      return NextResponse.json(result);
    }

    if (action === 'promote') {
      const id = typeof body?.id === 'string' ? body.id : '';
      const adminEmail = typeof body?.adminEmail === 'string' ? body.adminEmail : 'admin';
      if (!id) return jsonError('繰り上げ対象の予約IDが不足しています。');

      const result = await promoteWaitlistReservationInDatabase(supabase, id, adminEmail, {
        logAdminAction: logAdminActionServer,
        notifyReservationUpdated: notifyReservationUpdatedServer,
      });
      return NextResponse.json(result);
    }

    if (action === 'recalculatePricing') {
      const reservations = Array.isArray(body?.reservations) ? body.reservations : [];
      const results = await recalculateReservationsPricingInDatabase(supabase, reservations);
      return NextResponse.json({ results });
    }

    if (action === 'checkIn') {
      const id = typeof body?.id === 'string' ? body.id : '';
      if (!id) return jsonError('チェックイン対象の予約IDが不足しています。');

      const checkedInAt = new Date().toISOString();
      const { data, error } = await supabase
        .from('guest_reservations')
        .update({ status: 'checked_in', checked_in_at: checkedInAt, updated_at: checkedInAt })
        .eq('id', id)
        .not('status', 'in', '(cancelled,waitlisted)')
        .select('*')
        .single();

      if (error) return jsonError(error.message, 500);
      return NextResponse.json({ success: true, reservation: data });
    }

    return jsonError('未対応の予約操作です。');
  } catch (error) {
    const message = error instanceof Error ? error.message : '予約操作に失敗しました。';
    return jsonError(message, 500);
  }
}
