'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import QRCodeDisplay from '@/components/QRCodeDisplay';
import { supabase } from '@/lib/supabase';

export default function CheckInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">読み込み中...</div>}>
      <CheckInContent />
    </Suspense>
  );
}

function CheckInContent() {
  const searchParams = useSearchParams();
  const reservationId = searchParams.get('id');
  const [reservation, setReservation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (reservationId) {
      fetchReservation();
    }
  }, [reservationId]);

  const fetchReservation = async () => {
    if (!reservationId) return;
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', reservationId)
      .single();

    if (error) {
      console.error('Error fetching reservation:', error);
    } else {
      setReservation(data);
    }
    setLoading(false);
  };

  if (loading) return <div>読み込み中...</div>;
  if (!reservation) return <div>予約が見つかりません</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-4">チェックイン</h1>
        <p className="mb-4">このQRコードをチェックイン端末にかざしてください</p>
        <QRCodeDisplay value={reservationId!} size={200} />
        <div className="mt-4 text-sm text-gray-600">
          <p>予約ID: {reservationId}</p>
          <p>チェックイン日: {new Date(reservation.check_in_date).toLocaleDateString('ja-JP')}</p>
        </div>
      </div>
    </div>
  );
}