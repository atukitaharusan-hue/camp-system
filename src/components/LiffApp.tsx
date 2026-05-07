"use client";

import { LiffContext, type LiffContextValue } from "@/contexts/LiffContext";
import type { Liff } from "@line/liff";
import { useEffect, useState, type ReactNode } from "react";

function isLocalDevLiffProfileEnabled() {
  if (typeof window === "undefined") return false;
  const isExplicitlyEnabled = process.env.NEXT_PUBLIC_ENABLE_DEV_LIFF_PROFILE === "true";
  const isVercelPreview = process.env.NEXT_PUBLIC_VERCEL_ENV === "preview";
  const isDevelopment = process.env.NODE_ENV === "development";
  const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (!isLocalhost && !isVercelPreview) return false;
  return isExplicitlyEnabled || (isDevelopment && process.env.NEXT_PUBLIC_LINE_LIFF_ID === "dummy_liff_id");
}

const devLiffProfile: NonNullable<LiffContextValue["profile"]> = {
  userId: "dev-preview-line-user",
  displayName: "プレビューテストユーザー",
  pictureUrl: undefined,
};

function runAfterEffect(callback: () => void) {
  queueMicrotask(callback);
}

export default function LiffApp({ children }: { children: ReactNode }) {
  const [liffObject, setLiffObject] = useState<Liff | null>(null);
  const [liffError, setLiffError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [profile, setProfile] = useState<LiffContextValue["profile"]>(null);

  useEffect(() => {
    // admin・APIルートではLIFF不要
    const path = window.location.pathname;
    if (path.startsWith("/admin") || path.startsWith("/api")) {
      runAfterEffect(() => setIsReady(true));
      return;
    }

    if (isLocalDevLiffProfileEnabled()) {
      runAfterEffect(() => {
        setProfile(devLiffProfile);
        setIsReady(true);
      });
      return;
    }

    // instrumentation-client.ts が設定した global Promise を待つ
    const liffReady = globalThis.__liffReady;
    if (!liffReady) {
      runAfterEffect(() => setIsReady(true));
      return;
    }

    liffReady
      .then(async (liff) => {
        if (!liff) return; // リダイレクト中

        setLiffObject(liff);
        setIsReady(true);

        if (liff.isLoggedIn()) {
          const p = await liff.getProfile();
          setProfile({
            userId: p.userId,
            displayName: p.displayName,
            pictureUrl: p.pictureUrl,
          });
        }
      })
      .catch((error) => {
        console.error("LIFF setup failed:", error);
        setLiffError(String(error));
        setIsReady(true);
      });
  }, []);

  const contextValue: LiffContextValue = {
    liff: liffObject,
    liffError,
    isReady,
    isLoggedIn: Boolean(profile) || (liffObject?.isLoggedIn() ?? false),
    isInClient: liffObject?.isInClient() ?? false,
    profile,
  };

  return (
    <LiffContext.Provider value={contextValue}>
      {children}
    </LiffContext.Provider>
  );
}
