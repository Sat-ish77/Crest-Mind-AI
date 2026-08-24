import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://crestmind-api-88776185583.us-central1.run.app'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Types
export interface Source {
  doc_name: string
  section: string
  page_number: number
  confidence: 'high' | 'medium' | 'low'
  chunk_text: string
}

export interface AskResponse {
  answer: string
  found_in_documents: boolean
  overall_confidence: 'high' | 'medium' | 'low'
  sources: Source[]
  steps: string[]   // agent reasoning trace
}

export interface AskRequest {
  query: string
  filter_doc_type?: string | null
  filter_doc_name?: string | null
  top_k?: number
}

export interface IngestResponse {
  doc_name: string
  chunks_stored: number
  doc_type: string
}

export interface Document {
  doc_name: string
  doc_type: string
  chunks: number
  created_at: string
}

export interface DocumentsResponse {
  documents: Document[]
}

export interface DeleteResponse {
  success: boolean
  doc_name: string
}

// ─────────────────────────────────────────
// DEMO MODE HELPERS
// ─────────────────────────────────────────

export const isDemoMode = (): boolean => {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('demo_mode') === 'true'
}

export const enterDemoMode = () => {
  localStorage.setItem('demo_mode', 'true')
  localStorage.setItem('auth', 'true')
  localStorage.setItem('demo_user', 'Demo User')
}

export const exitDemoMode = () => {
  localStorage.removeItem('demo_mode')
  localStorage.removeItem('auth')
  localStorage.removeItem('demo_user')
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ─────────────────────────────────────────
// DEMO DATA
// ─────────────────────────────────────────

const DEMO_DOCUMENTS: Document[] = [
  { doc_name: 'Ollies - Lease, 2010.docx',           doc_type: 'lease',      chunks: 28, created_at: '2025-03-10T14:22:00Z' },
  { doc_name: 'Ollies - Amend 1, 2015.docx',         doc_type: 'amendment',  chunks: 18, created_at: '2025-03-10T14:35:00Z' },
  { doc_name: 'Ollies - Amendment, 2010.docx',        doc_type: 'amendment',  chunks: 14, created_at: '2025-03-10T14:48:00Z' },
  { doc_name: 'TMT SM Work Order Quote418.pdf',       doc_type: 'work_order', chunks: 22, created_at: '2025-03-11T09:15:00Z' },
  { doc_name: '1-Woodcrest Short Term LEASE.docx',    doc_type: 'lease',      chunks: 31, created_at: '2025-03-11T09:30:00Z' },
]

const DEMO_RESPONSES: { keywords: string[]; response: AskResponse }[] = [
  {
    keywords: ['renewal', 'renew', 'option'],
    response: {
      answer:
        'The tenant has 2 renewal options of 5 years each, exercisable with 12 months written notice prior to lease expiration. Both options are subject to the same terms and conditions as the original lease agreement.',
      found_in_documents: true,
      overall_confidence: 'high',
      sources: [
        {
          doc_name: 'Ollies - Lease, 2010.docx',
          section: 'Section 3.2 — Renewal Options',
          page_number: 4,
          confidence: 'high',
          chunk_text:
            'Tenant shall have two (2) options to renew this Lease for additional periods of five (5) years each, upon written notice no later than twelve (12) months prior to expiration of the then-current term.',
        },
      ],
      steps: [],
    },
  },
  {
    keywords: ['hvac', 'ductwork', 'invoice', 'insulation', 'work order'],
    response: {
      answer:
        'The HVAC ductwork invoice totaled $3,850.93 as submitted by TMT in the work order quote. This covered full ductwork replacement and insulation removal for the Ollie\'s Bargain Outlet location.',
      found_in_documents: true,
      overall_confidence: 'high',
      sources: [
        {
          doc_name: 'TMT SM Work Order Quote418.pdf',
          section: 'Quote Summary — Line Items',
          page_number: 1,
          confidence: 'high',
          chunk_text:
            'Total invoice amount: $3,850.93. Scope of work includes complete ductwork replacement, insulation removal, and system testing per Woodcrest Capital maintenance standards.',
        },
      ],
      steps: [],
    },
  },
  {
    keywords: ['rent', 'base rent', 'monthly', 'payment'],
    response: {
      answer:
        'The base rent under the short term lease agreement is $42,000 annually, payable in equal monthly installments of $3,500. The lease includes a 3% annual escalation clause beginning in year 2.',
      found_in_documents: true,
      overall_confidence: 'medium',
      sources: [
        {
          doc_name: '1-Woodcrest Short Term LEASE.docx',
          section: 'Article 4 — Rent',
          page_number: 3,
          confidence: 'medium',
          chunk_text:
            'Base Rent shall be Forty-Two Thousand Dollars ($42,000) per annum, payable in equal monthly installments of Three Thousand Five Hundred Dollars ($3,500) on the first day of each month.',
        },
      ],
      steps: [],
    },
  },
  {
    keywords: ['amendment', '2015', 'modify', 'modification'],
    response: {
      answer:
        'The 2015 amendment takes effect January 1, 2015, modifying the original 2010 lease terms for the Ollie\'s Bargain Outlet tenancy. Key changes include updated CAM charges and revised maintenance responsibilities for the landlord.',
      found_in_documents: true,
      overall_confidence: 'high',
      sources: [
        {
          doc_name: 'Ollies - Amend 1, 2015.docx',
          section: 'Section 1 — Effective Date & Modifications',
          page_number: 1,
          confidence: 'high',
          chunk_text:
            'This First Amendment to Lease Agreement is effective as of January 1, 2015, and modifies the original Lease dated 2010 between Woodcrest Capital LLC (Landlord) and Ollie\'s Bargain Outlet (Tenant).',
        },
      ],
      steps: [],
    },
  },
]

const DEFAULT_DEMO_RESPONSE: AskResponse = {
  answer:
    'Based on the available Woodcrest Capital property documents, I found relevant information related to your query. The portfolio includes lease agreements, amendments, and work orders for the Ollie\'s Bargain Outlet tenancy. For full document access, please contact Woodcrest Capital directly.',
  found_in_documents: true,
  overall_confidence: 'medium',
  sources: [
    {
      doc_name: 'Ollies - Lease, 2010.docx',
      section: 'General Terms',
      page_number: 1,
      confidence: 'medium',
      chunk_text:
        'This Lease Agreement is entered into between Woodcrest Capital LLC as Landlord and Ollie\'s Bargain Outlet Inc. as Tenant for the premises located within the Woodcrest shopping center portfolio.',
    },
  ],
  steps: [],
}

const getDemoResponse = (query: string): AskResponse => {
  const q = query.toLowerCase()
  for (const item of DEMO_RESPONSES) {
    if (item.keywords.some((kw) => q.includes(kw))) {
      return item.response
    }
  }
  return DEFAULT_DEMO_RESPONSE
}

// ─────────────────────────────────────────
// API FUNCTIONS
// ─────────────────────────────────────────

export async function askQuestion(request: AskRequest): Promise<AskResponse> {
  if (isDemoMode()) {
    await sleep(2000)
    return getDemoResponse(request.query)
  }
  const response = await api.post<AskResponse>('/ask', request)
  return response.data
}

export async function ingestDocument(
  file: File,
  propertyName: string,
  docType: string
): Promise<IngestResponse> {
  if (isDemoMode()) {
    await sleep(3000)
    return { doc_name: file.name, chunks_stored: 24, doc_type: docType }
  }
  const formData = new FormData()
  formData.append('file', file)
  formData.append('property_name', propertyName)
  formData.append('doc_type', docType)
  const response = await api.post<IngestResponse>('/ingest', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

export async function getDocuments(): Promise<DocumentsResponse> {
  if (isDemoMode()) {
    await sleep(500)
    return { documents: DEMO_DOCUMENTS }
  }
  const response = await api.get<DocumentsResponse>('/documents')
  return response.data
}

export async function deleteDocument(docName: string): Promise<DeleteResponse> {
  if (isDemoMode()) {
    await sleep(500)
    return { success: true, doc_name: docName }
  }
  const response = await api.delete<DeleteResponse>(`/documents/${encodeURIComponent(docName)}`)
  return response.data
}