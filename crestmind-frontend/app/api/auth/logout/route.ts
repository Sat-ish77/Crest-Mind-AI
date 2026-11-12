import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/server-auth'

export const runtime = 'nodejs'

export async function POST() {
  const response = NextResponse.json({ success: true })
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
  return response
}
