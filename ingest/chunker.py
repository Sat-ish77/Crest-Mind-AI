"""
CrestMind AI — Semantic Document Chunker

Splits documents into chunks that respect section boundaries,
paragraph structure, and sentence integrity. Pure Python — no
external NLP dependencies.

ON-PREMISE SWAP:
  Adjust CHUNK_TARGET and CHUNK_MAX below to tune chunk size.
  The chunking logic is self-contained — no external libraries.
"""

import re

# ── Chunking parameters ─────────────────────────────────────
CHUNK_TARGET = 1000   # aim to group paragraphs up to this length
CHUNK_MAX = 1200      # if a single paragraph exceeds this, split at sentences
SENTENCE_OVERLAP = 150  # overlap when splitting oversized paragraphs

# ── Section detection ────────────────────────────────────────
# Numbered sections: "1.", "2.", "15." etc at start of line
_NUMBERED_SECTION = re.compile(r"^(\d{1,3})\.\s+(.+)", re.MULTILINE)

# ALL CAPS headings: 2+ consecutive uppercase words (min 6 chars total)
_CAPS_HEADING = re.compile(r"^([A-Z][A-Z\s\-&/,]{5,})$", re.MULTILINE)

# Keyword-based section labels for property documents
_SECTION_KEYWORDS: list[str] = [
    "HVAC",
    "Rent",
    "Lease Term",
    "Exclusive Use",
    "Triple Net",
    "NNN",
    "Amendment",
    "CAM",
    "Insurance",
    "Options",
    "Relocation",
    "Co-Tenancy",
    "Assignment",
    "Maintenance",
    "Payment",
    "Ductwork",
    "Inspection",
    "Insulation",
    "Work Order",
    "Tenant Improvements",
    "Default",
    "Termination",
    "Indemnification",
    "Subordination",
    "Estoppel",
    "Condemnation",
    "Guaranty",
    "Notices",
    "Parking",
    "Utilities",
    "Signs",
    "Hazardous Materials",
    "Compliance",
]

_keyword_pattern = re.compile(
    r"(?i)^(" + "|".join(re.escape(kw) for kw in _SECTION_KEYWORDS) + r")\b",
    re.MULTILINE,
)

# Sentence boundary: period followed by space and uppercase letter,
# but skip common abbreviations
_SENTENCE_SPLIT = re.compile(
    r"(?<!\bDr)(?<!\bMr)(?<!\bMs)(?<!\bNo)(?<!\bSt)(?<!\bVs)"
    r"(?<!\bArt)(?<!\bSec)(?<!\bInc)(?<!\bLtd)(?<!\bCorp)"
    r"\.\s+(?=[A-Z])"
)

# ── Property-name extraction ────────────────────────────────
_property_pattern = re.compile(
    r"(?i)(?:property|shopping center|center name|project)[:\s]+([A-Z][\w\s\-&']{3,50})",
)


def _extract_property_name(full_text: str) -> str | None:
    """Try to pull a property name from the first 2000 chars."""
    match = _property_pattern.search(full_text[:2000])
    return match.group(1).strip() if match else None


def _page_for_position(pages: list[dict], position: int) -> int:
    """Given a character offset in the full text, return the page number."""
    running = 0
    for page in pages:
        running += len(page["text"]) + 1
        if position < running:
            return page["page_number"]
    return pages[-1]["page_number"] if pages else 1


def _detect_section_label(text: str) -> str | None:
    """Extract a section label from a paragraph if it starts one.

    Checks numbered sections ("1. LEASE TERM"), ALL-CAPS headings
    ("MAINTENANCE AND REPAIRS"), and keyword matches.
    """
    text_stripped = text.strip()
    if not text_stripped:
        return None

    # Numbered section: "15. ASSIGNMENT AND SUBLETTING"
    m = _NUMBERED_SECTION.match(text_stripped)
    if m:
        return m.group(2).strip().title()

    # ALL CAPS heading
    m = _CAPS_HEADING.match(text_stripped)
    if m:
        return m.group(1).strip().title()

    # Keyword at start of line
    m = _keyword_pattern.match(text_stripped)
    if m:
        return m.group(1).title()

    return None


def _split_sentences(text: str) -> list[str]:
    """Split text into sentences, keeping the period with each sentence."""
    parts = _SENTENCE_SPLIT.split(text)
    return [s.strip() for s in parts if s.strip()]


def _split_oversized(paragraph: str) -> list[str]:
    """Split a paragraph that exceeds CHUNK_MAX at sentence boundaries
    with SENTENCE_OVERLAP characters of overlap."""
    sentences = _split_sentences(paragraph)
    if len(sentences) <= 1:
        return [paragraph]

    chunks: list[str] = []
    current = ""

    for sent in sentences:
        candidate = (current + " " + sent).strip() if current else sent
        if len(candidate) > CHUNK_MAX and current:
            chunks.append(current)
            # Overlap: start the next chunk with the tail of the current
            overlap_text = current[-SENTENCE_OVERLAP:] if len(current) > SENTENCE_OVERLAP else current
            current = (overlap_text + " " + sent).strip()
        else:
            current = candidate

    if current:
        chunks.append(current)

    return chunks


def chunk_document(doc: dict) -> list[dict]:
    """Split a loaded document into semantically-aware chunks.

    Parameters
    ----------
    doc : dict
        Output of ingest.loader.load_document(), must contain
        keys: text, doc_name, doc_type, pages.

    Returns
    -------
    list[dict]  — each chunk dict has:
        content        – the chunk text
        doc_name       – original filename
        doc_type       – detected document type
        section        – section label (or None)
        page_number    – page this chunk came from
        property_name  – extracted property name (or None)
        metadata       – {"chunk_index": i, "total_chunks": n}
    """
    full_text = doc["text"]
    pages = doc.get("pages", [])
    doc_name = doc["doc_name"]
    doc_type = doc["doc_type"]

    property_name = _extract_property_name(full_text)

    # Step 1: Split on double newlines to get natural paragraphs
    paragraphs = [p.strip() for p in full_text.split("\n\n") if p.strip()]

    # Step 2 & 3: Walk paragraphs, detect sections, group into chunks
    raw_chunks: list[tuple[str, str | None, int]] = []  # (text, section, char_offset)
    current_section: str | None = None
    current_buffer = ""
    current_offset = 0
    buffer_start_offset = 0

    char_pos = 0

    for para_idx, para in enumerate(paragraphs):
        # Track character position in the original text
        para_pos = full_text.find(para, char_pos)
        if para_pos == -1:
            para_pos = char_pos
        char_pos = para_pos + len(para)

        # Check if this paragraph starts a new section
        label = _detect_section_label(para)
        if label:
            # Flush the current buffer as a chunk before starting new section
            if current_buffer.strip():
                raw_chunks.append((current_buffer.strip(), current_section, buffer_start_offset))
            current_section = label
            current_buffer = para
            buffer_start_offset = para_pos
            continue

        # Would adding this paragraph exceed the target?
        candidate = (current_buffer + "\n\n" + para).strip() if current_buffer else para

        if len(candidate) > CHUNK_TARGET and current_buffer:
            # Flush the buffer
            raw_chunks.append((current_buffer.strip(), current_section, buffer_start_offset))
            current_buffer = para
            buffer_start_offset = para_pos
        else:
            if not current_buffer:
                buffer_start_offset = para_pos
            current_buffer = candidate

    # Don't forget the last buffer
    if current_buffer.strip():
        raw_chunks.append((current_buffer.strip(), current_section, buffer_start_offset))

    # Step 4: Split any oversized chunks at sentence boundaries
    final_chunks: list[tuple[str, str | None, int]] = []
    for text, section, offset in raw_chunks:
        if len(text) > CHUNK_MAX:
            sub_parts = _split_oversized(text)
            for sub in sub_parts:
                sub_offset = full_text.find(sub[:80], max(0, offset - 50))
                if sub_offset == -1:
                    sub_offset = offset
                final_chunks.append((sub, section, sub_offset))
        else:
            final_chunks.append((text, section, offset))

    # Build output dicts
    total = len(final_chunks)
    chunks: list[dict] = []

    for i, (text, section, offset) in enumerate(final_chunks):
        page_number = _page_for_position(pages, offset)

        chunks.append({
            "content": text,
            "doc_name": doc_name,
            "doc_type": doc_type,
            "section": section,
            "page_number": page_number,
            "property_name": property_name,
            "metadata": {
                "chunk_index": i,
                "total_chunks": total,
            },
        })

    return chunks
