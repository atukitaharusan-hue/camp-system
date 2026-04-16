// instrumentation-client.ts
// Reactより先に実行される。LIFF init の結果を global Promise で共有し、
// LiffApp コンポーネントが二重 init せず確実に参照できるようにする。

import type { Liff } from "@line/liff";

declare global {
  var __liffReady: Promise<Liff | null> | undefined;
}

const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID;

if (liffId && liffId !== "dummy_liff_id") {
  console.info(`[instrumentation-client] Initializing LIFF with ID: ${liffId}`);
  const path = window.location.pathname;
  if (!path.startsWith("/admin") && !path.startsWith("/api")) {
    globalThis.__liffReady = import("@line/liff")
      .then((mod) => mod.default)
      .then(async (liff) => {
        await liff.init({ liffId });

        if (liff.isLoggedIn()) {
          // ログイン後の code パラメータをクリーンアップ
          const url = new URL(window.location.href);
          if (url.searchParams.has("code")) {
            url.search = "";
            window.location.replace(url.toString());
            return null; // リダイレクト中
          }
          return liff;
        } else {
          liff.login();
          return null; // リダイレクト中
        }
      })
      .catch((err) => {
        console.error("[instrumentation-client] LIFF init failed:", err);
        return null;
      });
  }
}
