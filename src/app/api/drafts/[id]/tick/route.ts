import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { checkLimit } from "@/server/rate-limit";
import { createSupabaseServerClient } from "@/server/supabase/server";

/**
 * Resolve an expired turn. The client on the clock calls this when its
 * countdown reaches zero. The `resolve_timeout` RPC re-checks the deadline, so
 * concurrent or early calls are harmless no-ops.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const gate = await checkLimit(user.id, "tick");
  if (!gate.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(gate.retryAfter) } },
    );
  }

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("resolve_timeout", { p_draft_id: id });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
