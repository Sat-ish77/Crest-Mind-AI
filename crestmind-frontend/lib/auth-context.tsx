'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

const DEMO_PASSWORD = 'crestmind2026'

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
    const storedUser = localStorage.getItem('crestmind_user')
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    } else if (localStorage.getItem('demo_mode') === 'true') {
      // Recognize demo session as valid — no password needed
      setUser({ username: 'Demo User' })
    }
    setIsLoading(false)
  }, [])

  const login = async (username: string, password: string): Promise<boolean> => {
    if (username && password === DEMO_PASSWORD) {
      const userData = { username }
      setUser(userData)
      localStorage.setItem('crestmind_user', JSON.stringify(userData))
      return true
    }
    return false
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('crestmind_user')
    localStorage.removeItem('demo_mode')
    localStorage.removeItem('auth')
    localStorage.removeItem('demo_user')
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