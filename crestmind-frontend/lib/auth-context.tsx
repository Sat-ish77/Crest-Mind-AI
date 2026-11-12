'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { clearApiToken } from '@/lib/api'

// Sign-in is verified on the server (app/api/auth/*). The session lives in
// an httpOnly cookie, so nothing in localStorage can grant access to real
// data. Demo mode stays client-side: it only ever shows built-in sample data.

interface User {
  username: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const restore = async () => {
      if (localStorage.getItem('demo_mode') === 'true') {
        if (!cancelled) setUser({ username: 'Demo User' })
        return
      }
      try {
        const res = await fetch('/api/auth/session', { cache: 'no-store' })
        if (res.ok && !cancelled) {
          const data = await res.json()
          setUser({ username: data.username })
        }
      } catch {
        // Offline or server error: stay signed out.
      }
    }
    // Leftover from the old client-side login; it no longer means anything.
    localStorage.removeItem('crestmind_user')
    restore().finally(() => {
      if (!cancelled) setIsLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const login = async (username: string, password: string): Promise<boolean> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (res.status === 401 || res.status === 400) return false
    if (!res.ok) throw new Error(`Sign-in failed (${res.status})`)
    const data = await res.json()
    localStorage.removeItem('demo_mode')
    setUser({ username: data.username })
    return true
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('crestmind_user')
    localStorage.removeItem('demo_mode')
    localStorage.removeItem('auth')
    localStorage.removeItem('demo_user')
    clearApiToken()
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}