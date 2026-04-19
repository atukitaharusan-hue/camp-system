'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useBookingDraftStore } from '@/stores/bookingDraftStore';
import { fetchOptions, fetchPlans, fetchPricingSettings } from '@/lib/admin/fetchData';
import { calculatePlanAccommodationAmount, calculateReservationPricing } from '@/lib/pricing';
import { getSiteSelectionLabel } from '@/lib/siteSelectionLabel';
import { generateQrToken } from '@/lib/generateQrToken';
import { bookingToReservation } from '@/lib/bookingToReservation';
import { createReservation } from '@/lib/createReservation';
import { validateReservation, formatUserErrors } from '@/lib/validateReservation';
import type { PricingLineItem, ReservationPricingBreakdown } from '@/types/pricing';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

function formatPrice(price: number): string {
  return price.toLocaleString('ja-JP');
}

function getPaymentLabel(method: string | null): string {
  if (method === 'credit_card') return 'クレジットカード';
  if (method === 'on_site') return '現地払い(現金のみ)';
  return '未選択';
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-4 border-b-2 border-emerald-600 pb-2 text-[15px] font-bold text-gray-800">
      {children}
    </h2>
  );
}

function SummaryRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: ReactNode;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={bold ? 'font-bold text-gray-900' : 'text-gray-500'}>{label}</span>
      <span className={bold ? 'text-xl font-bold text-emerald-700' : 'font-medium text-gray-800'}>
        {value}
      </span>
    </div>
  );
}

function CheckBadge({ checked, label }: { checked: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${
          checked ? 'bg-emerald-500' : 'bg-gray-300'
        }`}
      >
        {checked ? (
          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </span>
      <span className={`text-sm ${checked ? 'text-gray-700' : 'text-gray-400'}`}>{label}</span>
    </div>
  );
}

function CenterPanel({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-stone-50 to-emerald-50/30 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
          <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="mb-2 font-semibold text-gray-700">{title}</p>
        <div className="mb-6 whitespace-pre-wrap text-sm leading-relaxed text-gray-500">{description}</div>
        {action}
      </div>
    </div>
  );
}

export default function BookingConfirmationPage() {
  const stay = useBookingDraftStore((state) => state.stay);
  const plan = useBookingDraftStore((state) => state.plan);
  const site = useBookingDraftStore((state) => state.site);
  const options = useBookingDraftStore((state) => state.options);
  const policy = useBookingDraftStore((state) => state.policy);
  const payment = useBookingDraftStore((state) => state.payment);
  const userInfo = useBookingDraftStore((state) => state.userInfo);
  const lineProfile = useBookingDraftStore((state) => state.lineProfile);
  const resetDraft = useBookingDraftStore((state) => state.reset);

  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [allOptions, setAllOptions] = useState<{ id: string; name: string }[]>([]);
  const [pricingBreakdown, setPricingBreakdown] = useState<ReservationPricingBreakdown | null>(null);
  const [isPricingLoading, setIsPricingLoading] = useState(true);
  const [pricingError, setPricingError] = useState<string | null>(null);

  const accommodationAmount = calculatePlanAccommodationAmount(
    {
      pricingMode: plan.pricingMode,
      basePrice: plan.basePrice,
      adultPrice: plan.adultPrice,
      childPrice: plan.childPrice,
      infantPrice: plan.infantPrice,
      guestBandRules: plan.guestBandRules,
    },
    {
      adults: stay.adults,
      children: stay.children,
      infants: stay.infants,
    },
    {
      checkInDate: stay.checkIn,
    },
  );

  const optionsTotal =
    options.rentals.reduce((sum, item) => sum + item.subtotal, 0) +
    options.events.reduce((sum, item) => sum + item.subtotal, 0);

  useEffect(() => {
    fetchOptions().then((items) =>
      setAllOptions(items.map((item) => ({ id: item.id, name: item.name }))),
    );
  }, []);

  useEffect(() => {
    let active = true;

    if (!plan.minorPlanId) {
      setPricingBreakdown(null);
      setIsPricingLoading(false);
      return () => {
        active = false;
      };
    }

    setIsPricingLoading(true);
    setPricingError(null);

    Promise.all([fetchPricingSettings(), fetchPlans()])
      .then(([pricingSettings, plans]) => {
        if (!active) return;
        const selectedPlan = plans.find((item) => item.id === plan.minorPlanId) ?? null;

        setPricingBreakdown(
          calculateReservationPricing(pricingSettings, {
            adults: stay.adults,
            children: stay.children,
            infants: stay.infants,
            accommodationAmount,
            designationFeeAmount: site.designationFee,
            optionsAmount: optionsTotal,
            isLodgingTaxApplicable: selectedPlan?.isLodgingTaxApplicable ?? false,
          }),
        );
      })
      .catch(() => {
        if (!active) return;
        setPricingBreakdown(null);
        setPricingError('料金明細の読み込みに失敗しました。時間をおいてもう一度お試しください。');
      })
      .finally(() => {
        if (!active) return;
        setIsPricingLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    accommodationAmount,
    optionsTotal,
    plan.minorPlanId,
    site.designationFee,
    stay.adults,
    stay.children,
    stay.infants,
  ]);

  const optionMap = useMemo(() => new Map(allOptions.map((item) => [item.id, item])), [allOptions]);

  const missingFields = useMemo(() => {
    const fields: string[] = [];

    if (!stay.checkIn) fields.push('チェックイン日');
    if (!stay.checkOut) fields.push('チェックアウト日');
    if (!plan.minorPlanId) fields.push('プラン');
    if (!site.siteId) fields.push('サイト');
    if (!policy.agreedCancellation) fields.push('キャンセルポリシーへの同意');
    if (!policy.agreedTerms) fields.push('利用規約への同意');
    if (!payment.method) fields.push('支払い方法');

    return fields;
  }, [
    payment.method,
    plan.minorPlanId,
    policy.agreedCancellation,
    policy.agreedTerms,
    site.siteId,
    stay.checkIn,
    stay.checkOut,
  ]);

  if (missingFields.length > 0 && !isSubmitting) {
    return (
      <CenterPanel
        title="確認画面へ進む前に確認が必要です"
        description={`不足している項目: ${missingFields.join(' / ')}`}
        action={
          <Link
            href="/booking/terms-payment"
            className="inline-block rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            1つ前の画面に戻る
          </Link>
        }
      />
    );
  }

  if (pricingError && !isSubmitting) {
    return (
      <CenterPanel
        title="確認画面の表示でエラーが発生しました"
        description={pricingError}
        action={
          <Link
            href="/booking/terms-payment"
            className="inline-block rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            1つ前の画面に戻る
          </Link>
        }
      />
    );
  }

  if ((isPricingLoading || !pricingBreakdown) && !isSubmitting) {
    return (
      <CenterPanel
        title="確認画面を準備しています"
        description="料金明細を読み込み中です。そのままお待ちください。"
      />
    );
  }

  const confirmedPricingBreakdown = pricingBreakdown as ReservationPricingBreakdown;
  const totalAmount = confirmedPricingBreakdown.totalAmount;

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const validation = await validateReservation({
        siteNumber: site.siteNumber ?? '',
        checkInDate: stay.checkIn!,
        checkOutDate: stay.checkOut!,
        guests: stay.adults + stay.children + stay.infants,
        source: 'web',
        planId: plan.minorPlanId,
        requestedSiteCount: plan.requestedSiteCount,
        selectedSiteNumbers: site.selectedSiteNumbers,
      });

      if (!validation.valid) {
        setSubmitError(formatUserErrors(validation.errors));
        setIsSubmitting(false);
        return;
      }

      if (!lineProfile.userId) {
        setSubmitError('LINEログイン情報が見つかりません。LINEアプリからアクセスし直してください。');
        setIsSubmitting(false);
        return;
      }

      const draft = {
        stay,
        site,
        options,
        policy,
        payment,
        userInfo,
        plan,
        lineProfile,
        meta: { version: 1, updatedAt: 0 },
      };

      const payload = bookingToReservation({
        draft,
        qrToken: generateQrToken(),
        pricingBreakdown: confirmedPricingBreakdown,
      });

      const result = await createReservation(payload);

      if (!result.success) {
        setSubmitError(result.error);
        setIsSubmitting(false);
        return;
      }

      resetDraft();
      router.push(`/reservation/${result.reservation.id}/qr`);
    } catch {
      setSubmitError('予約確定時にエラーが発生しました。時間をおいて再度お試しください。');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-emerald-50/30 py-8 pb-28">
      <div className="container mx-auto max-w-2xl px-4">
        <div className="mb-10 text-center">
          <Link href="/booking/terms-payment" className="inline-block text-sm text-emerald-700 transition-colors hover:text-emerald-800">
            規約確認へ戻る
          </Link>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">予約内容の最終確認</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 sm:text-base">
            内容を確認して、問題なければ予約を確定してください。
          </p>
        </div>

        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <SectionHeading>宿泊情報</SectionHeading>
          <div className="space-y-2.5 text-sm">
            <SummaryRow label="チェックイン" value={stay.checkIn ? formatDate(stay.checkIn) : '-'} />
            <SummaryRow label="チェックアウト" value={stay.checkOut ? formatDate(stay.checkOut) : '-'} />
            <SummaryRow label="宿泊数" value={`${stay.nights}泊`} />
            <SummaryRow
              label="人数"
              value={`大人(中学生以上) ${stay.adults}名 / 子ども ${stay.children}名 / 幼児 ${stay.infants}名`}
            />
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <SectionHeading>サイト情報</SectionHeading>
          <div className="space-y-2.5 text-sm">
            <SummaryRow label="プラン" value={plan.planName ?? '-'} />
            <SummaryRow label="サイト" value={getSiteSelectionLabel(site)} />
            <SummaryRow label="宿泊料金" value={`¥${formatPrice(confirmedPricingBreakdown.accommodationAmount)}`} />
            {confirmedPricingBreakdown.designationFeeAmount > 0 && (
              <SummaryRow
                label="サイト指定料金"
                value={`¥${formatPrice(confirmedPricingBreakdown.designationFeeAmount)}`}
              />
            )}
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <SectionHeading>オプション</SectionHeading>
          {options.rentals.length === 0 && options.events.length === 0 ? (
            <p className="text-sm text-gray-400">オプションの選択はありません。</p>
          ) : (
            <div className="space-y-2 text-sm">
              {options.rentals.map((rental) => (
                <div key={rental.optionId} className="flex justify-between gap-3">
                  <span className="text-gray-600">
                    {optionMap.get(rental.optionId)?.name ?? 'オプション'}
                    {rental.quantity > 1 && ` ×${rental.quantity}`}
                    {rental.days && rental.days > 1 && ` (${rental.days}日)`}
                  </span>
                  <span className="font-medium">¥{formatPrice(rental.subtotal)}</span>
                </div>
              ))}
              {options.events.map((event) => (
                <div key={event.optionId} className="flex justify-between gap-3">
                  <span className="text-gray-600">
                    {optionMap.get(event.optionId)?.name ?? 'イベント'}
                    {event.people > 1 && ` ×${event.people}名`}
                  </span>
                  <span className="font-medium">¥{formatPrice(event.subtotal)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <SectionHeading>同意状況</SectionHeading>
          <div className="space-y-3">
            <CheckBadge checked={policy.agreedCancellation} label="キャンセルポリシーに同意済み" />
            <CheckBadge checked={policy.agreedTerms} label="利用規約に同意済み" />
            <CheckBadge checked={policy.agreedSns} label="SNS案内に同意済み" />
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <SectionHeading>支払い方法</SectionHeading>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-5 w-5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-800">{getPaymentLabel(payment.method)}</p>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <SectionHeading>料金明細</SectionHeading>
          <div className="space-y-1.5 text-sm">
            <SummaryRow label="宿泊料金" value={`¥${formatPrice(confirmedPricingBreakdown.accommodationAmount)}`} />
            <SummaryRow label="サイト指定料金" value={`¥${formatPrice(confirmedPricingBreakdown.designationFeeAmount)}`} />
            <SummaryRow label="オプション料金" value={`¥${formatPrice(confirmedPricingBreakdown.optionsAmount)}`} />
            {confirmedPricingBreakdown.mandatoryFees.map((fee: PricingLineItem) => (
              <SummaryRow key={fee.id} label={fee.label} value={`¥${formatPrice(fee.amount)}`} />
            ))}
            {confirmedPricingBreakdown.lodgingTax && (
              <SummaryRow
                label={confirmedPricingBreakdown.lodgingTax.label}
                value={`¥${formatPrice(confirmedPricingBreakdown.lodgingTax.amount)}`}
              />
            )}
            <div className="mt-1 border-t border-gray-300 pt-3">
              <SummaryRow label="合計金額" value={`¥${formatPrice(totalAmount)}`} bold />
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5">
          <h3 className="mb-2 text-sm font-semibold text-amber-800">ご確認ください</h3>
          <ul className="list-inside list-disc space-y-1.5 text-xs leading-relaxed text-amber-700">
            <li>予約確定時に在庫と料金を再確認します。</li>
            <li>確定後にチェックイン用 QR コードを表示します。</li>
            <li>内容に誤りがある場合は、前の画面に戻って修正してください。</li>
          </ul>
        </section>

        {submitError && (
          <section className="mb-8 rounded-2xl border border-red-200 bg-red-50 p-4 sm:p-5">
            <p className="mb-1 text-sm font-semibold text-red-800">予約確定でエラーが発生しました</p>
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-red-700">{submitError}</p>
          </section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl gap-3">
          <Link
            href="/booking/terms-payment"
            className="flex-1 rounded-xl border border-gray-300 py-3 text-center text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
          >
            戻る
          </Link>
          <button
            type="button"
            disabled={isSubmitting || isPricingLoading}
            onClick={handleConfirm}
            className={`flex-[2] rounded-xl py-3 text-center text-sm font-bold transition-all ${
              isSubmitting || isPricingLoading
                ? 'cursor-not-allowed bg-gray-300 text-gray-500'
                : 'bg-emerald-600 text-white shadow-md hover:bg-emerald-700 active:scale-[0.98]'
            }`}
          >
            {isSubmitting ? '予約確定中...' : '予約を確定する'}
          </button>
        </div>
      </div>
    </div>
  );
}
