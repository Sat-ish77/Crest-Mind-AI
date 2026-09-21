# 🏢 CrestMind AI — Property Intelligence Platform
> UNT Capstone | Group 13 | Built for Woodcrest Capital | Spring 2026

CrestMind AI is a RAG (Retrieval-Augmented Generation) system that lets 
Woodcrest Capital employees ask plain English questions about thousands of 
property documents and get cited, accurate answers instantly.

---

## 💡 The Problem It Solves

Property managers currently dig through hundreds of leases, HVAC reports, 
and invoices manually. CrestMind lets them just ask:

- *"What are the HVAC responsibilities for Ollie's property?"*
- *"When does the exclusive use clause expire on this lease?"*
- *"What was the total ductwork repair cost?"*

And get an instant answer with the exact source document cited.

---

## 🏗️ How It Works
```
PDF/DOCX Documents
      ↓
OCR + Text Extraction
      ↓
Split into 500-char chunks
      ↓
Convert to vectors (embeddings)
      ↓
Store in Supabase (PostgreSQL + pgvector)
      ↓
[User asks a question]
      ↓
Find similar chunks (similarity search)
      ↓
Send to Llama 3.3 70B (Groq → GCP Vertex AI)
      ↓
Answer + Source Citation
```

---

## 👥 Team — Group 13

| Name | Role |
|---|---|
| Satish Wagle | AI Lead — RAG Pipeline, Embeddings, LLM |
| Sushil Dahal | Team Lead — Backend & Database |
| Smarika Koirala | Frontend Lead — React UI |
| Saurav Pandey | OCR & Document Ingestion |
| Yubraj Chaulagain | DevOps — GCP & Deployment |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| LLM | Llama 3.3 70B (Groq for dev, GCP Vertex AI for prod) |
| Embeddings | OpenAI text-embedding-3-small |
| Vector Database | Supabase + pgvector |
| Prototype UI | Streamlit |
| Production UI | React |
| Deployment | Docker → GCP / On-Premise |

---

## 📁 Project Structure
```
crestmind-ai/
├── api.py                  ← FastAPI backend (RAG, documents, HITL feedback)
├── app.py                  ← Streamlit prototype
├── crestmind-frontend/     ← Next.js property-manager application
├── ingest/
│   ├── loader.py           ← PDF/DOCX → raw text
│   ├── chunker.py          ← text → chunks
│   └── embedder.py         ← chunks → vectors → Supabase
├── rag/
│   ├── retriever.py        ← similarity search
│   └── generator.py        ← LLM call + citations
├── db/
│   ├── schema.sql          ← Supabase table setup
│   ├── audit_logs.sql      ← HITL feedback/audit migration
│   └── client.py           ← Supabase connection
├── ui/
│   └── components.py       ← UI components
├── data/
│   └── samples/            ← test documents (gitignored)
├── .env.example            ← environment variables template
└── requirements.txt
```

---

## 🔐 Environment Variables
```
OPENAI_API_KEY=        ← for embeddings
GROQ_API_KEY=          ← for LLM calls (dev)
SUPABASE_URL=          ← your Supabase project URL
SUPABASE_KEY=          ← backend-only Supabase service-role key
CORS_ORIGINS=          ← exact frontend URL(s), comma-separated in production
GCP_PROJECT_ID=        ← for Vertex AI (prod)
```

---

## Human-in-the-Loop feedback

Property managers can verify a useful answer or flag an incorrect one. The
backend stores an immutable snapshot of the question, answer, citations,
confidence, reviewer, and optional note.

1. Run `db/audit_logs.sql` in the Supabase SQL editor once.
2. Keep `SUPABASE_KEY` on the backend only; the audit table has RLS enabled.
3. Deploy the current `api.py` image so Cloud Run exposes:
   - `POST /feedback` — store a verified/flagged judgement.
   - `GET /feedback?action=flagged|verified` — read the newest audit records.
4. Run `python -m unittest tests.test_feedback_api` after installing the
   requirements to verify validation, persistence, filtering, and safe errors.

Feedback is an audit and improvement queue. It does not automatically retrain
the model or silently change future answers.

---

## 🌿 Branch Structure

| Branch | Purpose |
|---|---|
| `main` | Final stable code only |
| `develop` | Team integration branch |
| `sample` | Streamlit prototype + RAG testing |

---

## ⚠️ Important

- Never commit `.env` — it contains secret keys
- Never commit `data/samples/` — client documents are confidential
- Always work on `sample` or `develop`, never directly on `main`
