import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const rawApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
// Safe build-time placeholder so getAuth does not throw auth/invalid-api-key during static analysis
const apiKey = rawApiKey && rawApiKey.trim() !== '' ? rawApiKey : 'AIzaSyBuildTimePrerenderKeySafePlaceholder00';

const firebaseConfig = {
  apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'agricart-erp.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'agricart-erp',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'agricart-erp.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:1234567890:web:abcdef123456',
};

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

let _auth: Auth;
try {
  _auth = getAuth(app);
} catch (authErr) {
  console.warn('Firebase client getAuth initialization warning:', authErr);
  _auth = {} as Auth;
}

export const auth: Auth = _auth;
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);
export default app;
