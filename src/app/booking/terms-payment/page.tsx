'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { dummyOptions } from '@/data/optionsDummyData';
import { dummyPolicySettings } from '@/data/adminDummyData';
import { ADMIN_POLICIES_KEY, readJsonStorage } from '@/lib/admin/browserStorage';
import { useBookingDraftStore } from '@/stores/bookingDraftStore';
import { STORAGE_KEY_OPTIONS_PAYLOAD, type OptionsPayload } from '@/types/options';

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

export default function TermsPaymentPage() {
  const router = useRouter();
  const stay = useBookingDraftStore((state) => state.stay);
  const site = useBookingDraftStore((state) => state.site);
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
  const [policySettings, setPolicySettings] = useState(dummyPolicySettings);
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
    setPolicySettings(readJsonStorage(ADMIN_POLICIES_KEY, dummyPolicySettings));
  }, []);

  const optionMap = useMemo(() => new Map(dummyOptions.map((item) => [item.id, item])), []);

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
          <p className="mb-2 font-semibold text-gray-700">オプション情報が見つかりません</p>
          <p className="mb-6 text-sm text-gray-500">オプション選択画面からやり直してください。</p>
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
  const totalAmount = booking.sitePrice + booking.designationFee + optionsTotalAmount;

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
          <Link href="/booking/options" className="text-sm text-emerald-700 hover:text-emerald-800">
            オプション選択へ戻る
          </Link>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900">規約とお支払い方法</h1>
          <p className="mt-2 text-sm text-gray-500">
            内容をご確認のうえ、利用規約への同意とお支払い方法の選択をお願いします。
          </p>
        </div>

        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <SectionHeading>予約内容の確認</SectionHeading>
          <div className="space-y-2.5 text-sm text-gray-700">
            <Row label="宿泊日" value={`${formatDate(booking.checkInDate)} 〜 ${formatDate(booking.checkOutDate)}`} />
            <Row label="宿泊数" value={`${booking.nights}泊`} />
            <Row label="人数" value={`${booking.guests}名`} />
            <Row label="サイト" value={`${booking.siteName}${booking.siteNumber ? ` / ${booking.siteNumber}` : ''}`} />

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
              <Row label="サイト料金" value={`¥${booking.sitePrice.toLocaleString()}`} />
              <Row label="サイト指定料" value={`¥${booking.designationFee.toLocaleString()}`} />
              <Row label="オプション合計" value={`¥${optionsTotalAmount.toLocaleString()}`} />
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
                      <tr key={`${item.period}-${index}`} className="border-t border-gray-100">
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
              label="SNSや広報への掲載に同意します"
            />
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <SectionHeading>お支払い方法</SectionHeading>
          <div className="space-y-3">
            {paymentMethods.map((method) => {
              const isSelected = selectedPayment === method.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setSelectedPayment(method.id)}
                  className={`flex w-full items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50/60 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <span className={`block text-sm font-semibold ${isSelected ? 'text-emerald-800' : 'text-gray-800'}`}>
                      {method.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-500">{method.description}</span>
                  </div>
                  <span
                    className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                      isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
                    }`}
                  >
                    {isSelected && <span className="h-2 w-2 rounded-full bg-white" />}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5">
          <h3 className="mb-2 text-sm font-semibold text-amber-800">お支払いに関する注意事項</h3>
          <ul className="list-inside list-disc space-y-1.5 text-xs leading-relaxed text-amber-700">
            <li>プランやオプションにより支払いタイミングが異なる場合があります。</li>
            <li>{policySettings.paymentNotice}</li>
            <li>お問い合わせや質問事項は公式ラインにて受け付けております。</li>
          </ul>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl gap-3">
          <Link
            href="/booking/options"
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
        <span className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>⌄</span>
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
