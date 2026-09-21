'use client'

import { useState } from 'react'
import { Flag, CheckCircle, FileText, Inbox } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import useSWR from 'swr'
import { getFeedback, AuditLog, isDemoMode } from '@/lib/api'
import { cn } from '@/lib/utils'

// Audit trail for CR-CAP2-001 — read-only view of every human judgement
// recorded on an AI answer. This is the screen the client opens to check
// that answers feeding financial decisions were reviewed by a person.

type Filter = '' | 'verified' | 'flagged'

const filters: { value: Filter; label: string }[] = [
  { value: '',         label: 'All' },
  { value: 'flagged',  label: 'Flagged' },
  { value: 'verified', label: 'Verified' },
]

function formatTimestamp(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleString()
}

function LogCard({ log, index }: { log: AuditLog; index: number }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const flagged = log.action === 'flagged'

  return (
    <motion.div
      className="glass-card rounded-xl overflow-hidden border border-border/50"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.35 }}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-start justify-between gap-4 p-5 text-left hover:bg-primary/5 transition-colors"
      >
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-bold uppercase tracking-[0.15em]',
                flagged
                  ? 'bg-destructive/10 border-destructive/30 text-destructive'
                  : 'bg-success/10 border-success/30 text-success'
              )}
            >
              {flagged ? <Flag className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
              {log.action}
            </span>
            {log.overall_confidence && (
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">
                {log.overall_confidence} confidence
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-foreground truncate">{log.query}</p>
          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.1em]">
            {log.username || 'unknown user'} &nbsp;|&nbsp; {formatTimestamp(log.created_at)}
          </p>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="p-5 pt-0 space-y-4 border-t border-border/30">
              {log.note && (
                <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-destructive/70 mb-1.5">
                    Reviewer Note
                  </p>
                  <p className="text-sm text-foreground/80">{log.note}</p>
                </div>
              )}

              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 mb-1.5">
                  Answer as shown
                </p>
                <pre className="font-mono text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap bg-muted/30 rounded-lg p-4 border border-border/30">
                  {log.answer}
                </pre>
              </div>

              {log.sources?.length > 0 && (
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 mb-1.5">
                    Sources cited ({log.sources.length})
                  </p>
                  <div className="space-y-1.5">
                    {log.sources.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground/80">
                        <FileText className="w-3.5 h-3.5 text-primary/50 shrink-0" />
                        <span className="truncate">
                          {s.doc_name} &nbsp;|&nbsp; Page {s.page_number} &nbsp;|&nbsp; {s.section}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function ReviewPage() {
  const [filter, setFilter] = useState<Filter>('')
  const demo = isDemoMode()

  const { data, isLoading } = useSWR(
    ['feedback', filter],
    () => getFeedback(filter || undefined)
  )
  const logs = data?.logs || []

  return (
    <motion.div
      className="min-h-screen p-6 lg:p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="max-w-4xl mx-auto space-y-8">

        <motion.header
          className="space-y-2"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl lg:text-4xl font-serif text-foreground">Answer Review</h1>
          <p className="text-muted-foreground/70 text-sm tracking-wide">
            Every answer a person verified or flagged, newest first.
          </p>
        </motion.header>

        <div className="flex flex-wrap items-center gap-3">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                'px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-[0.15em] transition-all button-press border',
                filter === f.value
                  ? 'bg-primary/15 border-primary/40 text-primary'
                  : 'glass-card border-border/50 text-muted-foreground/70 hover:border-primary/30'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {demo && (
          <div className="glass-card rounded-xl p-4 border border-warning/30 bg-warning/5">
            <p className="text-xs text-warning">
              Demo mode is on. Demo answers are never written to the audit trail,
              so this list stays empty until you sign in normally.
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <motion.div
              className="w-12 h-12 rounded-full border-2 border-transparent border-t-primary"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        ) : logs.length === 0 ? (
          <motion.div
            className="flex flex-col items-center justify-center py-20 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="w-20 h-20 rounded-full bg-primary/5 border border-primary/10 flex items-center justify-center mb-6">
              <Inbox className="w-10 h-10 text-primary/30" />
            </div>
            <h3 className="text-lg font-serif text-foreground/80 mb-2">Nothing recorded yet</h3>
            <p className="text-sm text-muted-foreground/60 max-w-md leading-relaxed">
              When someone verifies or flags an answer on the Ask page, it shows up here
              with the sources it cited.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {logs.map((log, index) => (
              <LogCard key={log.id} log={log} index={index} />
            ))}
          </div>
        )}

      </div>
    </motion.div>
  )
}
