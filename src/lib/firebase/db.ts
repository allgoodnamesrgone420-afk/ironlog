"use client";

import type { FirebaseApp } from "firebase/app";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import app from "./client";

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
      // Optional fields left undefined (a set without RPE, an exercise without
      // notes) are skipped instead of failing the whole write.
      ignoreUndefinedProperties: true,
    });
  } catch {
    // Already initialized (e.g. hot reload in dev).
    return getFirestore(a);
  }
}

export const db: Firestore = resolveDb(app);
