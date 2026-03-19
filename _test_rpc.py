"""Quick diagnostic for hybrid RPC."""
from rag.retriever import _embed_query
from db.client import get_supabase

# Test 1: embedding
print("Testing embedding...")
try:
    emb = _embed_query("test")
    print(f"Embedding OK, dim={len(emb)}")
except Exception as e:
    print(f"Embedding FAILED: {e}")

# Test 2: row count
sb = get_supabase()
r = sb.table("documents").select("id", count="exact").execute()
print(f"\nTotal rows in documents: {r.count}")

# Test 3: RPC with query_text (new hybrid signature)
print("\nTesting hybrid RPC (with query_text)...")
emb = _embed_query("Who are the lessor and lessee?")
try:
    result = sb.rpc("match_documents", {
        "query_embedding": emb,
        "query_text": "Who are the lessor and lessee?",
        "match_count": 5,
        "filter_doc_type": None,
        "filter_doc_name": None,
    }).execute()
    print(f"Hybrid RPC returned {len(result.data)} rows")
    for row in result.data[:3]:
        sim = row.get("similarity", 0)
        doc = row.get("doc_name", "?")
        sec = row.get("section", "?")
        print(f"  sim={sim:.4f}  doc={doc}  section={sec}")
except Exception as e:
    print(f"Hybrid RPC FAILED: {e}")

# Test 4: RPC without query_text (old vector-only)
print("\nTesting old RPC (without query_text)...")
try:
    result = sb.rpc("match_documents", {
        "query_embedding": emb,
        "match_count": 5,
        "filter_doc_type": None,
        "filter_doc_name": None,
    }).execute()
    print(f"Old RPC returned {len(result.data)} rows")
    for row in result.data[:3]:
        sim = row.get("similarity", 0)
        doc = row.get("doc_name", "?")
        print(f"  sim={sim:.4f}  doc={doc}")
except Exception as e:
    print(f"Old RPC FAILED: {e}")
