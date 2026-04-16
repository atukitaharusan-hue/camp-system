"use client";

import { LiffContext, type LiffContextValue } from "@/contexts/LiffContext";
import type { Liff } from "@line/liff";
import { useEffect, useState, type ReactNode } from "react";

export default function LiffApp({ children }: { children: ReactNode }) {
  const [liffObject, setLiffObject] = useState<Liff | null>(null);
  const [liffError, setLiffError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [profile, setProfile] = useState<LiffContextValue["profile"]>(null);

  useEffect(() => {
    // admin・APIルートではLIFF不要
    const path = window.location.pathname;
    if (path.startsWith("/admin") || path.startsWith("/api")) {
      setIsReady(true);
      return;
    }

    // instrumentation-client.ts が設定した global Promise を待つ
    const liffReady = globalThis.__liffReady;
    if (!liffReady) {
      setIsReady(true);
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
    isLoggedIn: liffObject?.isLoggedIn() ?? false,
    isInClient: liffObject?.isInClient() ?? false,
    profile,
  };

  return (
    <LiffContext.Provider value={contextValue}>
      {children}
    </LiffContext.Provider>
  );
}
