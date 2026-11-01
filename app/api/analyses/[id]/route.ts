import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const { data, error } = await supabase.from("analyses").select("id,title,question,result,updated_at,analysis_sources(id,kind,title,url,content,position)").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Analysis not found." }, { status: 404 });
  return NextResponse.json({ analysis: data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const { error } = await supabase.from("analyses").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Could not delete this analysis." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
