import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/* ─── 型定義 ─── */

export type BookingDraft = {
  stay: {
    checkIn: string | null;
    checkOut: string | null;
    nights: number;
    adults: number;
    children: number;
  };
  plan: {
    majorCategoryId: string | null;
    minorPlanId: string | null;
    planName: string | null;
    categoryName: string | null;
  };
  site: {
    areaId: string | null;
    siteId: string | null;
    siteNumber: string | null;
    siteName: string | null;
    sitePrice: number;
    siteFee: number;
    designationFee: number;
    areaName: string | null;
    subAreaName: string | null;
  };
  options: {
    rentals: Array<{
      optionId: string;
      quantity: number;
      days?: number;
      subtotal: number;
    }>;
    events: Array<{
      optionId: string;
      people: number;
      subtotal: number;
    }>;
  };
  policy: {
    agreedCancellation: boolean;
    agreedTerms: boolean;
    agreedSns: boolean;
  };
  payment: {
    method: string | null;
  };
  userInfo: {
    gender: string | null;
    occupation: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    referralSource: string | null;
  };
  lineProfile: {
    userId: string | null;
    displayName: string | null;
    pictureUrl: string | null;
  };
  meta: {
    version: number;
    updatedAt: number;
  };
};

type BookingDraftActions = {
  setStay: (stay: Partial<BookingDraft["stay"]>) => void;
  setPlan: (plan: Partial<BookingDraft["plan"]>) => void;
  resetPlan: () => void;
  setSite: (site: Partial<BookingDraft["site"]>) => void;
  setOptions: (options: Partial<BookingDraft["options"]>) => void;
  setPolicy: (policy: Partial<BookingDraft["policy"]>) => void;
  setPayment: (payment: Partial<BookingDraft["payment"]>) => void;
  setUserInfo: (userInfo: Partial<BookingDraft["userInfo"]>) => void;
  setLineProfile: (lineProfile: Partial<BookingDraft["lineProfile"]>) => void;
  reset: () => void;
};

/* ─── 初期値 ─── */

const initialDraft: BookingDraft = {
  stay: {
    checkIn: null,
    checkOut: null,
    nights: 0,
    adults: 1,
    children: 0,
  },
  plan: {
    majorCategoryId: null,
    minorPlanId: null,
    planName: null,
    categoryName: null,
  },
  site: {
    areaId: null,
    siteId: null,
    siteNumber: null,
    siteName: null,
    sitePrice: 0,
    siteFee: 0,
    designationFee: 0,
    areaName: null,
    subAreaName: null,
  },
  options: {
    rentals: [],
    events: [],
  },
  policy: {
    agreedCancellation: false,
    agreedTerms: false,
    agreedSns: false,
  },
  payment: {
    method: null,
  },
  userInfo: {
    gender: null,
    occupation: null,
    phone: null,
    email: null,
    address: null,
    referralSource: null,
  },
  lineProfile: {
    userId: null,
    displayName: null,
    pictureUrl: null,
  },
  meta: {
    version: 1,
    updatedAt: 0,
  },
};

/* ─── ストア ─── */

export const useBookingDraftStore = create<BookingDraft & BookingDraftActions>()(
  persist(
    (set) => ({
      ...initialDraft,

      setStay: (stay) =>
        set((state) => ({
          stay: { ...state.stay, ...stay },
          meta: { ...state.meta, updatedAt: Date.now() },
        })),

      setPlan: (plan) =>
        set((state) => ({
          plan: { ...state.plan, ...plan },
          meta: { ...state.meta, updatedAt: Date.now() },
        })),

      resetPlan: () =>
        set((state) => ({
          plan: { ...initialDraft.plan },
          meta: { ...state.meta, updatedAt: Date.now() },
        })),

      setSite: (site) =>
        set((state) => ({
          site: { ...state.site, ...site },
          meta: { ...state.meta, updatedAt: Date.now() },
        })),

      setOptions: (options) =>
        set((state) => ({
          options: { ...state.options, ...options },
          meta: { ...state.meta, updatedAt: Date.now() },
        })),

      setPolicy: (policy) =>
        set((state) => ({
          policy: { ...state.policy, ...policy },
          meta: { ...state.meta, updatedAt: Date.now() },
        })),

      setPayment: (payment) =>
        set((state) => ({
          payment: { ...state.payment, ...payment },
          meta: { ...state.meta, updatedAt: Date.now() },
        })),

      setUserInfo: (userInfo) =>
        set((state) => ({
          userInfo: { ...state.userInfo, ...userInfo },
          meta: { ...state.meta, updatedAt: Date.now() },
        })),

      setLineProfile: (lineProfile) =>
        set((state) => ({
          lineProfile: { ...state.lineProfile, ...lineProfile },
          meta: { ...state.meta, updatedAt: Date.now() },
        })),

      reset: () =>
        set({ ...initialDraft, meta: { version: 1, updatedAt: Date.now() } }),
    }),
    {
      name: "booking-draft",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
