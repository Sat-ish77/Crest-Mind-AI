"""
CrestMind AI — Streamlit Application
Group 13 | UNT Capstone Spring 2026 | Built for Woodcrest Capital

Multi-page app with login gate, sidebar navigation, and full RAG pipeline.

ON-PREMISE SWAP:
  Smarika's React frontend replaces this file.
  rag.retriever.retrieve() and rag.generator.generate_answer()
  stay identical — just called via FastAPI instead of Streamlit.
"""

import os
import tempfile
import streamlit as st
from db.client import get_supabase
from ingest.loader import load_document
from ingest.chunker import chunk_document
from ingest.embedder import embed_and_store
from rag.retriever import retrieve
from rag.generator import generate_answer

# ─────────────────────────────────────────────────────────────────────────────
# PAGE CONFIG
# ─────────────────────────────────────────────────────────────────────────────

st.set_page_config(
    page_title="CrestMind AI — Woodcrest Capital",
    page_icon="🏢",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ─────────────────────────────────────────────────────────────────────────────
# DEMO CREDENTIALS
# ─────────────────────────────────────────────────────────────────────────────

DEMO_PASSWORD = "crestmind2026"

# ─────────────────────────────────────────────────────────────────────────────
# GLOBAL CSS
# Streamlit's HTML sanitizer breaks on CSS selectors with ">".
# We avoid child combinators and use attribute / class selectors instead.
# ─────────────────────────────────────────────────────────────────────────────

_FONTS = '<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">'

_THEME_CSS = """
<style>
:root {
  --ink:         #1a1714;
  --bg:          #0e0c0a;
  --bg-2:        #141210;
  --bg-3:        #1c1916;
  --cream:       #f0ead8;
  --cream-dim:   #a89880;
  --gold:        #c9a84c;
  --gold-light:  #e8d5a0;
  --gold-muted:  #8a6d2f;
  --gold-glow:   rgba(201,168,76,0.18);
  --border:      rgba(201,168,76,0.22);
  --border-soft: rgba(201,168,76,0.10);
  --green:       #4ade80;
  --red:         #f87171;
}

html, body, .stApp {
  background: var(--bg) !important;
  font-family: 'DM Sans', sans-serif !important;
  color: var(--cream) !important;
}

/* ── Sidebar ─────────────────────────────────────── */
section[data-testid="stSidebar"] {
  background: var(--bg-2) !important;
  border-right: 1px solid var(--border) !important;
}
section[data-testid="stSidebar"] * {
  font-family: 'DM Sans', sans-serif !important;
}

/* ── Inputs ──────────────────────────────────────── */
.stTextInput input {
  background: var(--bg-3) !important;
  border: 1px solid var(--border) !important;
  border-radius: 8px !important;
  color: var(--cream) !important;
  font-family: 'DM Sans', sans-serif !important;
  padding: 12px 16px !important;
  caret-color: var(--gold) !important;
}
.stTextInput input::placeholder {
  color: #4a453f !important;
  font-style: italic;
}
.stTextInput input:focus {
  border-color: var(--gold) !important;
  box-shadow: 0 0 0 3px var(--gold-glow) !important;
}

/* ── Labels ──────────────────────────────────────── */
label[data-testid="stWidgetLabel"] p {
  color: var(--cream-dim) !important;
  font-size: 0.78rem !important;
  font-weight: 600 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.08em !important;
}

/* ── Buttons ─────────────────────────────────────── */
.stButton button {
  background: var(--gold) !important;
  color: var(--ink) !important;
  border: none !important;
  border-radius: 8px !important;
  font-family: 'DM Sans', sans-serif !important;
  font-weight: 700 !important;
  font-size: 0.85rem !important;
  padding: 10px 28px !important;
  letter-spacing: 0.04em !important;
  text-transform: uppercase !important;
  transition: all 0.2s !important;
}
.stButton button:hover {
  background: var(--gold-light) !important;
  box-shadow: 0 4px 20px rgba(201,168,76,0.35) !important;
}

/* ── Selectbox ───────────────────────────────────── */
.stSelectbox div[data-baseweb="select"] {
  background: var(--bg-3) !important;
  border-radius: 8px !important;
}

/* ── File uploader ───────────────────────────────── */
section[data-testid="stFileUploader"] {
  background: var(--bg-3) !important;
  border: 2px dashed var(--border) !important;
  border-radius: 12px !important;
}

/* ── Metrics ─────────────────────────────────────── */
div[data-testid="stMetric"] {
  background: var(--bg-3) !important;
  border: 1px solid var(--border) !important;
  border-radius: 10px !important;
  padding: 14px 16px !important;
}
div[data-testid="stMetricLabel"] p {
  color: var(--cream-dim) !important;
  font-size: 0.7rem !important;
  text-transform: uppercase !important;
  letter-spacing: 0.1em !important;
}
div[data-testid="stMetricValue"] {
  color: var(--gold) !important;
  font-family: 'DM Serif Display', serif !important;
  font-size: 2rem !important;
}

/* ── Expanders ───────────────────────────────────── */
div[data-testid="stExpander"] {
  background: var(--bg-3) !important;
  border: 1px solid var(--border) !important;
  border-radius: 10px !important;
  margin-bottom: 8px !important;
}
div[data-testid="stExpander"] summary p {
  color: var(--gold-light) !important;
  font-weight: 600 !important;
  font-size: 0.88rem !important;
}

/* ── Dataframe ───────────────────────────────────── */
div[data-testid="stDataFrame"] {
  border: 1px solid var(--border) !important;
  border-radius: 10px !important;
  overflow: hidden !important;
}

/* ── Progress / Spinner ──────────────────────────── */
.stProgress div div div { background: var(--gold) !important; }
.stSpinner div div { border-top-color: var(--gold) !important; }

/* ── Alerts ──────────────────────────────────────── */
div[data-testid="stAlert"] { border-radius: 10px !important; }

/* ── Dividers ────────────────────────────────────── */
hr { border-color: var(--border) !important; opacity: 0.5 !important; }

/* ── Main content area ───────────────────────────── */
.main .block-container {
  padding: 2rem 3rem 4rem !important;
  max-width: 1100px !important;
}

/* ============================================================
   CUSTOM COMPONENT CLASSES
   ============================================================ */

.cm-login-wrapper {
  display: flex; align-items: center; justify-content: center;
  min-height: 85vh;
}
.cm-login-card {
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 3rem 2.8rem 2.5rem;
  max-width: 420px;
  width: 100%;
  box-shadow: 0 8px 40px rgba(0,0,0,0.5);
}
.cm-login-brand {
  text-align: center;
  margin-bottom: 2rem;
}
.cm-login-brand h1 {
  font-family: 'DM Serif Display', serif;
  font-size: 2rem;
  color: var(--gold);
  margin: 0;
}
.cm-login-brand p {
  color: var(--cream-dim);
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-top: 4px;
}
.cm-login-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--border);
}
.cm-login-tab {
  flex: 1;
  text-align: center;
  padding: 10px 0;
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--cream-dim);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}
.cm-login-tab.active {
  color: var(--gold);
  border-bottom-color: var(--gold);
}
.cm-login-tab.disabled {
  color: #3a3530;
  cursor: default;
}
.cm-login-error {
  background: rgba(153,27,27,0.15);
  border: 1px solid rgba(248,113,113,0.2);
  border-radius: 8px;
  padding: 10px 14px;
  color: var(--red);
  font-size: 0.82rem;
  margin-bottom: 1rem;
}
.cm-sso-btn {
  display: block;
  width: 100%;
  text-align: center;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--cream-dim);
  font-size: 0.8rem;
  font-weight: 500;
  margin-top: 1rem;
  background: transparent;
  cursor: not-allowed;
  opacity: 0.5;
}
.cm-login-footer {
  text-align: center;
  margin-top: 1.5rem;
  font-size: 0.68rem;
  color: #3a3530;
}

/* ── Nav buttons ─────────────────────────────────── */
.cm-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0.5rem 0;
}
.cm-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--cream-dim);
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid transparent;
  text-decoration: none;
}
.cm-nav-item:hover {
  background: var(--gold-glow);
  color: var(--cream);
}
.cm-nav-item.active {
  background: var(--gold-glow);
  color: var(--gold);
  border-color: var(--border);
  font-weight: 700;
}
.cm-nav-icon { font-size: 1rem; width: 20px; text-align: center; }

/* ── Section labels ──────────────────────────────── */
.cm-section-label {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--gold-muted);
  margin: 1.2rem 0 0.6rem;
}

/* ── Page title ──────────────────────────────────── */
.cm-page-title {
  font-family: 'DM Serif Display', serif;
  font-size: 2rem;
  color: var(--gold);
  margin-bottom: 0.2rem;
}
.cm-page-sub {
  color: var(--cream-dim);
  font-size: 0.88rem;
  margin-bottom: 1.5rem;
  line-height: 1.6;
}

/* ── File cards in sidebar ───────────────────────── */
.cm-file-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--border-soft);
  background: rgba(201,168,76,0.03);
  margin-bottom: 6px;
  transition: background 0.15s;
}
.cm-file-card:hover { background: var(--gold-glow); }
.cm-file-icon { font-size: 1rem; flex-shrink: 0; }
.cm-file-info { flex: 1; min-width: 0; }
.cm-file-name {
  font-size: 0.76rem; font-weight: 600; color: var(--cream);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cm-file-meta { font-size: 0.66rem; color: var(--cream-dim); margin-top: 1px; }
.cm-file-type {
  font-size: 0.58rem; padding: 2px 7px; border-radius: 4px;
  font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  flex-shrink: 0;
}
.type-lease      { background: rgba(59,130,246,0.15);  color: #60a5fa; }
.type-amendment  { background: rgba(168,85,247,0.15);  color: #c084fc; }
.type-invoice    { background: rgba(201,168,76,0.15);  color: var(--gold); }
.type-inspection { background: rgba(234,88,12,0.15);   color: #fb923c; }
.type-quote      { background: rgba(20,184,166,0.15);  color: #2dd4bf; }
.type-work_order { background: rgba(236,72,153,0.15);  color: #f472b6; }
.type-rent_roll  { background: rgba(45,106,79,0.15);   color: #4ade80; }
.type-unknown    { background: rgba(100,100,100,0.15); color: #9ca3af; }

/* ── Answer area ─────────────────────────────────── */
.cm-answer-box {
  background: var(--bg-3);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem 1.8rem;
  margin: 1rem 0;
  line-height: 1.8;
  color: var(--cream);
  font-size: 0.95rem;
}
.cm-answer-box table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
.cm-answer-box th {
  background: var(--gold-glow); color: var(--gold);
  padding: 8px 12px; font-size: 0.78rem; text-transform: uppercase;
  letter-spacing: 0.08em; border: 1px solid var(--border); text-align: left;
}
.cm-answer-box td {
  padding: 8px 12px; border: 1px solid var(--border-soft);
  color: var(--cream); font-size: 0.88rem;
}

/* ── Badges ──────────────────────────────────────── */
.cm-badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 14px; border-radius: 20px; font-size: 0.72rem;
  font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
  margin-bottom: 1rem;
}
.cm-badge-high   { background: rgba(45,106,79,0.20);  color: #4ade80; border: 1px solid rgba(74,222,128,0.25); }
.cm-badge-medium { background: rgba(180,120,20,0.20); color: var(--gold); border: 1px solid rgba(201,168,76,0.30); }
.cm-badge-low    { background: rgba(153,27,27,0.20);  color: #f87171; border: 1px solid rgba(248,113,113,0.25); }

/* ── Source details ──────────────────────────────── */
.cm-source-grid {
  display: grid; grid-template-columns: repeat(3,1fr);
  gap: 8px; margin-bottom: 8px;
}
.cm-source-label {
  color: var(--cream-dim); font-size: 0.66rem;
  text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 2px;
}
.cm-source-value { color: var(--cream); font-weight: 500; font-size: 0.82rem; }
.cm-chunk-text {
  background: rgba(0,0,0,0.3); border: 1px solid var(--border-soft);
  border-radius: 6px; padding: 10px 14px;
  font-family: 'DM Mono', monospace; font-size: 0.73rem;
  color: var(--cream-dim); line-height: 1.6; white-space: pre-wrap;
  margin-top: 10px; max-height: 160px; overflow-y: auto;
}

/* ── Status boxes ────────────────────────────────── */
.cm-not-found {
  background: rgba(153,27,27,0.12); border: 1px solid rgba(248,113,113,0.2);
  border-radius: 12px; padding: 1.2rem 1.5rem;
}
.cm-ingest-success {
  background: rgba(45,106,79,0.15); border: 1px solid rgba(74,222,128,0.2);
  border-radius: 12px; padding: 1.2rem 1.5rem; margin-top: 1rem;
}
.cm-empty {
  text-align: center; padding: 2.5rem 1rem; color: var(--cream-dim);
}
.cm-empty .icon { font-size: 2.5rem; margin-bottom: 0.5rem; }
.cm-empty p { font-size: 0.85rem; line-height: 1.6; }

/* ── Welcome page ────────────────────────────────── */
.cm-hero {
  padding: 2rem 0 1rem;
}
.cm-hero h1 {
  font-family: 'DM Serif Display', serif;
  font-size: 2.4rem;
  color: var(--gold);
  margin: 0 0 0.3rem;
}
.cm-hero p {
  color: var(--cream-dim);
  font-size: 1rem;
  line-height: 1.7;
  max-width: 700px;
}
.cm-feature-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin: 2rem 0;
}
.cm-feature-card {
  background: var(--bg-3);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
  transition: all 0.2s;
}
.cm-feature-card:hover {
  border-color: var(--gold);
  box-shadow: 0 4px 24px rgba(201,168,76,0.15);
}
.cm-feature-card .icon {
  font-size: 1.6rem;
  margin-bottom: 0.6rem;
}
.cm-feature-card h3 {
  font-family: 'DM Serif Display', serif;
  font-size: 1.1rem;
  color: var(--gold);
  margin: 0 0 0.4rem;
}
.cm-feature-card p {
  color: var(--cream-dim);
  font-size: 0.82rem;
  line-height: 1.6;
  margin: 0;
}
.cm-tips {
  background: var(--bg-3);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem 1.8rem;
  margin-top: 1rem;
}
.cm-tips h3 {
  font-family: 'DM Serif Display', serif;
  font-size: 1rem;
  color: var(--gold);
  margin: 0 0 0.8rem;
}
.cm-tips li {
  color: var(--cream-dim);
  font-size: 0.84rem;
  line-height: 1.8;
  margin-bottom: 0.3rem;
}
.cm-tips li strong {
  color: var(--cream);
}
.cm-stat-bar {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin: 1.5rem 0;
}
.cm-stat-card {
  background: var(--bg-3);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1.2rem 1rem;
  text-align: center;
}
.cm-stat-value {
  font-family: 'DM Serif Display', serif;
  font-size: 2rem;
  color: var(--gold);
}
.cm-stat-label {
  font-size: 0.68rem;
  color: var(--cream-dim);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-top: 4px;
}

/* ── Uploaded pill ───────────────────────────────── */
.cm-uploaded-pill {
  background: rgba(201,168,76,0.08);
  border: 1px solid rgba(201,168,76,0.2);
  border-radius: 8px;
  padding: 8px 14px;
  margin-top: 8px;
  font-size: 0.82rem;
  color: var(--gold);
}

/* ── Logout button override ──────────────────────── */
.cm-logout button {
  background: transparent !important;
  border: 1px solid rgba(248,113,113,0.3) !important;
  color: var(--red) !important;
  font-size: 0.72rem !important;
  padding: 6px 16px !important;
  text-transform: uppercase !important;
  letter-spacing: 0.06em !important;
}
.cm-logout button:hover {
  background: rgba(153,27,27,0.15) !important;
  box-shadow: none !important;
}
</style>
"""

# ─────────────────────────────────────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────────────────────────────────────

TYPE_ICONS = {
    "lease": "📋", "amendment": "📝", "invoice": "🧾",
    "inspection": "🔍", "quote": "💬", "work_order": "🔧",
    "rent_roll": "📊",
}

BADGE_MAP = {
    "high":   ("cm-badge-high",   "✅ High Confidence"),
    "medium": ("cm-badge-medium", "⚠️ Medium Confidence — Review Recommended"),
    "low":    ("cm-badge-low",    "🔴 Low Confidence — Verify Manually"),
}

NAV_ITEMS = [
    ("home",     "🏠", "Home"),
    ("ask",      "🔍", "Ask a Question"),
    ("ingest",   "📥", "Ingest Document"),
    ("explorer", "🔭", "Document Explorer"),
]

# ─────────────────────────────────────────────────────────────────────────────
# SESSION STATE INIT
# ─────────────────────────────────────────────────────────────────────────────

def _init_session():
    """Set default session state values on first load."""
    if "logged_in" not in st.session_state:
        st.session_state["logged_in"] = False
    if "page" not in st.session_state:
        st.session_state["page"] = "home"
    if "username" not in st.session_state:
        st.session_state["username"] = ""


# ─────────────────────────────────────────────────────────────────────────────
# DATA HELPERS
# ─────────────────────────────────────────────────────────────────────────────

@st.cache_data(ttl=30)
def _fetch_ingested_docs() -> list[dict]:
    """Fetch aggregated list of ingested documents from Supabase."""
    try:
        sb = get_supabase()
        rows = (
            sb.table("documents")
            .select("doc_name, doc_type, created_at")
            .order("created_at", desc=True)
            .execute()
        )
        doc_map: dict = {}
        for r in rows.data or []:
            n = r.get("doc_name", "unknown")
            if n not in doc_map:
                doc_map[n] = {
                    "doc_name": n,
                    "doc_type": (r.get("doc_type") or "unknown").lower(),
                    "created_at": (r.get("created_at") or "")[:10],
                    "chunks": 0,
                }
            doc_map[n]["chunks"] += 1
        return list(doc_map.values())
    except Exception:
        return []


@st.cache_data(ttl=30)
def _fetch_stats() -> tuple[int, int, str]:
    """Return (unique_doc_count, total_chunks, last_ingested_timestamp)."""
    try:
        sb = get_supabase()
        rows = sb.table("documents").select("doc_name, created_at").execute()
        unique = {r["doc_name"] for r in rows.data or [] if r.get("doc_name")}
        total_r = sb.table("documents").select("id", count="exact").execute()
        total = total_r.count or 0
        latest = (
            sb.table("documents")
            .select("created_at")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        last = (
            latest.data[0]["created_at"][:16].replace("T", " ")
            if latest.data
            else "—"
        )
        return len(unique), total, last
    except Exception:
        return 0, 0, "—"


# ─────────────────────────────────────────────────────────────────────────────
# LOGIN PAGE
# ─────────────────────────────────────────────────────────────────────────────

def _render_login():
    """Full-screen branded login page."""

    st.markdown(
        """
        <div class="cm-login-wrapper">
          <div class="cm-login-card">
            <div class="cm-login-brand">
              <h1>🏢 CrestMind AI</h1>
              <p>Property Document Intelligence</p>
            </div>
            <div class="cm-login-tabs">
              <div class="cm-login-tab active">Sign In</div>
              <div class="cm-login-tab disabled">Sign Up</div>
            </div>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # Streamlit form placed outside the HTML card (Streamlit can't nest
    # widgets inside raw HTML).  We use columns to center it visually.
    _, col_form, _ = st.columns([1.2, 1, 1.2])
    with col_form:
        with st.form("login_form"):
            username = st.text_input(
                "Username",
                placeholder="Enter your username",
            )
            password = st.text_input(
                "Password",
                type="password",
                placeholder="Enter password",
            )
            submitted = st.form_submit_button(
                "Sign In", use_container_width=True
            )

            if submitted:
                if password == DEMO_PASSWORD:
                    st.session_state["logged_in"] = True
                    st.session_state["username"] = username or "Property Manager"
                    st.session_state["page"] = "home"
                    st.rerun()
                else:
                    st.markdown(
                        '<div class="cm-login-error">'
                        "Incorrect password. Hint: <strong>crestmind2026</strong>"
                        "</div>",
                        unsafe_allow_html=True,
                    )

        st.markdown(
            '<div class="cm-sso-btn">🔒 Continue with Company SSO</div>',
            unsafe_allow_html=True,
        )
        st.markdown(
            '<div class="cm-login-footer">'
            "Woodcrest Capital · Group 13 · UNT Capstone 2026"
            "</div>",
            unsafe_allow_html=True,
        )


# ─────────────────────────────────────────────────────────────────────────────
# SIDEBAR (post-login)
# ─────────────────────────────────────────────────────────────────────────────

def _render_sidebar():
    """Sidebar with nav links, knowledge-base files, and logout."""

    with st.sidebar:
        # ── Branding ──────────────────────────────────────
        st.markdown(
            '<div style="padding:0.5rem 0 0.2rem;">'
            '<div style="font-family:\'DM Serif Display\',serif;'
            "font-size:1.5rem;color:#c9a84c;letter-spacing:0.02em;\">"
            "🏢 CrestMind AI</div>"
            '<div style="font-size:0.68rem;color:#5a5248;'
            'text-transform:uppercase;letter-spacing:0.12em;margin-top:2px;">'
            "Property Document Intelligence</div>"
            "</div>",
            unsafe_allow_html=True,
        )

        st.divider()

        # ── Navigation ────────────────────────────────────
        st.markdown(
            '<div class="cm-section-label">Navigation</div>',
            unsafe_allow_html=True,
        )

        current = st.session_state.get("page", "home")
        for page_key, icon, label in NAV_ITEMS:
            active = "active" if page_key == current else ""
            st.markdown(
                f'<div class="cm-nav-item {active}" '
                f'id="nav-{page_key}">'
                f'<span class="cm-nav-icon">{icon}</span> {label}</div>',
                unsafe_allow_html=True,
            )
            if st.button(
                label,
                key=f"nav_btn_{page_key}",
                use_container_width=True,
            ):
                st.session_state["page"] = page_key
                st.rerun()

        st.divider()

        # ── Knowledge Base ────────────────────────────────
        st.markdown(
            '<div class="cm-section-label">Knowledge Base</div>',
            unsafe_allow_html=True,
        )

        docs = _fetch_ingested_docs()
        if not docs:
            st.markdown(
                '<div class="cm-empty" style="padding:1rem 0;">'
                '<div class="icon">🗂️</div>'
                "<p>No documents yet.<br>Go to Ingest to add files.</p>"
                "</div>",
                unsafe_allow_html=True,
            )
        else:
            for doc in docs:
                dtype = doc["doc_type"]
                icon = TYPE_ICONS.get(dtype, "📄")
                type_class = (
                    f"type-{dtype}" if dtype in TYPE_ICONS else "type-unknown"
                )
                name = doc["doc_name"]
                short = name if len(name) <= 26 else name[:24] + "…"
                st.markdown(
                    f'<div class="cm-file-card">'
                    f'<span class="cm-file-icon">{icon}</span>'
                    f'<div class="cm-file-info">'
                    f'<div class="cm-file-name" title="{name}">{short}</div>'
                    f"<div class=\"cm-file-meta\">"
                    f"{doc['chunks']} chunks · {doc['created_at']}</div>"
                    f"</div>"
                    f'<span class="cm-file-type {type_class}">'
                    f"{dtype.replace('_',' ').upper()}</span>"
                    f"</div>",
                    unsafe_allow_html=True,
                )

        st.divider()

        # ── Footer + logout ───────────────────────────────
        st.markdown(
            '<div style="font-size:0.63rem;color:#3a3530;line-height:1.8;">'
            "🔒 Data stored in your Supabase instance<br>"
            "🤖 Powered by OpenAI + pgvector<br>"
            "📐 On-prem swap: 1 line per module"
            "</div>",
            unsafe_allow_html=True,
        )

        st.markdown("<br>", unsafe_allow_html=True)
        with st.container():
            st.markdown(
                '<div class="cm-logout">', unsafe_allow_html=True
            )
            if st.button("↩ Sign Out", key="logout_btn", use_container_width=True):
                st.session_state["logged_in"] = False
                st.session_state["page"] = "home"
                st.cache_data.clear()
                st.rerun()
            st.markdown("</div>", unsafe_allow_html=True)


# ─────────────────────────────────────────────────────────────────────────────
# PAGE: HOME / WELCOME
# ─────────────────────────────────────────────────────────────────────────────

def _render_home():
    """Welcome page with overview and quick-start guide."""

    username = st.session_state.get("username", "Property Manager")

    st.markdown(
        f"""
        <div class="cm-hero">
          <h1>Welcome back, {username}</h1>
          <p>
            CrestMind AI is your property document intelligence assistant.
            It reads, indexes, and answers questions about your leases,
            amendments, invoices, inspections, and work orders — grounded
            entirely in your own documents with zero hallucination.
          </p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # ── Stats bar ─────────────────────────────────────
    n_docs, n_chunks, last_time = _fetch_stats()
    st.markdown(
        f"""
        <div class="cm-stat-bar">
          <div class="cm-stat-card">
            <div class="cm-stat-value">{n_docs}</div>
            <div class="cm-stat-label">Documents Ingested</div>
          </div>
          <div class="cm-stat-card">
            <div class="cm-stat-value">{n_chunks}</div>
            <div class="cm-stat-label">Total Chunks</div>
          </div>
          <div class="cm-stat-card">
            <div class="cm-stat-value" style="font-size:1rem;">{last_time}</div>
            <div class="cm-stat-label">Last Ingestion</div>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # ── Feature cards ─────────────────────────────────
    st.markdown(
        """
        <div class="cm-feature-grid">
          <div class="cm-feature-card">
            <div class="icon">🔍</div>
            <h3>Ask Questions</h3>
            <p>
              Type any question in plain English. CrestMind searches your
              documents, retrieves the most relevant passages, and generates
              a cited answer with confidence scoring. Out-of-scope questions
              are caught before the LLM is called.
            </p>
          </div>
          <div class="cm-feature-card">
            <div class="icon">📥</div>
            <h3>Ingest Documents</h3>
            <p>
              Upload PDF or DOCX files. Each document is split into
              overlapping 800-character chunks, embedded into 1536-dimension
              vectors, and stored in your pgvector database — ready
              for instant semantic search.
            </p>
          </div>
          <div class="cm-feature-card">
            <div class="icon">🔭</div>
            <h3>Explore Knowledge Base</h3>
            <p>
              Browse every chunk stored in the system. Filter by document
              or section to verify ingestion quality, inspect extracted
              text, and confirm that your documents were processed
              correctly.
            </p>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # ── Getting started tips ──────────────────────────
    st.markdown(
        """
        <div class="cm-tips">
          <h3>Getting Started</h3>
          <ol>
            <li>Go to <strong>Ingest Document</strong> in the sidebar and upload your property files (PDF or DOCX).</li>
            <li>The system automatically detects document type (lease, invoice, inspection, etc.) and splits it into searchable chunks.</li>
            <li>Switch to <strong>Ask a Question</strong> and type any question — the AI will answer using <em>only</em> your documents.</li>
            <li>Every answer includes source citations with document name, page number, and section. Click to expand and verify the original text.</li>
            <li>Use <strong>Document Explorer</strong> to browse raw chunks and confirm ingestion quality.</li>
          </ol>
        </div>
        """,
        unsafe_allow_html=True,
    )


# ─────────────────────────────────────────────────────────────────────────────
# PAGE: ASK A QUESTION
# ─────────────────────────────────────────────────────────────────────────────

def _render_ask():
    """RAG question-answering interface."""

    st.markdown(
        '<div class="cm-page-title">Ask a Question</div>',
        unsafe_allow_html=True,
    )
    st.markdown(
        '<div class="cm-page-sub">'
        "Query ingested property documents using natural language. "
        "Every answer is grounded in your documents — no hallucinations."
        "</div>",
        unsafe_allow_html=True,
    )

    # ── Quick suggestions ─────────────────────────────
    st.markdown(
        '<div class="cm-section-label">Quick Questions</div>',
        unsafe_allow_html=True,
    )
    suggestions = [
        "What is the monthly rent amount?",
        "Who is responsible for HVAC?",
        "What were the ductwork repair costs?",
        "What are the NNN responsibilities?",
        "Are there exclusive use clauses?",
        "What equipment issues were found?",
    ]
    chosen = None
    cols = st.columns(3)
    for i, s in enumerate(suggestions):
        if cols[i % 3].button(s, key=f"sug_{i}", use_container_width=True):
            chosen = s

    st.markdown("<br>", unsafe_allow_html=True)

    query = st.text_input(
        "Your Question",
        value=chosen or st.session_state.get("last_query", ""),
        placeholder="e.g. What is the tenant's HVAC responsibility under the lease?",
    )

    # ── Filters ─────────────────────────────────────
    all_docs = _fetch_ingested_docs()
    doc_name_options = ["All Documents"] + [d["doc_name"] for d in all_docs]

    c1, c2, c3 = st.columns([2, 1.2, 1.2])
    with c1:
        search = st.button(
            "🔍  Search Documents",
            type="primary",
            use_container_width=True,
        )
    with c2:
        doc_name_choice = st.selectbox(
            "Search in",
            doc_name_options,
            label_visibility="collapsed",
        )
    with c3:
        doc_filter = st.selectbox(
            "Filter type",
            [
                "All Types", "Lease", "Amendment", "Invoice",
                "Inspection", "Quote", "Work Order",
            ],
            label_visibility="collapsed",
        )

    if search:
        if not query.strip():
            st.warning("Please enter a question.")
            return

        st.session_state["last_query"] = query
        filter_type = (
            None
            if doc_filter == "All Types"
            else doc_filter.lower().replace(" ", "_")
        )
        filter_name = (
            None
            if doc_name_choice == "All Documents"
            else doc_name_choice
        )

        with st.spinner("Searching and generating answer..."):
            retrieval = retrieve(
                query,
                top_k=5,
                filter_doc_type=filter_type,
                filter_doc_name=filter_name,
            )
            result = generate_answer(query, retrieval)

        st.markdown("<br>", unsafe_allow_html=True)

        if not result["found_in_documents"]:
            st.markdown(
                f"""
                <div class="cm-not-found">
                  <div style="color:#f87171;font-weight:700;font-size:0.82rem;
                       text-transform:uppercase;letter-spacing:0.08em;
                       margin-bottom:6px;">
                    ❌ Not Found in Documents
                  </div>
                  <div style="color:#d4bcbc;font-size:0.9rem;">
                    {result['answer']}
                  </div>
                  <div style="color:#7a5a5a;font-size:0.78rem;margin-top:8px;">
                    Try rephrasing, or ingest the relevant document first.
                  </div>
                </div>
                """,
                unsafe_allow_html=True,
            )
            return

        confidence = result.get("overall_confidence", "low")
        badge_class, badge_text = BADGE_MAP.get(
            confidence, ("cm-badge-low", "Unknown")
        )
        st.markdown(
            f'<div class="cm-badge {badge_class}">{badge_text}</div>',
            unsafe_allow_html=True,
        )
        st.markdown(
            f'<div class="cm-answer-box">{result["answer"]}</div>',
            unsafe_allow_html=True,
        )

        # ── Sources ───────────────────────────────────
        if result.get("sources"):
            st.markdown(
                '<div class="cm-section-label" style="margin-top:1.5rem;">'
                "Source Documents</div>",
                unsafe_allow_html=True,
            )
            for src in result["sources"]:
                conf = src.get("confidence", "?")
                conf_color = {
                    "high": "#4ade80", "medium": "#c9a84c", "low": "#f87171"
                }.get(conf, "#9ca3af")
                icon = TYPE_ICONS.get(
                    (src.get("doc_type") or "unknown").lower(), "📄"
                )
                label = (
                    f"{icon}  {src['doc_name']}  →  "
                    f"Page {src.get('page_number', '?')}  →  "
                    f"{src.get('section') or 'General'}"
                )
                with st.expander(label):
                    st.markdown(
                        f"""
                        <div class="cm-source-grid">
                          <div>
                            <div class="cm-source-label">Document</div>
                            <div class="cm-source-value">{src['doc_name']}</div>
                          </div>
                          <div>
                            <div class="cm-source-label">Section</div>
                            <div class="cm-source-value">
                              {src.get('section') or 'N/A'}
                            </div>
                          </div>
                          <div>
                            <div class="cm-source-label">Page · Confidence</div>
                            <div class="cm-source-value">
                              p.{src.get('page_number','?')} &nbsp;·&nbsp;
                              <span style="color:{conf_color};font-weight:700;">
                                {conf.upper()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div class="cm-chunk-text">{src.get('chunk_text','')}</div>
                        """,
                        unsafe_allow_html=True,
                    )


# ─────────────────────────────────────────────────────────────────────────────
# PAGE: INGEST DOCUMENT
# ─────────────────────────────────────────────────────────────────────────────

def _render_ingest():
    """Document upload and ingestion interface."""

    st.markdown(
        '<div class="cm-page-title">Ingest Documents</div>',
        unsafe_allow_html=True,
    )
    st.markdown(
        '<div class="cm-page-sub">'
        "Upload property documents to add them to the knowledge base. "
        "Supports PDF and DOCX files up to 200 MB. "
        "You can upload multiple files at once."
        "</div>",
        unsafe_allow_html=True,
    )

    c_up, c_meta = st.columns([1.2, 1])
    with c_up:
        uploaded_files = st.file_uploader(
            "Drop files here or click to browse",
            type=["pdf", "docx"],
            accept_multiple_files=True,
            label_visibility="collapsed",
        )
        if uploaded_files:
            for f in uploaded_files:
                size_kb = len(f.getvalue()) / 1024
                unit = "KB" if size_kb < 1024 else "MB"
                size_display = size_kb if size_kb < 1024 else size_kb / 1024
                st.markdown(
                    f'<div class="cm-uploaded-pill">'
                    f"📎 <strong>{f.name}</strong> &nbsp;·&nbsp; "
                    f"{size_display:.1f} {unit}</div>",
                    unsafe_allow_html=True,
                )
    with c_meta:
        property_name = st.text_input(
            "Property Name",
            placeholder="e.g. Ali's Acres Shopping Center",
        )
        doc_type_override = st.selectbox(
            "Document Type",
            [
                "Auto-detect", "Lease", "Amendment", "Invoice",
                "Inspection", "Quote", "Work Order", "Rent Roll",
            ],
        )

    st.markdown("<br>", unsafe_allow_html=True)
    ingest_btn = st.button(
        "⬆️  Ingest Documents",
        type="primary",
        use_container_width=True,
    )

    if ingest_btn:
        if not uploaded_files:
            st.warning("Please upload at least one file.")
            return

        total_files = len(uploaded_files)
        total_stored = 0
        results_summary: list[str] = []

        progress = st.progress(0, text="Starting ingestion...")

        for file_idx, uploaded in enumerate(uploaded_files):
            file_label = f"({file_idx + 1}/{total_files}) {uploaded.name}"
            base_pct = int((file_idx / total_files) * 100)

            suffix = os.path.splitext(uploaded.name)[1]
            try:
                with tempfile.NamedTemporaryFile(
                    delete=False, suffix=suffix
                ) as tmp:
                    tmp.write(uploaded.getvalue())
                    tmp_path = tmp.name
            except Exception as e:
                st.error(f"Failed to save {uploaded.name}: {e}")
                continue

            progress.progress(
                min(base_pct + 5, 99),
                text=f"📖 Reading {file_label}...",
            )
            try:
                doc = load_document(tmp_path)
                doc["doc_name"] = uploaded.name
            except Exception as e:
                st.error(f"Failed to read {uploaded.name}: {e}")
                os.unlink(tmp_path)
                continue

            if doc_type_override != "Auto-detect":
                doc["doc_type"] = doc_type_override.lower().replace(" ", "_")

            progress.progress(
                min(base_pct + 15, 99),
                text=f"✂️ Chunking {file_label}...",
            )
            try:
                chunks = chunk_document(doc)
            except Exception as e:
                st.error(f"Chunking failed for {uploaded.name}: {e}")
                os.unlink(tmp_path)
                continue

            if property_name.strip():
                for c in chunks:
                    c["property_name"] = property_name.strip()

            progress.progress(
                min(base_pct + 30, 99),
                text=f"🧠 Embedding {file_label}...",
            )
            try:
                stored = embed_and_store(chunks)
                total_stored += stored
                results_summary.append(
                    f"✅ {uploaded.name} — {stored} chunks"
                )
            except Exception as e:
                st.error(f"Embedding failed for {uploaded.name}: {e}")
                results_summary.append(f"❌ {uploaded.name} — failed")
                os.unlink(tmp_path)
                continue

            os.unlink(tmp_path)

        progress.progress(100, text="✅ All done!")

        summary_html = "<br>".join(results_summary)
        st.markdown(
            f"""
            <div class="cm-ingest-success">
              <div style="color:#4ade80;font-weight:700;font-size:0.82rem;
                   text-transform:uppercase;letter-spacing:0.08em;
                   margin-bottom:6px;">
                ✅ Ingestion Complete — {total_files} file(s)
              </div>
              <div style="color:#d4e8dc;font-size:0.85rem;line-height:1.8;">
                {summary_html}
              </div>
              <div style="color:#a0c4b0;font-size:0.78rem;margin-top:6px;">
                Total: <strong>{total_stored}</strong> chunks stored
              </div>
            </div>
            """,
            unsafe_allow_html=True,
        )
        st.cache_data.clear()
        st.rerun()

    # ── Table of already-ingested docs with delete ────
    st.divider()
    st.markdown(
        '<div class="cm-section-label">'
        "Knowledge Base — All Ingested Documents</div>",
        unsafe_allow_html=True,
    )
    docs = _fetch_ingested_docs()
    if not docs:
        st.markdown(
            '<div class="cm-empty">'
            '<div class="icon">🗂️</div>'
            "<p>No documents ingested yet.<br>"
            "Upload your first file above.</p></div>",
            unsafe_allow_html=True,
        )
    else:
        for d in docs:
            dtype = d["doc_type"]
            icon = TYPE_ICONS.get(dtype, "📄")
            type_label = dtype.replace("_", " ").title()

            col_info, col_type, col_chunks, col_date, col_del = st.columns(
                [3, 1.2, 0.8, 1, 0.7]
            )
            col_info.markdown(
                f"{icon} **{d['doc_name']}**", unsafe_allow_html=True
            )
            col_type.markdown(
                f'<span style="font-size:0.8rem;color:var(--cream-dim);">'
                f"{type_label}</span>",
                unsafe_allow_html=True,
            )
            col_chunks.markdown(
                f'<span style="font-size:0.8rem;color:var(--cream-dim);">'
                f"{d['chunks']} chunks</span>",
                unsafe_allow_html=True,
            )
            col_date.markdown(
                f'<span style="font-size:0.8rem;color:var(--cream-dim);">'
                f"{d['created_at']}</span>",
                unsafe_allow_html=True,
            )
            with col_del:
                if st.button(
                    "🗑️",
                    key=f"del_{d['doc_name']}",
                    help=f"Delete {d['doc_name']}",
                ):
                    try:
                        sb = get_supabase()
                        sb.table("documents").delete().eq(
                            "doc_name", d["doc_name"]
                        ).execute()
                        st.cache_data.clear()
                        st.rerun()
                    except Exception as e:
                        st.error(f"Delete failed: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# PAGE: DOCUMENT EXPLORER
# ─────────────────────────────────────────────────────────────────────────────

def _render_explorer():
    """Browse raw chunks stored in the knowledge base."""

    st.markdown(
        '<div class="cm-page-title">Document Explorer</div>',
        unsafe_allow_html=True,
    )
    st.markdown(
        '<div class="cm-page-sub">'
        "Browse raw text chunks stored in the knowledge base. "
        "Use this to verify ingestion quality and inspect extracted sections."
        "</div>",
        unsafe_allow_html=True,
    )

    docs = _fetch_ingested_docs()
    if not docs:
        st.markdown(
            '<div class="cm-empty">'
            '<div class="icon">🔭</div>'
            "<p>No documents ingested yet.</p></div>",
            unsafe_allow_html=True,
        )
        return

    c1, c2 = st.columns([2, 1])
    with c1:
        selected = st.selectbox(
            "Select Document",
            [d["doc_name"] for d in docs],
        )
    with c2:
        section_filter = st.text_input(
            "Filter by Section",
            placeholder="e.g. HVAC",
        )

    if selected:
        try:
            sb = get_supabase()
            q = (
                sb.table("documents")
                .select("content,section,page_number,doc_type,metadata")
                .eq("doc_name", selected)
                .order("page_number")
            )
            rows = q.execute()
            chunks = rows.data or []

            if section_filter.strip():
                kw = section_filter.lower()
                chunks = [
                    c for c in chunks
                    if kw in (c.get("section") or "").lower()
                ]

            st.markdown(
                f'<div style="font-size:0.82rem;color:var(--cream-dim);'
                f'margin-bottom:1rem;">'
                f"{len(chunks)} chunks in "
                f'<strong style="color:var(--gold);">{selected}</strong>'
                f"</div>",
                unsafe_allow_html=True,
            )

            for i, chunk in enumerate(chunks):
                section = chunk.get("section") or "General"
                page = chunk.get("page_number", "?")
                with st.expander(
                    f"Chunk {i + 1}  ·  Page {page}  ·  {section}"
                ):
                    st.markdown(
                        f'<div class="cm-chunk-text">'
                        f"{chunk['content']}</div>",
                        unsafe_allow_html=True,
                    )
        except Exception as e:
            st.error(f"Failed to load chunks: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# ROUTING
# ─────────────────────────────────────────────────────────────────────────────

PAGE_RENDERERS = {
    "home":     _render_home,
    "ask":      _render_ask,
    "ingest":   _render_ingest,
    "explorer": _render_explorer,
}


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def main():
    """Entry point — inject CSS, check auth, route to page."""
    _init_session()

    # Inject fonts + theme
    st.markdown(_FONTS, unsafe_allow_html=True)
    st.markdown(_THEME_CSS, unsafe_allow_html=True)

    if not st.session_state["logged_in"]:
        _render_login()
        return

    _render_sidebar()

    page = st.session_state.get("page", "home")
    renderer = PAGE_RENDERERS.get(page, _render_home)
    renderer()


if __name__ == "__main__":
    main()
