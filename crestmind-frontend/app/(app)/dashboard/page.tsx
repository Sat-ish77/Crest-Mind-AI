'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { MessageSquare, Database, FileText, ArrowRight, Search, Sparkles, Info, ShieldCheck, Building2, CalendarDays, FolderOpen, CircleCheck, ScanSearch } from 'lucide-react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import { useAuth } from '@/lib/auth-context'
import useSWR from 'swr'
import { getDocuments, isDemoMode } from '@/lib/api'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { formatCreatedAtRelative, createdAtToMs } from '@/lib/format-created-at'

// ── DEMO STATIC DATA ──
const DEMO_STATS = { documents: 5, categories: 4, queries: 47 }
const DEMO_ACTIVITY = [
  { question: 'How many renewal options does the tenant have?', time: '2 minutes ago' },
  { question: 'What is the base rent for the short term lease?', time: '1 hour ago' },
  { question: 'When does the 2015 amendment take effect?', time: '3 hours ago' },
]

// ── DEMO TOOLTIP COMPONENT ──
interface TooltipProps {
  title: string
  description: string
  tech?: string
  children: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
}

function DemoTooltip({ title, description, tech, children, position = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const demo = isDemoMode()
  if (!demo) return <>{children}</>

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onTouchStart={() => setVisible(!visible)}
    >
      {children}

      {/* Gold ? badge */}
      <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center z-10 pointer-events-none">
        <Info className="w-2.5 h-2.5 text-primary" />
      </div>

      <AnimatePresence>
        {visible && (
          <motion.div
            className={cn(
              'absolute z-50 w-64 pointer-events-none',
              positionClasses[position]
            )}
            initial={{ opacity: 0, scale: 0.95, y: position === 'top' ? 4 : -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            <div
              className="demo-tooltip-inner rounded-xl p-3 border"
              style={{
                background: 'rgba(14,12,10,0.95)',
                backdropFilter: 'blur(20px)',
                borderColor: 'rgba(201,168,76,0.25)',
                boxShadow: '0 0 0 1px rgba(201,168,76,0.08), 0 20px 40px rgba(0,0,0,0.6)',
              }}
            >
              <p className="tooltip-title text-[9px] font-bold uppercase tracking-[0.2em] mb-1">
                {title}
              </p>
              <p className="tooltip-body text-xs leading-relaxed mb-1.5">
                {description}
              </p>
              {tech && (
                <p className="tooltip-tech text-[10px] font-mono">
                  ⚙ {tech}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Animated counter
function useAnimatedCounter(target: number, duration: number = 1500) {
  const [count, setCount] = useState(0)
  const [lastTarget, setLastTarget] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true })

  useEffect(() => {
    if (!isInView || target === 0) return
    if (target === lastTarget) return
    setLastTarget(target)
    const startTime = Date.now()
    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const easeOut = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(target * easeOut))
      if (progress < 1) requestAnimationFrame(animate)
      else setCount(target)
    }
    requestAnimationFrame(animate)
  }, [target, duration, isInView, lastTarget])

  return { count, ref }
}

function PulsingSearchIcon() {
  return (
    <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
      <Search className="w-7 h-7 text-primary" />
    </motion.div>
  )
}

function FillingDocumentIcon() {
  return (
    <div className="relative w-7 h-7">
      <FileText className="w-7 h-7 text-success absolute" />
      <motion.div
        className="absolute inset-0 overflow-hidden"
        initial={{ height: '100%' }}
        animate={{ height: ['100%', '0%', '100%'] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="w-7 h-7 bg-card" />
      </motion.div>
    </div>
  )
}

function AssemblingGridIcon() {
  return (
    <motion.div className="relative w-7 h-7 flex flex-wrap gap-0.5">
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="w-3 h-3 rounded-sm bg-gold-light"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: i * 0.15, repeat: Infinity, repeatType: 'reverse', repeatDelay: 1.5 }}
        />
      ))}
    </motion.div>
  )
}

const featureCards = [
  {
    title: 'Ask Questions',
    description: 'Query your property documents using natural language and receive AI-powered insights with source citations.',
    icon: PulsingSearchIcon,
    href: '/ask',
    gradient: 'from-primary/20 to-primary/5',
    tooltip: {
      title: 'RAG PIPELINE',
      description: 'Click to ask any question about the pre-loaded Woodcrest Capital documents. AI finds the answer with source citations.',
      tech: 'GPT-4o-mini + pgvector + RRF',
    },
  },
  {
    title: 'Upload Documents',
    description: 'Add leases, amendments, invoices, and reports to your secure property library.',
    icon: FillingDocumentIcon,
    href: '/ingest',
    gradient: 'from-success/20 to-success/5',
    tooltip: {
      title: 'DOCUMENT UPLOAD',
      description: 'Upload PDFs or DOCX files. They get parsed, split into semantic chunks, embedded as vectors, and stored for retrieval.',
      tech: 'PyMuPDF + OpenAI Embeddings + Supabase',
    },
  },
  {
    title: 'Browse Library',
    description: 'Review your document library by property and document type, with upload history at a glance.',
    icon: AssemblingGridIcon,
    href: '/ingest',
    gradient: 'from-gold-light/20 to-gold-light/5',
    tooltip: {
      title: 'VECTOR DATABASE',
      description: 'Browse the source documents that power cited answers across the Woodcrest property portfolio.',
      tech: 'Supabase PostgreSQL + pgvector',
    },
  },
]

const EASE_OUT: [number, number, number, number] = [0.4, 0, 0.2, 1]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
}

function StatPlaceholder() {
  return (
    <motion.span
      className="text-5xl font-serif text-primary/30 tabular-nums"
      animate={{ opacity: [0.3, 0.7, 0.3] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    >
      —
    </motion.span>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const demo = isDemoMode()

  const { data: documentsData, isLoading } = useSWR(
    demo ? null : 'documents',
    getDocuments,
    {
      refreshInterval: 30000,
      revalidateOnMount: true,
      revalidateOnFocus: true,
    }
  )

  const documents = demo ? [] : (documentsData?.documents || [])
  const totalDocs   = demo ? DEMO_STATS.documents : documents.length
  const totalCategories = demo
    ? DEMO_STATS.categories
    : new Set(documents.map((doc) => doc.doc_type).filter(Boolean)).size

  // ── FIXED: spread to avoid mutation, dynamic timeAgo ──
  const lastUpload = documents.length > 0
    ? [...documents].sort((a, b) => createdAtToMs(b.created_at) - createdAtToMs(a.created_at))[0]
    : null

  const { count: docCount,   ref: docRef   } = useAnimatedCounter(totalDocs)
  const { count: categoryCount, ref: categoryRef } = useAnimatedCounter(totalCategories)
  const { count: queryCount, ref: queryRef } = useAnimatedCounter(demo ? DEMO_STATS.queries : 0)

  const showLoading = !demo && isLoading
  const displayName = demo ? 'Demo User' : (user?.username || 'Property Manager')
  const firstName = displayName.trim().split(/\s+/)[0] || 'Property Manager'
  const lastUploadText = demo
    ? 'Updated 2 hours ago'
    : lastUpload
      ? `Last document ${formatCreatedAtRelative(lastUpload.created_at)}`
      : 'No documents uploaded yet'
  const currentDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date())

  return (
    <motion.div
      className="min-h-screen p-5 sm:p-6 lg:p-8 relative overflow-hidden"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <div className="dashboard-orb dashboard-orb-one" aria-hidden />
      <div className="dashboard-orb dashboard-orb-two" aria-hidden />
      <div className="max-w-6xl mx-auto space-y-8 relative z-10">

        {/* Demo hint banner */}
        {demo && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-primary/15 bg-primary/5"
          >
            <Info className="w-4 h-4 text-primary/50 shrink-0" />
            <p className="text-xs text-primary/60">
              <span className="font-semibold text-primary/80">Demo tip:</span> Hover over any card, stat, or button to learn what it does and what powers it.
            </p>
          </motion.div>
        )}

        {/* Property manager command header */}
        <motion.header className="dashboard-hero rounded-[28px] p-6 sm:p-8 lg:p-10 overflow-hidden" variants={itemVariants}>
          <div className="dashboard-hero-grid" aria-hidden />
          <motion.div
            className="dashboard-hero-ring hidden sm:block"
            animate={{ rotate: 360 }}
            transition={{ duration: 32, repeat: Infinity, ease: 'linear' }}
            aria-hidden
          />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2 mb-5">
                <span className="role-pill"><Building2 className="w-3.5 h-3.5" /> Property Manager Workspace</span>
                <span className="status-pill"><span className="status-pulse" /> Systems ready</span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mb-2 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" /> {currentDate}
              </p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif tracking-tight leading-[1.02]">
                Welcome back, <span className="text-primary">{firstName}</span>
              </h1>
              <p className="mt-4 text-sm sm:text-base text-muted-foreground max-w-xl leading-relaxed">
                Your secure command center for leases, property records, and source-backed answers.
              </p>
            </div>
            <Link href="/ask" className="shrink-0">
              <motion.div
                className="hero-cta group"
                whileHover={{ y: -3, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="hero-cta-icon"><ScanSearch className="w-5 h-5" /></div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] opacity-65">Start here</p>
                  <p className="font-semibold">Ask about a property</p>
                </div>
                <ArrowRight className="w-4 h-4 ml-4 group-hover:translate-x-1 transition-transform" />
              </motion.div>
            </Link>
          </div>
          <div className="relative z-10 mt-8 flex flex-wrap gap-2">
            {['Source-cited answers', 'Secure document library', 'Human-reviewed feedback'].map((label) => (
              <span key={label} className="trust-chip"><CircleCheck className="w-3.5 h-3.5" /> {label}</span>
            ))}
          </div>
        </motion.header>

        {/* Stats Cards */}
        <motion.section className="grid grid-cols-1 md:grid-cols-3 gap-6" variants={containerVariants}>

          {/* Document library — includes last upload as requested */}
          <DemoTooltip
            title="DOCUMENT STORE"
            description="The complete searchable document library, with the most recent upload shown in the same card."
            tech="PyMuPDF + python-docx + Supabase"
            position="bottom"
          >
            <motion.div
              ref={docRef}
              className="metric-card metric-card-primary rounded-2xl p-6 animated-border"
              variants={itemVariants}
              whileHover={{ y: -4 }}
            >
              <div className="flex items-start justify-between gap-3 mb-5">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <span className="metric-kicker">Document library</span>
              </div>
              {showLoading ? <StatPlaceholder /> : (
                <p className="text-5xl font-serif text-primary tabular-nums">
                  {docCount.toLocaleString()}
                </p>
              )}
              <p className="mt-3 text-xs text-muted-foreground flex items-center gap-2">
                <CalendarDays className="w-3.5 h-3.5 text-primary" /> {lastUploadText}
              </p>
            </motion.div>
          </DemoTooltip>

          {/* Business-friendly coverage metric */}
          <DemoTooltip
            title="DOCUMENT COVERAGE"
            description="The number of business document categories currently represented in the library."
            tech="Document metadata classification"
            position="bottom"
          >
            <motion.div
              ref={categoryRef}
              className="metric-card metric-card-success rounded-2xl p-6 animated-border"
              variants={itemVariants}
              whileHover={{ y: -4 }}
            >
              <div className="flex items-start justify-between gap-3 mb-5">
                <div className="w-11 h-11 rounded-xl bg-success/10 flex items-center justify-center">
                  <FolderOpen className="w-5 h-5 text-success" />
                </div>
                <span className="metric-kicker">Document categories</span>
              </div>
              {showLoading ? <StatPlaceholder /> : (
                <p className="text-5xl font-serif text-success tabular-nums">
                  {categoryCount.toLocaleString()}
                </p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">Leases, amendments, invoices, reports</p>
            </motion.div>
          </DemoTooltip>

          {/* Assistant readiness / demo usage */}
          <DemoTooltip
            title="KNOWLEDGE ASSISTANT"
            description={demo
              ? 'Every query runs vector similarity search + BM25 keyword search simultaneously, merges results with RRF, then sends top chunks to GPT-4o-mini for a grounded answer.'
              : 'Your document assistant is available and configured to return answers with source references.'
            }
            tech={demo ? 'pgvector + tsvector + RRF + GPT-4o-mini' : 'Supabase PostgreSQL'}
            position="bottom"
          >
            <motion.div
              ref={queryRef}
              className="metric-card metric-card-info rounded-2xl p-6 animated-border"
              variants={itemVariants}
              whileHover={{ y: -4 }}
            >
              <div className="flex items-start justify-between gap-3 mb-5">
                <div className="w-11 h-11 rounded-xl bg-sky-500/10 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-sky-500" />
                </div>
                <span className="metric-kicker">Assistant status</span>
              </div>
              {showLoading ? <StatPlaceholder /> : demo ? (
                <p className="text-5xl font-serif text-primary tabular-nums">
                  {queryCount.toLocaleString()}
                </p>
              ) : (
                <p className="text-4xl font-serif text-sky-500">Ready</p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                {demo ? 'Questions answered in this workspace' : 'Source citations and review enabled'}
              </p>
            </motion.div>
          </DemoTooltip>
        </motion.section>

        {/* Feature Cards */}
        <motion.section variants={itemVariants}>
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 text-primary mb-2">
                <Sparkles className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Property operations</span>
              </div>
              <h2 className="text-2xl font-serif">What would you like to do?</h2>
            </div>
            <p className="hidden md:block text-xs text-muted-foreground">Designed for everyday property workflows</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featureCards.map((card, index) => {
              const IconComponent = card.icon
              return (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                >
                  <DemoTooltip
                    title={card.tooltip.title}
                    description={card.tooltip.description}
                    tech={card.tooltip.tech}
                    position="top"
                  >
                    <Link href={card.href}>
                      <motion.div
                        className="action-card rounded-2xl p-6 h-full group cursor-pointer"
                        whileHover={{ y: -4, scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${card.gradient} flex items-center justify-center mb-5 action-card-icon`}>
                          <IconComponent />
                        </div>
                        <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors duration-300">
                          {card.title}
                        </h3>
                        <p className="text-sm text-muted-foreground/70 leading-relaxed mb-5">
                          {card.description}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-primary font-medium">
                          <span className="text-[11px] uppercase tracking-[0.1em]">Open workspace</span>
                          <motion.div className="inline-block" whileHover={{ x: 4 }} transition={{ type: 'spring', stiffness: 400 }}>
                            <ArrowRight className="w-4 h-4" />
                          </motion.div>
                        </div>
                      </motion.div>
                    </Link>
                  </DemoTooltip>
                </motion.div>
              )
            })}
          </div>
        </motion.section>

        {/* Demo Activity Feed / Real Recent Documents */}
        {demo ? (
          <motion.section className="glass-card rounded-2xl p-6 lg:p-7" variants={itemVariants}>
            <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground mb-6">
              Recent Activity
            </h2>
            <div className="space-y-3">
              {DEMO_ACTIVITY.map((item, index) => (
                <DemoTooltip
                  key={index}
                  title="QUERY HISTORY"
                  description="Each question was checked against the document library and answered with source citations."
                  tech="OpenAI text-embedding-3-small + RRF"
                  position="top"
                >
                  <motion.div
                    className="flex items-center justify-between p-4 rounded-lg bg-background/30 border border-border/50"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + index * 0.1 }}
                  >
                    <div className="flex items-center gap-3">
                      <MessageSquare className="w-4 h-4 text-primary/60 shrink-0" />
                      <span className="text-sm text-muted-foreground/80">{item.question}</span>
                    </div>
                    <span className="text-xs text-muted-foreground/40 shrink-0 ml-4">{item.time}</span>
                  </motion.div>
                </DemoTooltip>
              ))}
            </div>
          </motion.section>
        ) : documents.length > 0 ? (
          <motion.section className="glass-card rounded-2xl p-6 lg:p-7" variants={itemVariants}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground">
                Recent Documents
              </h2>
              <Link href="/ingest" className="text-xs text-primary hover:text-primary-electric transition-colors flex items-center gap-1">
                <span>View All</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-3">
              {[...documents]
                .sort((a, b) => createdAtToMs(b.created_at) - createdAtToMs(a.created_at))
                .slice(0, 3)
                .map((doc, index) => (
                  <motion.div
                    key={doc.doc_name}
                    className="flex items-center justify-between p-4 rounded-lg bg-background/30 border border-border/50 hover:border-primary/30 transition-colors"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + index * 0.1 }}
                  >
                    <div className="flex items-center gap-3">
                      <Database className="w-4 h-4 text-primary/60" />
                      <span className="text-sm font-medium truncate max-w-[200px]">{doc.doc_name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="hidden sm:inline capitalize px-2 py-1 rounded-full bg-primary/8 text-primary">{doc.doc_type?.replaceAll('_', ' ') || 'Document'}</span>
                      <span>{formatCreatedAtRelative(doc.created_at)}</span>
                    </div>
                  </motion.div>
                ))}
            </div>
          </motion.section>
        ) : null}

        {/* Getting Started — only for real users with no docs */}
        {!demo && documents.length === 0 && !isLoading && (
          <motion.section className="glass-card rounded-2xl p-8" variants={itemVariants}>
            <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground mb-8">
              Getting Started
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { step: 1, title: 'Upload Your Documents', description: 'Start by ingesting your property documents such as leases, amendments, invoices, and inspection reports.' },
                { step: 2, title: 'Secure Processing', description: 'CrestMind prepares each document for accurate search while preserving its source details.' },
                { step: 3, title: 'Ask Anything', description: 'Query your knowledge base using natural language and receive accurate answers with source citations.' },
              ].map((item, index) => (
                <motion.div
                  key={item.step}
                  className="relative"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.15 }}
                >
                  <div className="flex items-start gap-4">
                    <motion.div
                      className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0"
                      whileHover={{ scale: 1.1, backgroundColor: 'rgba(201, 168, 76, 0.2)' }}
                    >
                      <span className="text-sm font-bold text-primary">{item.step}</span>
                    </motion.div>
                    <div>
                      <h3 className="font-semibold mb-2 text-foreground/90">{item.title}</h3>
                      <p className="text-sm text-muted-foreground/70 leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                  {item.step < 3 && (
                    <div className="hidden md:block absolute top-5 left-[calc(100%_-_1.5rem)] w-12 border-t border-dashed border-primary/20" />
                  )}
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

      </div>
    </motion.div>
  )
}
