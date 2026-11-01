"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Check, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type ConsentDetails = {
  authorization_id: string;
  redirect_uri: string;
  scope: string;
  client: { name: string; uri: string; logo_uri: string };
};

export default function OAuthConsent({ authorizationId, userEmail = "" }: { authorizationId: string; userEmail?: string }) {
  const [details, setDetails] = useState<ConsentDetails | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(authorizationId));

  useEffect(() => {
    if (!authorizationId) return;
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data) { setStatus(error?.message ?? "This authorization request could not be loaded."); setLoading(false); return; }
      if (!("authorization_id" in data)) { window.location.assign(data.redirect_url); return; }
      setDetails(data);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) { setStatus("This authorization request could not be loaded."); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    if (!authorizationId) return;
    setBusy(true); setStatus("");
    try {
      const supabase = createClient();
      const result = approve
        ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
        : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
      if (result.error || !result.data?.redirect_url) throw new Error(result.error?.message ?? "Could not complete this decision.");
      window.location.assign(result.data.redirect_url);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not complete this decision.");
      setBusy(false);
    }
  }

  const scopes = details?.scope.split(/\s+/).filter(Boolean) ?? [];

  return (
    <main className="auth-page oauth-consent-page">
      <section className="auth-card oauth-consent-card">
        <Link className="auth-brand" href="/"><Image src="/pramana_logo.webp" alt="" width={38} height={38} /><span>Pramana</span></Link>
        <div className="consent-mark"><ShieldCheck size={19} /></div>
        <p className="consent-eyebrow">Authorization request</p>
        <h1>{loading ? "Checking request…" : details ? `${details.client.name} wants access` : "Could not verify request"}</h1>
        {details ? <>
          <p className="consent-description">You are signed in as <strong>{userEmail}</strong>. Review what this app is requesting before continuing.</p>
          <div className="consent-client"><span className="consent-client-icon">{details.client.name.slice(0, 1).toUpperCase()}</span><span><strong>{details.client.name}</strong><small>{details.client.uri}</small></span><ArrowUpRight size={14} /></div>
          <div className="consent-scope-heading">This app is requesting</div>
          <ul className="consent-scopes">{(scopes.length ? scopes : ["email"]).map((scope) => <li key={scope}><Check size={14} /><span><strong>{scope}</strong><small>{scope === "email" ? "View your email address" : scope === "profile" ? "View basic profile information" : scope === "openid" ? "Confirm your identity" : "Access requested account information"}</small></span></li>)}</ul>
          <p className="consent-redirect">After approval, you will return to <span>{details.redirect_uri}</span>.</p>
          <div className="consent-actions"><button className="consent-deny" disabled={busy} onClick={() => decide(false)}>Deny</button><button className="consent-approve" disabled={busy} onClick={() => decide(true)}>{busy ? "Please wait…" : "Approve access"}</button></div>
        </> : !loading && <p className="consent-description">{status || "The request is missing its authorization ID. Return to the app that sent you here and try again."}</p>}
        {status && details && <p className="auth-message consent-error" role="alert">{status}</p>}
        <Link className="auth-back" href="/">Back to Pramana</Link>
      </section>
    </main>
  );
}
