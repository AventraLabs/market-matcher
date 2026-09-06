import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Optimistic route protection only — reads the session from the JWT
// cookie, no DB call. Real authorization still happens server-side
// wherever data is actually read or written (see src/lib/session.ts).
const protectedRoutes = ["/profile"];
const authRoutes = ["/login", "/register"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = Boolean(req.auth);

  if (protectedRoutes.some((route) => pathname.startsWith(route)) && !isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (authRoutes.includes(pathname) && isLoggedIn) {
    return NextResponse.redirect(new URL("/profile", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
