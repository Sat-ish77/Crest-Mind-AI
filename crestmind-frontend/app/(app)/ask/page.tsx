'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { Search, DollarSign, CalendarDays, ShieldCheck, ParkingCircle, Droplet, PawPrint, ChevronDown, FileText, Loader2, CheckCircle, AlertCircle, AlertTriangle, RefreshCw, Lock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { askQuestion, AskResponse, Source, getDocuments, isDemoMode } from '@/lib/api'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import useSWR from 'swr'
import { cn } from '@/lib/utils'

const placeholderQuestions = [
  'What is the monthly rent for the property?',
  'When does the lease agreement expire?',
  'What are the parking fees?',
  'Who is responsible for utility payments?',
  'What is the security deposit amount?',
  'What is the pet policy?',
]

// Real user quick questions
const quickQuestions = [
  { icon: DollarSign,    label: 'What is the monthly rent?' },
  { icon: PawPrint,      label: 'What is the pet policy?' },
  { icon: CalendarDays,  label: 'When does the lease expire?' },
  { icon: ShieldCheck,   label: 'What is the security deposit?' },
  { icon: ParkingCircle, label: 'Are there parking fees?' },
  { icon: Droplet,       label: 'Who pays for utilities?' },
]

// Demo mode quick questions — real Woodcrest data
const demoQuestions = [
  { icon: RefreshCw,    label: 'How many renewal options does the tenant have?' },
  { icon: DollarSign,   label: 'What was the total HVAC ductwork invoice?' },
  { icon: CalendarDays, label: 'When does the 2015 lease amendment take effect?' },
  { icon: ShieldCheck,  label: 'What is the base rent for the short term lease?' },
]

const docTypes = [
  { value: '',           label: 'All Document Types' },
  { value: 'lease',      label: 'Lease' },
  { value: 'amendment',  label: 'Amendment' },
  { value: 'invoice',    label: 'Invoice' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'quote',      label: 'Quote' },
  { value: 'work_order', label: 'Work Order' },
]

function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' | string }) {
  const config = {
    high:   { icon: CheckCircle,   label: 'High Confidence',   className: 'bg-success/10 border-success/30 text-success confidence-high' },
    medium: { icon: AlertCircle,   label: 'Medium Confidence', className: 'bg-warning/10 border-warning/30 text-warning confidence-medium' },
    low:    { icon: AlertTriangle, label: 'Low Confidence',    className: 'bg-destructive/10 border-destructive/30 text-destructive confidence-low' },
  }
  const safeKey =
    confidence === 'high' || confidence === 'medium' || confidence === 'low'
      ? confidence
      : 'medium'
  const { icon: Icon, label, className } = config[safeKey]
  return (
    <motion.div
      className={cn('inline-flex items-center gap-2 px-4 py-2 rounded-full border', className)}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Icon className="w-4 h-4" />
      <span className="text-[10px] font-bold uppercase tracking-[0.15em]">{label}</span>
    </motion.div>
  )
}

function SourceCard({ source, index }: { source: Source; index: number }) {
  const [isExpanded, setIsExpanded] = useState(index === 0)
  const confidenceConfig = {
    high:   'text-success',
    medium: 'text-warning',
    low:    'text-destructive',
  }
  return (
    <motion.div
      className="border border-border/50 rounded-xl overflow-hidden glass-card"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-primary/5 hover:bg-primary/10 transition-all duration-300"
      >
        <div className="flex items-center gap-3">
          <FileText className="w-4 h-4 text-primary/60" />
          <div className="text-left">
            <p className="text-sm font-semibold">{source.doc_name}</p>
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.1em]">
              Page {source.page_number} | {source.section}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn('text-[10px] font-bold uppercase tracking-wider', confidenceConfig[source.confidence])}>
            {source.confidence}
          </span>
          <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </motion.div>
        </div>
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="p-5 bg-background/60 border-t border-border/30">
              <div className="bg-muted/30 rounded-lg p-4 border border-border/30">
                <pre className="font-mono text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap terminal-cursor">
                  {source.chunk_text}
                </pre>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── REPLACED AnimatedAnswer with MarkdownAnswer ──
// Properly renders markdown tables, bold, lists from LLM output
function MarkdownAnswer({ text }: { text: string }) {
  return (
    <motion.div
      className="prose prose-sm max-w-none text-foreground"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="w-full border-collapse text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-primary/10 border-b border-primary/20">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-border/30">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-primary/5 transition-colors">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-primary/80">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 text-sm text-foreground/80">
              {children}
            </td>
          ),
          // Text elements
          p: ({ children }) => (
            <p className="text-base leading-relaxed text-foreground mb-3 last:mb-0">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">
              {children}
            </strong>
          ),
          // Lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1 text-foreground/80 mb-3">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 text-foreground/80 mb-3">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-sm text-foreground/80">
              {children}
            </li>
          ),
          // Code (for source citations)
          code: ({ children }) => (
            <code className="font-mono text-xs bg-muted/50 px-1.5 py-0.5 rounded text-primary/80">
              {children}
            </code>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </motion.div>
  )
}

export default function AskPage() {
  const [query, setQuery] = useState('')
  const [filterDocType, setFilterDocType] = useState('')
  const [filterDocName, setFilterDocName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState<AskResponse | null>(null)
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [isFocused, setIsFocused] = useState(false)

  const demo = isDemoMode()

  const { data: documentsData } = useSWR(demo ? null : 'documents', getDocuments)
  const documents = demo ? [] : (documentsData?.documents || [])

  // Cycle placeholder questions — only for real users
  useEffect(() => {
    if (demo || isFocused || query) return
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholderQuestions.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [isFocused, query, demo])

  const deduplicatedSources = useMemo(() => {
    if (!response?.sources) return []
    const seen = new Set<string>()
    return response.sources.filter((source) => {
      const key = `${source.doc_name}-${source.section}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [response?.sources])

  const handleSearch = useCallback(async (searchQuery?: string) => {
    const q = searchQuery || query
    if (!q.trim()) {
      toast.error('Please enter a question')
      return
    }

    // In demo mode only allow the 4 pre-defined questions
    if (demo) {
      const allowed = demoQuestions.map(q => q.label.toLowerCase())
      if (!allowed.includes(q.toLowerCase())) {
        toast.error('Please use one of the pre-loaded questions above')
        return
      }
    }

    setIsLoading(true)
    setResponse(null)

    try {
      const result = await askQuestion({
        query: q,
        filter_doc_type: filterDocType || null,
        filter_doc_name: filterDocName || null,
        top_k: 5,
      })
      setResponse(result)
    } catch (error) {
      console.error('Ask error:', error)
      toast.error('Failed to get answer. Please check if the API is running.')
    } finally {
      setIsLoading(false)
    }
  }, [query, filterDocType, filterDocName, demo])

  const handleQuickQuestion = (question: string) => {
    setQuery(question)
    handleSearch(question)
  }

  const activePills = demo ? demoQuestions : quickQuestions

  return (
    <motion.div
      className="min-h-screen p-6 lg:p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="max-w-4xl mx-auto space-y-10">

        {/* Header */}
        <motion.header
          className="space-y-2"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl lg:text-4xl font-serif text-foreground">Ask a Question</h1>
          <p className="text-muted-foreground/70 text-sm tracking-wide">
            {demo
              ? 'Explore real Woodcrest Capital property documents powered by RAG'
              : 'Query your property documents using natural language'}
          </p>
        </motion.header>

        {/* Quick Questions / Demo Pills */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 mb-4 px-1">
            {demo ? '✦ Click a Question to Try the RAG Pipeline' : 'Common Inquiries'}
          </p>
          <div className={cn(
            'grid gap-3',
            demo
              ? 'grid-cols-1 sm:grid-cols-2'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
          )}>
            {activePills.map((item, index) => {
              const Icon = item.icon
              return (
                <motion.button
                  key={item.label}
                  onClick={() => handleQuickQuestion(item.label)}
                  disabled={isLoading}
                  className={cn(
                    'flex items-center gap-3 p-4 glass-card rounded-xl transition-all duration-300 text-left group disabled:opacity-50 disabled:cursor-not-allowed button-press',
                    demo
                      ? 'hover:border-primary/50 hover:bg-primary/5 border border-primary/20'
                      : 'hover:border-primary/30'
                  )}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.05 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground transition-colors">
                    {item.label}
                  </span>
                </motion.button>
              )
            })}
          </div>
        </motion.section>

        {/* Search Input */}
        <motion.section
          className="space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <div className="relative">
            {demo ? (
              <div className="relative">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/30" />
                <div className="w-full glass-card rounded-xl py-5 pl-14 pr-6 text-lg text-muted-foreground/30 border border-primary/10 cursor-not-allowed select-none">
                  Use the questions above to explore the demo
                </div>
              </div>
            ) : (
              <>
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/50" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder={placeholderQuestions[placeholderIndex]}
                  className="w-full glass-card rounded-xl py-5 pl-14 pr-6 text-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all duration-300 placeholder:text-muted-foreground/30 caret-primary"
                  disabled={isLoading}
                />
                <motion.div
                  className="absolute inset-0 rounded-xl pointer-events-none"
                  initial={false}
                  animate={isFocused
                    ? { boxShadow: '0 0 0 2px rgba(201, 168, 76, 0.2), 0 0 40px rgba(201, 168, 76, 0.1)' }
                    : { boxShadow: '0 0 0 0 transparent' }
                  }
                  transition={{ duration: 0.3 }}
                />
              </>
            )}
          </div>

          {/* Filters + Search button — hidden in demo */}
          {!demo && (
            <div className="flex flex-wrap items-center gap-4">
              <select
                value={filterDocType}
                onChange={(e) => setFilterDocType(e.target.value)}
                className="glass-card rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all appearance-none cursor-pointer min-w-[160px]"
                disabled={isLoading}
              >
                {docTypes.map((type) => (
                  <option key={type.value} value={type.value} className="bg-card">
                    {type.label}
                  </option>
                ))}
              </select>

              <select
                value={filterDocName}
                onChange={(e) => setFilterDocName(e.target.value)}
                className="glass-card rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all appearance-none cursor-pointer min-w-[160px]"
                disabled={isLoading}
              >
                <option value="" className="bg-card">All Documents</option>
                {documents.map((doc) => (
                  <option key={doc.doc_name} value={doc.doc_name} className="bg-card">
                    {doc.doc_name}
                  </option>
                ))}
              </select>

              <motion.button
                onClick={() => handleSearch()}
                disabled={isLoading || !query.trim()}
                className="ml-auto bg-gradient-to-r from-primary to-primary-electric hover:from-primary-electric hover:to-primary text-primary-foreground font-bold px-8 py-3 rounded-lg transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-3 button-press button-shimmer"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isLoading ? (
                  <>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                      <Loader2 className="w-5 h-5" />
                    </motion.div>
                    <span className="text-sm uppercase tracking-[0.1em]">Analyzing</span>
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    <span className="text-sm uppercase tracking-[0.1em]">Search</span>
                  </>
                )}
              </motion.button>
            </div>
          )}
        </motion.section>

        {/* Loading State */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              className="flex flex-col items-center justify-center py-20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div className="relative">
                <motion.div
                  className="w-16 h-16 rounded-full border-2 border-primary/20"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <motion.div
                  className="absolute inset-0 flex items-center justify-center"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                >
                  <div className="w-12 h-12 rounded-full border-2 border-transparent border-t-primary" />
                </motion.div>
              </motion.div>
              <motion.p
                className="text-sm text-muted-foreground mt-6 tracking-wide"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {demo ? 'Running hybrid search + RRF...' : 'Analyzing documents...'}
              </motion.p>
              <motion.div
                className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
                animate={{ y: [0, 100, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {response && !isLoading && (
            <motion.section
              className="space-y-6"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            >
              <div className="flex items-center justify-between px-1">
                <ConfidenceBadge confidence={response.overall_confidence} />
                <motion.span
                  className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.1em]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  {response.found_in_documents ? 'Found in documents' : 'No direct match found'}
                </motion.span>
              </div>

              <motion.div
                className="glass-card rounded-xl p-8 border-l-4 border-l-primary relative overflow-hidden"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.4 }}
              >
                <motion.div
                  className="absolute left-0 top-0 bottom-0 w-1 bg-primary"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: 2 }}
                />
                {/* ── FIXED: MarkdownAnswer replaces AnimatedAnswer ── */}
                <MarkdownAnswer text={response.answer} />
              </motion.div>

              {deduplicatedSources.length > 0 && (
                <motion.div
                  className="space-y-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 px-1">
                    Source Citations ({deduplicatedSources.length})
                  </p>
                  <div className="space-y-3">
                    {deduplicatedSources.map((source, index) => (
                      <SourceCard
                        key={`${source.doc_name}-${source.section}-${index}`}
                        source={source}
                        index={index}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.section>
          )}
        </AnimatePresence>

        {/* Not Found State */}
        <AnimatePresence>
          {response && !response.found_in_documents && !isLoading && (
            <motion.div
              className="flex flex-col items-center text-center py-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4"
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5 }}
              >
                <Search className="w-8 h-8 text-destructive/60" />
              </motion.div>
              <p className="text-sm text-muted-foreground">
                Try rephrasing your question or uploading more documents.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {!response && !isLoading && (
          <motion.div
            className="flex flex-col items-center justify-center py-20 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <motion.div
              className="w-20 h-20 rounded-full bg-primary/5 border border-primary/10 flex items-center justify-center mb-6"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <Search className="w-10 h-10 text-primary/30" />
            </motion.div>
            <h3 className="text-lg font-serif text-foreground/80 mb-2">
              {demo ? 'Click a question above to see it in action' : 'Ready to Search'}
            </h3>
            <p className="text-sm text-muted-foreground/60 max-w-md leading-relaxed">
              {demo
                ? 'Each question runs a live RAG pipeline — vector search + keyword search merged with RRF, answered by GPT-4o-mini with source citations.'
                : 'Enter your question above or select a common inquiry. Our AI will analyze your property documents and provide accurate answers with source citations.'}
            </p>
          </motion.div>
        )}

      </div>
    </motion.div>
  )
}