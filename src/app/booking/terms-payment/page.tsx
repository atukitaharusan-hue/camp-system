'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchOptions, fetchPlans, fetchPolicySettings, fetchPricingSettings } from '@/lib/admin/fetchData';
import { calculatePlanAccommodationAmount, calculateReservationPricing } from '@/lib/pricing';
import { getSiteSelectionLabel } from '@/lib/siteSelectionLabel';
import { useBookingDraftStore } from '@/stores/bookingDraftStore';
import { STORAGE_KEY_OPTIONS_PAYLOAD, type OptionsPayload, type OptionItem } from '@/types/options';
import type { AdminPolicySettings } from '@/types/admin';
import type { ReservationPricingBreakdown } from '@/types/pricing';

interface PaymentMethodView {
  id: string;
  label: string;
  description: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-4 border-b-2 border-emerald-600 pb-2 text-[15px] font-bold text-gray-800">
      {children}
    </h2>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function AccordionSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between bg-stone-50 px-4 py-3.5 text-left transition-colors hover:bg-stone-100"
      >
        <span className="text-sm font-semibold text-gray-700">{title}</span>
        <span className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {isOpen && <div className="border-t border-gray-100 bg-white px-4 py-4">{children}</div>}
    </div>
  );
}

function Agreement({
  required = false,
  checked,
  onChange,
  label,
}: {
  required?: boolean;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <label className="group flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-5 w-5 rounded border-gray-300 accent-emerald-600"
      />
      <span className="text-sm text-gray-700 group-hover:text-gray-900">
        {required && (
          <span className="mr-1.5 inline-block rounded bg-red-50 px-1.5 py-0.5 text-xs font-bold text-red-600">
            必須
          </span>
        )}
        {label}
      </span>
    </label>
  );
}

export default function TermsPaymentPage() {
  const router = useRouter();
  const stay = useBookingDraftStore((state) => state.stay);
  const site = useBookingDraftStore((state) => state.site);
  const plan = useBookingDraftStore((state) => state.plan);
  const policy = useBookingDraftStore((state) => state.policy);
  const payment = useBookingDraftStore((state) => state.payment);
  const setPolicy = useBookingDraftStore((state) => state.setPolicy);
  const setPayment = useBookingDraftStore((state) => state.setPayment);

  const hasStay = !!(stay.checkIn && stay.checkOut && stay.nights > 0);
  const hasSite = !!site.siteId;

  useEffect(() => {
    if (!hasStay) {
      router.replace('/');
    } else if (!hasSite) {
      router.replace('/booking/sites');
    }
  }, [hasSite, hasStay, router]);

  const [payload, setPayload] = useState<OptionsPayload | null>(null);
  const [policySettings, setPolicySettings] = useState<AdminPolicySettings>({
    paymentNotice: '',
    eventEntryNotice: '',
    paymentMethods: [],
    cancellationPolicies: [],
    termsSections: [],
  });
  const [allOptions, setAllOptions] = useState<OptionItem[]>([]);
  const [pricingBreakdown, setPricingBreakdown] = useState<ReservationPricingBreakdown | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [agreedCancelPolicy, setAgreedCancelPolicy] = useState(policy.agreedCancellation);
  const [agreedTerms, setAgreedTerms] = useState(policy.agreedTerms);
  const [agreedSns, setAgreedSns] = useState(policy.agreedSns);
  const [selectedPayment, setSelectedPayment] = useState<string | null>(payment.method);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY_OPTIONS_PAYLOAD);
      if (stored) {
        setPayload(JSON.parse(stored) as OptionsPayload);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicySettings().then(setPolicySettings);
    fetchOptions().then(setAllOptions);
  }, []);

  useEffect(() => {
    if (!payload) return;
    Promise.all([fetchPricingSettings(), fetchPlans()]).then(([pricingSettings, plans]) => {
      const selectedPlan = plans.find((item) => item.id === plan.minorPlanId) ?? null;
      const fallbackAccommodationAmount = calculatePlanAccommodationAmount(
        {
          pricingMode: payload.booking.planPricingMode,
          basePrice: payload.booking.planBasePrice,
          adultPrice: payload.booking.planAdultPrice,
          childPrice: payload.booking.planChildPrice,
          infantPrice: payload.booking.planInfantPrice,
          guestBandRules: payload.booking.planGuestBandRules,
        },
        {
          adults: stay.adults,
          children: stay.children,
          infants: stay.infants,
        },
        {
          checkInDate: payload.booking.checkInDate,
        },
      );
      setPricingBreakdown(
          calculateReservationPricing(pricingSettings, {
            adults: stay.adults,
            children: stay.children,
            infants: stay.infants,
            accommodationAmount: plan.minorPlanId
              ? calculatePlanAccommodationAmount(
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
                )
              : fallbackAccommodationAmount,
          designationFeeAmount: payload.booking.designationFee,
          optionsAmount: payload.optionsTotalAmount,
          isLodgingTaxApplicable: selectedPlan?.isLodgingTaxApplicable ?? false,
        }),
      );
    });
  }, [payload, plan.adultPrice, plan.basePrice, plan.childPrice, plan.guestBandRules, plan.infantPrice, plan.minorPlanId, plan.pricingMode, stay.adults, stay.checkIn, stay.children, stay.infants]);

  const optionMap = useMemo(() => new Map(allOptions.map((item) => [item.id, item])), [allOptions]);

  const paymentMethods = useMemo<PaymentMethodView[]>(
    () =>
      policySettings.paymentMethods
        .filter((method) => method.isEnabled)
        .map((method) => ({
          id: method.id,
          label: method.label,
          description: method.description,
        })),
    [policySettings.paymentMethods],
  );

  const canProceed = agreedCancelPolicy && agreedTerms && !!selectedPayment;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-stone-50 to-emerald-50/30">
        <p className="text-sm text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-stone-50 to-emerald-50/30 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="mb-2 font-semibold text-gray-700">オプション選択情報が見つかりません</p>
          <p className="mb-6 text-sm text-gray-500">オプション選択画面からもう一度進んでください。</p>
          <Link
            href="/booking/options"
            className="inline-block rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            オプション選択へ戻る
          </Link>
        </div>
      </div>
    );
  }

  const { booking, selectedOptions, optionsTotalAmount } = payload;
  const accommodationAmount = plan.minorPlanId
    ? calculatePlanAccommodationAmount(
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
      )
    : calculatePlanAccommodationAmount(
        {
          pricingMode: booking.planPricingMode,
          basePrice: booking.planBasePrice,
          adultPrice: booking.planAdultPrice,
          childPrice: booking.planChildPrice,
          infantPrice: booking.planInfantPrice,
          guestBandRules: booking.planGuestBandRules,
        },
        {
          adults: booking.adults,
          children: booking.children,
          infants: booking.infants,
        },
        {
          checkInDate: booking.checkInDate,
        },
      );
  const totalAmount =
    pricingBreakdown?.totalAmount ??
    accommodationAmount + booking.designationFee + optionsTotalAmount;

  const handleProceed = () => {
    if (!canProceed || !selectedPayment) return;
    setPolicy({
      agreedCancellation: agreedCancelPolicy,
      agreedTerms,
      agreedSns,
    });
    setPayment({ method: selectedPayment });
    router.push('/booking/confirmation');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-emerald-50/30 py-8 pb-28">
      <div className="mx-auto max-w-2xl px-4">
        <div className="mb-10 text-center">
          <Link href="/booking/user-info" className="text-sm text-emerald-700 hover:text-emerald-800">
            入力画面へ戻る
          </Link>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900">規約確認とお支払い方法</h1>
          <p className="mt-2 text-sm text-gray-500">
            予約内容を確認し、利用規約への同意とお支払い方法の選択を行ってください。
          </p>
        </div>

        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <SectionHeading>予約内容の確認</SectionHeading>
          <div className="space-y-2.5 text-sm text-gray-700">
            <Row label="宿泊日" value={`${formatDate(booking.checkInDate)} - ${formatDate(booking.checkOutDate)}`} />
            <Row label="宿泊数" value={`${booking.nights}泊`} />
            <Row label="人数" value={`大人(中学生以上) ${booking.adults}名 / 子ども ${booking.children}名 / 幼児 ${booking.infants}名`} />
            <Row label="サイト" value={getSiteSelectionLabel({ siteId: booking.siteId, siteNumber: booking.siteNumber, siteName: booking.siteName })} />

            {selectedOptions.length > 0 && (
              <div className="mt-3 border-t border-gray-100 pt-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">選択したオプション</p>
                <div className="space-y-1.5">
                  {selectedOptions.map((selection) => {
                    const option = optionMap.get(selection.optionId);
                    return (
                      <div key={selection.optionId} className="flex justify-between gap-3">
                        <span className="text-gray-600">{option?.name ?? 'オプション'}</span>
                        <span className="font-medium">¥{selection.subtotal.toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-3 space-y-1.5 border-t border-gray-200 pt-3">
              <Row label="宿泊料金" value={`¥${(pricingBreakdown?.accommodationAmount ?? booking.sitePrice).toLocaleString()}`} />
              <Row label="サイト指定料金" value={`¥${(pricingBreakdown?.designationFeeAmount ?? booking.designationFee).toLocaleString()}`} />
              <Row label="オプション合計" value={`¥${(pricingBreakdown?.optionsAmount ?? optionsTotalAmount).toLocaleString()}`} />
              {pricingBreakdown?.mandatoryFees.map((fee) => (
                <Row key={fee.id} label={fee.label} value={`¥${fee.amount.toLocaleString()}`} />
              ))}
              {pricingBreakdown?.lodgingTax && (
                <Row label={pricingBreakdown.lodgingTax.label} value={`¥${pricingBreakdown.lodgingTax.amount.toLocaleString()}`} />
              )}
              <div className="mt-1 flex items-center justify-between border-t border-gray-300 pt-3">
                <span className="font-bold text-gray-900">合計金額</span>
                <span className="text-xl font-bold text-emerald-700">¥{totalAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <SectionHeading>利用規約とキャンセルポリシー</SectionHeading>
          <div className="space-y-3">
            <AccordionSection title="キャンセルポリシー" defaultOpen>
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">期間</th>
                      <th className="px-3 py-2 text-right font-medium">料金</th>
                    </tr>
                  </thead>
                  <tbody>
                    {policySettings.cancellationPolicies.map((item, index) => (
                      <tr key={`${item.period}-${index}`} className="border-t border-gray-100 text-gray-600">
                        <td className="px-3 py-2">{item.period}</td>
                        <td className="px-3 py-2 text-right">{item.rate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AccordionSection>

            {policySettings.termsSections.map((section) => (
              <AccordionSection key={section.title} title={section.title}>
                <ul className="space-y-2 text-sm leading-6 text-gray-600">
                  {section.body.filter(Boolean).map((line, index) => (
                    <li key={`${section.title}-${index}`}>・{line}</li>
                  ))}
                </ul>
              </AccordionSection>
            ))}
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <SectionHeading>同意確認</SectionHeading>
          <div className="space-y-4">
            <Agreement
              required
              checked={agreedCancelPolicy}
              onChange={setAgreedCancelPolicy}
              label="キャンセルポリシーを確認し、同意しました"
            />
            <Agreement
              required
              checked={agreedTerms}
              onChange={setAgreedTerms}
              label="利用規約を確認し、同意しました"
            />
            <Agreement
              checked={agreedSns}
              onChange={setAgreedSns}
              label="SNSやお知らせの配信に同意します"
            />
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <SectionHeading>お支払い方法</SectionHeading>
          <div className="space-y-3">
            {paymentMethods.map((method) => (
              <button
                key={method.id}
                type="button"
                onClick={() => setSelectedPayment(method.id)}
                className={`flex w-full items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                  selectedPayment === method.id
                    ? 'border-emerald-500 bg-emerald-50/60 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-gray-800">{method.label}</span>
                  <span className="mt-0.5 block text-xs text-gray-500">{method.description}</span>
                </div>
                <span
                  className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                    selectedPayment === method.id ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
                  }`}
                >
                  {selectedPayment === method.id && <span className="h-2 w-2 rounded-full bg-white" />}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5">
          <h3 className="mb-2 text-sm font-semibold text-amber-800">ご案内</h3>
          <ul className="list-inside list-disc space-y-1.5 text-xs leading-relaxed text-amber-700">
            <li>料金は確認画面でも再計算されます。</li>
            <li>{policySettings.paymentNotice}</li>
            <li>入力内容に不備がある場合は、確認画面へ進めません。</li>
          </ul>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl gap-3">
          <Link
            href="/booking/user-info"
            className="flex-1 rounded-xl border border-gray-300 py-3 text-center text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            戻る
          </Link>
          <button
            type="button"
            disabled={!canProceed}
            onClick={handleProceed}
            className={`flex-[2] rounded-xl py-3 text-center text-sm font-bold transition-all ${
              canProceed
                ? 'bg-emerald-600 text-white shadow-md hover:bg-emerald-700'
                : 'cursor-not-allowed bg-gray-200 text-gray-400'
            }`}
          >
            確認画面へ進む
          </button>
        </div>
      </div>
    </div>
  );
}
