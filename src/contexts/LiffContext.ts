"use client";

import type { Liff } from "@line/liff";
import { createContext, useContext } from "react";

export type LiffContextValue = {
  liff: Liff | null;
  liffError: string | null;
  isReady: boolean;
  isLoggedIn: boolean;
  isInClient: boolean;
  profile: { userId: string; displayName: string; pictureUrl?: string } | null;
};

export const LiffContext = createContext<LiffContextValue>({
  liff: null,
  liffError: null,
  isReady: false,
  isLoggedIn: false,
  isInClient: false,
  profile: null,
});

export const useLiff = () => useContext(LiffContext);
