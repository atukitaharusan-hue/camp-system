'use client';

import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { supabase } from '@/lib/supabase';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface PaymentFormProps {
  amount: number;
  onSuccess: (reservationId: string) => void;
  onCancel: () => void;
}

function PaymentForm({ amount, onSuccess, onCancel }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    try {
      // 予約を作成
      const { data: reservation, error: reservationError } = await supabase
        .from('reservations')
        .insert({
          user_id: 'temp-user', // LIFFユーザーIDに置き換え
          site_id: 'site-1', // 選択されたサイト
          check_in_date: '2024-01-01', // 選択された日付
          check_out_date: '2024-01-02',
          total_guests: 2, // 選択された人数
          total_amount: amount,
          status: 'pending'
        })
        .select()
        .single();

      if (reservationError) throw reservationError;

      // Stripe決済
      const { error: stripeError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/booking/confirmation?id=${reservation.id}`,
        },
      });

      if (stripeError) {
        setError(stripeError.message || '決済に失敗しました');
      }
    } catch (err) {
      setError('予約作成に失敗しました');
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <div className="text-red-600 text-sm">{error}</div>
      )}
      <div className="flex gap-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={!stripe || processing}
          className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-2 px-4 rounded"
        >
          {processing ? '処理中...' : `¥${amount.toLocaleString()} 決済`}
        </button>
      </div>
    </form>
  );
}

interface StripePaymentProps {
  amount: number;
  onSuccess: (reservationId: string) => void;
  onCancel: () => void;
}

export default function StripePayment({ amount, onSuccess, onCancel }: StripePaymentProps) {
  const [clientSecret, setClientSecret] = useState('');

  useEffect(() => {
    // サーバーサイドでPaymentIntentを作成
    fetch('/api/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    })
      .then((res) => res.json())
      .then((data) => setClientSecret(data.clientSecret));
  }, [amount]);

  if (!clientSecret) {
    return <div>決済情報を読み込み中...</div>;
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <PaymentForm amount={amount} onSuccess={onSuccess} onCancel={onCancel} />
    </Elements>
  );
}