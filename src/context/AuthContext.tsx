import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AuthContextType {
  currentUser: User | null;
  userRole: string | null;
  userPermissions: string[];
  loading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userRole: null,
  userPermissions: [],
  loading: true,
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          let exists = false;
          let role: string = 'viewer';
          let perms: string[] = [];
          
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
              setUserRole('admin');
              setUserPermissions(['admin_all']); // We can use 'admin_all' as a wildcard
              if (!exists || role !== 'admin') {
                  try {
                    await setDoc(userDocRef, {
                      email: user.email,
                      role: 'admin',
                      createdAt: Date.now()
                    }, { merge: true });
                  } catch(e: any) {}
              }
          } else if (exists) {
            setUserRole(role);
            // Fetch permissions if custom role
            if (role !== 'admin' && role !== 'analyst' && role !== 'viewer') {
               try {
                 const profileDoc = await getDoc(doc(db, 'access_profiles', role));
                 if (profileDoc.exists()) {
                     perms = profileDoc.data().permissions || [];
                 }
               } catch(err) { console.error("Error fetching permissions", err); }
            } else if (role === 'admin') {
               perms = ['admin_all'];
            }
            setUserPermissions(perms);
          } else {
            setUserRole('viewer');
            setUserPermissions([]);
          }
        } catch (error: any) {
          console.error("Error fetching user profile", error);
          if (user.email === 'marcelo@laghettomultipropriedade.com.br') {
              setUserRole('admin');
              setUserPermissions(['admin_all']);
          } else {
             alert(`Erro: ${error.message}`);
          }
        }
      } else {
        setUserRole(null);
        setUserPermissions([]);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ currentUser, userRole, userPermissions, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
