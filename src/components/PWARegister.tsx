"use client";

import { useEffect } from "react";

/** Registers the service worker on mount. Mounted from the (app) layout. */
export function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* ignore — SW is best-effort */
    });
  }, []);
  return null;
}
