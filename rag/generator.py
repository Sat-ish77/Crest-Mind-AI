"""
CrestMind AI — Answer Generator

Calls the LLM with retrieved context to produce a grounded,
cited answer.  Skips the LLM entirely for out-of-scope queries.

ON-PREMISE SWAP:
  Replace the OpenAI chat completion call in _call_llm() with
  a call to your local Llama 3.3 70B endpoint (e.g. vLLM or
  Ollama).  The system prompt and response parsing stay the same.
"""

import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# ── Configuration ────────────────────────────────────────────
LLM_MODEL = "gpt-4o-mini"  # swap to local model name for on-premise

_openai_client: OpenAI | None = None

SYSTEM_PROMPT = """\
You are CrestMind AI, a property document intelligence \
assistant for Woodcrest Capital, a real estate company.

STRICT RULES — FOLLOW EXACTLY:
1. Answer ONLY using the document context provided below. \
Never use your training knowledge to answer.
2. Read ALL provided chunks carefully and extract the answer even if \
it is spread across multiple chunks or mentioned indirectly. \
Legal documents use formal language so read thoroughly.
3. ONLY say "I could not find this specific information in the provided chunks." \
if after reading ALL chunks the answer truly cannot be found anywhere.
4. NEVER invent numbers, dollar amounts, dates, or names not present in the chunks.
5. Always cite your source at end of every answer: \
📄 Source: [doc_name] → Page [page_number] → [section]
6. If multiple documents are relevant → cite ALL of them.
7. If confidence is low → add this warning: \
"⚠️ Low confidence: Please verify this manually."

FORMATTING RULES:
8. If the question asks about costs, amounts, dates, \
comparisons, responsibilities, or lists of any kind \
→ ALWAYS respond in markdown table format with proper headers.
9. Always include units: $ for costs, sqft for area, % for rates.
10. For single simple facts → plain sentence is fine.

WOODCREST CAPITAL REAL ESTATE TERMINOLOGY:
Use these exact definitions — never use generic definitions:
- NNN (Triple Net): Tenant pays CAM + Taxes + Insurance
- CAM: Common Area Maintenance (parking, lighting, \
landscaping, roofing) — paid pro-rata by tenants
- T&I: Property Taxes and Insurance reimbursed by tenant
- PRORATA SHARE: tenant sqft divided by total building sqft
- PRORATA WITH CAP: pro-rata increase capped vs prior year
- TI / TIA: Tenant Improvement Allowance from landlord
- OPTIONS: Tenant right to extend lease (90 days notice)
- CO/COO: Certificate of Occupancy
- COI: Certificate of Insurance
- EXCLUSIVES: Exclusive right to specific business type \
(does not prohibit others from selling similar items \
under 10% of overall sales)
- RELOCATION: Landlord right to move tenant at \
landlord expense to accommodate another tenant
- CO-TENANCY: Rent reduction clause if anchor tenant leaves
- ASSIGNEE: Entity taking over existing lease
- ASSIGNOR: Current tenant assigning lease rights
- REA: Reciprocal Easement Agreement between property owners
- OEA: Operating and Easement Agreement with major tenants\
"""

# Response returned when the question is out of scope
_OUT_OF_SCOPE_RESPONSE = {
    "answer": "This information is not available in the provided documents.",
    "found_in_documents": False,
    "overall_confidence": "none",
    "sources": [],
}


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


def _build_context(chunks: list[dict]) -> str:
    """Format retrieved chunks into a context block for the LLM."""
    parts: list[str] = []
    for c in chunks:
        header = (
            f"[Source: {c.get('doc_name', 'unknown')} "
            f"| Page {c.get('page_number', '?')} "
            f"| Section: {c.get('section', 'N/A')}]"
        )
        parts.append(f"{header}\n{c.get('content', '')}")
    return "\n\n---\n\n".join(parts)


def _overall_confidence(chunks: list[dict]) -> str:
    """Determine overall confidence from chunk-level confidence labels."""
    levels = [c.get("confidence", "low") for c in chunks]
    if "high" in levels:
        return "high"
    if "medium" in levels:
        return "medium"
    return "low"


def _call_llm(user_message: str) -> str:
    """Send a message to the LLM and return the response text."""
    client = _get_openai()
    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        temperature=0.1,
        max_tokens=2048,
    )
    return response.choices[0].message.content


def generate_answer(query: str, retrieval_result: dict) -> dict:
    """Generate a grounded answer for the user's query.

    Parameters
    ----------
    query : str
        The user's natural-language question.
    retrieval_result : dict
        Output of rag.retriever.retrieve(). Must include:
        - chunks: list of retrieved chunk dicts
        - out_of_scope: bool

    Returns
    -------
    dict with keys:
        answer              – full answer text with citations
        sources             – list of source dicts for verification
        overall_confidence  – "high" / "medium" / "low" / "none"
        found_in_documents  – True / False
    """
    if retrieval_result.get("out_of_scope", True):
        return _OUT_OF_SCOPE_RESPONSE

    chunks = retrieval_result["chunks"]
    context = _build_context(chunks)

    user_message = (
        f"DOCUMENT CONTEXT:\n{context}\n\n"
        f"QUESTION:\n{query}"
    )

    try:
        answer_text = _call_llm(user_message)
    except Exception as exc:
        return {
            "answer": f"Error generating answer: {exc}",
            "found_in_documents": False,
            "overall_confidence": "none",
            "sources": [],
        }

    sources = [
        {
            "doc_name": c.get("doc_name", "unknown"),
            "section": c.get("section"),
            "page_number": c.get("page_number"),
            "confidence": c.get("confidence", "low"),
            "chunk_text": c.get("content", ""),
        }
        for c in chunks
    ]

    return {
        "answer": answer_text,
        "sources": sources,
        "overall_confidence": _overall_confidence(chunks),
        "found_in_documents": True,
    }
