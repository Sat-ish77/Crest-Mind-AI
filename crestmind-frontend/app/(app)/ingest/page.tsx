'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Upload, CloudUpload, FileText, Check, Trash2, AlertCircle, X, Database, Search, FileStack, Sparkles, Cpu, Lock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ingestDocument, getDocuments, deleteDocument, Document, isDemoMode } from '@/lib/api'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import useSWR, { mutate } from 'swr'
import { cn } from '@/lib/utils'
import { formatCreatedAtRelative } from '@/lib/format-created-at'

const docTypes = [
  { value: 'auto-detect', label: 'Auto-detect' },
  { value: 'lease', label: 'Lease' },
  { value: 'amendment', label: 'Amendment' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'quote', label: 'Quote' },
  { value: 'work_order', label: 'Work Order' },
]

type IngestStep = 'reading' | 'chunking' | 'embedding'

function getDocTypeBadgeClass(docType: string): string {
  const type = docType.toLowerCase()
  if (type === 'lease') return 'badge-lease'
  if (type === 'amendment') return 'badge-amendment'
  if (type === 'invoice') return 'badge-invoice'
  if (type === 'inspection') return 'badge-inspection'
  if (type === 'quote') return 'badge-quote'
  if (type === 'work_order') return 'badge-work_order'
  return 'badge-invoice'
}

// Animated pipeline visualization
function PipelineVisualization({ currentStep }: { currentStep: IngestStep }) {
  const steps: { key: IngestStep; label: string; description: string; icon: React.ElementType }[] = [
    { key: 'reading', label: 'Reading', description: 'Reading document...', icon: FileText },
    { key: 'chunking', label: 'Chunking', description: 'Creating semantic chunks...', icon: FileStack },
    { key: 'embedding', label: 'Embedding', description: 'Generating embeddings...', icon: Cpu },
  ]

  const currentIndex = steps.findIndex((s) => s.key === currentStep)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-primary uppercase tracking-[0.1em]">Processing</span>
        <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
          Step {currentIndex + 1} of {steps.length}
        </span>
      </div>
      
      {/* Progress bar */}
      <div className="relative w-full h-1.5 bg-muted/30 rounded-full overflow-hidden">
        <motion.div 
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-primary-electric"
          initial={{ width: '0%' }}
          animate={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
        <motion.div 
          className="absolute top-0 left-0 h-full w-full progress-shimmer"
          style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }}
        />
      </div>
      
      {/* Steps */}
      <div className="flex justify-between gap-4">
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex
          const isCurrent = index === currentIndex
          const Icon = step.icon
          
          return (
            <motion.div 
              key={step.key} 
              className="flex flex-col items-center gap-3 flex-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <motion.div 
                className={cn(
                  'w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300',
                  isCompleted ? 'bg-success/20 border border-success/30' :
                  isCurrent ? 'bg-primary/20 border border-primary/30' :
                  'bg-muted/20 border border-border/30'
                )}
                animate={isCurrent ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {isCompleted ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500 }}
                  >
                    <Check className="w-6 h-6 text-success" />
                  </motion.div>
                ) : isCurrent ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  >
                    <Icon className="w-6 h-6 text-primary" />
                  </motion.div>
                ) : (
                  <Icon className="w-6 h-6 text-muted-foreground/30" />
                )}
              </motion.div>
              <div className="text-center">
                <p className={cn(
                  'text-[10px] font-bold uppercase tracking-[0.1em]',
                  isCompleted ? 'text-success' : isCurrent ? 'text-primary' : 'text-muted-foreground/40'
                )}>
                  {step.label}
                </p>
                {isCurrent && (
                  <motion.p 
                    className="text-[10px] text-muted-foreground/60 mt-1"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    {step.description}
                  </motion.p>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

// Confetti burst component
function ConfettiBurst() {
  const particles = Array.from({ length: 20 }).map((_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 200,
    y: (Math.random() - 0.5) * 200,
    rotation: Math.random() * 360,
    scale: Math.random() * 0.5 + 0.5,
  }))

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute left-1/2 top-1/2 w-2 h-2 rounded-full bg-primary"
          initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: p.scale, rotate: p.rotation }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      ))}
    </div>
  )
}

// ── DEMO MODE: static knowledge base ──
const DEMO_DOCUMENTS: Document[] = [
  { doc_name: 'Ollies - Lease, 2010.docx',         doc_type: 'lease',      chunks: 28, created_at: '2025-03-10T14:22:00Z' },
  { doc_name: 'Ollies - Amend 1, 2015.docx',       doc_type: 'amendment',  chunks: 18, created_at: '2025-03-10T14:35:00Z' },
  { doc_name: 'Ollies - Amendment, 2010.docx',      doc_type: 'amendment',  chunks: 14, created_at: '2025-03-10T14:48:00Z' },
  { doc_name: 'TMT SM Work Order Quote418.pdf',     doc_type: 'work_order', chunks: 22, created_at: '2025-03-11T09:15:00Z' },
  { doc_name: '1-Woodcrest Short Term LEASE.docx',  doc_type: 'lease',      chunks: 31, created_at: '2025-03-11T09:30:00Z' },
]

export default function IngestPage() {
  const [file, setFile] = useState<File | null>(null)
  const [propertyName, setPropertyName] = useState('')
  const [docType, setDocType] = useState('auto-detect')
  const [isIngesting, setIsIngesting] = useState(false)
  const [currentStep, setCurrentStep] = useState<IngestStep | null>(null)
  const [lastIngestResult, setLastIngestResult] = useState<{ docName: string; chunks: number } | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const demo = isDemoMode()

  const { data: documentsData, isLoading: isLoadingDocs } = useSWR(
    demo ? null : 'documents',
    getDocuments,
    { refreshInterval: 10000 }
  )

  const documents = demo ? DEMO_DOCUMENTS : (documentsData?.documents || [])
  const filteredDocuments = documents.filter((doc) =>
    doc.doc_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Check if on mobile
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!demo) setIsDragOver(true)
  }, [demo])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (demo) return
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) setFile(droppedFile)
  }, [demo])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (demo) return
    const selectedFile = e.target.files?.[0]
    if (selectedFile) setFile(selectedFile)
  }

  const handleIngest = async () => {
    if (!file) {
      toast.error('Please select a file first')
      return
    }
    if (!propertyName.trim()) {
      toast.error('Please enter a property name')
      return
    }

    setIsIngesting(true)
    setLastIngestResult(null)

    const steps: IngestStep[] = ['reading', 'chunking', 'embedding']
    for (const step of steps) {
      setCurrentStep(step)
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    try {
      const result = await ingestDocument(file, propertyName, docType)
      setLastIngestResult({ docName: result.doc_name, chunks: result.chunks_stored })
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 1000)
      toast.success(`Successfully uploaded ${result.doc_name}`)
      setFile(null)
      setPropertyName('')
      setDocType('auto-detect')
      if (fileInputRef.current) fileInputRef.current.value = ''
      mutate('documents')
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Failed to upload document. Please check if the API is running.')
    } finally {
      setIsIngesting(false)
      setCurrentStep(null)
    }
  }

  const handleDelete = async (docName: string) => {
    if (demo) {
      toast.error('Deletion is disabled in demo mode')
      return
    }
    setDeletingDoc(docName)
    try {
      await deleteDocument(docName)
      toast.success(`Deleted ${docName}`)
      mutate('documents')
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Failed to delete document')
    } finally {
      setDeletingDoc(null)
    }
  }

  return (
    <motion.div 
      className="min-h-screen p-6 lg:p-8 pb-32 lg:pb-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="max-w-6xl mx-auto space-y-10">

        {/* Header */}
        <motion.header 
          className="space-y-2"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl lg:text-4xl font-serif text-foreground">Upload Document</h1>
          <p className="text-muted-foreground/70 text-sm tracking-wide">
            Expand your knowledge base by uploading property documents
          </p>
        </motion.header>

        {/* ── DEMO BANNER ── */}
        {demo && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 bg-primary/5 border border-primary/20 rounded-xl px-6 py-4"
          >
            <Lock className="w-5 h-5 text-primary/60 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-primary">
                ✦ Demo Mode — Document upload is disabled
              </p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                5 real Woodcrest Capital documents are pre-loaded below. Sign in with credentials to upload your own documents.
              </p>
            </div>
          </motion.div>
        )}

        {/* Upload Section — hidden in demo */}
        {!demo && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Dropzone */}
            <motion.div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'flex flex-col items-center justify-center gap-6 rounded-xl border-2 border-dashed px-6 py-16 lg:py-20 cursor-pointer transition-all duration-300',
                isDragOver ? 'border-primary bg-primary/10 marching-ants' :
                file ? 'border-success/50 bg-success/5' :
                'border-primary/30 glass-card hover:border-primary/50 hover:bg-primary/5'
              )}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              whileHover={{ scale: 1.01 }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.doc"
                onChange={handleFileSelect}
                className="hidden"
              />
              <AnimatePresence mode="wait">
                {file ? (
                  <motion.div 
                    className="flex flex-col items-center gap-4"
                    key="file-selected"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                  >
                    <motion.div 
                      className="w-20 h-20 rounded-full bg-success/10 border border-success/20 flex items-center justify-center"
                      initial={{ y: -20 }}
                      animate={{ y: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    >
                      <FileText className="w-10 h-10 text-success" />
                    </motion.div>
                    <div className="text-center">
                      <p className="font-semibold text-foreground">{file.name}</p>
                      <p className="text-sm text-muted-foreground/60">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <motion.button
                      onClick={(e) => {
                        e.stopPropagation()
                        setFile(null)
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                      className="flex items-center gap-2 text-sm text-destructive/70 hover:text-destructive transition-colors"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <X className="w-4 h-4" />
                      Remove file
                    </motion.button>
                  </motion.div>
                ) : (
                  <motion.div
                    className="flex flex-col items-center gap-4"
                    key="no-file"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <motion.div
                      animate={isDragOver ? { scale: 1.1, y: -5 } : { scale: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <CloudUpload className="w-16 h-16 text-primary/60" />
                    </motion.div>
                    <div className="text-center">
                      <p className="text-xl font-serif text-foreground/80">Drop files here</p>
                      <p className="text-sm text-muted-foreground/50 mt-1">
                        Supports PDF, DOCX, and TXT (Max 50MB)
                      </p>
                    </div>
                    <motion.button 
                      className="bg-primary/10 hover:bg-primary/20 text-primary font-semibold px-8 py-3 rounded-lg transition-colors text-sm uppercase tracking-[0.1em] border border-primary/20"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Browse Files
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Metadata Form */}
            <motion.div 
              className="glass-card rounded-xl p-6 space-y-6"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 flex items-center gap-1">
                    Property Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={propertyName}
                    onChange={(e) => setPropertyName(e.target.value)}
                    placeholder="e.g. Westfield Shopping Center"
                    className="w-full glass-card rounded-lg h-14 px-4 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all placeholder:text-muted-foreground/30 caret-primary"
                    disabled={isIngesting}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
                    Document Type
                  </label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className="w-full glass-card rounded-lg h-14 px-4 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all appearance-none cursor-pointer"
                    disabled={isIngesting}
                  >
                    {docTypes.map((type) => (
                      <option key={type.value} value={type.value} className="bg-card">
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <AnimatePresence>
                {currentStep && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <PipelineVisualization currentStep={currentStep} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Upload Button - always enabled */}
              <motion.button
                onClick={handleIngest}
                disabled={isIngesting}
                className="w-full bg-gradient-to-r from-primary to-primary-electric hover:from-primary-electric hover:to-primary text-primary-foreground font-bold py-4 rounded-lg shadow-lg shadow-primary/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-sm uppercase tracking-[0.1em] button-press button-shimmer relative overflow-hidden"
                whileHover={!isIngesting ? { scale: 1.02 } : {}}
                whileTap={!isIngesting ? { scale: 0.98 } : {}}
              >
                {showConfetti && <ConfettiBurst />}
                {isIngesting ? (
                  <>
                    <Spinner className="w-5 h-5" />
                    <span>Processing</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    <span>Upload Document</span>
                  </>
                )}
              </motion.button>
            </motion.div>
          </div>
        )}

        {/* Success Card */}
        <AnimatePresence>
          {lastIngestResult && (
            <motion.div 
              className="flex items-center gap-4 glass-card p-5 rounded-xl border border-success/30 relative overflow-hidden"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <motion.div 
                className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
              >
                <Check className="w-6 h-6 text-success" />
              </motion.div>
              <div>
                <p className="font-bold text-success">Upload Complete</p>
                <p className="text-sm text-success/70">
                  &quot;{lastIngestResult.docName}&quot; has been processed into {lastIngestResult.chunks} chunks.
                </p>
              </div>
              <Sparkles className="absolute right-4 top-4 w-5 h-5 text-success/30" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Knowledge Base Table */}
        <motion.section 
          className="space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground">
                Knowledge Base
              </h2>
              {demo && (
                <span className="text-[9px] font-bold uppercase tracking-widest text-primary/50 border border-primary/20 px-2 py-0.5 rounded">
                  Demo Data
                </span>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents..."
                className="pl-10 pr-4 py-2.5 glass-card rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 w-64"
              />
            </div>
          </div>

          <div className="glass-card rounded-xl overflow-hidden">
            {isLoadingDocs && !demo ? (
              <div className="flex items-center justify-center py-16">
                <Spinner className="w-6 h-6 text-primary" />
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <AlertCircle className="w-12 h-12 text-muted-foreground/20 mb-4" />
                <p className="text-muted-foreground/60 text-sm">
                  {searchQuery ? 'No documents match your search' : 'No documents uploaded yet'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-primary/5">
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">Document Name</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">Type</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">Chunks</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">Uploaded</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {filteredDocuments.map((doc: Document, index: number) => (
                      <motion.tr 
                        key={doc.doc_name} 
                        className="hover:bg-primary/5 transition-colors group"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <FileText className="w-4 h-4 text-primary/50" />
                            <span className="font-medium text-foreground/90">{doc.doc_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            'text-[10px] font-bold uppercase px-2.5 py-1 rounded-full',
                            getDocTypeBadgeClass(doc.doc_type)
                          )}>
                            {doc.doc_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground/70 font-mono text-sm">{doc.chunks}</td>
                        <td className="px-6 py-4 text-muted-foreground/70 text-sm">
                          {formatCreatedAtRelative(doc.created_at)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <motion.button
                            onClick={() => handleDelete(doc.doc_name)}
                            disabled={deletingDoc === doc.doc_name || demo}
                            className={cn(
                              'text-muted-foreground/50 hover:text-destructive transition-all disabled:opacity-30 disabled:cursor-not-allowed',
                              !demo && 'opacity-0 group-hover:opacity-100'
                            )}
                            title={demo ? 'Deletion disabled in demo mode' : 'Delete document'}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            {deletingDoc === doc.doc_name ? (
                              <Spinner className="w-4 h-4" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </motion.button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.section>
      </div>

      {/* Mobile Sticky Bar — real users only */}
      <AnimatePresence>
        {!demo && file && isMobile && (
          <motion.div 
            className="fixed bottom-0 left-0 right-0 p-4 glass-card border-t border-border/50 lg:hidden z-50"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground/60">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <motion.button
                onClick={handleIngest}
                disabled={isIngesting}
                className="bg-gradient-to-r from-primary to-primary-electric text-primary-foreground font-bold px-6 py-3 rounded-lg shadow-lg shadow-primary/20 transition-all disabled:opacity-70 flex items-center gap-2 text-sm uppercase tracking-[0.1em]"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isIngesting ? <Spinner className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                <span>Upload</span>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}