'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fetchReservationByIdAdmin } from '@/lib/admin/fetchReservations';
import { updateReservation } from '@/lib/admin/updateReservation';
import { dummySites } from '@/data/adminDummyData';
import { generateReceptionCode } from '@/types/reservation';
import type { Database } from '@/types/database';

type GuestReservationRow = Database['public']['Tables']['guest_reservations']['Row'];
type PaymentMethod = Database['public']['Enums']['payment_method'];
type PaymentStatus = Database['public']['Enums']['payment_status'];

export default function EditReservationPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [reservation, setReservation] = useState<GuestReservationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // フォーム state
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [pets, setPets] = useState(0);
  const [cars, setCars] = useState(0);
  const [siteNumber, setSiteNumber] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('pending');
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    async function load() {
      const result = await fetchReservationByIdAdmin(id);
      if (result.error || !result.data) {
        setError(result.error ?? '予約が見つかりません');
        setLoading(false);
        return;
      }
      const r = result.data;
      setReservation(r);
      setCheckInDate(r.check_in_date);
      setCheckOutDate(r.check_out_date);
      setAdults(r.adults ?? r.guests ?? 1);
      setChildren(r.children ?? 0);
      setInfants(r.infants ?? 0);
      setPets(r.pets ?? 0);
      setCars(r.cars ?? 0);
      setSiteNumber(r.site_number ?? '');
      setSpecialRequests(r.special_requests ?? '');
      setPaymentMethod(r.payment_method ?? 'cash');
      setPaymentStatus(r.payment_status ?? 'pending');
      setTotalAmount(Number(r.total_amount));
      setLoading(false);
    }
    load();
  }, [id]);

  const handleSubmit = useCallback(async () => {
    setError(null);
    setSuccess(false);
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    const adminEmail = user?.email ?? '不明';

    const result = await updateReservation(
      id,
      {
        checkInDate,
        checkOutDate,
        guests: adults + children + infants,
        adults,
        children,
        infants,
        pets,
        cars,
        siteNumber,
        specialRequests,
        paymentMethod,
        paymentStatus,
        totalAmount,
      },
      adminEmail,
    );

    if (!result.success) {
      setError(result.error);
      setSaving(false);
      return;
    }

    setSuccess(true);
    setSaving(false);
    setTimeout(() => router.push(`/admin/reservations/${id}`), 1200);
  }, [id, checkInDate, checkOutDate, adults, children, infants, pets, cars, siteNumber, specialRequests, paymentMethod, paymentStatus, totalAmount, router]);

  if (loading) {
    return <div className="max-w-3xl p-4 text-sm text-gray-400">読み込み中...</div>;
  }

  if (!reservation) {
    return (
      <div className="max-w-3xl">
        <Link href="/admin/reservations" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
          &larr; 予約一覧に戻る
        </Link>
        <div className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-700">
          {error ?? '予約が見つかりません'}
        </div>
      </div>
    );
  }

  const r = reservation;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-4">
        <Link href={`/admin/reservations/${id}`} className="text-sm text-blue-600 hover:underline">
          &larr; 詳細に戻る
        </Link>
        <h1 className="text-xl font-bold text-gray-900">
          予約編集: {generateReceptionCode(r.id)}
        </h1>
      </div>

      {/* 予約者情報（読み取り専用） */}
      <div className="bg-gray-50 border border-gray-200 rounded p-4 mb-4">
        <h2 className="text-sm font-medium text-gray-700 mb-2">予約者情報（変更不可）</h2>
        <div className="text-sm text-gray-600 space-y-1">
          <p>予約者名: {r.user_name}</p>
          <p>メール: {r.user_email ?? '未設定'}</p>
          <p>電話: {r.user_phone ?? '未設定'}</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 whitespace-pre-wrap">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
          予約を更新しました。詳細画面に戻ります...
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded p-5 space-y-4">
        {/* 宿泊情報 */}
        <h2 className="text-sm font-semibold text-gray-800 border-b border-gray-100 pb-2">宿泊情報</h2>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="チェックイン日">
            <input
              type="date"
              value={checkInDate}
              onChange={(e) => setCheckInDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </FormField>
          <FormField label="チェックアウト日">
            <input
              type="date"
              value={checkOutDate}
              onChange={(e) => setCheckOutDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="大人人数">
            <input
              type="number"
              min={1}
              value={adults}
              onChange={(e) => setAdults(Number(e.target.value))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </FormField>
          <FormField label="子供人数">
            <input
              type="number"
              min={0}
              value={children}
              onChange={(e) => setChildren(Number(e.target.value))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField label="幼児人数">
            <input
              type="number"
              min={0}
              value={infants}
              onChange={(e) => setInfants(Number(e.target.value))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </FormField>
          <FormField label="ペット数">
            <input
              type="number"
              min={0}
              value={pets}
              onChange={(e) => setPets(Number(e.target.value))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </FormField>
          <FormField label="車台数">
            <input
              type="number"
              min={0}
              value={cars}
              onChange={(e) => setCars(Number(e.target.value))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="サイト番号">
            <select
              value={siteNumber}
              onChange={(e) => setSiteNumber(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="">選択してください</option>
              {dummySites.map((s) => (
                <option key={s.siteNumber} value={s.siteNumber}>
                  {s.siteNumber} - {s.siteName} (定員{s.capacity}名)
                </option>
              ))}
            </select>
          </FormField>
        </div>

        {/* 決済情報 */}
        <h2 className="text-sm font-semibold text-gray-800 border-b border-gray-100 pb-2 pt-2">決済情報</h2>

        <div className="grid grid-cols-3 gap-4">
          <FormField label="合計金額">
            <input
              type="number"
              min={0}
              value={totalAmount}
              onChange={(e) => setTotalAmount(Number(e.target.value))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </FormField>
          <FormField label="支払い方法">
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="credit_card">クレジットカード</option>
              <option value="cash">現地払い</option>
              <option value="bank_transfer">銀行振込</option>
            </select>
          </FormField>
          <FormField label="決済ステータス">
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="pending">決済待ち</option>
              <option value="paid">決済済み</option>
              <option value="refunded">返金済み</option>
              <option value="failed">決済失敗</option>
            </select>
          </FormField>
        </div>

        {/* 備考 */}
        <FormField label="備考">
          <textarea
            value={specialRequests}
            onChange={(e) => setSpecialRequests(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </FormField>

        {/* アクション */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded hover:bg-gray-800 disabled:opacity-40"
          >
            {saving ? '保存中...' : '変更を保存'}
          </button>
          <Link
            href={`/admin/reservations/${id}`}
            className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            キャンセル
          </Link>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
