import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteSession, SESSION_COOKIE } from "@/lib/serverSession";

export async function POST() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(SESSION_COOKIE)?.value;
  // Delete the row outright rather than just clearing the cookie — this is
  // what makes sign-out immediate and irreversible even if someone else has
  // a copy of the same cookie value.
  await deleteSession(sid);
  cookieStore.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
