import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { dataMode, config } from "@/lib/config";
import { getSupabaseServerClient, SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  if (dataMode === "supabase") {
    const supabase = await getSupabaseServerClient();
    await supabase.auth.signOut();
  } else {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE);
  }
  return NextResponse.redirect(new URL("/", config.appUrl), { status: 303 });
}
