# 🏢 CrestMind AI — Property Intelligence Platform
> UNT Capstone | Group 13 | Built for Woodcrest Capital | Spring 2026

CrestMind AI is a RAG (Retrieval-Augmented Generation) system that lets 
Woodcrest Capital employees ask plain English questions about thousands of 
property documents and get cited, accurate answers instantly.

---

## Open the current application

Use [CrestMind AI on Vercel](https://v0-crestmind-frontend.vercel.app/).
This is the property-manager frontend; it connects to FastAPI on GCP Cloud Run.
No local installation is required to use the hosted system.

If you already cloned this repository, run `python app.py` to open that same
website in your browser. On a machine without a browser, the launcher prints
the URL for you to copy. The old Streamlit interface has been removed from
`main`; `streamlit run app.py` is no longer a supported startup command.

### Develop the current frontend locally

From the repository root:

```powershell
cd crestmind-frontend
npm install
npm run dev
```

Copy `crestmind-frontend/.env.example` to `crestmind-frontend/.env.local`
and fill in the sign-in password and secrets (see
[Authentication](#-authentication)). Open http://localhost:3000. Unless
`NEXT_PUBLIC_API_URL` is overridden, this frontend connects to the existing
GCP backend. Vercel and Cloud Run are
hosting services; cloning the repository does not start either service locally.

### Develop the backend locally (optional)

From the repository root, install `requirements.txt` in your Python environment
and configure the backend `.env` using `.env.example`. The backend needs
Supabase credentials, an OpenAI embedding key, and Google Application Default
Credentials authorized for the Vertex AI model used by this project.

```powershell
python -m pip install -r requirements.txt
python -m uvicorn api:app --reload --host 127.0.0.1 --port 8000
```

To use that local backend, set `NEXT_PUBLIC_API_URL=http://localhost:8000`
in `crestmind-frontend/.env.local` and restart the Next.js development server.
Allow `http://localhost:3000` in the backend's `CORS_ORIGINS` setting.
Keep all secret API keys on the backend; only the API URL belongs in the
frontend's public (`NEXT_PUBLIC_`) settings.

### Database setup

Run these in the Supabase SQL editor, in order, on a new project:

1. `db/schema.sql` — `properties` and `documents` tables
2. `db/match_documents.sql` — hybrid (vector + keyword) search function
3. `db/audit_logs.sql` — feedback audit trail

For an existing database, run `db/migrations/001_property_link.sql`, then
read the header of `db/match_documents.sql` before running it (it replaces
the search function).

See [the User Manual](user-manual.md) for property-manager instructions.

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
| Frontend | Next.js + React |
| Backend | FastAPI |
| Deployment | Frontend: Vercel; backend: Docker container on GCP Cloud Run |

---

## 📁 Project Structure
```
crestmind-ai/
├── api.py                  ← FastAPI backend (RAG, documents, HITL feedback)
├── app.py                  ← opens the current hosted frontend
├── crestmind-frontend/     ← Next.js property-manager application
├── ingest/
│   ├── loader.py           ← PDF/DOCX → raw text
│   ├── chunker.py          ← text → chunks
│   └── embedder.py         ← chunks → vectors → Supabase
├── rag/
│   ├── retriever.py        ← similarity search
│   └── generator.py        ← LLM call + citations
├── db/
│   ├── schema.sql          ← properties + documents tables
│   ├── match_documents.sql ← hybrid search RPC
│   ├── audit_logs.sql      ← HITL feedback/audit migration
│   ├── migrations/         ← changes for existing databases
│   └── client.py           ← Supabase connection
├── ui/
│   └── components.py       ← unused legacy placeholder
├── scripts/
│   ├── e2e_local/          ← end-to-end check on local Postgres, fictional docs
│   └── reclassify_doc_types.py ← fix doc_type on already-ingested rows
├── data/
│   └── samples/            ← local test documents (gitignored, never commit)
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
API_AUTH_TOKEN=        ← required in production; see Authentication
```

---

## 🔒 Authentication

- **Sign-in** is checked on the Next.js server (`app/api/auth/*`) against
  `CRESTMIND_LOGIN_PASSWORD`. The session is an httpOnly cookie signed with
  `CRESTMIND_SESSION_SECRET`.
- **API calls** carry a 15-minute token that the Next.js server signs with
  `CRESTMIND_API_AUTH_TOKEN`. The browser sends it straight to Cloud Run,
  which verifies it with the same value in `API_AUTH_TOKEN`. The secret
  never reaches the browser, and uploads are not limited by Vercel's
  request-size cap.
- Only `GET /` (health check) is public when `API_AUTH_TOKEN` is set. If it
  is unset, the API logs a warning and accepts every request — local
  development only.

Deploy order: set the three `CRESTMIND_*` variables in Vercel and redeploy
the frontend, then set `API_AUTH_TOKEN` on Cloud Run.

## ✅ Tests

```powershell
python -m unittest discover -s tests -t .
```

`scripts/e2e_local/run_e2e.py` runs the whole backend (ingest → agent →
answer → feedback → delete) against a local Postgres + pgvector with
fictional documents and stubbed models; see the file header for setup.

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
| `sample` | Historical prototype / RAG experiments; use `main` for the current app |

---

## ⚠️ Important

- Never commit `.env` — it contains secret keys
- Never commit `data/samples/` — client documents are confidential
- Always work on `sample` or `develop`, never directly on `main`
