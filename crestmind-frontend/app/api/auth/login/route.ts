import { NextResponse } from 'next/server'
import { checkPassword, createSession, SESSION_COOKIE, SESSION_TTL_SECONDS } from '@/lib/server-auth'

export const runtime = 'nodejs'

// The password is checked HERE, on the server. It used to be a constant in
// browser JavaScript (lib/auth-context.tsx), readable by anyone.
export async function POST(request: Request) {
  let body: { username?: unknown; password?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const username = typeof body.username === 'string' ? body.username.trim().slice(0, 200) : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required' }, { status: 400 })
  }

  let ok: boolean
  let session: string
  try {
    ok = checkPassword(password)
    session = createSession(username)
  } catch (err) {
    console.error('Login is not configured:', err)
    return NextResponse.json({ error: 'Sign-in is not configured on the server' }, { status: 500 })
  }
  if (!ok) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const response = NextResponse.json({ username })
  response.cookies.set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
  return response
}
