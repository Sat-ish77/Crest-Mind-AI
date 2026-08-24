"""
CrestMind AI — Agentic RAG Pipeline

Replaces the simple retrieve → generate pipeline with a LangGraph agent
that can:
  1. Identify which property the user is asking about
  2. Check property status (active / sold / historical)
  3. Route to the right document category (Tenants, Insurance, etc.)
  4. Re-search if the first retrieval is insufficient
  5. Handle cross-property queries ("compare rent across all TX properties")
  6. Ask for clarification when property name is ambiguous

ON-PREMISE SWAP:
  Change _get_llm() to point at local Ollama endpoint.
  All agent logic stays identical.
"""

from __future__ import annotations

import os
import json
from typing import TypedDict, Annotated, Literal
import operator

import google.auth
import google.auth.transport.requests
from openai import OpenAI
from langgraph.graph import StateGraph, END
from dotenv import load_dotenv

from rag.retriever import retrieve
from rag.property_resolver import (
    resolve_property,
    format_property_status_warning,
    get_properties_by_state,
)

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────
LLM_MODEL  = "meta/llama-3.3-70b-instruct-maas"
GCP_REGION = "us-central1"

# Document category routing hints — maps query keywords to folder names
CATEGORY_HINTS: dict[str, list[str]] = {
    "Tenants":        ["lease", "rent", "tenant", "renewal", "amendment", "security deposit",
                       "cam", "nnn", "triple net", "expir", "term", "occupancy"],
    "Insurance":      ["insurance", "coi", "liability", "certificate", "coverage"],
    "Taxes":          ["tax", "assessment", "property tax", "ad valorem"],
    "Roofing":        ["roof", "roofing", "leak", "membrane", "tpo", "epdm"],
    "CapEx":          ["capex", "capital", "improvement", "renovation", "construction"],
    "Debt Service":   ["mortgage", "loan", "debt", "lender", "note", "refinanc"],
    "Reconciliations":["reconcili", "cam reconcil", "annual reconcil"],
    "Property":       ["inspection", "survey", "square feet", "acreage", "zoning"],
    "Utilities":      ["utility", "utilities", "electric", "water", "gas", "trash"],
    "Fire Systems":   ["fire", "sprinkler", "alarm", "suppression"],
}


def _infer_category(query: str) -> str | None:
    """Return the most likely document category folder for a query."""
    q = query.lower()
    best_category = None
    best_count    = 0

    for category, keywords in CATEGORY_HINTS.items():
        count = sum(1 for kw in keywords if kw in q)
        if count > best_count:
            best_count    = count
            best_category = category

    return best_category if best_count > 0 else None


# ── Vertex AI client (with credential caching) ────────────────────────
_credentials = None
_project: str | None = None


def _get_llm() -> OpenAI:
    """Return a Vertex AI OpenAI-compatible client with refreshed token."""
    global _credentials, _project
    if _credentials is None:
        _credentials, _project = google.auth.default(
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
    if not _credentials.valid:
        _credentials.refresh(google.auth.transport.requests.Request())

    return OpenAI(
        base_url=(
            f"https://{GCP_REGION}-aiplatform.googleapis.com/v1beta1"
            f"/projects/{_project}/locations/{GCP_REGION}/endpoints/openapi"
        ),
        api_key=_credentials.token,
    )


def _llm_call(messages: list[dict], temperature: float = 0.0) -> str:
    """Single LLM call. Returns response text."""
    client = _get_llm()
    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=messages,
        temperature=temperature,
        max_tokens=2048,
    )
    return response.choices[0].message.content or ""


# ── Agent State ───────────────────────────────────────────────────────
class AgentState(TypedDict):
    # Input
    query:              str
    filter_doc_type:    str | None
    filter_doc_name:    str | None
    top_k:              int

    # Property resolution
    property_id:        str | None
    property_name:      str | None
    property_status:    str | None   # active | sold | historical | held
    property_warning:   str | None
    is_cross_property:  bool         # True = user wants all properties

    # Retrieval
    doc_category:       str | None
    chunks:             list[dict]
    retrieval_attempts: int          # how many times we've searched

    # Clarification
    needs_clarification: bool
    clarification_msg:   str | None
    candidates:          list[dict]  # ambiguous property matches

    # Output
    answer:             str | None
    sources:            list[dict]
    overall_confidence: str
    found_in_documents: bool

    # Reasoning trace (shown as loading steps in UI)
    steps:              Annotated[list[str], operator.add]


# ── Node: Analyze Query ───────────────────────────────────────────────
def analyze_query(state: AgentState) -> dict:
    """
    Step 1: Understand what the user is asking.
    - Is this a cross-property query? ("all properties in TX")
    - Which property are they asking about?
    - What document category does this map to?
    """
    query = state["query"]

    # Detect cross-property patterns
    cross_property_signals = [
        "all properties", "across all", "every property",
        "portfolio", "compare", "all tenants", "all locations",
        "how many properties", "list all",
    ]
    is_cross = any(sig in query.lower() for sig in cross_property_signals)

    # Infer doc category
    category = state.get("filter_doc_type") or _infer_category(query)

    return {
        "is_cross_property": is_cross,
        "doc_category": category,
        "steps": [f"🔍 Analyzing query: {'cross-property' if is_cross else 'single property'}"],
    }


# ── Node: Resolve Property ────────────────────────────────────────────
def resolve_property_node(state: AgentState) -> dict:
    """
    Step 2: Identify which property the user means.
    Skip for cross-property queries.
    """
    if state.get("is_cross_property"):
        return {
            "property_id": None,
            "property_name": None,
            "property_status": None,
            "property_warning": None,
            "needs_clarification": False,
            "steps": ["🏢 Cross-property query detected — searching all properties"],
        }

    # Ask LLM to extract the property name from the query
    extraction_prompt = [
        {
            "role": "system",
            "content": (
                "Extract the property name or location from the user's query. "
                "Return ONLY the property name/location as a short string. "
                "If no specific property is mentioned, return 'NONE'."
            ),
        },
        {"role": "user", "content": state["query"]},
    ]
    extracted_name = _llm_call(extraction_prompt, temperature=0.0).strip()

    if extracted_name.upper() == "NONE" or not extracted_name:
        # No specific property → treat as cross-property
        return {
            "is_cross_property": True,
            "property_id": None,
            "property_name": None,
            "needs_clarification": False,
            "steps": ["📋 No specific property identified — searching all documents"],
        }

    # Fuzzy resolve
    resolution = resolve_property(extracted_name)

    if resolution["status"] == "ambiguous":
        return {
            "needs_clarification": True,
            "clarification_msg": resolution["message"],
            "candidates": resolution["candidates"],
            "property_id": None,
            "property_name": None,
            "steps": [f"❓ Ambiguous property name: '{extracted_name}'"],
        }

    if resolution["status"] == "not_found":
        # Fall back to searching all docs
        return {
            "is_cross_property": True,
            "property_id": None,
            "property_name": extracted_name,
            "needs_clarification": False,
            "steps": [f"⚠️ Property '{extracted_name}' not found — searching all documents"],
        }

    # Found
    prop = resolution["property"]
    warning = format_property_status_warning(prop)

    return {
        "property_id":      prop["id"],
        "property_name":    prop["name"],
        "property_status":  prop.get("status", "active"),
        "property_warning": warning,
        "needs_clarification": False,
        "steps": [f"✅ Property identified: {prop['name']} ({prop.get('state', '')}) — {prop.get('status', 'active')}"],
    }


# ── Node: Retrieve Documents ──────────────────────────────────────────
def retrieve_documents(state: AgentState) -> dict:
    """
    Step 3: Search the vector database for relevant chunks.
    Filters by property_id and doc_category when available.
    """
    attempts = state.get("retrieval_attempts", 0)

    # Build filter — use property_id and category if available
    filter_doc_name = state.get("filter_doc_name")
    filter_doc_type = state.get("doc_category") or state.get("filter_doc_type")

    # If we have a property_id, add it as a metadata filter
    property_id = state.get("property_id")

    category_label = state.get("doc_category") or "all categories"
    prop_label     = state.get("property_name") or "all properties"

    step_msg = f"🗄️ Searching {category_label} documents for {prop_label}"
    if attempts > 0:
        step_msg = f"🔄 Re-searching with broader scope (attempt {attempts + 1})"

    # Call existing retriever
    # On retry (attempts > 0), broaden: drop category filter
    retrieval_result = retrieve(
        query=state["query"],
        filter_doc_type=filter_doc_type if attempts == 0 else None,
        filter_doc_name=filter_doc_name,
        top_k=state.get("top_k", 5),
        property_id=property_id,  # new filter — add to retriever.py
    )

    chunks = retrieval_result.get("chunks", [])

    return {
        "chunks":             chunks,
        "retrieval_attempts": attempts + 1,
        "steps":              [step_msg],
    }


# ── Node: Evaluate Retrieval ──────────────────────────────────────────
def evaluate_retrieval(state: AgentState) -> Literal["generate", "retry", "not_found"]:
    """
    Router: Are the retrieved chunks good enough to answer the query?
    """
    chunks   = state.get("chunks", [])
    attempts = state.get("retrieval_attempts", 0)

    # No chunks at all
    if not chunks:
        if attempts < 2:
            return "retry"
        return "not_found"

    # Check if chunks have reasonable confidence
    high_or_medium = [
        c for c in chunks
        if c.get("confidence") in ("high", "medium")
    ]

    if high_or_medium:
        return "generate"

    # Low confidence chunks + we haven't retried yet
    if attempts < 2:
        return "retry"

    # Low confidence but we've tried twice — generate anyway with warning
    return "generate"


# ── Node: Generate Answer ─────────────────────────────────────────────
def generate_answer_node(state: AgentState) -> dict:
    """
    Step 4: Generate a grounded answer using retrieved chunks.
    """
    from rag.generator import generate_answer

    chunks = state.get("chunks", [])

    # Add property status warning to context if needed
    property_warning = state.get("property_warning")

    result = generate_answer(
        query=state["query"],
        retrieval_result={
            "chunks": chunks,
            "out_of_scope": len(chunks) == 0,
        },
    )

    # Append property status warning to answer if relevant
    answer = result.get("answer", "")
    if property_warning and result.get("found_in_documents"):
        answer = f"{answer}\n\n{property_warning}"

    return {
        "answer":             answer,
        "sources":            result.get("sources", []),
        "overall_confidence": result.get("overall_confidence", "low"),
        "found_in_documents": result.get("found_in_documents", False),
        "steps":              ["💡 Generating answer from retrieved context"],
    }


# ── Node: Not Found ───────────────────────────────────────────────────
def not_found_node(state: AgentState) -> dict:
    """Return a clean 'not found' response."""
    prop = state.get("property_name", "the specified property")
    return {
        "answer": (
            f"I could not find relevant documents to answer your question "
            f"about {prop}. This may be because:\n"
            "- The documents haven't been ingested yet\n"
            "- The question refers to information not in the current knowledge base\n\n"
            "Please try rephrasing your question or contact your document administrator."
        ),
        "sources":            [],
        "overall_confidence": "none",
        "found_in_documents": False,
        "steps":              ["❌ No relevant documents found"],
    }


# ── Node: Clarification Needed ────────────────────────────────────────
def clarification_node(state: AgentState) -> dict:
    """Return a clarification request when property is ambiguous."""
    candidates = state.get("candidates", [])
    candidate_names = [c.get("name", "") for c in candidates[:3]]
    names_str = ", ".join(candidate_names)

    return {
        "answer": (
            f"{state.get('clarification_msg', 'Please clarify which property you mean.')}\n\n"
            f"Did you mean one of these?\n"
            + "\n".join(f"• {n}" for n in candidate_names)
        ),
        "sources":            [],
        "overall_confidence": "none",
        "found_in_documents": False,
        "steps":              ["❓ Clarification needed from user"],
    }


# ── Routing Functions ─────────────────────────────────────────────────
def route_after_resolve(state: AgentState) -> Literal["retrieve", "clarify"]:
    if state.get("needs_clarification"):
        return "clarify"
    return "retrieve"


# ── Build the Graph ───────────────────────────────────────────────────
def build_agent() -> StateGraph:
    graph = StateGraph(AgentState)

    # Add nodes
    graph.add_node("analyze",     analyze_query)
    graph.add_node("resolve",     resolve_property_node)
    graph.add_node("retrieve",    retrieve_documents)
    graph.add_node("generate",    generate_answer_node)
    graph.add_node("not_found",   not_found_node)
    graph.add_node("clarify",     clarification_node)

    # Edges
    graph.set_entry_point("analyze")
    graph.add_edge("analyze", "resolve")

    graph.add_conditional_edges(
        "resolve",
        route_after_resolve,
        {"retrieve": "retrieve", "clarify": "clarify"},
    )

    graph.add_conditional_edges(
        "retrieve",
        evaluate_retrieval,
        {
            "generate":  "generate",
            "retry":     "retrieve",
            "not_found": "not_found",
        },
    )

    graph.add_edge("generate",  END)
    graph.add_edge("not_found", END)
    graph.add_edge("clarify",   END)

    return graph.compile()


# ── Public API ────────────────────────────────────────────────────────
_agent = None


def get_agent():
    global _agent
    if _agent is None:
        _agent = build_agent()
    return _agent


def run_agent(
    query: str,
    filter_doc_type: str | None = None,
    filter_doc_name: str | None = None,
    top_k: int = 5,
) -> dict:
    """
    Run the agentic RAG pipeline.

    Returns
    -------
    {
        "answer":             str,
        "sources":            list,
        "overall_confidence": str,
        "found_in_documents": bool,
        "steps":              list[str],  # reasoning trace for UI
    }
    """
    agent = get_agent()

    initial_state: AgentState = {
        "query":               query,
        "filter_doc_type":     filter_doc_type,
        "filter_doc_name":     filter_doc_name,
        "top_k":               top_k,
        "property_id":         None,
        "property_name":       None,
        "property_status":     None,
        "property_warning":    None,
        "is_cross_property":   False,
        "doc_category":        None,
        "chunks":              [],
        "retrieval_attempts":  0,
        "needs_clarification": False,
        "clarification_msg":   None,
        "candidates":          [],
        "answer":              None,
        "sources":             [],
        "overall_confidence":  "low",
        "found_in_documents":  False,
        "steps":               [],
    }

    final_state = agent.invoke(initial_state)

    return {
        "answer":             final_state.get("answer", ""),
        "sources":            final_state.get("sources", []),
        "overall_confidence": final_state.get("overall_confidence", "low"),
        "found_in_documents": final_state.get("found_in_documents", False),
        "steps":              final_state.get("steps", []),
    }