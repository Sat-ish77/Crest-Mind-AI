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
PDF/DOCX/Images
      ↓
OCR + text extraction (local Tesseract for now)
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
| OCR / Text Extraction | Tesseract (pytesseract) on‑prem; Google Vision/Vertex AI later |
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
├── app.py                  ← Streamlit prototype
├── ingest/
│   ├── loader.py           ← PDF/DOCX → raw text
│   ├── chunker.py          ← text → chunks
│   └── embedder.py         ← chunks → vectors → Supabase
├── rag/
│   ├── retriever.py        ← similarity search
│   └── generator.py        ← LLM call + citations
├── db/
│   ├── schema.sql          ← Supabase table setup
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

Additional tools used in the OCR pipeline may require external binaries:

```bash
# install tesseract-ocr on macOS
brew install tesseract
``````
OPENAI_API_KEY=        ← for embeddings
GROQ_API_KEY=          ← for LLM calls (dev)
SUPABASE_URL=          ← your Supabase project URL
SUPABASE_KEY=          ← your Supabase anon key
GCP_PROJECT_ID=        ← for Vertex AI (prod)
```

---

## 📝 OCR Usage

Saurav’s module lives under `ingest/`; to run OCR locally:

```python
from ingest.loader import loader
text = loader("data/samples/your_file.pdf")
print(text[:400])
```

The loader uses Tesseract internally (no external cost) and handles PDF
and common image types.  Later you can swap the implementation for a
cloud service (Google Vision / Vertex AI) without changing callers.

Once you have raw text you can continue with `ingest.chunker.chunk_text`
and `ingest.embedder.embed_chunks` to push data into the vector store.

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