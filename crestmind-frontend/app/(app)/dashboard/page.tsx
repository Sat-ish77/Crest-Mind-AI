'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { MessageSquare, Upload, Database, FileText, Layers, Clock, ArrowRight, Search, Sparkles, Info } from 'lucide-react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import { useAuth } from '@/lib/auth-context'
import useSWR from 'swr'
import { getDocuments, isDemoMode } from '@/lib/api'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { formatCreatedAtRelative, createdAtToMs } from '@/lib/format-created-at'

// ── DEMO STATIC DATA ──
const DEMO_STATS = { documents: 5, chunks: 113, queries: 47 }
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
    description: 'Upload and process new documents to expand your knowledge base with automatic chunking and embedding.',
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
    title: 'Explore Knowledge',
    description: 'Browse your entire document library, search across all uploaded materials, and manage your data.',
    icon: AssemblingGridIcon,
    href: '/ingest',
    gradient: 'from-gold-light/20 to-gold-light/5',
    tooltip: {
      title: 'VECTOR DATABASE',
      description: 'Browse all 113 chunks stored across 5 property documents. Each chunk has a vector + full-text search index.',
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
  const [displayName, setDisplayName] = useState('')
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
  const totalChunks = demo ? DEMO_STATS.chunks    : documents.reduce((acc, doc) => acc + doc.chunks, 0)

  // ── FIXED: spread to avoid mutation, dynamic timeAgo ──
  const lastUpload = documents.length > 0
    ? [...documents].sort((a, b) => createdAtToMs(b.created_at) - createdAtToMs(a.created_at))[0]
    : null

  useEffect(() => {
    const name = demo ? 'Demo User' : (user?.username || 'User')
    let index = 0
    setDisplayName('')
    const interval = setInterval(() => {
      if (index <= name.length) {
        setDisplayName(name.slice(0, index))
        index++
      } else {
        clearInterval(interval)
      }
    }, 80)
    return () => clearInterval(interval)
  }, [user?.username, demo])

  const { count: docCount,   ref: docRef   } = useAnimatedCounter(totalDocs)
  const { count: chunkCount, ref: chunkRef } = useAnimatedCounter(totalChunks)
  const { count: queryCount, ref: queryRef } = useAnimatedCounter(demo ? DEMO_STATS.queries : 0)

  const showLoading = !demo && isLoading

  return (
    <motion.div
      className="min-h-screen p-6 lg:p-8"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <div className="max-w-6xl mx-auto space-y-10">

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

        {/* Header */}
        <motion.header className="space-y-3" variants={itemVariants}>
          <h1 className="text-4xl lg:text-5xl font-serif">
            <span className="text-muted-foreground/60 font-light">Welcome back,</span>{' '}
            <span className="text-primary">
              {displayName}
              <span className="typewriter-cursor" />
            </span>
          </h1>
          <motion.div
            className="h-0.5 w-0 bg-gradient-to-r from-primary to-transparent"
            animate={{ width: displayName.length > 0 ? '120px' : '0px' }}
            transition={{ duration: 0.5, delay: 0.3 }}
          />
          <p className="text-muted-foreground/80 text-sm tracking-wide">
            Your property intelligence dashboard is ready for analysis.
          </p>
        </motion.header>

        {/* Stats Cards */}
        <motion.section className="grid grid-cols-1 md:grid-cols-3 gap-6" variants={containerVariants}>

          {/* Documents */}
          <DemoTooltip
            title="DOCUMENT STORE"
            description="Each document is parsed, split into semantic chunks, and stored with metadata: property name, doc type, section, and page number."
            tech="PyMuPDF + python-docx + Supabase"
            position="bottom"
          >
            <motion.div
              ref={docRef}
              className="glass-card glass-card-hover rounded-xl p-6 animated-border"
              variants={itemVariants}
              whileHover={{ y: -4 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">
                  Documents Uploaded
                </p>
              </div>
              {showLoading ? <StatPlaceholder /> : (
                <p className="text-5xl font-serif text-primary tabular-nums">
                  {docCount.toLocaleString()}
                </p>
              )}
            </motion.div>
          </DemoTooltip>

          {/* Chunks */}
          <DemoTooltip
            title="SEMANTIC CHUNKS"
            description="Documents are split at natural section boundaries — not arbitrary character limits. Each chunk is ~1,000 chars with 150-char overlap so answers are never cut off mid-sentence."
            tech="Custom Python semantic chunker"
            position="bottom"
          >
            <motion.div
              ref={chunkRef}
              className="glass-card glass-card-hover rounded-xl p-6 animated-border"
              variants={itemVariants}
              whileHover={{ y: -4 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Layers className="w-5 h-5 text-primary" />
                </div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">
                  Total Chunks
                </p>
              </div>
              {showLoading ? <StatPlaceholder /> : (
                <p className="text-5xl font-serif text-primary tabular-nums">
                  {chunkCount.toLocaleString()}
                </p>
              )}
            </motion.div>
          </DemoTooltip>

          {/* Queries / Last Upload */}
          <DemoTooltip
            title={demo ? 'RAG PIPELINE' : 'LAST INGESTION'}
            description={demo
              ? 'Every query runs vector similarity search + BM25 keyword search simultaneously, merges results with RRF, then sends top chunks to GPT-4o-mini for a grounded answer.'
              : 'Time since the last document was uploaded into the vector database.'
            }
            tech={demo ? 'pgvector + tsvector + RRF + GPT-4o-mini' : 'Supabase PostgreSQL'}
            position="bottom"
          >
            <motion.div
              ref={queryRef}
              className="glass-card glass-card-hover rounded-xl p-6 animated-border"
              variants={itemVariants}
              whileHover={{ y: -4 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">
                  {demo ? 'Queries Run' : 'Last Upload'}
                </p>
              </div>
              {showLoading ? <StatPlaceholder /> : demo ? (
                <p className="text-5xl font-serif text-primary tabular-nums">
                  {queryCount.toLocaleString()}
                </p>
              ) : (
                <p className="text-5xl font-serif text-primary">
                  {lastUpload ? formatCreatedAtRelative(lastUpload.created_at) : '—'}
                </p>
              )}
            </motion.div>
          </DemoTooltip>
        </motion.section>

        {/* Feature Cards */}
        <motion.section variants={itemVariants}>
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground">
              Quick Actions
            </h2>
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
                        className="glass-card rounded-xl p-6 h-full group animated-border cursor-pointer"
                        whileHover={{ y: -4, scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center mb-5`}>
                          <IconComponent />
                        </div>
                        <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors duration-300">
                          {card.title}
                        </h3>
                        <p className="text-sm text-muted-foreground/70 leading-relaxed mb-5">
                          {card.description}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-primary font-medium">
                          <span className="text-[11px] uppercase tracking-[0.1em]">Get Started</span>
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
          <motion.section className="glass-card rounded-xl p-6" variants={itemVariants}>
            <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground mb-6">
              Recent Activity
            </h2>
            <div className="space-y-3">
              {DEMO_ACTIVITY.map((item, index) => (
                <DemoTooltip
                  key={index}
                  title="QUERY HISTORY"
                  description="Each of these ran the full RAG pipeline — embedded as a vector, searched across 113 chunks, answered by GPT-4o-mini with source citations."
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
          <motion.section className="glass-card rounded-xl p-6" variants={itemVariants}>
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
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{doc.chunks} chunks</span>
                      <span className="text-primary/60">{formatCreatedAtRelative(doc.created_at)}</span>
                    </div>
                  </motion.div>
                ))}
            </div>
          </motion.section>
        ) : null}

        {/* Getting Started — only for real users with no docs */}
        {!demo && documents.length === 0 && !isLoading && (
          <motion.section className="glass-card rounded-xl p-8" variants={itemVariants}>
            <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground mb-8">
              Getting Started
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { step: 1, title: 'Upload Your Documents', description: 'Start by ingesting your property documents such as leases, amendments, invoices, and inspection reports.' },
                { step: 2, title: 'AI Processing', description: 'Our system automatically chunks, embeds, and indexes your documents for intelligent retrieval.' },
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