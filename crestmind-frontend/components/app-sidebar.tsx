'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { Home, MessageSquare, Upload, FolderOpen, LogOut, FlaskConical, Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { useAuth } from '@/lib/auth-context'
import useSWR from 'swr'
import { getDocuments, Document, isDemoMode, exitDemoMode } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useState } from 'react'

function getDocTypeBadgeClass(docType: string): string {
  const type = docType.toLowerCase()
  if (type === 'lease')      return 'badge-lease'
  if (type === 'amendment')  return 'badge-amendment'
  if (type === 'invoice')    return 'badge-invoice'
  if (type === 'inspection') return 'badge-inspection'
  if (type === 'quote')      return 'badge-quote'
  if (type === 'work_order') return 'badge-work_order'
  return 'badge-invoice'
}

// ── SIDEBAR TOOLTIP ──
interface SidebarTooltipProps {
  title: string
  description: string
  tech?: string
  children: React.ReactNode
}

function SidebarTooltip({ title, description, tech, children }: SidebarTooltipProps) {
  const [visible, setVisible] = useState(false)
  const demo = isDemoMode()
  if (!demo) return <>{children}</>

  return (
    <div
      className="relative"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}

      {/* Gold ? badge */}
      <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center pointer-events-none z-10">
        <Info className="w-2 h-2 text-primary/70" />
      </div>

      <AnimatePresence>
        {visible && (
          <motion.div
            className="absolute left-full top-0 ml-3 z-50 w-60 pointer-events-none"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15 }}
          >
            <div
              className="rounded-xl p-3 border"
              style={{
                background: 'rgba(14,12,10,0.97)',
                backdropFilter: 'blur(20px)',
                borderColor: 'rgba(201,168,76,0.25)',
                boxShadow: '0 0 0 1px rgba(201,168,76,0.08), 0 20px 40px rgba(0,0,0,0.7)',
              }}
            >
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary/70 mb-1">
                {title}
              </p>
              <p className="text-xs text-foreground/80 leading-relaxed mb-1.5">
                {description}
              </p>
              {tech && (
                <p className="text-[10px] font-mono text-primary/50">⚙ {tech}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── THEME TOGGLE ──
const themes = [
  { key: 'dark',  label: 'Obsidian', color: '#c9a84c', bg: '#0a0805' },
  { key: 'light', label: 'Light',    color: '#4f46e5', bg: '#ffffff' },
  { key: 'green', label: 'Forest',   color: '#34d399', bg: '#061a0a' },
]

function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex items-center gap-2 px-1">
      <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40 flex-1">
        Theme
      </span>
      <div className="flex items-center gap-1.5">
        {themes.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              if (t.key === 'light') {
                setTheme(theme === 'light' ? 'midnight' : 'light')
                return
              }
              setTheme(t.key)
            }}
            title={t.label}
            className={cn(
              'relative w-5 h-5 rounded-full border-2 transition-all duration-200 overflow-hidden',
              theme === t.key
                ? 'border-foreground/60 scale-110'
                : 'border-transparent opacity-50 hover:opacity-80 hover:scale-105'
            )}
            style={{
              background: t.key === 'light' ? undefined : t.bg,
              boxShadow: `0 0 0 1px ${t.color}40`,
            }}
          >
            {t.key === 'light' && (
              <>
                <span className="absolute inset-y-0 left-0 w-1/2 bg-white" />
                <span className="absolute inset-y-0 right-0 w-1/2 bg-[#0b0f14]" />
                <span className="absolute top-[3px] bottom-[3px] left-1/2 w-px -translate-x-1/2 bg-black/25" />
              </>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

const navItems = [
  {
    href: '/dashboard',
    label: 'Home',
    icon: Home,
    tooltip: {
      title: 'DASHBOARD',
      description: 'Overview of your knowledge base — document count, total chunks, and query stats.',
      tech: 'Next.js 16 + Tailwind + shadcn/ui',
    },
  },
  {
    href: '/ask',
    label: 'Ask a Question',
    icon: MessageSquare,
    tooltip: {
      title: 'RAG QUERY ENGINE',
      description: 'Ask anything about your property documents. Uses hybrid search + GPT-4o-mini to return grounded answers with source citations.',
      tech: 'pgvector + BM25 + RRF + GPT-4o-mini',
    },
  },
  {
    href: '/ingest',
    label: 'Upload Documents',
    icon: Upload,
    tooltip: {
      title: 'DOCUMENT PIPELINE',
      description: 'Upload PDFs or DOCX files. System parses, chunks, embeds, and stores them as searchable vectors.',
      tech: 'PyMuPDF + OpenAI Embeddings + Supabase',
    },
  },
]

interface AppSidebarProps {
  onNavigate?: () => void
}

export function AppSidebar({ onNavigate }: AppSidebarProps) {
  const pathname  = usePathname()
  const router    = useRouter()
  const { user, logout } = useAuth()
  const demo = isDemoMode()

  const { data: documentsData } = useSWR('documents', getDocuments, {
    refreshInterval: 30000,
    revalidateOnFocus: false,
  })

  const documents = documentsData?.documents || []

  const handleNavigation = () => onNavigate?.()

  const handleLogout = () => {
    logout()
    onNavigate?.()
  }

  const handleExitDemo = () => {
    exitDemoMode()
    onNavigate?.()
    router.push('/')
  }

  return (
    <aside className="h-full w-64 bg-sidebar border-r border-sidebar-border flex flex-col">

      {/* Logo & Brand */}
      <div className="p-6">
        <SidebarTooltip
          title="TECH STACK"
          description="Next.js 16 frontend on Vercel. FastAPI backend on GCP Cloud Run. Supabase PostgreSQL + pgvector. Built for Woodcrest Capital — UNT Capstone 2026."
          tech="Next.js + FastAPI + GCP + Supabase"
        >
          <Link href="/dashboard" className="flex items-center gap-3" onClick={handleNavigation}>
            <motion.div className="relative w-10 h-10 rounded-lg overflow-hidden bg-card logo-breathe">
              <Image src="/images/logo.jpeg" alt="CrestMind AI" fill className="object-cover" />
            </motion.div>
            <div className="flex flex-col">
              <h1 className="font-serif text-lg text-primary tracking-tight">CrestMind AI</h1>
              <p className="text-[8px] text-muted-foreground/60 uppercase tracking-[0.2em]">Property Intelligence</p>
            </div>
          </Link>
        </SidebarTooltip>

        {/* Demo Mode Badge */}
        {demo && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 flex items-center gap-1.5 px-2 py-1 rounded-md border border-primary/30 bg-primary/5 w-fit"
          >
            <FlaskConical className="w-3 h-3 text-primary/70" />
            <span className="text-[9px] font-bold text-primary/70 uppercase tracking-[0.15em]">
              Demo Mode
            </span>
          </motion.div>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-sidebar-border/50 mx-4" />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40 px-3 mb-3">
          Navigation
        </p>
        {navItems.map((item, index) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <SidebarTooltip
                title={item.tooltip.title}
                description={item.tooltip.description}
                tech={item.tooltip.tech}
              >
                <Link
                  href={item.href}
                  onClick={handleNavigation}
                  className={cn(
                    'relative flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-300',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  )}
                >
                  <AnimatePresence>
                    {isActive && (
                      <motion.div
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] bg-primary rounded-r-full"
                        initial={{ opacity: 0, scaleY: 0 }}
                        animate={{ opacity: 1, scaleY: 1 }}
                        exit={{ opacity: 0, scaleY: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ boxShadow: '0 0 10px rgba(201, 168, 76, 0.5)' }}
                      />
                    )}
                  </AnimatePresence>
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              </SidebarTooltip>
            </motion.div>
          )
        })}

        {/* Knowledge Base */}
        <div className="pt-8">
          <SidebarTooltip
            title="VECTOR DATABASE"
            description="113 semantic chunks stored across 5 Woodcrest Capital documents. Each chunk has a 1,536-dim vector + tsvector for hybrid search."
            tech="Supabase PostgreSQL + pgvector extension"
          >
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40 px-3 mb-3">
              Knowledge Base
            </p>
          </SidebarTooltip>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {documents.length === 0 ? (
              <p className="text-xs text-muted-foreground/40 px-3 italic">No documents uploaded</p>
            ) : (
              documents.slice(0, 10).map((doc: Document, index: number) => (
                <motion.div
                  key={doc.doc_name}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-sidebar-accent transition-all duration-200 group cursor-default"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + index * 0.03 }}
                  whileHover={{ x: 4 }}
                >
                  <FolderOpen className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
                  <span className="text-xs text-muted-foreground/60 group-hover:text-sidebar-foreground truncate flex-1 transition-colors">
                    {doc.doc_name}
                  </span>
                  <span className={cn(
                    'text-[8px] font-bold uppercase px-1.5 py-0.5 rounded',
                    getDocTypeBadgeClass(doc.doc_type)
                  )}>
                    {doc.doc_type}
                  </span>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </nav>

      {/* User / Exit Demo Section */}
      <div className="p-4 border-t border-sidebar-border/50 space-y-3">

        {/* Theme Toggle — always visible */}
        <ThemeToggle />

        <div className="h-px bg-sidebar-border/30" />

        {!demo && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm">
              {user?.username?.slice(0, 2).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-foreground/90">{user?.username || 'User'}</p>
              <p className="text-[9px] text-muted-foreground/50 uppercase tracking-[0.1em]">Woodcrest Capital</p>
            </div>
          </div>
        )}

        {!demo && (
          <motion.button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </motion.button>
        )}

        {demo && (
          <motion.button
            onClick={handleExitDemo}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive/70 hover:text-destructive hover:bg-destructive/10 border border-destructive/20 hover:border-destructive/40 transition-all duration-200"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <LogOut className="w-4 h-4" />
            <span>← Exit Demo</span>
          </motion.button>
        )}
      </div>
    </aside>
  )
}