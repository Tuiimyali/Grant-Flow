import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that don't require authentication
const PUBLIC_PATHS = ['/auth/signin', '/auth/signup', '/']

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request)

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith('/auth/'))

  // Redirect unauthenticated users to sign in
  if (!user && !isPublic) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/auth/signin'
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect signed-in users away from auth pages
  if (user && pathname.startsWith('/auth/')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
