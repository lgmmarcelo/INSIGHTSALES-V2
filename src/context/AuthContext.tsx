import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AuthContextType {
  currentUser: User | null;
  userRole: string | null;
  userRoleName: string | null;
  userDisplayName: string | null;
  userPermissions: string[];
  loading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userRole: null,
  userRoleName: null,
  userDisplayName: null,
  userPermissions: [],
  loading: true,
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userRoleName, setUserRoleName] = useState<string | null>(null);
  const [userDisplayName, setUserDisplayName] = useState<string | null>(null);
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
          let displayName: string | null = user.displayName;
          let perms: string[] = [];
          
          let userDocData: any = null;
          try {
            const userDoc = await getDoc(userDocRef);
            exists = userDoc.exists();
            if (exists) {
              userDocData = userDoc.data();
              role = userDocData.role || 'viewer';
              if (userDocData.displayName) {
                displayName = userDocData.displayName;
              }
            }
          } catch (e: any) {
            console.error("GET DOC FAILED:", e);
            throw new Error(`Get Doc Failed: ${e.message}`);
          }
          
          setUserDisplayName(displayName);

          if (user.email === 'marcelo@laghettomultipropriedade.com.br') {
              setUserRole('admin');
              setUserRoleName('Administrador');
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
            let roleName = role === 'admin' ? 'Administrador' : role === 'analyst' ? 'Analista' : role === 'viewer' ? 'Visualizador' : role;
            
            // Check if profile details are denormalized inside user document
            if (userDocData && userDocData.permissions && Array.isArray(userDocData.permissions)) {
                perms = userDocData.permissions;
                if (userDocData.roleName) {
                    roleName = userDocData.roleName;
                }
            } else {
                // Fetch permissions if custom role
                if (role !== 'admin' && role !== 'analyst' && role !== 'viewer') {
                   try {
                     const cleanRoleId = role.trim();
                     const profileDocRef = doc(db, 'access_profiles', cleanRoleId);
                     const profileDoc = await getDoc(profileDocRef);
                     if (profileDoc.exists()) {
                         perms = profileDoc.data().permissions || [];
                         roleName = profileDoc.data().name || role;
                     } else {
                         console.error("Profile Document does not exist for role ID:", cleanRoleId);
                     }
                   } catch(err: any) { 
                     console.error("Error fetching permissions for custom role", err); 
                   }
                } else if (role === 'admin') {
                   perms = ['admin_all'];
                }
            }
            
            setUserPermissions(perms);
            setUserRoleName(roleName);
          } else {
            setUserRole('viewer');
            setUserRoleName('Visualizador');
            setUserPermissions([]);
          }
        } catch (error: any) {
          console.error("Error fetching user profile", error);
          if (user.email === 'marcelo@laghettomultipropriedade.com.br') {
              setUserRole('admin');
              setUserRoleName('Administrador');
              setUserPermissions(['admin_all']);
          } else {
             alert(`Erro: ${error.message}`);
          }
        }
      } else {
        setUserRole(null);
        setUserRoleName(null);
        setUserDisplayName(null);
        setUserPermissions([]);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ currentUser, userRole, userRoleName, userDisplayName, userPermissions, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
