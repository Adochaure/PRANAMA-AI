import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import GoogleSignInButton from "./GoogleSignInButton";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string; next?: string }>;

export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="auth-page" style={{ backgroundColor: "#001a9c" }}>
      <section className="auth-card">
        <Link className="auth-brand" href="/"><Image src="/pramana_logo.webp" alt="" width={38} height={38} /><span>Pramana</span></Link>
        <h1>Sign in to your workspace</h1>
        <p>Sign in with Google to save analyses and sources to your account.</p>
        <Suspense fallback={<GoogleSignInButton next="/dashboard" initialMessage="" />}>
          <LoginOptions searchParams={searchParams} />
        </Suspense>
        <Link className="auth-back" href="/">Back to Pramana</Link>
      </section>
    </main>
  );
}

async function LoginOptions({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const requestedNext = params.next ?? "/dashboard";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/dashboard";
  const initialMessage = params.error === "google"
    ? "Google sign-in failed. Check the Google provider credentials and callback URL in Supabase, then try again."
    : params.error === "session"
      ? "Sign-in completed, but the session could not be created. Try again."
      : "";

  return <GoogleSignInButton next={next} initialMessage={initialMessage} />;
}
