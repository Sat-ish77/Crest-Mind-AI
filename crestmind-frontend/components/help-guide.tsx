'use client'

import Link from 'next/link'
import { ArrowUpRight, BookOpenCheck, CircleHelp, FileSearch, Flag, Home, MessageSquareText, ShieldCheck, Upload } from 'lucide-react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

const guideSteps = [
  {
    icon: Home,
    title: 'Start at Home',
    description: 'Portfolio overview, recent activity, and shortcuts.',
    href: '/dashboard',
  },
  {
    icon: Upload,
    title: 'Build the Document Library',
    description: 'Add and manage approved property documents.',
    href: '/ingest',
  },
  {
    icon: MessageSquareText,
    title: 'Ask a Property Question',
    description: 'Ask naturally and receive a source-cited answer.',
    href: '/ask',
  },
  {
    icon: Flag,
    title: 'Verify or Flag',
    description: 'Confirm good answers or flag incorrect ones.',
    href: '/review',
  },
]

export function HelpGuide() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="workspace-help-button" aria-label="Open CrestMind guide" title="How CrestMind works">
          <CircleHelp className="h-4 w-4" />
          <span className="hidden sm:inline">Guide</span>
        </button>
      </DialogTrigger>

      <DialogContent className="guide-dialog sm:max-w-3xl">
        <DialogHeader className="pr-8">
          <div className="guide-kicker"><BookOpenCheck className="h-3.5 w-3.5" /> Property Manager Guide</div>
          <DialogTitle className="font-serif text-2xl">CrestMind quick guide</DialogTitle>
          <DialogDescription className="leading-relaxed">
            Search Woodcrest&apos;s approved documents, receive cited answers, and review the result.
          </DialogDescription>
        </DialogHeader>

        <div className="guide-flow">
          {guideSteps.map(({ icon: Icon, title, description, href }, index) => (
            <DialogClose asChild key={title}>
              <Link className="guide-step" href={href}>
                <div className="guide-step-number">{String(index + 1).padStart(2, '0')}</div>
                <div className="guide-step-icon"><Icon className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
                <ArrowUpRight className="guide-step-arrow" />
              </Link>
            </DialogClose>
          ))}
        </div>

        <div className="guide-knowledge-card">
          <FileSearch className="h-5 w-5" />
          <div>
            <h3>What is the Document Library?</h3>
            <p>
              The approved property files CrestMind is allowed to search. Technical indexing stays in the background.
            </p>
          </div>
        </div>

        <div className="guide-trust-note">
          <ShieldCheck className="h-4 w-4" />
          <span>Trust rule: check the cited source before using an answer for a financial, legal, or tenant decision.</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
