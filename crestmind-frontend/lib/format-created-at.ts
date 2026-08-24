import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns'

/** Legacy API shape: date only — relative "hours ago" is misleading */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

function parseInstant(value: string): Date | null {
  const s = value.trim()
  if (!s) return null
  const d = parseISO(s)
  if (isValid(d)) return d
  const fallback = new Date(s)
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

/** Relative time from full ISO (browser local "now"); date-only shows calendar date */
export function formatCreatedAtRelative(createdAt: string): string {
  const s = createdAt?.trim()
  if (!s) return '—'
  if (DATE_ONLY.test(s)) {
    const d = parseISO(s)
    return isValid(d) ? format(d, 'MMM d, yyyy') : '—'
  }
  const d = parseInstant(s)
  if (!d) return '—'
  return formatDistanceToNow(d, { addSuffix: true })
}

/** Sort key for document lists (newest first) */
export function createdAtToMs(createdAt: string): number {
  const d = parseInstant(createdAt?.trim() ?? '')
  return d ? d.getTime() : 0
}
