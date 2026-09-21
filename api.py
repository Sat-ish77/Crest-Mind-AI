"""
CrestMind AI — FastAPI Backend
Group 13 | UNT Capstone Spring 2026 | Built for Woodcrest Capital

Exposes 5 endpoints that wrap the RAG pipeline.
Smarika's React frontend calls these endpoints directly.

ON-PREMISE SWAP:
  Deploy this file on GCP via Docker (Yubraj).
  All environment variables stay the same as .env
"""

import os
import tempfile
import logging
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Literal, Optional
from dotenv import load_dotenv

from db.client import get_supabase
from ingest.loader import load_document
from ingest.chunker import chunk_document
from ingest.embedder import embed_and_store
from rag.retriever import retrieve
from rag.generator import generate_answer
from rag.agent import run_agent

load_dotenv()

logger = logging.getLogger("crestmind.api")

_cors_setting = os.getenv("CORS_ORIGINS", "*")
ALLOWED_ORIGINS = [origin.strip() for origin in _cors_setting.split(",") if origin.strip()]

# ─────────────────────────────────────────────────────────────────────────────
# APP INIT
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="CrestMind AI API",
    description="Property Document Intelligence for Woodcrest Capital",
    version="1.0.0",
)

# Local/demo deployments default to any origin. Production should set
# CORS_ORIGINS to the exact Woodcrest frontend domain(s), comma-separated.
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=ALLOWED_ORIGINS != ["*"],
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
    steps: list = []   # agent reasoning trace shown in UI

class DocumentInfo(BaseModel):
    doc_name: str
    doc_type: str
    chunks: int
    created_at: str  # ISO 8601 timestamptz from DB (time + offset)

class FeedbackSource(BaseModel):
    """Snapshot of one citation as it appeared with the judged answer."""

    doc_name: str = Field(..., min_length=1, max_length=500)
    section: Optional[str] = Field(default=None, max_length=500)
    page_number: Optional[int] = Field(default=None, ge=0)
    confidence: Optional[Literal["high", "medium", "low"]] = None
    chunk_text: Optional[str] = Field(default=None, max_length=50_000)


class FeedbackRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=10_000)
    answer: str = Field(..., min_length=1, max_length=200_000)
    action: Literal["verified", "flagged"]
    overall_confidence: Optional[Literal["high", "medium", "low", "none"]] = None
    sources: list[FeedbackSource] = Field(default_factory=list)
    username: Optional[str] = Field(default=None, max_length=200)
    note: Optional[str] = Field(default=None, max_length=5_000)


class FeedbackResponse(BaseModel):
    success: bool
    id: Optional[str] = None


class FeedbackLog(BaseModel):
    id: str
    created_at: str
    username: Optional[str] = None
    query: str
    answer: str
    overall_confidence: Optional[str] = None
    sources: list[FeedbackSource] = Field(default_factory=list)
    action: Literal["verified", "flagged"]
    note: Optional[str] = None


class FeedbackListResponse(BaseModel):
    logs: list[FeedbackLog] = Field(default_factory=list)


def _created_at_iso(value) -> str:
    """Normalize Supabase created_at to an ISO 8601 string for JSON."""
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _model_to_dict(model: BaseModel) -> dict:
    """Support both Pydantic v1 and v2 while deployments are being aligned."""
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


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

    Uses the agentic RAG pipeline (LangGraph) which:
    - Identifies which property the user is asking about
    - Checks property status (active / sold / historical)
    - Routes to the correct document category
    - Re-searches if first retrieval is insufficient
    - Handles cross-property queries

    Request body:
        query           — natural language question
        filter_doc_type — optional: "lease", "invoice", "amendment" etc
        filter_doc_name — optional: exact filename to search within
        top_k           — optional: number of chunks to retrieve (default 5)

    Returns:
        answer              — Llama-generated answer with citations
        found_in_documents  — True if answer found, False if out of scope
        overall_confidence  — "high", "medium", "low", or "none"
        sources             — list of source chunks used
        steps               — agent reasoning trace for UI
    """
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    try:
        result = run_agent(
            query=request.query,
            filter_doc_type=request.filter_doc_type,
            filter_doc_name=request.filter_doc_name,
            top_k=request.top_k or 5,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ingest")
def ingest(
    file: UploadFile = File(...),
    property_name: str = Form(default=""),
    doc_type: str = Form(default="Auto-detect"),
):
    """
    Upload and ingest a PDF, DOCX, or legacy DOC document.

    Form fields:
        file          — PDF, DOCX, or DOC file
        property_name — optional property name override
        doc_type      — optional type override (lease, invoice etc)

    Returns:
        doc_name      — filename that was ingested
        chunks_stored — number of chunks stored in Supabase
        doc_type      — detected or overridden document type
    """
    # Validate file type — now includes .doc
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".pdf", ".docx", ".doc"]:
        raise HTTPException(
            status_code=400,
            detail="Only PDF, DOCX, and DOC files are supported"
        )

    # Save to temp file preserving original extension
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(file.file.read())
            tmp_path = tmp.name
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")

    try:
        # Load — loader.py handles .doc → .docx conversion automatically
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


# ─────────────────────────────────────────────────────────────────────────────
# HUMAN-IN-THE-LOOP FEEDBACK (CR-CAP2-001)
# ─────────────────────────────────────────────────────────────────────────────

@app.post(
    "/feedback",
    response_model=FeedbackResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_feedback(request: FeedbackRequest):
    """
    Record a human judgement on an AI answer.

    Writes one row to audit_logs. Nothing here retrains anything —
    this is an audit trail so a person's verification (or rejection)
    of an answer is recoverable after the fact.

    Body:
        query              — the question that was asked
        answer             — the answer that was shown
        action             — "verified" or "flagged"
        overall_confidence — the confidence label shown at the time
        sources            — source list as displayed (snapshotted)
        username           — self-reported, NOT authenticated
        note               — optional free text, used when flagging

    Returns:
        success — True if the row was written
        id      — UUID of the new audit_logs row
    """
    query = request.query.strip()
    answer = request.answer.strip()
    username = request.username.strip() if request.username else None
    note = request.note.strip() if request.note else None

    if not query or not answer:
        raise HTTPException(
            status_code=400,
            detail="query and answer are both required",
        )
    if len(request.sources) > 25:
        raise HTTPException(
            status_code=400,
            detail="A feedback record can contain at most 25 sources",
        )

    try:
        sb = get_supabase()
        result = sb.table("audit_logs").insert({
            "query":              query,
            "answer":             answer,
            "action":             request.action,
            "overall_confidence": request.overall_confidence,
            "sources":            [_model_to_dict(source) for source in request.sources],
            "username":           username,
            "note":               note,
        }).execute()

        row_id = result.data[0]["id"] if result.data else None
        return {"success": True, "id": row_id}

    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to store answer feedback")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Feedback storage is temporarily unavailable",
        )


@app.get("/feedback", response_model=FeedbackListResponse)
def list_feedback(
    action: Optional[Literal["verified", "flagged"]] = None,
    limit: int = Query(default=100, ge=1, le=500),
):
    """
    Read the audit trail, newest first (Review page).

    Query params:
        action — optional: "verified" or "flagged" to filter
        limit  — max rows to return (default 100)

    Returns:
        logs — list of audit_logs rows
    """
    try:
        sb = get_supabase()
        q = (
            sb.table("audit_logs")
            .select("*")
            .order("created_at", desc=True)
            .limit(limit)
        )
        if action:
            q = q.eq("action", action)

        rows = q.execute()
        logs = rows.data or []
        for log in logs:
            log["created_at"] = _created_at_iso(log.get("created_at"))
        return {"logs": logs}

    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to read answer feedback")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Feedback history is temporarily unavailable",
        )
