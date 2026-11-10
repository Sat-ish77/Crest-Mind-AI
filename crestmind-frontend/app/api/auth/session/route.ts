import { NextRequest, NextResponse } from 'next/server'
import { mintApiToken, readSession, SESSION_COOKIE } from '@/lib/server-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Returns the signed-in user plus a 15-minute token for the FastAPI backend.
export async function GET(request: NextRequest) {
  let session: { username: string } | null
  try {
    session = readSession(request.cookies.get(SESSION_COOKIE)?.value)
  } catch (err) {
    console.error('Session check is not configured:', err)
    return NextResponse.json({ error: 'Sign-in is not configured on the server' }, { status: 500 })
  }
  if (!session) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }
  const api = mintApiToken(session.username)
  return NextResponse.json(
    { username: session.username, apiToken: api?.token ?? null, expiresAt: api?.expiresAt ?? null },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
