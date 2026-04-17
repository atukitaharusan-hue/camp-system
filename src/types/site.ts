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
