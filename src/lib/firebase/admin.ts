import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import type { Storage } from 'firebase-admin/storage';

if (typeof window !== 'undefined') {
  throw new Error('Firebase Admin SDK cannot be executed in the browser.');
}

function getPrivateKey(): string | undefined {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!privateKey) return undefined;
  return privateKey.replace(/\\n/g, '\n');
}

function isValidPrivateKey(key?: string): boolean {
  if (!key) return false;
  if (key.includes('...') || key.includes('Sample') || key.length < 200) return false;
  return key.includes('-----BEGIN PRIVATE KEY-----');
}

let app: App;

if (getApps().length === 0) {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getPrivateKey();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'agricart-shop-next';

  if (clientEmail && isValidPrivateKey(privateKey)) {
    app = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey!,
      }),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
    });
  } else {
    // If running in development without live GCP service account key, initialize default app
    app = initializeApp({
      projectId,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
    });
  }
} else {
  app = getApps()[0];
}

export const hasValidAdminCredentials = Boolean(
  process.env.FIREBASE_CLIENT_EMAIL && isValidPrivateKey(getPrivateKey())
);

export const adminAuth: Auth = getAuth(app);
export const adminDb: Firestore = getFirestore(app);
try {
  adminDb.settings({ ignoreUndefinedProperties: true });
} catch {
  // Settings might have already been locked if reused
}
let _adminStorage: Storage | null = null;

export function getAdminStorage(): Storage {
  if (!_adminStorage) {
    // Dynamically load firebase-admin/storage to avoid eager evaluation of @google-cloud/storage
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getStorage } = require('firebase-admin/storage');
    _adminStorage = getStorage(app);
  }
  return _adminStorage!;
}

export const adminStorage: Storage = new Proxy({} as Storage, {
  get(_target, prop, receiver) {
    return Reflect.get(getAdminStorage(), prop, receiver);
  },
});

export default app;
