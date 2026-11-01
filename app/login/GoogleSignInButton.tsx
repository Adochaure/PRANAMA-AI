"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function GoogleSignInButton({ next, initialMessage }: { next: string; initialMessage: string }) {
  const [message, setMessage] = useState(initialMessage);
  const [busy, setBusy] = useState(false);

  async function continueWithGoogle() {
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (error) setMessage(error.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start Google sign-in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="google-signin-button" type="button" onClick={continueWithGoogle} disabled={busy}>
        <span className="google-signin-content">
          <svg aria-hidden="true" viewBox="0 0 48 48" width="17" height="17">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.72 7.18l7.65 5.94c4.46-4.12 7.11-10.2 7.11-17.59Z"/>
            <path fill="#FBBC05" d="M10.54 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.75-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.98-6.19Z"/>
            <path fill="#34A853" d="M24 48c6.47 0 11.91-2.13 15.87-5.86l-7.65-5.94c-2.13 1.43-4.85 2.28-8.22 2.28-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/>
          </svg>
          {busy ? "Connecting..." : "Continue with Google"}
        </span>
      </button>

      <div className="auth-message" role="status" aria-live="polite">{message}</div>
    </>
  );
}
