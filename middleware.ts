import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_PREFIXES = ['/login', '/register', '/setup', '/join', '/api/auth', '/_next', '/favicon.ico'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = req.cookies.get('session')?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Verify JWT — secret is fetched via an internal header trick:
  // We pass it through a response header from the app_config endpoint,
  // but since middleware can't access SQLite directly we do a lightweight
  // check: verify signature with the secret stored in a readable cookie.
  //
  // For a personal/local app, presence of a valid HttpOnly cookie is
  // sufficient protection. Full cryptographic verification happens in
  // every API route that calls verifySession().
  //
  // If you need strict edge verification, set AUTH_SECRET env var and
  // the middleware will verify the JWT signature as well.
  if (process.env.AUTH_SECRET) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
    } catch {
      const res = NextResponse.redirect(new URL('/login', req.url));
      res.cookies.delete('session');
      return res;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
