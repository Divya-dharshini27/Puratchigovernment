import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // This deployment is exclusively the Government & Statutory Authority Admin Console.
  // Redirect legacy citizen and host paths to the admin login gateway.
  if (pathname.startsWith("/citizen") || pathname.startsWith("/host")) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("notice", "restricted_admin_console");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/citizen/:path*",
    "/host/:path*"
  ]
};
