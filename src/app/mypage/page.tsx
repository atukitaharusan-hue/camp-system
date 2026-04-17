"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLiff } from "@/contexts/LiffContext";
import { supabase } from "@/lib/supabase";

type UserProfile = {
  displayName: string;
  pictureUrl: string | null;
  gender: string | null;
  occupation: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  reservationCount: number;
};

export default function MyPage() {
  const { isReady, isLoggedIn, profile: liffProfile } = useLiff();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isReady) return;
    if (!isLoggedIn || !liffProfile?.userId) {
      setLoading(false);
      return;
    }

    (async () => {
      // 予約数と最新の予約からプロフィール情報を取得
      const { data, count } = await supabase
        .from("guest_reservations")
        .select("user_gender, user_occupation, user_phone, user_email, user_address", { count: "exact" })
        .eq("user_identifier", liffProfile.userId)
        .order("created_at", { ascending: false })
        .limit(1);

      const latest = data?.[0];
      setUserProfile({
        displayName: liffProfile.displayName,
        pictureUrl: liffProfile.pictureUrl ?? null,
        gender: latest?.user_gender ?? null,
        occupation: latest?.user_occupation ?? null,
        phone: latest?.user_phone ?? null,
        email: latest?.user_email ?? null,
        address: latest?.user_address ?? null,
        reservationCount: count ?? 0,
      });
      setLoading(false);
    })();
  }, [isReady, isLoggedIn, liffProfile]);

  // 未ログイン
  if (isReady && !isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-stone-50 to-emerald-50/30 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <p className="mb-2 font-semibold text-gray-700">LINEログインが必要です</p>
          <p className="mb-6 text-sm text-gray-500">マイページを表示するにはLINEアプリからアクセスしてください。</p>
          <Link href="/" className="inline-block rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
            TOPへ戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-emerald-50/30 py-8 pb-20">
      <div className="mx-auto max-w-2xl px-4">
        {loading ? (
          <div className="py-20 text-center text-sm text-gray-400">読み込み中...</div>
        ) : userProfile ? (
          <div className="space-y-6">
            {/* プロフィールカード */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-4">
                {userProfile.pictureUrl ? (
                  <img
                    src={userProfile.pictureUrl}
                    alt=""
                    className="h-16 w-16 rounded-full border-2 border-emerald-200 object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                    <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-bold text-gray-800">{userProfile.displayName}</h2>
                  <p className="text-sm text-gray-500">
                    予約回数: <span className="font-semibold text-emerald-700">{userProfile.reservationCount}回</span>
                  </p>
                </div>
              </div>
            </section>

            {/* 登録情報 */}
            <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-4">
                <h3 className="text-sm font-semibold text-gray-800">登録情報</h3>
              </div>
              <div className="divide-y divide-gray-50 px-5">
                <ProfileRow label="性別" value={userProfile.gender} />
                <ProfileRow label="電話番号" value={userProfile.phone} />
                <ProfileRow label="メールアドレス" value={userProfile.email} />
                <ProfileRow label="住所" value={userProfile.address} />
                <ProfileRow label="ご職業" value={userProfile.occupation} />
              </div>
              {!userProfile.phone && !userProfile.email && (
                <div className="border-t border-gray-100 px-5 py-4">
                  <p className="text-xs text-amber-600">
                    予約時にお客様情報を入力すると、次回から自動で入力されます。
                  </p>
                </div>
              )}
            </section>

            {/* メニュー */}
            <section className="space-y-3">
              <Link
                href="/mypage/reservations"
                className="flex w-full items-center justify-between rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
                    <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">予約一覧</p>
                    <p className="text-xs text-gray-500">予約状況の確認・QRコード表示</p>
                  </div>
                </div>
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>

              <Link
                href="/"
                className="flex w-full items-center justify-between rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
                    <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">新規予約</p>
                    <p className="text-xs text-gray-500">新しいキャンプ予約を作成</p>
                  </div>
                </div>
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>

              <Link
                href="/availability-calendar"
                className="flex w-full items-center justify-between rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50">
                    <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">空き状況カレンダー</p>
                    <p className="text-xs text-gray-500">サイトの空き状況を確認</p>
                  </div>
                </div>
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-800">{value || "—"}</span>
    </div>
  );
}
