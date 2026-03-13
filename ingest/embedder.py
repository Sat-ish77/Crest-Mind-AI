"""
CrestMind AI — Embedding & Storage

Embeds text chunks via OpenAI and stores them in Supabase.

ON-PREMISE SWAP:
  Embeddings:  Replace the _embed_batch() call with a local
               nomic-embed-text model.  Keep output dim = 1536
               or update VECTOR(1536) in schema.sql to match.
  Storage:     Replace Supabase inserts with direct psycopg2
               inserts — same column names, same table.
"""

import os
import time
from openai import OpenAI
from dotenv import load_dotenv
from db.client import get_supabase

load_dotenv()

# ── Configuration ────────────────────────────────────────────
EMBEDDING_MODEL = "text-embedding-3-small"  # 1536 dimensions
BATCH_SIZE = 20  # chunks per OpenAI API call

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


def _embed_batch(texts: list[str]) -> list[list[float]]:
    """Call OpenAI embeddings API for a batch of texts.

    Returns a list of 1536-dim float vectors, one per input text.
    """
    client = _get_openai()
    response = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=texts,
    )
    return [item.embedding for item in response.data]


def _chunk_exists(supabase, doc_name: str, chunk_index: int) -> bool:
    """Check if a chunk with this doc_name + chunk_index already exists."""
    result = (
        supabase.table("documents")
        .select("id")
        .eq("doc_name", doc_name)
        .eq("metadata->>chunk_index", str(chunk_index))
        .limit(1)
        .execute()
    )
    return len(result.data) > 0


def embed_and_store(chunks: list[dict]) -> int:
    """Embed chunks and store them in the Supabase documents table.

    Parameters
    ----------
    chunks : list[dict]
        Output of ingest.chunker.chunk_document().

    Returns
    -------
    int — number of chunks successfully stored.

    Skips duplicates (same doc_name + chunk_index).
    Prints progress to stdout for monitoring.
    """
    if not chunks:
        print("No chunks to embed.")
        return 0

    supabase = get_supabase()
    total = len(chunks)
    stored = 0

    for batch_start in range(0, total, BATCH_SIZE):
        batch = chunks[batch_start : batch_start + BATCH_SIZE]
        texts = [c["content"] for c in batch]

        try:
            embeddings = _embed_batch(texts)
        except Exception as exc:
            print(f"  ✗ OpenAI API error on batch starting at {batch_start}: {exc}")
            time.sleep(2)
            continue

        for i, (chunk, embedding) in enumerate(zip(batch, embeddings)):
            idx = batch_start + i
            chunk_index = chunk["metadata"]["chunk_index"]

            if _chunk_exists(supabase, chunk["doc_name"], chunk_index):
                print(f"  ⏭ Chunk {idx + 1}/{total} already exists — skipped")
                continue

            row = {
                "content": chunk["content"],
                "embedding": embedding,
                "doc_name": chunk["doc_name"],
                "doc_type": chunk["doc_type"],
                "section": chunk.get("section"),
                "page_number": chunk.get("page_number"),
                "property_name": chunk.get("property_name"),
                "metadata": chunk.get("metadata", {}),
            }

            try:
                supabase.table("documents").insert(row).execute()
                stored += 1
                print(f"  ✓ Stored chunk {idx + 1}/{total}")
            except Exception as exc:
                print(f"  ✗ Failed to store chunk {idx + 1}/{total}: {exc}")

    print(f"\nDone — {stored}/{total} chunks stored.")
    return stored
