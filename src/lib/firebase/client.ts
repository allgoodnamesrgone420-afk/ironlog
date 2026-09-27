"use client";

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  inMemoryPersistence,
  type Auth,
} from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
} as const;

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  // Fail loudly in dev — never silently boot a broken Firebase client.
  // (NEXT_PUBLIC_* values are inlined at build time, so this also catches missing build-time env vars.)
  console.error("[ironlog] Missing NEXT_PUBLIC_FIREBASE_* env vars — copy .env.example to .env.local");
}

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

/**
 * The default getAuth() eagerly wires up the popup/redirect resolver, which loads
 * a hidden auth iframe from <project>.firebaseapp.com. IronLog only uses
 * email/password, so we initialize Auth WITHOUT that resolver and with an
 * explicit persistence fallback chain. getAuth() is kept for the server-side
 * prerender pass where browser persistence isn't available.
 */
function resolveAuth(a: FirebaseApp): Auth {
  if (typeof window === "undefined") return getAuth(a);
  try {
    return initializeAuth(a, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence],
    });
  } catch {
    return getAuth(a);
  }
}

/**
 * In the browser, keep Firestore's cache in IndexedDB so sets logged offline
 * (a basement gym) are queued on disk and survive closing the app, instead of
 * living only in memory until the connection returns.
 */
function resolveDb(a: FirebaseApp): Firestore {
  if (typeof window === "undefined") return getFirestore(a);
  try {
    return initializeFirestore(a, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    // Already initialized (e.g. hot reload in dev).
    return getFirestore(a);
  }
}

export const auth: Auth = resolveAuth(app);
export const db: Firestore = resolveDb(app);
export default app;
