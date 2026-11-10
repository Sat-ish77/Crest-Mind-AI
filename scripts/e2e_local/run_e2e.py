"""End-to-end check of the CrestMind backend against a local Postgres.

What is real:   api.py (FastAPI TestClient), loader, chunker, embedder,
                retriever, LangGraph agent, property resolver, generator
                plumbing, and db/schema.sql + db/audit_logs.sql running on
                Postgres 16 + pgvector.
What is stubbed: OpenAI embeddings (deterministic hashed bag-of-words),
                Vertex AI Llama (extractive stub that records its prompt),
                Supabase HTTP (thin psycopg adapter with the same call shape).

It answers "do all the pieces fit together?" with fictional documents and
known answers. It does NOT measure real LLM answer quality.

Setup (once):
    sudo apt-get install postgresql-16 postgresql-16-pgvector
    createdb crestmind_e2e
    pip install -r requirements.txt "psycopg[binary]" httpx

Run from the repository root:
    python scripts/e2e_local/make_dummy_docs.py /tmp/cm_docs
    E2E_DSN="host=localhost dbname=crestmind_e2e user=postgres password=..." \
        python scripts/e2e_local/run_e2e.py /tmp/cm_docs

Exit code is non-zero if any check fails. The script DROPS and recreates
the documents / properties / audit_logs tables in the target database —
never point E2E_DSN at a real database.
"""
import hashlib
import math
import os
import re
import sys
from types import SimpleNamespace

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DOCS = sys.argv[1]
DSN = os.environ["E2E_DSN"]
TOKEN = "e2e-test-token"

sys.path.insert(0, REPO)
os.environ["API_AUTH_TOKEN"] = TOKEN
conn = psycopg.connect(DSN, autocommit=True)

# ── fresh schema from the repo's own SQL ──────────────────────────────
conn.execute("DROP TABLE IF EXISTS documents, audit_logs, properties CASCADE")
for f in ("db/schema.sql", "db/match_documents.sql", "db/audit_logs.sql",
          "db/migrations/001_property_link.sql"):
    conn.execute(open(os.path.join(REPO, f)).read())
conn.execute("""INSERT INTO properties (name, entity_name, city, state, status, sold_date) VALUES
 ('Maple Ridge Plaza',   'Cedar Holdings LP', 'Austin',     'TX', 'active', NULL),
 ('Harbor Point Center', 'Harbor Point LLC',  'Wilmington', 'NC', 'sold',   '2025-09-30'),
 ('Parkplace Plaza',     'Parkplace LP',      'Dallas',     'TX', 'active', NULL),
 ('Park Place Center',   'PPC LP',            'Plano',      'TX', 'active', NULL),
 ('Northmont Plaza',     'Northmont LLC',     'Dayton',     'OH', 'active', NULL),
 ('Cockrell Drive',      'Cockrell LLC',      'Tyler',      'TX', 'active', NULL)""")


# ── Supabase-shaped adapter over psycopg ──────────────────────────────
def _vec(v):
    return "[" + ",".join(f"{x:.6f}" for x in v) + "]"


def _clean(row):
    out = {}
    for k, v in row.items():
        if k == "embedding":
            continue
        if k in ("id", "property_id") and v is not None:
            v = str(v)
        elif hasattr(v, "isoformat"):
            v = v.isoformat()
        out[k] = v
    return out


class _Query:
    def __init__(self, table):
        self.table, self.op, self.cols = table, "select", "*"
        self.where, self.orders, self.lim, self.row, self.one = [], [], None, None, False

    def select(self, cols="*", count=None):
        self.cols = cols
        return self

    def insert(self, row):
        self.op, self.row = "insert", row
        return self

    def delete(self):
        self.op = "delete"
        return self

    def eq(self, col, val):
        m = re.fullmatch(r"(\w+)->>(\w+)", col)
        self.where.append((f"{m[1]}->>'{m[2]}'" if m else col, val))
        return self

    def order(self, col, desc=False):
        self.orders.append(f"{col} {'DESC' if desc else 'ASC'}")
        return self

    def limit(self, n):
        self.lim = int(n)
        return self

    def single(self):
        self.one = True
        return self

    def execute(self):
        where = " AND ".join(f"{c} = %s" for c, _ in self.where) or "TRUE"
        args = [v for _, v in self.where]
        cur = conn.cursor(row_factory=dict_row)
        if self.op == "insert":
            cols, marks, vals = [], [], []
            for k, v in self.row.items():
                cols.append(k)
                if k == "embedding":
                    marks.append("%s::vector"); vals.append(_vec(v))
                else:
                    marks.append("%s"); vals.append(Jsonb(v) if isinstance(v, (dict, list)) else v)
            sql = f"INSERT INTO {self.table} ({','.join(cols)}) VALUES ({','.join(marks)}) RETURNING *"
            return SimpleNamespace(data=[_clean(r) for r in cur.execute(sql, vals).fetchall()])
        if self.op == "delete":
            cur.execute(f"DELETE FROM {self.table} WHERE {where}", args)
            return SimpleNamespace(data=[])
        sql = f"SELECT {self.cols} FROM {self.table} WHERE {where}"
        if self.orders:
            sql += " ORDER BY " + ",".join(self.orders)
        if self.lim:
            sql += f" LIMIT {self.lim}"
        data = [_clean(r) for r in cur.execute(sql, args).fetchall()]
        return SimpleNamespace(data=(data[0] if data else None) if self.one else data, count=len(data))


class FakeSupabase:
    rpc_calls = []

    def table(self, name):
        return _Query(name)

    def rpc(self, fn, params):
        def execute():
            FakeSupabase.rpc_calls.append(params)
            parts, vals = [], []
            for k, v in params.items():
                parts.append(f"{k} => %s::vector" if k == "query_embedding" else f"{k} => %s")
                vals.append(_vec(v) if k == "query_embedding" else v)
            cur = conn.cursor(row_factory=dict_row)
            rows = cur.execute(f"SELECT * FROM {fn}({', '.join(parts)})", vals).fetchall()
            return SimpleNamespace(data=[_clean(r) for r in rows])
        return SimpleNamespace(execute=execute)


# ── model stubs ───────────────────────────────────────────────────────
STOP = set("the a an of to and is for what who on in at by this be with are does when "
           "how much which was its it any each per our".split())


def _toks(s):
    return [t for t in re.findall(r"[a-z0-9]+", s.lower()) if t not in STOP]


def fake_embed(text):
    v = [0.0] * 1536
    for t in _toks(text):
        v[int(hashlib.md5(t.encode()).hexdigest(), 16) % 1536] += 1.0
    n = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / n for x in v]


LLM_PROMPTS = []
KNOWN_PROPERTIES = ["maple ridge", "harbor point", "park place", "parkplace"]


def fake_agent_llm(messages, temperature=0.0):
    user = messages[-1]["content"].lower()
    for name in KNOWN_PROPERTIES:
        if name in user:
            return name.title()
    return "NONE"


def fake_answer_llm(user_message):
    LLM_PROMPTS.append(user_message)
    context, question = user_message.split("QUESTION:\n")
    q = set(_toks(question))
    best = (0, "", "")
    for block in context.split("\n\n---\n\n"):
        header, _, body = block.replace("DOCUMENT CONTEXT:\n", "").partition("\n")
        for sentence in re.split(r"(?<=[.])\s+|\n", body):
            score = len(q & set(_toks(sentence)))
            if score > best[0]:
                best = (score, sentence.strip(), header)
    if best[0] == 0:
        return "I could not find this specific information in the provided chunks."
    return f"{best[1]}\n\n📄 Source: {best[2]}"


# ── wire up ───────────────────────────────────────────────────────────
import db.client  # noqa: E402
db.client._supabase_client = FakeSupabase()
import ingest.embedder as embedder  # noqa: E402
import rag.retriever as retriever  # noqa: E402
import rag.agent as agent  # noqa: E402
import rag.generator as generator  # noqa: E402
embedder._embed_batch = lambda texts: [fake_embed(t) for t in texts]
retriever._embed_query = fake_embed
agent._llm_call = fake_agent_llm
generator._call_llm = fake_answer_llm
import api  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

anon = TestClient(api.app)
client = TestClient(api.app, headers={"Authorization": f"Bearer {TOKEN}"})
results = []


def check(name, ok, detail=""):
    results.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f"  -- {detail}" if detail else ""))


print("\n-- auth")
check("GET / health is public", anon.get("/").status_code == 200)
check("POST /ask without token -> 401", anon.post("/ask", json={"query": "x"}).status_code == 401)
check("DELETE without token -> 401", anon.delete("/documents/x.pdf").status_code == 401)
bad = TestClient(api.app, headers={"Authorization": "Bearer wrong"})
check("wrong token -> 401", bad.get("/documents").status_code == 401)

print("\n-- ingest")
EXPECTED = {
    "Maple Ridge Plaza - Lease 2024.docx": "lease",
    "Harbor Point Amendment 1.docx": "amendment",
    "Ductwork Invoice 7781.pdf": "invoice",
    "HVAC Inspection Harbor Point.pdf": "inspection",
}
for name, want in EXPECTED.items():
    with open(os.path.join(DOCS, name), "rb") as f:
        body = client.post("/ingest", files={"file": (name, f.read())}).json()
    check(f"{name}: stored, type={want}, property linked",
          body.get("chunks_stored", 0) > 0 and body.get("doc_type") == want and body.get("property_id"),
          f"chunks={body.get('chunks_stored')} type={body.get('doc_type')} property_id={bool(body.get('property_id'))}")

chunks = client.get("/documents/Maple Ridge Plaza - Lease 2024.docx/chunks").json()["chunks"]
sections = [c["section"] for c in chunks]
check("DOCX lease split by section", len(chunks) >= 5 and any(s and "Hvac" in s for s in sections), sections)
chunks = client.get("/documents/HVAC Inspection Harbor Point.pdf/chunks").json()["chunks"]
check("PDF page numbers kept",
      any("compressor" in c["content"].lower() and c["page_number"] == 2 for c in chunks))
with open(os.path.join(DOCS, "Ductwork Invoice 7781.pdf"), "rb") as f:
    again = client.post("/ingest", files={"file": ("Ductwork Invoice 7781.pdf", f.read())}).json()
check("re-ingest skips duplicates", again.get("chunks_stored") == 0)

# Simulate documents ingested before property linking existed.
conn.execute("UPDATE documents SET property_id = NULL WHERE doc_name = 'Harbor Point Amendment 1.docx'")

print("\n-- ask (right fact must reach the LLM, right source must be cited)")
QA = [
    ("What is the monthly base rent at Maple Ridge Plaza?", "$4,250.00", "Maple Ridge Plaza - Lease 2024.docx"),
    ("Who is responsible for HVAC maintenance at Maple Ridge Plaza?", "routine HVAC maintenance", "Maple Ridge Plaza - Lease 2024.docx"),
    ("When does the exclusive use clause expire at Maple Ridge Plaza?", "December 31, 2029", "Maple Ridge Plaza - Lease 2024.docx"),
    ("What was the total ductwork invoice cost?", "$12,480.50", "Ductwork Invoice 7781.pdf"),
    ("What did the HVAC inspection find at Harbor Point?", "compressor", "HVAC Inspection Harbor Point.pdf"),
    ("What is the new monthly base rent in the Harbor Point amendment?", "$5,100.00", "Harbor Point Amendment 1.docx"),
]
for question, fact, source in QA:
    LLM_PROMPTS.clear()
    FakeSupabase.rpc_calls.clear()
    r = client.post("/ask", json={"query": question})
    b = r.json()
    prompt = LLM_PROMPTS[-1] if LLM_PROMPTS else ""
    cited = [s["doc_name"] for s in b.get("sources", [])]
    check(question, r.status_code == 200 and fact in prompt and source in cited and len(cited) <= 5,
          f"fact_in_prompt={fact in prompt} sources={len(cited)} searches={len(FakeSupabase.rpc_calls)} "
          f"conf={b.get('overall_confidence')}")
    if "Harbor Point" in question:
        check("  sold-property warning", "was sold on" in b.get("answer", ""))

print("\n-- edge cases")
b = client.post("/ask", json={"query": "What is the capital of France?"}).json()
check("out-of-scope reported as not found", b["found_in_documents"] is False and b["overall_confidence"] == "none",
      f"found={b['found_in_documents']} conf={b['overall_confidence']}")
b = client.post("/ask", json={"query": "What is the rent at Park Place?"}).json()
check("ambiguous property asks to clarify", "did you mean" in b["answer"].lower(), b["answer"][:80])
check("not-found message never says 'None'", "None" not in b["answer"])
check("blank query -> 400", client.post("/ask", json={"query": "  "}).status_code == 400)

print("\n-- feedback + delete")
r = client.post("/feedback", json={"query": "q", "answer": "a", "action": "flagged"})
check("POST /feedback", r.status_code == 201 and r.json()["id"])
check("GET /feedback", len(client.get("/feedback?action=flagged").json()["logs"]) == 1)
client.delete("/documents/Ductwork Invoice 7781.pdf")
left = conn.execute("SELECT count(*) FROM documents WHERE doc_name = 'Ductwork Invoice 7781.pdf'").fetchone()[0]
check("DELETE removes every chunk", left == 0)

passed = sum(results)
print(f"\n{passed}/{len(results)} checks passed")
sys.exit(0 if passed == len(results) else 1)
