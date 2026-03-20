"""
CrestMind AI — FastAPI Backend
Group 13 | UNT Capstone Spring 2026 | Built for Woodcrest Capital

Exposes 4 endpoints that wrap the existing RAG pipeline.
Smarika's React frontend calls these endpoints directly.

ON-PREMISE SWAP:
  Deploy this file on GCP via Docker (Yubraj).
  All environment variables stay the same as .env
"""

import os
import tempfile
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

from db.client import get_supabase
from ingest.loader import load_document
from ingest.chunker import chunk_document
from ingest.embedder import embed_and_store
from rag.retriever import retrieve
from rag.generator import generate_answer

load_dotenv()

# ─────────────────────────────────────────────────────────────────────────────
# APP INIT
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="CrestMind AI API",
    description="Property Document Intelligence for Woodcrest Capital",
    version="1.0.0",
)

# Allow React frontend to call this API from any origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────────────────────
# REQUEST / RESPONSE MODELS
# ─────────────────────────────────────────────────────────────────────────────

class AskRequest(BaseModel):
    query: str
    filter_doc_type: Optional[str] = None
    filter_doc_name: Optional[str] = None
    top_k: Optional[int] = 5

class AskResponse(BaseModel):
    answer: str
    found_in_documents: bool
    overall_confidence: str
    sources: list

class DocumentInfo(BaseModel):
    doc_name: str
    doc_type: str
    chunks: int
    created_at: str

# ─────────────────────────────────────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    """Health check."""
    return {"status": "CrestMind AI is running"}


@app.post("/ask", response_model=AskResponse)
def ask(request: AskRequest):
    """
    Ask a question about ingested property documents.

    Request body:
        query           — natural language question
        filter_doc_type — optional: "lease", "invoice", "amendment" etc
        filter_doc_name — optional: exact filename to search within
        top_k           — optional: number of chunks to retrieve (default 5)

    Returns:
        answer              — GPT-generated answer with citations
        found_in_documents  — True if answer found, False if out of scope
        overall_confidence  — "high", "medium", "low", or "none"
        sources             — list of source chunks used
    """
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    retrieval = retrieve(
        query=request.query,
        top_k=request.top_k or 5,
        filter_doc_type=request.filter_doc_type,
        filter_doc_name=request.filter_doc_name,
    )

    result = generate_answer(request.query, retrieval)
    return result


@app.post("/ingest")
def ingest(
    file: UploadFile = File(...),
    property_name: str = Form(default=""),
    doc_type: str = Form(default="Auto-detect"),
):
    """
    Upload and ingest a PDF or DOCX document.

    Form fields:
        file          — PDF or DOCX file
        property_name — optional property name override
        doc_type      — optional type override (lease, invoice etc)

    Returns:
        doc_name      — filename that was ingested
        chunks_stored — number of chunks stored in Supabase
        doc_type      — detected or overridden document type
    """
    # Validate file type
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".pdf", ".docx"]:
        raise HTTPException(
            status_code=400,
            detail="Only PDF and DOCX files are supported"
        )

    # Save to temp file
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(file.file.read())
            tmp_path = tmp.name
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")

    try:
        # Load
        doc = load_document(tmp_path)
        doc["doc_name"] = file.filename

        # Override doc type if specified
        if doc_type and doc_type.lower() != "auto-detect":
            doc["doc_type"] = doc_type.lower().replace(" ", "_")

        # Chunk
        chunks = chunk_document(doc)

        # Override property name if specified
        if property_name.strip():
            for chunk in chunks:
                chunk["property_name"] = property_name.strip()

        # Embed and store
        stored = embed_and_store(chunks)

        return {
            "doc_name": file.filename,
            "chunks_stored": stored,
            "doc_type": doc["doc_type"],
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        os.unlink(tmp_path)


@app.get("/documents")
def list_documents():
    """
    List all ingested documents with chunk counts.

    Returns:
        documents — list of {doc_name, doc_type, chunks, created_at}
    """
    try:
        sb = get_supabase()
        rows = (
            sb.table("documents")
            .select("doc_name, doc_type, created_at")
            .order("created_at", desc=True)
            .execute()
        )

        doc_map = {}
        for r in rows.data or []:
            name = r.get("doc_name", "unknown")
            if name not in doc_map:
                doc_map[name] = {
                    "doc_name": name,
                    "doc_type": (r.get("doc_type") or "unknown").lower(),
                    "created_at": (r.get("created_at") or "")[:10],
                    "chunks": 0,
                }
            doc_map[name]["chunks"] += 1

        return {"documents": list(doc_map.values())}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/documents/{doc_name}")
def delete_document(doc_name: str):
    """
    Delete all chunks for a specific document.

    Path param:
        doc_name — exact filename to delete

    Returns:
        success — True if deleted
        doc_name — filename that was deleted
    """
    try:
        sb = get_supabase()
        sb.table("documents").delete().eq("doc_name", doc_name).execute()
        return {"success": True, "doc_name": doc_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/documents/{doc_name}/chunks")
def get_chunks(doc_name: str, section: Optional[str] = None):
    """
    Get all chunks for a specific document (Document Explorer).

    Path param:
        doc_name — exact filename
    Query param:
        section  — optional section filter keyword

    Returns:
        chunks — list of chunk dicts
    """
    try:
        sb = get_supabase()
        q = (
            sb.table("documents")
            .select("content, section, page_number, doc_type, metadata")
            .eq("doc_name", doc_name)
            .order("page_number")
        )
        rows = q.execute()
        chunks = rows.data or []

        if section:
            kw = section.lower()
            chunks = [
                c for c in chunks
                if kw in (c.get("section") or "").lower()
            ]

        return {"doc_name": doc_name, "chunks": chunks}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 