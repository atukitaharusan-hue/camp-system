'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { dummyPlans } from '@/data/adminDummyData';
import { siteDetails } from '@/data/sitesDummyData';
import {
  createAdminReservation,
  validateAdminReservation,
  type AdminReservationInput,
} from '@/lib/admin/createAdminReservation';
import type { Database } from '@/types/database';

type PaymentMethod = Database['public']['Enums']['payment_method'];
type PaymentStatus = Database['public']['Enums']['payment_status'];

type CustomerProfile = Pick<
  AdminReservationInput,
  | 'userName'
  | 'userPhone'
  | 'userEmail'
  | 'gender'
  | 'occupation'
  | 'postalCode'
  | 'prefecture'
  | 'city'
  | 'addressLine'
  | 'buildingName'
  | 'lineDisplayName'
  | 'lineId'
  | 'referralSource'
>;

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: '現地払い' },
  { value: 'credit_card', label: 'クレジットカード' },
  { value: 'bank_transfer', label: '銀行振込' },
];

const PAYMENT_STATUS_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: 'pending', label: '未入金' },
  { value: 'paid', label: '入金済み' },
];

const OCCUPATION_OPTIONS = ['会社員', '学生', '自営業', '公務員', '主婦', '家族', 'その他'];

const CUSTOMER_PROFILE_KEY = 'admin-reservation-customer-profile';

function addDays(dateStr: string, days: number) {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function ReservationTabs() {
  return (
    <div className="mb-6 flex gap-2 border-b border-gray-200 pb-3">
      <Link
        href="/admin/reservations/new"
        className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white"
      >
        手動予約登録
      </Link>
      <Link
        href="/admin/import"
        className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
      >
        顧客データアップロード
      </Link>
    </div>
  );
}

export default function AdminReservationNewPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<AdminReservationInput>({
    userName: '',
    userPhone: '',
    userEmail: '',
    planId: '',
    gender: '',
    occupation: '',
    postalCode: '',
    prefecture: '',
    city: '',
    addressLine: '',
    buildingName: '',
    lineDisplayName: '',
    lineId: '',
    referralSource: '',
    checkInDate: '',
    checkOutDate: '',
    guests: 1,
    siteNumber: '',
    paymentMethod: 'cash',
    paymentStatus: 'pending',
    totalAmount: 0,
    specialRequests: '',
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CUSTOMER_PROFILE_KEY);
      if (!stored) return;
      const profile = JSON.parse(stored) as Partial<CustomerProfile>;
      setForm((prev) => ({ ...prev, ...profile }));
    } catch {
      // ignore preview/local parse failures
    }
  }, []);

  const availablePlans = useMemo(() => dummyPlans.filter((plan) => plan.isPublished), []);

  const availableSites = useMemo(() => {
    if (!form.planId) return siteDetails;
    const selectedPlan = dummyPlans.find((plan) => plan.id === form.planId);
    if (!selectedPlan) return siteDetails;
    return siteDetails.filter((site) => selectedPlan.targetSiteIds.includes(site.id));
  }, [form.planId]);

  const update = <K extends keyof AdminReservationInput>(key: K, value: AdminReservationInput[K]) => {
    setForm((prev) => {
      if (key === 'planId') {
        return { ...prev, planId: value as string, siteNumber: '' };
      }

      if (key === 'checkInDate') {
        const nextCheckOut =
          prev.checkOutDate && prev.checkOutDate <= (value as string) ? addDays(value as string, 1) : prev.checkOutDate;
        return { ...prev, checkInDate: value as string, checkOutDate: nextCheckOut };
      }

      return { ...prev, [key]: value };
    });
    setError(null);
  };

  const nights =
    form.checkInDate && form.checkOutDate && form.checkOutDate > form.checkInDate
      ? Math.ceil(
          (new Date(form.checkOutDate).getTime() - new Date(form.checkInDate).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;
  const checkOutMin = form.checkInDate ? addDays(form.checkInDate, 1) : '';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const validationError = validateAdminReservation(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const result = await createAdminReservation({ ...form, adminEmail: user?.email ?? undefined });
    setSaving(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    const customerProfile: CustomerProfile = {
      userName: form.userName,
      userPhone: form.userPhone,
      userEmail: form.userEmail,
      gender: form.gender,
      occupation: form.occupation,
      postalCode: form.postalCode,
      prefecture: form.prefecture,
      city: form.city,
      addressLine: form.addressLine,
      buildingName: form.buildingName,
      lineDisplayName: form.lineDisplayName,
      lineId: form.lineId,
      referralSource: form.referralSource,
    };
    localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(customerProfile));

    router.push(`/admin/reservations/${result.reservation.id}`);
  };

  return (
    <div className="max-w-5xl">
      <ReservationTabs />
      <h1 className="mb-6 text-xl font-bold text-gray-900">手動予約登録</h1>

      {error && (
        <div className="mb-4 whitespace-pre-wrap rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded border border-gray-200 bg-white p-5">
          <h2 className="mb-4 border-b border-gray-100 pb-2 text-sm font-semibold text-gray-800">お客様情報</h2>
          <p className="mb-4 text-xs text-gray-500">
            一度登録した情報は、この端末では次回以降の手動予約登録時に自動反映されます。
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="お名前" required>
              <input
                type="text"
                value={form.userName}
                onChange={(event) => update('userName', event.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="性別">
              <select
                value={form.gender}
                onChange={(event) => update('gender', event.target.value)}
                className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">未選択</option>
                <option value="male">男性</option>
                <option value="female">女性</option>
                <option value="other">その他</option>
                <option value="no_answer">回答しない</option>
              </select>
            </Field>
            <Field label="電話番号">
              <input
                type="tel"
                value={form.userPhone}
                onChange={(event) => update('userPhone', event.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="職業">
              <select
                value={form.occupation}
                onChange={(event) => update('occupation', event.target.value)}
                className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">選択してください</option>
                {OCCUPATION_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="メールアドレス">
              <input
                type="email"
                value={form.userEmail}
                onChange={(event) => update('userEmail', event.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="郵便番号">
              <input
                type="text"
                value={form.postalCode}
                onChange={(event) => update('postalCode', event.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="都道府県">
              <input
                type="text"
                value={form.prefecture}
                onChange={(event) => update('prefecture', event.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="市区町村">
              <input
                type="text"
                value={form.city}
                onChange={(event) => update('city', event.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="番地">
              <input
                type="text"
                value={form.addressLine}
                onChange={(event) => update('addressLine', event.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="建物名・部屋番号">
              <input
                type="text"
                value={form.buildingName}
                onChange={(event) => update('buildingName', event.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="LINEアカウント名">
              <input
                type="text"
                value={form.lineDisplayName}
                onChange={(event) => update('lineDisplayName', event.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="LINEアカウントID">
              <input
                type="text"
                value={form.lineId}
                onChange={(event) => update('lineId', event.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="キャンプ場を知ったきっかけ">
                <input
                  type="text"
                  value={form.referralSource}
                  onChange={(event) => update('referralSource', event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </Field>
            </div>
          </div>
        </section>

        <section className="rounded border border-gray-200 bg-white p-5">
          <h2 className="mb-4 border-b border-gray-100 pb-2 text-sm font-semibold text-gray-800">宿泊情報</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="チェックイン日" required>
              <input
                type="date"
                value={form.checkInDate}
                onChange={(event) => update('checkInDate', event.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="チェックアウト日" required>
              <input
                type="date"
                min={checkOutMin}
                value={form.checkOutDate}
                onChange={(event) => update('checkOutDate', event.target.value)}
                disabled={!form.checkInDate}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
              />
            </Field>
            <Field label="人数" required>
              <input
                type="number"
                min={1}
                value={form.guests}
                onChange={(event) => update('guests', parseInt(event.target.value, 10) || 1)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="プラン" required>
              <select
                value={form.planId}
                onChange={(event) => update('planId', event.target.value)}
                className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">選択してください</option>
                {availablePlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="サイト番号">
                <select
                  value={form.siteNumber}
                  onChange={(event) => update('siteNumber', event.target.value)}
                  className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">未指定で登録する</option>
                  {availableSites.map((site) => (
                    <option key={site.id} value={site.siteNumber}>
                      {site.siteNumber} - {site.siteName}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
          {nights > 0 && <p className="mt-3 text-sm text-gray-500">{nights}泊</p>}
        </section>

        <section className="rounded border border-gray-200 bg-white p-5">
          <h2 className="mb-4 border-b border-gray-100 pb-2 text-sm font-semibold text-gray-800">支払い情報</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="合計金額（税込）" required>
              <input
                type="number"
                min={0}
                value={form.totalAmount}
                onChange={(event) => update('totalAmount', parseInt(event.target.value, 10) || 0)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <div />
            <Field label="支払い方法" required>
              <select
                value={form.paymentMethod}
                onChange={(event) => update('paymentMethod', event.target.value as PaymentMethod)}
                className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="支払い状況" required>
              <select
                value={form.paymentStatus}
                onChange={(event) => update('paymentStatus', event.target.value as PaymentStatus)}
                className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                {PAYMENT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        <section className="rounded border border-gray-200 bg-white p-5">
          <h2 className="mb-4 border-b border-gray-100 pb-2 text-sm font-semibold text-gray-800">備考</h2>
          <textarea
            value={form.specialRequests}
            onChange={(event) => update('specialRequests', event.target.value)}
            rows={3}
            className="w-full resize-y rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="補足メモがあれば入力してください"
          />
        </section>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => router.push('/admin/reservations')}
            className="text-sm text-gray-500 underline hover:text-gray-700"
          >
            一覧に戻る
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '登録中...' : '予約を登録する'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
