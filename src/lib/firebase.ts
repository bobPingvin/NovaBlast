import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, GithubAuthProvider, signInWithPopup, signInWithCustomToken, signOut, onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { initializeFirestore, getFirestore, setLogLevel, collection, doc, setDoc, getDoc, getDocFromServer, getDocs, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase SDK safely (prevents duplicate initialization during reloads)
const customAuthDomain =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN
    ? String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN).trim()
    : '';

const resolvedFirebaseConfig = customAuthDomain
  ? { ...firebaseConfig, authDomain: customAuthDomain }
  : firebaseConfig;

const app = getApps().length ? getApp() : initializeApp(resolvedFirebaseConfig);

// Set Firestore log level to silent to prevent benign transport logs from triggering console error listeners
setLogLevel('silent');

// Use WebChannel with automatic long-polling fallback (and ignore undefined fields cleanly)
export const db = (() => {
  try {
    return initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
      ignoreUndefinedProperties: true,
    }, firebaseConfig.firestoreDatabaseId);
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
})();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
export const githubProvider = new GithubAuthProvider();
githubProvider.addScope('read:user');
githubProvider.addScope('user:email');

const hasValidFirebaseConfig = Boolean(
  firebaseConfig?.projectId &&
  firebaseConfig.projectId !== 'remixed-project-id' &&
  firebaseConfig?.apiKey &&
  firebaseConfig?.firestoreDatabaseId
);

async function testConnection(retryCount = 0) {
  if (!hasValidFirebaseConfig) {
    console.error('Please check your Firebase configuration.');
    return;
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        void testConnection(0);
      }, { once: true });
    }
    return;
  }

  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      if (retryCount < 2) {
        const delayMs = retryCount === 0 ? 2000 : 4000;
        setTimeout(() => {
          void testConnection(retryCount + 1);
        }, delayMs);
        return;
      }
      console.warn('Firestore connection unavailable: client appears offline or Firestore transport is blocked by network/extensions.');
    }
  }
}
void testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy,
  limit,
  signInWithPopup,
  signInWithCustomToken,
  signOut,
  onAuthStateChanged,
  GithubAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  Timestamp
};
export type { User };
