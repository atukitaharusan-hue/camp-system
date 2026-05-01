import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { normalizeStripeJpyAmount } from '@/lib/pricing';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

type PaymentIntentRequestBody = {
  reservationId?: unknown;
  idempotencyKey?: unknown;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as PaymentIntentRequestBody;
    const reservationId = typeof body.reservationId === 'string' ? body.reservationId.trim() : '';

    if (!reservationId) {
      return jsonError('reservationId is required', 400);
    }

    const supabase = getSupabaseAdminClient();
    const { data: reservation, error } = await supabase
      .from('guest_reservations')
      .select('id,total_amount,payment_status,status')
      .eq('id', reservationId)
      .maybeSingle();

    if (error) {
      console.error('[create-payment-intent] Supabase error:', error);
      return jsonError('Reservation lookup failed', 500);
    }

    if (!reservation) {
      return jsonError('Reservation not found', 404);
    }

    if (reservation.payment_status === 'paid') {
      return jsonError('Reservation is already paid', 409);
    }

    if (reservation.status === 'cancelled') {
      return jsonError('Cancelled reservations cannot be paid', 409);
    }

    const amount = normalizeStripeJpyAmount(Number(reservation.total_amount));
    if (amount === null) {
      return jsonError('Reservation amount is not payable', 400);
    }

    const clientIdempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
    const idempotencyKey = clientIdempotencyKey || `guest-reservation:${reservation.id}:payment-intent:${amount}`;

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'jpy',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        reservation_id: reservation.id,
        reservation_table: 'guest_reservations',
      },
    }, { idempotencyKey });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret, amount });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return NextResponse.json(
      { error: 'Payment intent creation failed' },
      { status: 500 }
    );
  }
}