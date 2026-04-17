"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useBookingDraftStore } from "@/stores/bookingDraftStore";
import { fetchOptions } from '@/lib/admin/fetchData';
import { generateQrToken } from "@/lib/generateQrToken";
import { bookingToReservation } from "@/lib/bookingToReservation";
import { createReservation } from "@/lib/createReservation";
import { validateReservation, formatUserErrors } from "@/lib/validateReservation";

// ============================================================
// ユーティリティ
// ============================================================

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${weekdays[d.getDay()]}）`;
}

function formatPrice(price: number): string {
  return price.toLocaleString("ja-JP");
}

function getPaymentLabel(method: string | null): string {
  if (method === "credit_card") return "クレジットカード（事前決済）";
  if (method === "on_site") return "現地決済";
  return "未選択";
}

// ============================================================
// サブコンポーネント
// ============================================================

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[15px] font-bold text-gray-800 pb-2 mb-4 border-b-2 border-emerald-600">
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
  value: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className={bold ? "font-bold text-gray-900" : "text-gray-500"}>
        {label}
      </span>
      <span className={bold ? "text-xl font-bold text-emerald-700" : "font-medium text-gray-800"}>
        {value}
      </span>
    </div>
  );
}

function CheckBadge({ checked, label }: { checked: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
          checked ? "bg-emerald-500" : "bg-gray-300"
        }`}
      >
        {checked ? (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </span>
      <span className={`text-sm ${checked ? "text-gray-700" : "text-gray-400"}`}>
        {label}
      </span>
    </div>
  );
}

// ============================================================
// メインページコンポーネント
// ============================================================

export default function BookingConfirmationPage() {
  const stay = useBookingDraftStore((s) => s.stay);
  const plan = useBookingDraftStore((s) => s.plan);
  const site = useBookingDraftStore((s) => s.site);
  const options = useBookingDraftStore((s) => s.options);
  const policy = useBookingDraftStore((s) => s.policy);
  const payment = useBookingDraftStore((s) => s.payment);
  const userInfo = useBookingDraftStore((s) => s.userInfo);
  const lineProfile = useBookingDraftStore((s) => s.lineProfile);
  const resetDraft = useBookingDraftStore((s) => s.reset);

  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [allOptions, setAllOptions] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetchOptions().then((opts) => setAllOptions(opts.map((o) => ({ id: o.id, name: o.name }))));
  }, []);

  // --- オプション名の逆引きマップ ---
  const optionMap = useMemo(
    () => new Map(allOptions.map((o) => [o.id, o])),
    [allOptions]
  );

  // --- 必須情報のガード ---
  const isValid =
    stay.checkIn !== null &&
    site.siteId !== null &&
    policy.agreedCancellation &&
    policy.agreedTerms &&
    payment.method !== null;

  if (!isValid && !isSubmitting) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-emerald-50/30 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-sm w-full text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-700 font-semibold mb-2">
            必要な情報が不足しています
          </p>
          <p className="text-sm text-gray-500 mb-6">
            規約への同意・支払い方法の選択を完了してからお進みください。
          </p>
          <Link
            href="/booking/terms-payment"
            className="inline-block px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
          >
            規約・支払い方法に戻る
          </Link>
        </div>
      </div>
    );
  }

  // --- 金額計算 ---
  const rentalTotal = options.rentals.reduce((s, r) => s + r.subtotal, 0);
  const eventTotal = options.events.reduce((s, e) => s + e.subtotal, 0);
  const optionsTotal = rentalTotal + eventTotal;
  const totalAmount = site.sitePrice + site.designationFee + optionsTotal;

  // --- 予約確定ハンドラ ---
  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // 共通バリデーション
      const validation = await validateReservation({
        siteNumber: site.siteNumber ?? '',
        checkInDate: stay.checkIn!,
        checkOutDate: stay.checkOut!,
        guests: stay.adults + stay.children,
        source: 'web',
        planId: plan.minorPlanId,
      });

      if (!validation.valid) {
        setSubmitError(formatUserErrors(validation.errors));
        setIsSubmitting(false);
        return;
      }

      if (!lineProfile.userId) {
        setSubmitError('LINEログインが必要です。LINEアプリからアクセスしてください。');
        setIsSubmitting(false);
        return;
      }

      const draft = { stay, site, options, policy, payment, userInfo, plan, lineProfile, meta: { version: 1, updatedAt: 0 } };
      const qrToken = generateQrToken();
      const payload = bookingToReservation({ draft, qrToken, totalAmount });
      const result = await createReservation(payload);

      if (!result.success) {
        setSubmitError(result.error);
        setIsSubmitting(false);
        return;
      }

      // 保存成功 → store クリア → QR ページへ遷移
      resetDraft();
      router.push(`/reservation/${result.reservation.id}/qr`);
    } catch {
      setSubmitError('予約の保存中にエラーが発生しました。時間をおいて再度お試しください。');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-emerald-50/30 py-8 pb-28">
      <div className="container mx-auto px-4 max-w-2xl">
        {/* ============================================ */}
        {/* ページヘッダー */}
        {/* ============================================ */}
        <div className="text-center mb-10">
          <Link
            href="/booking/terms-payment"
            className="inline-block text-emerald-700 hover:text-emerald-800 text-sm transition-colors"
          >
            ← 規約・支払い方法に戻る
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-4 tracking-tight">
            予約内容の確認
          </h1>
          <p className="text-gray-500 mt-2 text-sm sm:text-base max-w-md mx-auto">
            以下の内容で予約を確定します。内容をご確認ください。
          </p>
        </div>

        {/* ============================================ */}
        {/* 宿泊情報 */}
        {/* ============================================ */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-6 mb-6">
          <SectionHeading>宿泊情報</SectionHeading>
          <div className="space-y-2.5 text-sm">
            <SummaryRow
              label="チェックイン"
              value={stay.checkIn ? formatDate(stay.checkIn) : "—"}
            />
            <SummaryRow
              label="チェックアウト"
              value={stay.checkOut ? formatDate(stay.checkOut) : "—"}
            />
            <SummaryRow
              label="宿泊数"
              value={`${stay.nights}泊${stay.nights + 1}日`}
            />
            <SummaryRow
              label="人数"
              value={
                <>
                  大人{stay.adults}名
                  {stay.children > 0 && `、子ども${stay.children}名`}
                </>
              }
            />
          </div>
        </section>

        {/* ============================================ */}
        {/* サイト情報 */}
        {/* ============================================ */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-6 mb-6">
          <SectionHeading>サイト情報</SectionHeading>
          <div className="space-y-2.5 text-sm">
            {site.areaName && (
              <SummaryRow label="エリア" value={site.areaName} />
            )}
            {site.subAreaName && (
              <SummaryRow label="サブエリア" value={site.subAreaName} />
            )}
            <SummaryRow
              label="サイト"
              value={`${site.siteName ?? "—"} ${site.siteNumber ?? ""}`}
            />
            <SummaryRow
              label="サイト料金"
              value={`¥${formatPrice(site.sitePrice)}`}
            />
            {site.designationFee > 0 && (
              <SummaryRow
                label="サイト指定料"
                value={`¥${formatPrice(site.designationFee)}`}
              />
            )}
          </div>
        </section>

        {/* ============================================ */}
        {/* オプション */}
        {/* ============================================ */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-6 mb-6">
          <SectionHeading>オプション</SectionHeading>

          {options.rentals.length === 0 && options.events.length === 0 ? (
            <p className="text-sm text-gray-400">オプションの選択なし</p>
          ) : (
            <div className="space-y-2 text-sm">
              {options.rentals.map((r) => {
                const opt = optionMap.get(r.optionId);
                return (
                  <div key={r.optionId} className="flex justify-between">
                    <span className="text-gray-600">
                      ・{opt?.name ?? "不明なオプション"}
                      {r.quantity > 1 && ` ×${r.quantity}`}
                      {r.days && r.days > 1 && ` (${r.days}日間)`}
                    </span>
                    <span className="font-medium">¥{formatPrice(r.subtotal)}</span>
                  </div>
                );
              })}
              {options.events.map((e) => {
                const opt = optionMap.get(e.optionId);
                return (
                  <div key={e.optionId} className="flex justify-between">
                    <span className="text-gray-600">
                      ・{opt?.name ?? "不明なオプション"}
                      {e.people > 1 && ` ×${e.people}名`}
                    </span>
                    <span className="font-medium">¥{formatPrice(e.subtotal)}</span>
                  </div>
                );
              })}
              <div className="flex justify-between pt-2 border-t border-gray-100">
                <span className="text-gray-500">オプション合計</span>
                <span className="font-medium">¥{formatPrice(optionsTotal)}</span>
              </div>
            </div>
          )}
        </section>

        {/* ============================================ */}
        {/* 規約同意状態 */}
        {/* ============================================ */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-6 mb-6">
          <SectionHeading>規約・同意事項</SectionHeading>
          <div className="space-y-3">
            <CheckBadge checked={policy.agreedCancellation} label="キャンセルポリシーに同意済み" />
            <CheckBadge checked={policy.agreedTerms} label="利用規約に同意済み" />
            <CheckBadge checked={policy.agreedSns} label="SNS・広報掲載への協力に同意" />
          </div>
        </section>

        {/* ============================================ */}
        {/* 支払い方法 */}
        {/* ============================================ */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-6 mb-6">
          <SectionHeading>お支払い方法</SectionHeading>
          <div className="flex items-center gap-3">
            <span className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
              {payment.method === "credit_card" ? (
                <svg className="w-5 h-5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              )}
            </span>
            <div>
              <p className="font-semibold text-sm text-gray-800">
                {getPaymentLabel(payment.method)}
              </p>
              {payment.method === "credit_card" && (
                <p className="text-xs text-gray-500 mt-0.5">
                  予約確定時に決済が行われます
                </p>
              )}
              {payment.method === "on_site" && (
                <p className="text-xs text-gray-500 mt-0.5">
                  チェックイン時に受付でお支払いください
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* 合計金額 */}
        {/* ============================================ */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-6 mb-6">
          <SectionHeading>お支払い金額</SectionHeading>
          <div className="space-y-1.5 text-sm">
            <SummaryRow label="サイト料金" value={`¥${formatPrice(site.sitePrice)}`} />
            {site.designationFee > 0 && (
              <SummaryRow label="サイト指定料" value={`¥${formatPrice(site.designationFee)}`} />
            )}
            {optionsTotal > 0 && (
              <SummaryRow label="オプション合計" value={`¥${formatPrice(optionsTotal)}`} />
            )}
            <div className="pt-3 mt-1 border-t border-gray-300">
              <SummaryRow label="合計金額" value={`¥${formatPrice(totalAmount)}`} bold />
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* 注意事項 */}
        {/* ============================================ */}
        <section className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 sm:p-5 mb-8">
          <h3 className="font-semibold text-sm text-amber-800 mb-2">
            ご確認ください
          </h3>
          <ul className="space-y-1.5 list-disc list-inside text-xs leading-relaxed text-amber-700">
            <li>予約確定後のキャンセルにはキャンセルポリシーが適用されます。</li>
            <li>予約内容を変更したい場合は、各ステップに戻って修正できます。</li>
            <li>確定後、チェックイン用QRコードが発行されます。</li>
          </ul>
        </section>

        {/* エラー表示 */}
        {submitError && (
          <section className="bg-red-50 border border-red-200 rounded-2xl p-4 sm:p-5 mb-8">
            <p className="text-sm font-semibold text-red-800 mb-1">
              予約の保存に失敗しました
            </p>
            <p className="text-xs text-red-700 whitespace-pre-wrap leading-relaxed">{submitError}</p>
          </section>
        )}
      </div>

      {/* ============================================ */}
      {/* フッター操作ボタン（固定フッター） */}
      {/* ============================================ */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 px-4 py-3 safe-area-pb">
        <div className="max-w-2xl mx-auto flex gap-3">
          <Link
            href="/booking/terms-payment"
            className="flex-1 py-3 rounded-xl border border-gray-300 text-center text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            ← 戻る
          </Link>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirm}
            className={`flex-[2] py-3 rounded-xl text-center text-sm font-bold transition-all ${
              isSubmitting
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md active:scale-[0.98]"
            }`}
          >
            {isSubmitting ? "保存中..." : "予約を確定する"}
          </button>
        </div>
      </div>
    </div>
  );
}
