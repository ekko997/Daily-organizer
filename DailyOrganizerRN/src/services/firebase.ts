import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, Auth } from 'firebase/auth';
// @ts-ignore — this RN-specific persistence helper exists at runtime even if types lag behind
import { getReactNativePersistence } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// PASTE YOUR FIREBASE CONFIG HERE — from Firebase Console → Project Settings → General → Your apps
const firebaseConfig = {
  apiKey: 'AIzaSyA-IUyBkBfM4gMCcrCzs8jeY_oCrbTSrmY',
  authDomain: 'daily-organizer-a6e84.firebaseapp.com',
  projectId: 'daily-organizer-a6e84',
  storageBucket: 'daily-organizer-a6e84.firebasestorage.app',
  messagingSenderId: '356687193221',
  appId: '1:356687193221:web:05722907acdebdcf8575ec',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let authInstance: Auth;
try {
  authInstance = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
} catch {
  // Falls back to default (non-persisted) auth if RN persistence isn't available
  // in the installed firebase version — sign-in will just be required each app launch.
  authInstance = getAuth(app);
}

export const auth = authInstance;

// Firestore's default connection method (WebChannel/gRPC) can silently hang
// with no error on certain networks (some WiFi routers, VPNs, corporate
// networks). Forcing long-polling is the standard, well-documented fix —
// it's slightly less efficient but far more reliable across networks.
//
// ignoreUndefinedProperties: Firestore normally REJECTS any write containing
// an `undefined` field (e.g. an optional field left blank) — this makes it
// silently drop those fields instead of failing the whole write.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false,
  ignoreUndefinedProperties: true,
});
