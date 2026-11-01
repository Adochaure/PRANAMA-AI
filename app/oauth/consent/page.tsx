import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import OAuthConsent from "./OAuthConsent";

export const dynamic = "force-dynamic";

export default function OAuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string }>;
}) {
  return (
    <Suspense fallback={<OAuthConsent authorizationId="" />}>
      <ConsentContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ConsentContent({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string }>;
}) {
  const { authorization_id: authorizationId } = await searchParams;
  if (!authorizationId) return <OAuthConsent authorizationId="" />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const consentPath = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
    redirect(`/login?next=${encodeURIComponent(consentPath)}`);
  }

  return <OAuthConsent authorizationId={authorizationId} userEmail={user.email ?? ""} />;
}
