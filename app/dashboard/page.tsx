import { Suspense } from "react";
import Dashboard from "@/components/dashboard/Dashboard";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { connection } from "next/server";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <AuthenticatedDashboard />
    </Suspense>
  );
}

async function AuthenticatedDashboard() {
  await connection();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <Dashboard userId={user.id} userEmail={user.email ?? ""} />;
}

function DashboardFallback() {
  return (
    <div className="dashboard-shell" role="status" aria-label="Loading your workspace">
      <aside className="dashboard-sidebar">
        <div className="sidebar-head">
          <div className="dashboard-brand"><span>Pramana</span></div>
        </div>
        <div className="new-analysis-button" aria-hidden="true">Loading workspace…</div>
      </aside>
      <div className="dashboard-workspace">
        <div className="dashboard-grid">
          <main className="center-column">
            <div className="conversation-panel">
              <header className="conversation-heading">
                <h1>Preparing your workspace</h1>
              </header>
              <div className="conversation-scroll" />
              <div className="composer-dock">
                <div className="dashboard-composer" aria-hidden="true">
                  <div className="composer-status">Checking your secure session…</div>
                </div>
              </div>
            </div>
          </main>
          <aside className="insights-column">
            <section className="insights-panel">
              <h2>Insights</h2>
              <p>Loading your analysis tools…</p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
