import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Server-only Firebase Admin. Used by API routes to:
 *  - verify incoming Firebase ID tokens before calling Gemini
 *  - write to the rateLimits collection
 *
 * Expects FIREBASE_SERVICE_ACCOUNT_B64 (base64 of the service-account JSON).
 */
function getServiceAccount() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 is not set");
  const json = Buffer.from(b64, "base64").toString("utf8");
  return JSON.parse(json);
}

let adminApp: App | null = null;
function getAdminApp(): App {
  if (adminApp) return adminApp;
  if (getApps().length) {
    adminApp = getApps()[0]!;
    return adminApp;
  }
  adminApp = initializeApp({ credential: cert(getServiceAccount()) });
  return adminApp;
}

export function adminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function adminDb(): Firestore {
  return getFirestore(getAdminApp());
}

/**
 * Verify a Firebase ID token from the Authorization header.
 * Returns the decoded token (with uid) or throws.
 */
export async function verifyBearerToken(authorizationHeader: string | null): Promise<{ uid: string; email_verified: boolean }> {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    throw new Error("Missing or malformed Authorization header");
  }
  const idToken = authorizationHeader.slice("Bearer ".length).trim();
  const decoded = await adminAuth().verifyIdToken(idToken, true);
  return { uid: decoded.uid, email_verified: !!decoded.email_verified };
}
