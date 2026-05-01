'use client';

import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface PaymentFormProps {
  reservationId: string;
  amount: number;
  onSuccess: (reservationId: string) => void;
  onCancel: () => void;
}

function PaymentForm({ reservationId, amount, onSuccess, onCancel }: PaymentFormProps) {
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
      const { error: stripeError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/booking/confirmation?id=${reservationId}`,
        },
        redirect: 'if_required',
      });

      if (stripeError) {
        setError(stripeError.message || '決済に失敗しました');
        return;
      }

      onSuccess(reservationId);
    } catch (err) {
      setError('決済処理に失敗しました');
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
  reservationId: string;
  amount?: number;
  onSuccess: (reservationId: string) => void;
  onCancel: () => void;
}

export default function StripePayment({ reservationId, amount, onSuccess, onCancel }: StripePaymentProps) {
  const [paymentIntent, setPaymentIntent] = useState<{ reservationId: string; clientSecret: string; amount: number } | null>(null);
  const [loadError, setLoadError] = useState<{ reservationId: string; message: string } | null>(null);

  useEffect(() => {
    if (!reservationId) return;
    let ignore = false;

    fetch('/api/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservationId }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error ?? '決済情報の作成に失敗しました');
        }
        if (!ignore) {
          setPaymentIntent({
            reservationId,
            clientSecret: data.clientSecret,
            amount: Number(data.amount ?? amount ?? 0),
          });
        }
      })
      .catch((err) => {
        if (!ignore) {
          setLoadError({
            reservationId,
            message: err instanceof Error ? err.message : '決済情報の作成に失敗しました',
          });
        }
      });

    return () => {
      ignore = true;
    };
  }, [amount, reservationId]);

  if (loadError?.reservationId === reservationId) {
    return <div className="text-red-600 text-sm">{loadError.message}</div>;
  }

  if (paymentIntent?.reservationId !== reservationId) {
    return <div>決済情報を読み込み中...</div>;
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret: paymentIntent.clientSecret }}>
      <PaymentForm reservationId={reservationId} amount={paymentIntent.amount} onSuccess={onSuccess} onCancel={onCancel} />
    </Elements>
  );
}