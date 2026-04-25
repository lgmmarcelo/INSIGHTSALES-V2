import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AuthContextType {
  currentUser: User | null;
  userRole: 'admin' | 'analyst' | 'viewer' | null;
  loading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userRole: null,
  loading: true,
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'analyst' | 'viewer' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Fetch role
        try {
          const userDocRef = doc(db, 'users', user.uid);
          let exists = false;
          let role = 'viewer';
          
          try {
            const userDoc = await getDoc(userDocRef);
            exists = userDoc.exists();
            if (exists) {
              role = userDoc.data().role;
            }
          } catch (e: any) {
            console.error("GET DOC FAILED:", e);
            throw new Error(`Get Doc Failed: ${e.message}`);
          }
          
          if (user.email === 'marcelo@laghettomultipropriedade.com.br') {
              setUserRole('admin'); // Hardcode owner as admin
              if (!exists || role !== 'admin') {
                  try {
                    await setDoc(userDocRef, {
                      email: user.email,
                      role: 'admin',
                      createdAt: Date.now()
                    }, { merge: true });
                    console.log("Bootstrap SetDoc succeeded.");
                  } catch(e: any) {
                    console.error("SET DOC FAILED:", e);
                    throw new Error(`Set Doc Failed: ${e.message}`);
                  }
              }
          } else if (exists) {
            setUserRole(role);
          } else {
            setUserRole('viewer');
          }
        } catch (error: any) {
          console.error("Error fetching user profile", error);
          if (user.email === 'marcelo@laghettomultipropriedade.com.br') {
              setUserRole('admin');
          } else {
             alert(`Erro: ${error.message}`);
          }
        }
      } else {
        setUserRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ currentUser, userRole, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
