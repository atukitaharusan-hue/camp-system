"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiff } from "@/contexts/LiffContext";
import { supabase } from "@/lib/supabase";
import ReservationStatusBadge from "@/components/reservation/ReservationStatusBadge";
import type { Database } from "@/types/database";

type GuestRow = Database["public"]["Tables"]["guest_reservations"]["Row"];

type ReservationSummary = {
  id: string;
  status: GuestRow["status"];
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  guests: number;
  siteNumber: string | null;
  totalAmount: number;
  createdAt: string;
};

const STATUS_ORDER: Record<string, number> = {
  confirmed: 0,
  pending: 1,
  checked_in: 2,
  completed: 3,
  cancelled: 4,
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const w = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getMonth() + 1}/${d.getDate()}（${w[d.getDay()]}）`;
}

export default function MyReservationsPage() {
  const router = useRouter();
  const { isReady, isLoggedIn, profile } = useLiff();
  const [reservations, setReservations] = useState<ReservationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isReady) return;
    if (!isLoggedIn || !profile?.userId) {
      setLoading(false);
      return;
    }

    (async () => {
      const { data } = await supabase
        .from("guest_reservations")
        .select("id, status, check_in_date, check_out_date, nights, guests, site_number, total_amount, created_at")
        .eq("user_identifier", profile.userId)
        .order("check_in_date", { ascending: false });

      if (data) {
        const mapped: ReservationSummary[] = data.map((r) => ({
          id: r.id,
          status: r.status,
          checkInDate: r.check_in_date,
          checkOutDate: r.check_out_date,
          nights: r.nights,
          guests: r.guests,
          siteNumber: r.site_number,
          totalAmount: Number(r.total_amount),
          createdAt: r.created_at,
        }));
        mapped.sort((a, b) => (STATUS_ORDER[a.status ?? ""] ?? 9) - (STATUS_ORDER[b.status ?? ""] ?? 9));
        setReservations(mapped);
      }
      setLoading(false);
    })();
  }, [isReady, isLoggedIn, profile]);

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
          <p className="mb-6 text-sm text-gray-500">予約一覧を表示するにはLINEアプリからアクセスしてください。</p>
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
        {/* ヘッダー */}
        <div className="mb-8 text-center">
          <Link href="/mypage" className="inline-block text-sm text-emerald-700 hover:text-emerald-800 transition-colors">
            ← マイページに戻る
          </Link>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900">予約一覧</h1>
          <p className="mt-2 text-sm text-gray-500">あなたの予約状況を確認できます。</p>
        </div>

        {loading ? (
          <div className="py-20 text-center text-sm text-gray-400">読み込み中...</div>
        ) : reservations.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
            <p className="mb-2 font-semibold text-gray-600">予約がありません</p>
            <p className="mb-6 text-sm text-gray-400">新しい予約を作成しましょう。</p>
            <Link href="/" className="inline-block rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
              予約する
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {reservations.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => router.push(`/reservation/${r.id}/qr`)}
                className="w-full rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all hover:border-gray-300 hover:shadow-md active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-gray-800">
                        {formatDate(r.checkInDate)} 〜 {formatDate(r.checkOutDate)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span>{r.nights}泊</span>
                      <span>{r.guests}名</span>
                      {r.siteNumber && <span>サイト: {r.siteNumber}</span>}
                      <span>¥{r.totalAmount.toLocaleString("ja-JP")}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <ReservationStatusBadge status={r.status ?? "pending"} />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] text-gray-400">
                    予約番号: {r.id.substring(0, 8).toUpperCase()}
                  </span>
                  <span className="text-xs font-medium text-emerald-600">詳細を見る →</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
