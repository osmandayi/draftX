import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/server/supabase/server";

/** Sign the user out and return to the landing page. */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
