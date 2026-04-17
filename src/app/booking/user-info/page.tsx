"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useBookingDraftStore } from "@/stores/bookingDraftStore";
import { supabase } from "@/lib/supabase";

const GENDER_OPTIONS = ["男性", "女性", "その他", "回答しない"] as const;

const REFERRAL_OPTIONS = [
  "検索エンジン",
  "SNS（Instagram）",
  "SNS（X / Twitter）",
  "SNS（その他）",
  "友人・知人の紹介",
  "雑誌・メディア",
  "リピート",
  "その他",
] as const;

export default function BookingUserInfoPage() {
  const router = useRouter();

  const userInfo = useBookingDraftStore((s) => s.userInfo);
  const lineProfile = useBookingDraftStore((s) => s.lineProfile);
  const site = useBookingDraftStore((s) => s.site);
  const setUserInfo = useBookingDraftStore((s) => s.setUserInfo);

  const [gender, setGender] = useState(userInfo.gender ?? "");
  const [occupation, setOccupation] = useState(userInfo.occupation ?? "");
  const [phone, setPhone] = useState(userInfo.phone ?? "");
  const [email, setEmail] = useState(userInfo.email ?? "");
  const [address, setAddress] = useState(userInfo.address ?? "");
  const [referralSource, setReferralSource] = useState(userInfo.referralSource ?? "");
  const [loaded, setLoaded] = useState(false);

  // リピーター自動入力: LINE userId で過去の予約から取得
  useEffect(() => {
    if (loaded) return;
    // store に既に値があればスキップ
    if (userInfo.phone || userInfo.email) {
      setLoaded(true);
      return;
    }

    const userId = lineProfile.userId;
    if (!userId) {
      setLoaded(true);
      return;
    }

    (async () => {
      const { data } = await supabase
        .from("guest_reservations")
        .select("user_gender, user_occupation, user_phone, user_email, user_address, user_referral_source")
        .eq("user_identifier", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (data) {
        if (data.user_gender) setGender(data.user_gender);
        if (data.user_occupation) setOccupation(data.user_occupation);
        if (data.user_phone) setPhone(data.user_phone);
        if (data.user_email) setEmail(data.user_email);
        if (data.user_address) setAddress(data.user_address);
        if (data.user_referral_source) setReferralSource(data.user_referral_source);
      }
      setLoaded(true);
    })();
  }, [lineProfile.userId, loaded, userInfo.phone, userInfo.email]);

  // ガード: サイト未選択なら戻す
  if (!site.siteId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-stone-50 to-emerald-50/30 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="mb-4 font-semibold text-gray-700">先にサイトを選択してください</p>
          <Link href="/booking/sites" className="inline-block rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
            サイト選択に戻る
          </Link>
        </div>
      </div>
    );
  }

  const isValid = gender !== "" && phone.trim() !== "" && email.trim() !== "" && address.trim() !== "";

  const handleNext = useCallback(() => {
    if (!isValid) return;
    setUserInfo({
      gender,
      occupation: occupation || null,
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      referralSource: referralSource || null,
    });
    router.push("/booking/terms-payment");
  }, [isValid, gender, occupation, phone, email, address, referralSource, setUserInfo, router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-emerald-50/30 py-8 pb-28">
      <div className="container mx-auto max-w-2xl px-4">
        {/* ヘッダー */}
        <div className="mb-10 text-center">
          <Link href="/booking/options" className="inline-block text-sm text-emerald-700 hover:text-emerald-800 transition-colors">
            ← オプション選択に戻る
          </Link>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            お客様情報の入力
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 sm:text-base">
            予約に必要な情報をご入力ください。
          </p>
        </div>

        {/* フォーム */}
        <div className="space-y-6">
          {/* 性別 (必須) */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <label className="mb-3 block text-sm font-bold text-gray-800">
              性別 <span className="ml-1 text-xs text-red-500">必須</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {GENDER_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setGender(opt)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                    gender === opt
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </section>

          {/* 電話番号 (必須) */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <label htmlFor="phone" className="mb-3 block text-sm font-bold text-gray-800">
              電話番号 <span className="ml-1 text-xs text-red-500">必須</span>
            </label>
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="09012345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </section>

          {/* メールアドレス (必須) */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <label htmlFor="email" className="mb-3 block text-sm font-bold text-gray-800">
              メールアドレス <span className="ml-1 text-xs text-red-500">必須</span>
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </section>

          {/* 住所 (必須) */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <label htmlFor="address" className="mb-3 block text-sm font-bold text-gray-800">
              住所 <span className="ml-1 text-xs text-red-500">必須</span>
            </label>
            <input
              id="address"
              type="text"
              autoComplete="street-address"
              placeholder="東京都渋谷区..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </section>

          {/* 職業 (任意) */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <label htmlFor="occupation" className="mb-3 block text-sm font-bold text-gray-800">
              ご職業 <span className="ml-1 text-xs text-gray-400">任意</span>
            </label>
            <input
              id="occupation"
              type="text"
              placeholder="会社員、学生など"
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </section>

          {/* きっかけ (任意) */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <label className="mb-3 block text-sm font-bold text-gray-800">
              当施設を知ったきっかけ <span className="ml-1 text-xs text-gray-400">任意</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {REFERRAL_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setReferralSource(referralSource === opt ? "" : opt)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                    referralSource === opt
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* 固定フッター */}
      <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur-sm safe-area-pb">
        <div className="mx-auto flex max-w-2xl gap-3">
          <Link
            href="/booking/options"
            className="flex-1 rounded-xl border border-gray-300 py-3 text-center text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
          >
            ← 戻る
          </Link>
          <button
            type="button"
            disabled={!isValid}
            onClick={handleNext}
            className={`flex-[2] rounded-xl py-3 text-center text-sm font-bold transition-all ${
              isValid
                ? "bg-emerald-600 text-white shadow-md hover:bg-emerald-700 active:scale-[0.98]"
                : "cursor-not-allowed bg-gray-300 text-gray-500"
            }`}
          >
            規約・支払い方法へ進む →
          </button>
        </div>
      </div>
    </div>
  );
}
