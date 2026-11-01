"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function GoogleSignInButton({ next, initialMessage }: { next: string; initialMessage: string }) {
  const [message, setMessage] = useState(initialMessage);
  const [busy, setBusy] = useState(false);
  const [emailMode, setEmailMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

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

  async function handleEmailAuth(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      setMessage("Please enter both email and password.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
        });
        if (error) throw error;
        if (data.session) {
          window.location.assign(next);
          return;
        }
        setMessage("Account created. Check your email to confirm or try signing in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });
        if (error) throw error;
        window.location.assign(next);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  async function continueAsGuest() {
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const demoEmail = "demo@pramana.ai";
      const demoPassword = "DemoUser2026!";
      
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword,
      });

      if (!signInErr) {
        window.location.assign(next);
        return;
      }

      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: demoEmail,
        password: demoPassword,
      });

      if (!signUpErr && signUpData.session) {
        window.location.assign(next);
        return;
      }

      const { error: anonErr } = await supabase.auth.signInAnonymously();
      if (!anonErr) {
        window.location.assign(next);
        return;
      }

      throw signInErr || signUpErr || anonErr;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not sign in as guest.");
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

      <div className="auth-divider"><span>or with email</span></div>

      {!emailMode ? (
        <div style={{ display: "grid", gap: "8px", marginTop: "12px" }}>
          <button
            type="button"
            onClick={() => setEmailMode(true)}
            style={{
              height: "40px",
              border: "1px solid #dfe2e9",
              borderRadius: "8px",
              background: "#fff",
              color: "#374151",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Sign in with email & password
          </button>
          <button
            type="button"
            onClick={continueAsGuest}
            disabled={busy}
            style={{
              height: "36px",
              border: "1px dashed #c3cae6",
              borderRadius: "8px",
              background: "#f8f9fd",
              color: "#001a9c",
              fontSize: "11px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Explore workspace as Guest (instant demo)
          </button>
        </div>
      ) : (
        <form onSubmit={handleEmailAuth}>
          <label htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" disabled={busy}>
            {busy ? "Processing..." : isSignUp ? "Create account" : "Sign in"}
          </button>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginTop: "6px" }}>
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              style={{ background: "none", border: 0, color: "var(--blue)", cursor: "pointer", padding: 0 }}
            >
              {isSignUp ? "Have an account? Sign in" : "Need an account? Sign up"}
            </button>
            <button
              type="button"
              onClick={() => setEmailMode(false)}
              style={{ background: "none", border: 0, color: "#6b7280", cursor: "pointer", padding: 0 }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="auth-message" role="status" aria-live="polite">{message}</div>
    </>
  );
}
