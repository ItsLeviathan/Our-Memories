import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Paths that never require a session. */
const PUBLIC_PATHS = [/^\/login$/, /^\/m\//, /^\/api\/public\//, /^\/api\/cron\//];

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Rejects cross-site state-changing requests (defense in depth on top of SameSite cookies). */
function isCrossSiteWrite(request: NextRequest) {
  if (SAFE_METHODS.has(request.method)) return false;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== request.nextUrl.host;
  } catch {
    return true;
  }
}

export async function proxy(request: NextRequest) {
  if (isCrossSiteWrite(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Refreshes the session cookie if needed. Must run before any redirect logic.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((re) => re.test(pathname));

  if (!signedIn && !isPublic) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (signedIn && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|.*\.(?:svg|png|jpg|jpeg|webp|avif|ico)$).*)",
  ],
};
