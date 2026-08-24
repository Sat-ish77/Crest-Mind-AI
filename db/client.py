"""
CrestMind AI — Supabase Connection Helper

Provides a singleton Supabase client so every module shares
one connection instead of creating a new one per call.

ON-PREMISE SWAP:
  Replace get_supabase() with a direct psycopg2 / SQLAlchemy
  connection to your local PostgreSQL + pgvector instance.
  Every other module calls get_supabase() — nothing else changes.
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

_supabase_client: Client | None = None


def get_supabase() -> Client:
    """Return a singleton Supabase client.

    Reads SUPABASE_URL and SUPABASE_KEY from the .env file.
    Raises RuntimeError with a helpful message if either is missing
    or if the connection cannot be established.
    """
    global _supabase_client

    if _supabase_client is not None:
        return _supabase_client

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")

    if not url:
        raise RuntimeError(
            "SUPABASE_URL is missing. "
            "Add it to your .env file (see .env.example)."
        )
    if not key:
        raise RuntimeError(
            "SUPABASE_KEY is missing. "
            "Add it to your .env file (see .env.example)."
        )

    try:
        _supabase_client = create_client(url, key)
    except Exception as exc:
        raise RuntimeError(
            f"Failed to connect to Supabase: {exc}\n"
            "Check that SUPABASE_URL and SUPABASE_KEY are correct."
        ) from exc

    return _supabase_client
