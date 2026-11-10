"""Re-run doc_type detection on documents already in the database.

The old detector matched the substring "wo" (Woodcrest, ductwork, two,
network) and filed most leases and invoices as work orders. New uploads are
classified correctly; this fixes rows ingested before the fix.

Dry run (prints the changes, writes nothing):
    python scripts/reclassify_doc_types.py
Apply:
    python scripts/reclassify_doc_types.py --apply

Uses SUPABASE_URL / SUPABASE_KEY from .env. Classification uses the filename
plus the first stored chunk, so it can differ slightly from a fresh upload
for documents whose type is only evident deeper in the text.

Word documents ingested before the paragraph fix were stored as one large
section; re-upload those files (delete, then ingest) to get per-section
chunks and citations.
"""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from db.client import get_supabase  # noqa: E402
from ingest.loader import _detect_doc_type  # noqa: E402


def main(apply: bool) -> None:
    sb = get_supabase()
    rows = (
        sb.table("documents")
        .select("doc_name, doc_type, content")
        .eq("metadata->>chunk_index", "0")
        .execute()
    ).data or []

    changes = []
    for row in rows:
        new_type = _detect_doc_type(row["doc_name"], row.get("content") or "")
        if new_type != (row.get("doc_type") or "unknown"):
            changes.append((row["doc_name"], row.get("doc_type"), new_type))

    if not changes:
        print("All documents already have the detected doc_type.")
        return

    for name, old, new in changes:
        print(f"{old!s:>12} -> {new:<12} {name}")

    if not apply:
        print(f"\n{len(changes)} document(s) would change. Re-run with --apply to write.")
        return

    for name, _old, new in changes:
        sb.table("documents").update({"doc_type": new}).eq("doc_name", name).execute()
    print(f"\nUpdated {len(changes)} document(s).")


if __name__ == "__main__":
    main(apply="--apply" in sys.argv[1:])
