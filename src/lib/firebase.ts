// src/lib/firebase.ts
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBncmvFQk5jwWHvLCcaAx8XaAQsYhbHPTs",
  authDomain: "insightsales-v2.firebaseapp.com",
  projectId: "insightsales-v2",
  storageBucket: "insightsales-v2.firebasestorage.app",
  messagingSenderId: "871199759493",
  appId: "1:871199759493:web:459f3bf08f5c2c6332ddec"
};

// Initialize main app
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Helper function to create a user without signing out the current Admin user
// This requires a secondary App instance.
export async function createSecondaryUser(email: string, pass: string, role: string) {
  // Check if secondary app exists
  let secondaryApp;
  if (!getApps().length || getApps().length === 1) {
    secondaryApp = initializeApp(firebaseConfig, "Secondary");
  } else {
    secondaryApp = getApp("Secondary");
  }
  
  const secondaryAuth = getAuth(secondaryApp);
  const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
  
  // Write to users collection
  await setDoc(doc(db, "users", userCredential.user.uid), {
    email: email,
    role: role,
    createdAt: Date.now()
  });

  // Secondary auth sign out to clear session
  await secondaryAuth.signOut();
  return userCredential.user;
}
