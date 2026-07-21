import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  getRedirectResult,
  signOut as firebaseSignOut,
  signInWithCredential,
  GoogleAuthProvider,
  type User,
} from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import { isTauri } from "@tauri-apps/api/core";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";

const ALLOWED_EMAIL = "yashjee22@gmail.com";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unlistenDeepLink: (() => void) | undefined;

    // Listen for Tauri deep links (daytrack://auth?token=...)
    if (isTauri()) {
      const setupDeepLink = async () => {
        const unlisten = await onOpenUrl((urls) => {
          try {
            const url = new URL(urls[0]);
            const token = url.searchParams.get("token");
            if (token) {
              setLoading(true);
              const credential = GoogleAuthProvider.credential(token);
              signInWithCredential(auth, credential).catch((err) => {
                setError(`Deep-link login failed: ${err.message}`);
                setLoading(false);
              });
            }
          } catch (e) {
            console.error("Failed to parse deep link", e);
          }
        });
        unlistenDeepLink = unlisten;
      };
      setupDeepLink();
    } else {
      // Only check redirect result on standard web browsers
      getRedirectResult(auth).then((result) => {
        if (result && result.user.email !== ALLOWED_EMAIL) {
          firebaseSignOut(auth);
          setError(`Access denied. Only ${ALLOWED_EMAIL} can use this app.`);
        }
      }).catch((err) => {
        console.error("Redirect Error:", err);
        setError(`Sign-in failed: ${err.message || err.code}`);
      });
    }

    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        if (firebaseUser.email === ALLOWED_EMAIL) {
          setUser(firebaseUser);
          setError(null);
        } else {
          firebaseSignOut(auth);
          setUser(null);
          setError(`Access denied. Only ${ALLOWED_EMAIL} can use this app.`);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      unsub();
      if (unlistenDeepLink) unlistenDeepLink();
    };
  }, []);

  async function signIn() {
    setError(null);
    try {
      if (isTauri()) {
        const { open } = await import("@tauri-apps/plugin-shell");
        // Open the system browser to the dedicated auth route on the live web app
        await open("https://daytrack-antigravity.web.app/desktop-login");
        return;
      }
      
      // Standard web browser fallback
      await signInWithRedirect(auth, googleProvider);
    } catch (err: any) {
      console.error(err);
      if (err.code !== "auth/popup-closed-by-user") {
        setError(`Sign-in failed: Firebase Error (${err.code}).`);
      }
    }
  }

  async function signOut() {
    await firebaseSignOut(auth);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
