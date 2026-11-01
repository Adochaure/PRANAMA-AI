import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import OAuthConsent from "./OAuthConsent";

export default async function OAuthConsentPage({ searchParams }: { searchParams: Promise<{ authorization_id?: string }> }) {
  const { authorization_id: authorizationId } = await searchParams;
  if (!authorizationId) return <OAuthConsent authorizationId="" />;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const consentPath = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
    redirect(`/login?next=${encodeURIComponent(consentPath)}`);
  }

  return <OAuthConsent authorizationId={authorizationId} userEmail={user.email ?? ""} />;
}
