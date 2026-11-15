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
 * Locally, FIREBASE_AUTH_EMULATOR_HOST (and FIRESTORE_EMULATOR_HOST) point it
 * at the emulators instead, which need no credentials.
 */

/** The server can't check tokens at all (missing or broken credentials): not the caller's fault. */
export class AdminConfigError extends Error {}

function getServiceAccount() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) throw new AdminConfigError("FIREBASE_SERVICE_ACCOUNT_B64 is not set");
  try {
    return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  } catch {
    throw new AdminConfigError("FIREBASE_SERVICE_ACCOUNT_B64 is not valid base64 JSON");
  }
}

let adminApp: App | null = null;
function getAdminApp(): App {
  if (adminApp) return adminApp;
  if (getApps().length) {
    adminApp = getApps()[0]!;
    return adminApp;
  }
  adminApp = process.env.FIREBASE_AUTH_EMULATOR_HOST
    ? initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID })
    : initializeApp({ credential: cert(getServiceAccount()) });
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

/**
 * The AI routes spend money per call, and anyone can create an account, so a
 * throwaway address must not be enough to use them: the email has to be
 * verified. Set ALLOW_UNVERIFIED_AI=true to switch this off.
 */
export function mayUseAI(user: { email_verified: boolean }): boolean {
  return user.email_verified || process.env.ALLOW_UNVERIFIED_AI === "true";
}

export const UNVERIFIED_MESSAGE = "Verify your email to use the AI features. Settings has a button to resend the link.";
