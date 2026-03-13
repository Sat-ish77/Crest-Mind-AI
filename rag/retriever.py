"""
CrestMind AI — Retriever

Embeds the user query, runs similarity search against Supabase,
and applies confidence scoring + out-of-scope detection.

ON-PREMISE SWAP:
  Embeddings:  Change EMBEDDING_MODEL and swap _embed_query()
               to call your local nomic-embed-text endpoint.
  Database:    Replace the Supabase RPC call with a direct
               SQL query against your local pgvector instance.
"""

import os
from openai import OpenAI
from dotenv import load_dotenv
from db.client import get_supabase

load_dotenv()

# ── Configuration ────────────────────────────────────────────
EMBEDDING_MODEL = "text-embedding-3-small"  # must match ingest model
SIMILARITY_THRESHOLD = 0.40  # below this = out of scope

_openai_client: OpenAI | None = None


def _get_openai() -> OpenAI:
    """Return a singleton OpenAI client."""
    global _openai_client
    if _openai_client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "OPENAI_API_KEY is missing. "
                "Add it to your .env file (see .env.example)."
            )
        _openai_client = OpenAI(api_key=api_key)
    return _openai_client


def _embed_query(query: str) -> list[float]:
    """Embed a single query string and return a 1536-dim vector."""
    client = _get_openai()
    response = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=query,
    )
    return response.data[0].embedding


def _confidence_level(similarity: float) -> str:
    """Map a similarity score to a human-readable confidence level."""
    if similarity >= 0.85:
        return "high"
    if similarity >= SIMILARITY_THRESHOLD:
        return "medium"
    return "low"


def retrieve(
    query: str,
    top_k: int = 5,
    filter_doc_type: str | None = None,
    filter_doc_name: str | None = None,
) -> dict:
    """Search documents for chunks relevant to the user's query.

    Parameters
    ----------
    query : str
        Natural-language question from the user.
    top_k : int
        Maximum number of chunks to return.
    filter_doc_type : str | None
        If set, restrict results to this document type
        (e.g. "lease", "invoice").
    filter_doc_name : str | None
        If set, restrict results to this specific document
        by filename (e.g. "Ollies - Lease, 2010.docx").

    Returns
    -------
    dict with keys:
        chunks       – list of chunk dicts (with similarity + confidence)
        out_of_scope – True if no chunk meets SIMILARITY_THRESHOLD
        message      – human-readable status string
    """
    try:
        query_embedding = _embed_query(query)
    except Exception as exc:
        return {
            "chunks": [],
            "out_of_scope": True,
            "message": f"Failed to embed query: {exc}",
        }

    supabase = get_supabase()

    rpc_params = {
        "query_embedding": query_embedding,
        "match_count": top_k,
        "filter_doc_type": filter_doc_type,
        "filter_doc_name": filter_doc_name,
    }

    try:
        result = supabase.rpc("match_documents", rpc_params).execute()
    except Exception as exc:
        return {
            "chunks": [],
            "out_of_scope": True,
            "message": f"Database search failed: {exc}",
        }

    rows = result.data or []

    # Attach confidence level to each chunk
    chunks = []
    for row in rows:
        sim = row.get("similarity", 0)
        row["confidence"] = _confidence_level(sim)
        chunks.append(row)

    # Out-of-scope detection: if every chunk is below threshold
    if not chunks or all(
        c.get("similarity", 0) < SIMILARITY_THRESHOLD for c in chunks
    ):
        return {
            "chunks": [],
            "out_of_scope": True,
            "message": "No relevant information found in the documents.",
        }

    return {
        "chunks": chunks,
        "out_of_scope": False,
        "message": f"Found {len(chunks)} relevant chunk(s).",
    }
