"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBookingDraftStore } from "@/stores/bookingDraftStore";

// サイト選択ページ（静的UI / ワイヤーフレーム相当）
// - サイト選択・保存・次ページ遷移ロジックは未実装
// - ダミーデータで見た目のみ構築

type SiteStatus = "available" | "selected" | "reserved" | "maintenance";

const STATUS_LABELS: Record<SiteStatus, string> = {
  available: "空き",
  selected: "選択中",
  reserved: "予約済み",
  maintenance: "メンテナンス中",
};

const STATUS_STYLES: Record<SiteStatus, string> = {
  available: "bg-white border-gray-300 text-gray-800",
  selected: "bg-blue-50 border-blue-500 ring-2 ring-blue-300 text-blue-800",
  reserved: "bg-gray-100 border-gray-300 text-gray-400",
  maintenance: "bg-yellow-50 border-yellow-400 text-yellow-700 border-dashed",
};

const LEGEND_DOT_STYLES: Record<SiteStatus, string> = {
  available: "bg-white border border-gray-400",
  selected: "bg-blue-100 border-2 border-blue-500",
  reserved: "bg-gray-200 border border-gray-400",
  maintenance: "bg-yellow-100 border border-dashed border-yellow-500",
};

type Site = {
  id: string;
  name: string;
  status: SiteStatus;
};

type SubArea = {
  name: string;
  description: string;
  sites: Site[];
};

type Area = {
  name: string;
  description: string;
  subAreas: SubArea[];
};

/** ISO 日付文字列 → 表示用 */
function formatDate(iso: string): string {
  return iso.replace(/-/g, "/");
}

// ダミーエリアデータ（後からSupabase等に差し替え可能）
const DUMMY_AREAS: Area[] = [
  {
    name: "ほたるの里エリア",
    description: "川に近く、自然を感じやすいエリア",
    subAreas: [
      {
        name: "いこいの森エリア",
        description: "木陰が多く、静かに過ごしやすい区画",
        sites: [
          { id: "a1", name: "A-1", status: "available" },
          { id: "a2", name: "A-2", status: "selected" },
          { id: "a3", name: "A-3", status: "available" },
          { id: "a4", name: "A-4", status: "reserved" },
        ],
      },
      {
        name: "川辺エリア",
        description: "川のせせらぎが聞こえる開放的な区画",
        sites: [
          { id: "b1", name: "B-1", status: "available" },
          { id: "b2", name: "B-2", status: "reserved" },
          { id: "b3", name: "B-3", status: "available" },
        ],
      },
    ],
  },
  {
    name: "みはらしの丘エリア",
    description: "高台にあり、見晴らしの良いエリア",
    subAreas: [
      {
        name: "展望サイト",
        description: "景色を楽しめる人気の区画",
        sites: [
          { id: "c1", name: "C-1", status: "available" },
          { id: "c2", name: "C-2", status: "maintenance" },
          { id: "c3", name: "C-3", status: "available" },
        ],
      },
      {
        name: "星空サイト",
        description: "夜空がきれいに見える静かな区画",
        sites: [
          { id: "d1", name: "D-1", status: "available" },
          { id: "d2", name: "D-2", status: "available" },
        ],
      },
    ],
  },
];

// ダミーサイト詳細（後から選択連動に差し替え可能）
const DUMMY_DETAIL = {
  name: "A-1",
  drainage: "良好",
  slope: "ほぼ平坦",
  view: "林間・木漏れ日あり",
  distanceFromEntrance: "徒歩2分",
  note: "初心者におすすめのサイトです。炊事場・トイレが近くにあります。",
  designationFee: 500,
};

export default function SiteSelectionPage() {
  const router = useRouter();
  const { stay, plan } = useBookingDraftStore();

  const hasPlan = !!(plan.majorCategoryId && plan.minorPlanId);
  const hasStay = !!(stay.checkIn && stay.checkOut && stay.nights > 0);

  // plan が未選択ならプラン選択ページへリダイレクト
  useEffect(() => {
    if (!hasPlan) {
      router.replace("/booking/plans");
    }
  }, [hasPlan, router]);

  if (!hasPlan) return null;

  const planLabel = plan.planName
    ? { categoryName: plan.categoryName ?? '', planName: plan.planName }
    : null;

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-md px-4 py-6">
        {/* ヘッダー */}
        <section className="mb-6">
          <button
            type="button"
            onClick={() => router.push("/booking/plans")}
            className="text-sm text-blue-600 hover:text-blue-800 mb-3 inline-flex items-center gap-1"
          >
            ← プラン選択に戻る
          </button>
          <h1 className="text-xl font-bold text-gray-900">サイトを選択</h1>
          <p className="mt-1 text-sm text-gray-500">
            ご希望のサイト番号をお選びください
          </p>
        </section>

        {/* 宿泊日・プランサマリー */}
        <section className="mb-6 space-y-2">
          {hasStay && (
            <div className="border border-blue-200 bg-blue-50 rounded-lg px-4 py-3">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">宿泊日：</span>
                {formatDate(stay.checkIn!)} 〜 {formatDate(stay.checkOut!)}
                （<strong>{stay.nights}泊</strong>）
              </p>
            </div>
          )}
          {planLabel && (
            <div className="border border-green-200 bg-green-50 rounded-lg px-4 py-3">
              <p className="text-sm text-green-800">
                <span className="font-semibold">プラン：</span>
                {planLabel.categoryName} / {planLabel.planName}
              </p>
            </div>
          )}
        </section>

        {/* 場内マップ */}
        <section className="mb-6">
          <div className="flex h-48 items-center justify-center rounded border-2 border-dashed border-gray-300 bg-gray-50">
            <p className="text-sm text-gray-400">
              場内マップ（後で画像挿入）
            </p>
          </div>
        </section>

        {/* 凡例 */}
        <section className="mb-6 rounded border border-gray-200 bg-gray-50 p-3">
          <p className="mb-2 text-xs font-medium text-gray-500">空き状況</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {(Object.entries(STATUS_LABELS) as [SiteStatus, string][]).map(
              ([status, label]) => (
                <div key={status} className="flex items-center gap-1.5">
                  <span
                    className={`inline-block h-3 w-3 rounded-sm ${LEGEND_DOT_STYLES[status]}`}
                  />
                  <span className="text-xs text-gray-600">{label}</span>
                </div>
              )
            )}
          </div>
        </section>

        {/* エリア別サイト一覧 */}
        <section className="mb-6 space-y-6">
          {DUMMY_AREAS.map((area) => (
            <div key={area.name}>
              {/* 大カテゴリ */}
              <h2 className="text-base font-bold text-gray-800">
                {area.name}
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">
                {area.description}
              </p>

              <div className="mt-3 space-y-4 pl-3 border-l-2 border-gray-200">
                {area.subAreas.map((sub) => (
                  <div key={sub.name}>
                    {/* 中カテゴリ */}
                    <h3 className="text-sm font-semibold text-gray-700">
                      {sub.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {sub.description}
                    </p>

                    {/* サイト番号グリッド */}
                    <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {sub.sites.map((site) => (
                        <div
                          key={site.id}
                          className={`flex h-14 cursor-pointer items-center justify-center rounded-md border text-sm font-medium transition-colors ${STATUS_STYLES[site.status]}`}
                        >
                          {site.name}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* 選択中サイトの写真エリア（プレースホルダー） */}
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">
            サイト写真
          </h2>
          <div className="flex aspect-video items-center justify-center rounded border-2 border-dashed border-gray-300 bg-gray-50">
            <p className="text-sm text-gray-400">
              サイトを選択すると写真が表示されます
            </p>
          </div>
        </section>

        {/* サイト詳細（ダミー固定表示） */}
        <section className="mb-6 rounded border border-gray-200 p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">
            サイト詳細
          </h2>
          <dl className="space-y-2 text-sm">
            {[
              ["サイト番号", DUMMY_DETAIL.name],
              ["水はけ", DUMMY_DETAIL.drainage],
              ["傾斜", DUMMY_DETAIL.slope],
              ["景観", DUMMY_DETAIL.view],
              ["入口からの距離", DUMMY_DETAIL.distanceFromEntrance],
              ["補足", DUMMY_DETAIL.note],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-start gap-2 border-b border-gray-100 pb-2 last:border-b-0 last:pb-0"
              >
                <dt className="w-28 shrink-0 text-gray-500">{label}</dt>
                <dd className="text-gray-800">{value}</dd>
              </div>
            ))}
          </dl>
          {/* サイト指定料金 */}
          <div className="mt-3 rounded bg-blue-50 px-3 py-2 text-sm">
            <span className="text-gray-600">サイト指定料金：</span>
            <span className="font-semibold text-blue-700">
              +{DUMMY_DETAIL.designationFee.toLocaleString()}円
            </span>
          </div>
        </section>

        {/* 予約へ進むボタン（ダミー） */}
        <section>
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-md bg-gray-300 py-3 text-center text-sm font-semibold text-gray-500"
          >
            予約へ進む（準備中）
          </button>
          <p className="mt-2 text-center text-xs text-gray-400">
            サイトを選択すると予約に進めます
          </p>
        </section>
      </div>
    </main>
  );
}
