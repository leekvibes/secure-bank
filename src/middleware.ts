import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const isAdmin = req.nextUrl.pathname.startsWith("/admin");
  const isAdminn = req.nextUrl.pathname.startsWith("/adminn");
  if (!isAdmin && !isAdminn) return NextResponse.next();

  const secureCookies = req.nextUrl.protocol === "https:";
  const cookieName = secureCookies
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName });

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (token.role !== "ADMIN") {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/adminn/:path*"],
};
