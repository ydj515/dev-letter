import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { encodeAdminCredentials, constantTimeEquals } from "@/lib/admin-auth";

const ADMIN_LOGIN_PATH = "/admin/login";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  if (pathname.startsWith(ADMIN_LOGIN_PATH)) {
    return NextResponse.next();
  }

  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.error("[AdminAuth] ADMIN_USERNAME or ADMIN_PASSWORD is not configured");
    return new Response("Admin credentials not configured", { status: 500 });
  }

  const token = request.cookies.get("admin-auth")?.value ?? "";
  const expected = encodeAdminCredentials(username, password);

  if (constantTimeEquals(token, expected)) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = ADMIN_LOGIN_PATH;
  loginUrl.searchParams.set("redirect", pathname + request.nextUrl.search);

  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete("admin-auth");
  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
