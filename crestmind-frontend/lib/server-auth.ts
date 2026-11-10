// Server-only authentication helpers. Never import this from a client
// component: it reads secrets from server environment variables.
//
// Environment (set in Vercel → Project → Settings → Environment Variables;
// none of these may start with NEXT_PUBLIC_):
//   CRESTMIND_LOGIN_PASSWORD  — shared password property managers sign in with
//   CRESTMIND_SESSION_SECRET  — random string (32+ chars) that signs the session cookie
//   CRESTMIND_API_AUTH_TOKEN  — same value as API_AUTH_TOKEN on the FastAPI backend
import 'server-only'
import { createHmac, timingSafeEqual } from 'crypto'

export const SESSION_COOKIE = 'crestmind_session'
export const SESSION_TTL_SECONDS = 12 * 60 * 60 // one working day
const API_TOKEN_TTL_SECONDS = 15 * 60

const b64url = (value: string) => Buffer.from(value, 'utf8').toString('base64url')
const fromB64url = (value: string) => Buffer.from(value, 'base64url').toString('utf8')
const hmacHex = (key: string, payload: string) =>
  createHmac('sha256', key).update(payload).digest('hex')
const nowSeconds = () => Math.floor(Date.now() / 1000)

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

export function checkPassword(password: string): boolean {
  const expected = process.env.CRESTMIND_LOGIN_PASSWORD
  if (!expected) throw new Error('CRESTMIND_LOGIN_PASSWORD is not configured')
  return safeEqual(password, expected)
}

function sessionSecret(): string {
  const secret = process.env.CRESTMIND_SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('CRESTMIND_SESSION_SECRET must be set to at least 32 characters')
  }
  return secret
}

/** Cookie value: <expiry>.<base64url username>.<hmac> */
export function createSession(username: string): string {
  const payload = `${nowSeconds() + SESSION_TTL_SECONDS}.${b64url(username)}`
  return `${payload}.${hmacHex(sessionSecret(), payload)}`
}

export function readSession(cookie: string | undefined): { username: string } | null {
  if (!cookie) return null
  const parts = cookie.split('.')
  if (parts.length !== 3) return null
  const [expiry, user, signature] = parts
  if (!safeEqual(signature, hmacHex(sessionSecret(), `${expiry}.${user}`))) return null
  if (Number(expiry) < nowSeconds()) return null
  return { username: fromB64url(user) }
}

/**
 * Short-lived bearer token the browser sends straight to the FastAPI backend.
 * Format must match verify_api_token() in api.py:
 *   v1.<expiry>.<base64url username>.<hex HMAC-SHA256(API token, "v1.<expiry>.<user>")>
 * Returns null when the backend token is not configured (local development).
 */
export function mintApiToken(username: string): { token: string; expiresAt: number } | null {
  const secret = process.env.CRESTMIND_API_AUTH_TOKEN
  if (!secret) return null
  const expiresAt = nowSeconds() + API_TOKEN_TTL_SECONDS
  const payload = `v1.${expiresAt}.${b64url(username)}`
  return { token: `${payload}.${hmacHex(secret, payload)}`, expiresAt }
}
