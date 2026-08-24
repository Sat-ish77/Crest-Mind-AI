'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Eye, EyeOff, Lock, User, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { useAuth } from '@/lib/auth-context'
import { AuthProvider } from '@/lib/auth-context'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { enterDemoMode } from '@/lib/api'

// ── GOLD PARTICLE FIELD (canvas) ──
function ParticleField({ count = 50 }: { count?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    interface Particle { x: number; y: number; size: number; speedY: number; opacity: number; fadeSpeed: number }

    const particles: Particle[] = Array.from({ length: count }, () => ({
      x:         Math.random() * canvas.width,
      y:         Math.random() * canvas.height,
      size:      Math.random() * 1.8 + 0.4,
      speedY:    Math.random() * 0.25 + 0.08,
      opacity:   Math.random() * 0.45 + 0.1,
      fadeSpeed: Math.random() * 0.004 + 0.002,
    }))

    let id: number
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => {
        p.y -= p.speedY
        p.opacity += Math.sin(Date.now() * p.fadeSpeed) * 0.008
        if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width }

        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3)
        g.addColorStop(0, `rgba(201,168,76,${Math.max(0.08, Math.min(0.55, p.opacity))})`)
        g.addColorStop(1, 'rgba(201,168,76,0)')
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2)
        ctx.fillStyle = g
        ctx.fill()
      })
      id = requestAnimationFrame(animate)
    }
    animate()

    return () => { ro.disconnect(); cancelAnimationFrame(id) }
  }, [count])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10" />
}

// ── 3D FLOATING WIREFRAME SHAPES ──
const SHAPES = [
  { id: 0, size: 55,  left: '12%', top: '14%', delay: 0,   dur: 9,  ry: 45  },
  { id: 1, size: 35,  left: '78%', top: '18%', delay: 1.8, dur: 11, ry: -30 },
  { id: 2, size: 70,  left: '68%', top: '62%', delay: 0.6, dur: 13, ry: 60  },
  { id: 3, size: 30,  left: '18%', top: '72%', delay: 2.4, dur: 8,  ry: -45 },
  { id: 4, size: 45,  left: '42%', top: '38%', delay: 1.2, dur: 10, ry: 30  },
  { id: 5, size: 28,  left: '85%', top: '50%', delay: 3.0, dur: 7,  ry: -60 },
]

/** Fewer, smaller diamonds beside the login card (desktop) — theme `primary` border */
const SHAPES_SIDEBAR: {
  id: string
  size: number
  left?: string
  right?: string
  top?: string
  bottom?: string
  delay: number
  dur: number
  ry: number
}[] = [
  { id: 'sb0', size: 26, left: '5%', top: '18%', delay: 0, dur: 11, ry: 38 },
  { id: 'sb1', size: 20, right: '7%', top: '24%', delay: 1.4, dur: 10, ry: -32 },
  { id: 'sb2', size: 24, left: '9%', bottom: '22%', delay: 0.7, dur: 12, ry: 48 },
]

function FloatingShapesSidebar() {
  return (
    <div
      className="hidden lg:block absolute inset-0 pointer-events-none z-[15]"
      style={{ perspective: '900px' }}
      aria-hidden
    >
      {SHAPES_SIDEBAR.map(s => (
        <motion.div
          key={s.id}
          className="absolute"
          style={{
            ...(s.left != null ? { left: s.left } : {}),
            ...(s.right != null ? { right: s.right } : {}),
            ...(s.top != null ? { top: s.top } : {}),
            ...(s.bottom != null ? { bottom: s.bottom } : {}),
          }}
          animate={{ y: [0, -10, 0], rotateY: [0, s.ry, 0], rotateX: [0, 10, 0] }}
          transition={{ duration: s.dur, delay: s.delay, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div
            className="border border-primary/25 shadow-[0_0_10px_rgba(79,70,229,0.08)]"
            style={{
              width: s.size,
              height: s.size,
              transform: 'rotate(45deg)',
            }}
          />
          <div
            className="border border-primary/15 absolute top-1/4 left-1/4"
            style={{
              width: s.size * 0.5,
              height: s.size * 0.5,
              transform: 'rotate(45deg)',
            }}
          />
        </motion.div>
      ))}
    </div>
  )
}

function FloatingShapes() {
  return (
    <div className="absolute inset-0 pointer-events-none z-20" style={{ perspective: '900px' }}>
      {SHAPES.map(s => (
        <motion.div
          key={s.id}
          className="absolute"
          style={{ left: s.left, top: s.top }}
          animate={{ y: [0, -18, 0], rotateY: [0, s.ry, 0], rotateX: [0, 15, 0] }}
          transition={{ duration: s.dur, delay: s.delay, repeat: Infinity, ease: 'easeInOut' }}
        >
          {/* Outer diamond */}
          <div
            style={{
              width: s.size,
              height: s.size,
              border: '1px solid rgba(201,168,76,0.35)',
              transform: 'rotate(45deg)',
              boxShadow: '0 0 12px rgba(201,168,76,0.12), inset 0 0 8px rgba(201,168,76,0.06)',
            }}
          />
          {/* Inner diamond */}
          <div
            style={{
              width: s.size * 0.5,
              height: s.size * 0.5,
              border: '1px solid rgba(201,168,76,0.2)',
              transform: 'rotate(45deg)',
              position: 'absolute',
              top: '25%',
              left: '25%',
            }}
          />
        </motion.div>
      ))}
    </div>
  )
}

// ── ANIMATED GOLD RING AROUND LOGO ──
function LogoRing() {
  return (
    <motion.div
      className="absolute inset-0 rounded-xl"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    >
      <motion.div
        className="absolute inset-[-3px] rounded-xl border border-primary/30"
        animate={{
          boxShadow: [
            '0 0 0 0 rgba(201,168,76,0)',
            '0 0 20px 2px rgba(201,168,76,0.3)',
            '0 0 0 0 rgba(201,168,76,0)',
          ],
        }}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
      />
    </motion.div>
  )
}

function LeftPanel() {
  return (
    <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden flex-col">
      {/* Building photo */}
      <Image
        src="/images/woodcrest-building.jpeg"
        alt="Woodcrest Capital"
        fill
        className="object-cover object-center"
        priority
      />

      {/* Gradient overlay — darker at edges, lighter centre */}
      <div className="absolute inset-0 login-building-overlay z-10" />

      {/* Seam into login column — theme-specific in globals.css */}
      <div className="absolute inset-y-0 right-0 login-building-seam z-10" />

      {/* Particles on top */}
      <ParticleField count={40} />

      {/* 3D shapes */}
      <FloatingShapes />

      {/* Readability scrim behind copy */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[min(52%,420px)] bg-gradient-to-t from-black/70 via-black/35 to-transparent pointer-events-none z-[25]"
        aria-hidden
      />

      {/* Bottom text block */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 p-10 z-30"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.7 }}
      >
        {/* Brand — high contrast on photo (primary alone was too subtle at 9px) */}
        <p className="mb-3 max-w-xs border-l-[3px] border-primary pl-3.5 text-[10px] font-bold uppercase tracking-[0.28em] text-white [text-shadow:0_1px_3px_rgba(0,0,0,1),0_0_20px_rgba(0,0,0,0.75)]">
          Woodcrest Capital
        </p>
        <h2 className="font-serif text-3xl md:text-[2rem] text-white leading-tight mb-2 font-semibold tracking-tight [text-shadow:0_2px_16px_rgba(0,0,0,0.85)]">
          Property Intelligence<br />
          <span className="text-primary drop-shadow-[0_2px_12px_rgba(0,0,0,0.75)]">Powered by AI</span>
        </h2>
        <p className="text-sm text-white/85 mb-0 max-w-xs leading-relaxed [text-shadow:0_1px_10px_rgba(0,0,0,0.75)]">
          Ask any question about your leases, amendments, and property documents — get instant, cited answers.
        </p>

        {/* Footer */}
        <p className="mt-6 text-[9px] text-white/50 uppercase tracking-[0.2em] [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">
          UNT Capstone 2026 · Group 13
        </p>
      </motion.div>
    </div>
  )
}

// ── MAIN LOGIN FORM ──
function LoginForm() {
  const [username, setUsername]     = useState('')
  const [password, setPassword]     = useState('')
  const [showPassword, setShowPwd]  = useState(false)
  const [isLoading, setIsLoading]   = useState(false)
  const [isShaking, setIsShaking]   = useState(false)
  const [isSuccess, setIsSuccess]   = useState(false)
  const { setTheme } = useTheme()
  const { login, user, isLoading: authLoading } = useAuth()
  const router = useRouter()

  // Always start sign-in on the white/purple theme (even if localStorage had another theme saved).
  useEffect(() => {
    setTheme('light')
  }, [setTheme])

  useEffect(() => {
    if (!authLoading && user) router.push('/dashboard')
  }, [user, authLoading, router])

  const shake = () => { setIsShaking(true); setTimeout(() => setIsShaking(false), 500) }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      toast.error('Please enter both username and password')
      shake(); return
    }
    setIsLoading(true)
    try {
      const ok = await login(username, password)
      if (ok) {
        setIsSuccess(true)
        toast.success('Welcome to CrestMind AI')
        setTimeout(() => router.push('/dashboard'), 600)
      } else {
        toast.error('Invalid credentials'); shake()
      }
    } catch {
      toast.error('An error occurred'); shake()
    } finally {
      setIsLoading(false)
    }
  }, [username, password, login, router])

  const handleDemoMode = useCallback(() => {
    enterDemoMode()
    toast.success('Entering demo mode — no account needed')
    router.push('/dashboard')
  }, [router])

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Spinner className="w-8 h-8 text-primary" />
          <p className="text-sm text-muted-foreground tracking-widest uppercase">Initializing</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-background">

      {/* ── LEFT: Building panel (desktop only) ── */}
      <LeftPanel />

      {/* ── RIGHT: Login form ── */}
      <div className="login-form-panel flex-1 flex flex-col items-center justify-center relative overflow-hidden px-6 py-12 lg:px-12">

        {/* Desktop: subtle diamonds flanking the card (not on the building side) */}
        <FloatingShapesSidebar />

        {/* Mobile-only particle field + decorations */}
        <div className="lg:hidden absolute inset-0">
          <ParticleField count={40} />
          <div className="absolute inset-0 dot-grid" />
          <div className="noise-texture" />
          {/* Corner accents */}
          <motion.div
            className="absolute top-0 left-0 w-24 h-24 border-l border-t border-primary/20 m-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          />
          <motion.div
            className="absolute bottom-0 right-0 w-24 h-24 border-r border-b border-primary/20 m-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          />
        </div>

        {/* Desktop background (right side) — very subtle */}
        <div className="hidden lg:block absolute inset-0 dot-grid opacity-40" />
        <div className="hidden lg:block noise-texture" />

        <AnimatePresence mode="wait">
          {!isSuccess ? (
            <motion.div
              key="login-card"
              className="relative w-full max-w-md z-20"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40, scale: 0.96 }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            >
              {/* Subtle gold glow behind card */}
              <div className="absolute -inset-6 bg-primary/4 blur-3xl rounded-full" />

              <motion.div
                className={`glass-card relative rounded-2xl p-8 lg:p-10 gold-glow ${isShaking ? 'shake' : ''}`}
                animate={isShaking ? { x: [0, -4, 4, -4, 4, 0] } : {}}
                transition={{ duration: 0.4 }}
              >
                {/* Logo & Brand */}
                <motion.div
                  className="flex flex-col items-center mb-8 text-center"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <div className="relative w-[72px] h-[72px] rounded-xl overflow-hidden mb-4">
                    <LogoRing />
                    <Image
                      src="/images/logo.jpeg"
                      alt="CrestMind AI"
                      fill
                      className="object-cover relative z-10"
                    />
                  </div>
                  <motion.h1
                    className="font-serif text-3xl text-primary tracking-tight mb-1.5"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    CRESTMIND AI
                  </motion.h1>
                  <motion.p
                    className="text-[10px] font-semibold tracking-[0.3em] text-primary/60 uppercase"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    Property Document Intelligence
                  </motion.p>
                </motion.div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Username */}
                  <motion.div
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 }}
                  >
                    <label className="block text-[10px] font-bold text-primary/60 uppercase tracking-[0.2em] mb-2 px-1">
                      Username
                    </label>
                    <div className="relative group">
                      <input
                        type="text"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        placeholder="Enter your username"
                        className="w-full bg-background/50 border border-primary/20 rounded-lg h-14 px-4 pr-10 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 input-glow input-gold-sweep transition-all caret-primary"
                        disabled={isLoading}
                      />
                      <User className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/30 group-focus-within:text-primary/60 transition-colors" />
                    </div>
                  </motion.div>

                  {/* Password */}
                  <motion.div
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.32 }}
                  >
                    <label className="block text-[10px] font-bold text-primary/60 uppercase tracking-[0.2em] mb-2 px-1">
                      Password
                    </label>
                    <div className="relative group">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full bg-background/50 border border-primary/20 rounded-lg h-14 px-4 pr-10 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 input-glow input-gold-sweep transition-all caret-primary"
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/30 hover:text-primary/60 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </motion.div>

                  {/* Sign In Button */}
                  <motion.button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-primary to-primary-electric hover:from-primary-electric hover:to-primary text-primary-foreground font-bold py-4 rounded-lg shadow-lg shadow-primary/20 transition-all uppercase tracking-[0.15em] text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 button-press button-shimmer"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isLoading ? (
                      <><Spinner className="w-4 h-4" /><span>Authenticating</span></>
                    ) : (
                      <><Lock className="w-4 h-4" /><span>Sign In</span></>
                    )}
                  </motion.button>
                </form>

                {/* SSO + Demo */}
                <motion.div
                  className="mt-5 space-y-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <button
                    disabled
                    className="w-full bg-muted/30 text-muted-foreground/50 font-medium py-3 rounded-lg border border-border/50 cursor-not-allowed text-sm tracking-wide"
                  >
                    Single Sign-On (Coming Soon)
                  </button>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-primary/10" />
                    <span className="text-[9px] text-primary/30 uppercase tracking-[0.2em] font-semibold">or</span>
                    <div className="flex-1 h-px bg-primary/10" />
                  </div>

                  <motion.button
                    onClick={handleDemoMode}
                    className="relative w-full overflow-hidden bg-transparent text-primary font-semibold py-3 rounded-lg border border-primary/40 hover:border-primary/70 hover:bg-primary/5 text-sm tracking-wide transition-all flex items-center justify-center gap-2 group"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
                    <Sparkles className="w-4 h-4 text-primary/70" />
                    <span>Explore Live Demo</span>
                    <span className="text-[9px] text-primary/50 uppercase tracking-widest font-bold ml-1">
                      — No Account Needed
                    </span>
                  </motion.button>
                </motion.div>

                {/* Footer note */}
                <motion.div
                  className="mt-7 pt-7 border-t border-primary/10 flex flex-col items-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <p className="text-[9px] text-muted-foreground/50 uppercase tracking-[0.2em] font-semibold">
                    Secure Archival Access
                  </p>
                  {/* Mobile-only footer (desktop shows it in the left panel) */}
                  <p className="lg:hidden mt-2 text-[9px] text-muted-foreground/30 uppercase tracking-[0.15em]">
                    Woodcrest Capital · Group 13 · UNT Capstone 2026
                  </p>
                </motion.div>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="success-state"
              className="flex flex-col items-center gap-5 z-20"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <motion.div
                className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 0.5 }}
              >
                <motion.svg
                  className="w-10 h-10 text-success"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <motion.path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5 }}
                  />
                </motion.svg>
              </motion.div>
              <p className="text-primary font-serif text-xl">Welcome, {username}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <AuthProvider>
      <LoginForm />
    </AuthProvider>
  )
}