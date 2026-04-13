import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

/**
 * Firebase web SDK (client). Server-side Admin SDK can be added later for trusted operations.
 */
function readConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

let app: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  const config = readConfig();
  if (!config.apiKey || !config.projectId) {
    throw new Error(
      "Missing Firebase env vars. Copy .env.local.example to .env.local and add your Firebase web config."
    );
  }
  app = getApps().length ? getApps()[0]! : initializeApp(config);
  return app;
}

export function getFirebaseAuth() {
  return getAuth(getFirebaseApp());
}

export function getDb() {
  return getFirestore(getFirebaseApp());
}

export function isFirebaseConfigured(): boolean {
  const c = readConfig();
  return Boolean(c.apiKey && c.projectId);
}
