import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { data, error } = await supabase
    .from("analyses")
    .select("id,title,updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(40);
  if (error) return NextResponse.json({ error: "Could not load analysis history." }, { status: 500 });
  return NextResponse.json({ analyses: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid analysis." }, { status: 400 });
  const input = body as { id?: unknown; title?: unknown; question?: unknown; result?: unknown; sources?: unknown };
  if (typeof input.question !== "string" || input.question.trim().length < 5 || input.question.length > 500) {
    return NextResponse.json({ error: "Question must be between 5 and 500 characters." }, { status: 400 });
  }

  const title = (typeof input.title === "string" ? input.title : input.question).trim().slice(0, 120) || "New analysis";
  const sourceInput = Array.isArray(input.sources) ? input.sources.slice(0, 8) : [];
  const sources = sourceInput.map((raw, position) => {
    const source = (raw && typeof raw === "object" ? raw : {}) as { kind?: unknown; title?: unknown; url?: unknown; content?: unknown };
    const kind = source.kind === "pdf" || source.kind === "text" ? source.kind : "url";
    return {
      user_id: user.id,
      kind,
      title: typeof source.title === "string" ? source.title.slice(0, 240) : "Source",
      url: typeof source.url === "string" ? source.url.slice(0, 2000) : null,
      content: typeof source.content === "string" ? source.content.slice(0, 30000) : null,
      position,
    };
  });
  if (sources.some((source) => source.kind === "url" && !source.url)) {
    return NextResponse.json({ error: "Every link source needs a valid URL." }, { status: 400 });
  }

  const row = {
    user_id: user.id,
    title,
    question: input.question.trim(),
    result: input.result ?? null,
    updated_at: new Date().toISOString(),
  };
  const id = typeof input.id === "string" ? input.id : null;
  const saved = id
    ? await supabase.from("analyses").update(row).eq("id", id).eq("user_id", user.id).select("id,title,updated_at").maybeSingle()
    : await supabase.from("analyses").insert(row).select("id,title,updated_at").single();
  if (saved.error || !saved.data) return NextResponse.json({ error: "Could not save this analysis." }, { status: 500 });
  const savedAnalysis = saved.data;

  const { error: clearError } = await supabase.from("analysis_sources").delete().eq("analysis_id", savedAnalysis.id).eq("user_id", user.id);
  if (clearError) return NextResponse.json({ error: "Analysis saved, but its source list could not be updated." }, { status: 500 });
  if (sources.length) {
    const { error } = await supabase.from("analysis_sources").insert(sources.map((source) => ({ ...source, analysis_id: savedAnalysis.id })));
    if (error) return NextResponse.json({ error: "Analysis saved, but some sources could not be saved." }, { status: 500 });
  }
  return NextResponse.json({ analysis: savedAnalysis });
}
