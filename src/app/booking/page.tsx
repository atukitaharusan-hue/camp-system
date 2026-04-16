"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /booking へのアクセスを /booking/plans へリダイレクトする。
 * 日付入力は / (TOP) で行い、プラン選択以降は /booking/plans から始まる。
 */
export default function BookingPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/booking/plans");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500 text-sm">リダイレクト中...</p>
    </div>
  );
}