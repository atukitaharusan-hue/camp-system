export type SiteType = "auto" | "family" | "cottage";

export interface SiteDetail {
  id: string;
  siteNumber: string;
  type: SiteType;
  areaName: string;
  subAreaName: string;
  siteName: string;
  description: string;
  capacity: number;
  price: number;
  designationFee: number;
  features: { water: boolean; electricity: boolean; sewer: boolean };
  slope: number;
  distance: number;
  available: boolean;
  imageUrl: string;
  compatiblePlanIds: string[];
}

export const siteTypeLabels: Record<SiteType, string> = {
  auto: "オートサイト",
  family: "ファミリー向けサイト",
  cottage: "コテージ",
};

export const planTypeDefaults: Record<string, SiteType> = {
  "off-season-auto": "auto",
  "off-season-cottage": "cottage",
  "family-oyako": "family",
  "family-cottage": "cottage",
  "standard-auto-a": "auto",
  "standard-cottage-b": "cottage",
  "standard-free": "family",
};

export const siteDetails: SiteDetail[] = [
  {
    id: "1",
    siteNumber: "A-01",
    type: "auto",
    areaName: "Aエリア",
    subAreaName: "川沿いサイト",
    siteName: "川沿いオートサイト A-01",
    description:
      "川音が近く、初めての方でも使いやすい標準的なオートサイトです。",
    capacity: 4,
    price: 5000,
    designationFee: 500,
    features: { water: true, electricity: true, sewer: false },
    slope: 3,
    distance: 50,
    available: true,
    imageUrl: "/site-map-placeholder.svg",
    compatiblePlanIds: ["off-season-auto", "standard-auto-a"],
  },
  {
    id: "2",
    siteNumber: "A-02",
    type: "auto",
    areaName: "Aエリア",
    subAreaName: "川沿いサイト",
    siteName: "電源付きオートサイト A-02",
    description:
      "電源付きで車横付けもしやすく、連泊でも使いやすいサイトです。",
    capacity: 5,
    price: 6200,
    designationFee: 800,
    features: { water: true, electricity: true, sewer: false },
    slope: 2,
    distance: 35,
    available: true,
    imageUrl: "/site-map-placeholder.svg",
    compatiblePlanIds: ["off-season-auto", "standard-auto-a"],
  },
  {
    id: "3",
    siteNumber: "B-01",
    type: "family",
    areaName: "Bエリア",
    subAreaName: "林間サイト",
    siteName: "林間ファミリーサイト B-01",
    description:
      "木陰が多く、子ども連れでも過ごしやすい広めの区画です。",
    capacity: 5,
    price: 5600,
    designationFee: 500,
    features: { water: false, electricity: true, sewer: false },
    slope: 4,
    distance: 80,
    available: false,
    imageUrl: "/site-map-placeholder.svg",
    compatiblePlanIds: ["family-oyako", "standard-free"],
  },
  {
    id: "4",
    siteNumber: "B-02",
    type: "family",
    areaName: "Bエリア",
    subAreaName: "林間サイト",
    siteName: "見晴らしファミリーサイト B-02",
    description:
      "開放感があり、家族利用で人気のあるゆったり区画です。",
    capacity: 6,
    price: 6100,
    designationFee: 700,
    features: { water: true, electricity: true, sewer: false },
    slope: 2,
    distance: 65,
    available: true,
    imageUrl: "/site-map-placeholder.svg",
    compatiblePlanIds: ["family-oyako", "standard-free"],
  },
  {
    id: "5",
    siteNumber: "C-01",
    type: "cottage",
    areaName: "Cエリア",
    subAreaName: "コテージ棟",
    siteName: "森側コテージ C-01",
    description:
      "水道と電源を備えた、静かに過ごしやすいコテージです。",
    capacity: 5,
    price: 12000,
    designationFee: 1500,
    features: { water: true, electricity: true, sewer: true },
    slope: 1,
    distance: 25,
    available: true,
    imageUrl: "/site-map-placeholder.svg",
    compatiblePlanIds: [
      "off-season-cottage",
      "family-cottage",
      "standard-cottage-b",
    ],
  },
  {
    id: "6",
    siteNumber: "C-02",
    type: "cottage",
    areaName: "Cエリア",
    subAreaName: "コテージ棟",
    siteName: "広めコテージ C-02",
    description:
      "荷物が多い滞在でも使いやすい、ゆとりのあるコテージです。",
    capacity: 6,
    price: 13200,
    designationFee: 1800,
    features: { water: true, electricity: true, sewer: true },
    slope: 1,
    distance: 20,
    available: true,
    imageUrl: "/site-map-placeholder.svg",
    compatiblePlanIds: [
      "off-season-cottage",
      "family-cottage",
      "standard-cottage-b",
    ],
  },
];

export function getSiteById(id: string): SiteDetail | undefined {
  return siteDetails.find((site) => site.id === id);
}
