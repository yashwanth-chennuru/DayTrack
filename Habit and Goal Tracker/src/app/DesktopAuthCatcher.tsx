import { useEffect, useState } from "react";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";

export default function DesktopAuthCatcher() {
  const [status, setStatus] = useState("Waiting to start...");
  const [error, setError] = useState<string | null>(null);

  const runAuth = async () => {
    setStatus("Waiting for authentication...");
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.idToken;

      if (token) {
        setStatus("Authentication successful! Redirecting to app...");
        window.location.href = `daytrack://auth?token=${token}`;
        
        setTimeout(() => {
          window.close();
          setStatus("You can now close this window and return to the app.");
        }, 2000);
      } else {
        setError("Failed to retrieve authentication token.");
      }
    } catch (err: any) {
      if (err.code === "auth/popup-closed-by-user") {
        setError("Sign-in cancelled. You can close this window.");
      } else {
        setError(`Sign-in failed: ${err.message || err.code}`);
      }
    }
  };

  return (
    <div
      className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <div className="bg-card rounded-2xl border border-border p-8 w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-6 h-6 rounded" style={{ background: "#d97706" }} />
          <span className="text-lg font-semibold tracking-wide text-foreground">
            DayTrack Desktop Auth
          </span>
        </div>

        {error ? (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm flex flex-col gap-3" style={{ background: "#c0392b18", color: "#c0392b" }}>
            <span>{error}</span>
            <button 
              onClick={runAuth}
              className="px-4 py-2 bg-foreground text-background rounded-md text-sm font-medium"
            >
              Try Again
            </button>
          </div>
        ) : status === "Waiting to start..." ? (
          <button 
            onClick={runAuth}
            className="w-full py-3 px-4 flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors hover:opacity-90"
            style={{ background: "#d97706", color: "white" }}
          >
            Authenticate with Google
          </button>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: "#d97706" }}></div>
            <p className="text-sm text-muted-foreground">{status}</p>
          </div>
        )}
      </div>
    </div>
  );
}
