import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase/server";

/** Current authenticated user, or null. */
export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Require an authenticated user or redirect to the landing page. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return user;
}
