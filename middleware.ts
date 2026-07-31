// Runs on every request. This is the "guard": it never trusts a token the
// browser presents on its own — it takes the opaque `sid` cookie and makes a
// real request to Postgres (the `sessions` table, see supabase/schema.sql) to
// confirm a live session exists for it. No session in the DB -> not signed
// in, full stop, regardless of what's in the cookie. No page can be reached
// without this DB check passing (except /login itself).
import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "sid";

async function isSessionValid(sessionId: string, supabaseUrl: string, serviceRoleKey: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/sessions?id=eq.${encodeURIComponent(sessionId)}&select=expires_at`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        cache: "no-store",
      }
    );
    if (!res.ok) return false;
    const rows = (await res.json()) as { expires_at: string }[];
    if (rows.length !== 1) return false;
    return new Date(rows[0].expires_at).getTime() > Date.now();
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // If Supabase isn't configured yet, don't hard-lock the app out — let it
  // through so the get-started/setup instructions can still render.
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;

  // Signing in/up is how a session is created in the first place — these
  // routes must be reachable without one.
  if (pathname === "/api/auth/login" || pathname === "/api/auth/signup") {
    return NextResponse.next();
  }

  const isAuthRoute = pathname.startsWith("/login");
  const sid = request.cookies.get(SESSION_COOKIE)?.value;
  const valid = sid ? await isSessionValid(sid, supabaseUrl, serviceRoleKey) : false;

  // API routes get a JSON 401 instead of an HTML redirect — a fetch() call
  // following a redirect to the login page is not a usable error for the
  // client-side code that made the request.
  if (pathname.startsWith("/api/")) {
    if (!valid) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (!valid && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const res = NextResponse.redirect(url);
    if (sid) res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  if (valid && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
