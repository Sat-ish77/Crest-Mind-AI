"""
CrestMind AI — Document Chunker

Splits a loaded document into overlapping text chunks and
attaches metadata (section labels, page numbers, property name).

ON-PREMISE SWAP:
  To change the chunking strategy, only edit CHUNK_SIZE and
  CHUNK_OVERLAP below, or swap RecursiveCharacterTextSplitter
  for any splitter with the same .split_text(str) interface.
"""

import re
from langchain_text_splitters import RecursiveCharacterTextSplitter

# ── Chunking parameters ─────────────────────────────────────
CHUNK_SIZE = 800
CHUNK_OVERLAP = 100

_splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP,
    length_function=len,
    separators=["\n\n", "\n", ". ", " ", ""],
)

# ── Section-detection keywords ───────────────────────────────
# When one of these appears at the start of a line (case-insensitive),
# it becomes the current section label for all following chunks.

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
]

_section_pattern = re.compile(
    r"(?i)^(" + "|".join(re.escape(kw) for kw in _SECTION_KEYWORDS) + r")\b",
    re.MULTILINE,
)

# ── Property-name extraction ────────────────────────────────
# Looks for patterns like "Property: Woodcrest Plaza" or
# "Shopping Center: ..." near the top of the document.

_property_pattern = re.compile(
    r"(?i)(?:property|shopping center|center name|project)[:\s]+([A-Z][\w\s\-&']{3,50})",
)


def _detect_section(text: str) -> str | None:
    """Return the first section keyword found in `text`, or None."""
    match = _section_pattern.search(text)
    return match.group(1).title() if match else None


def _extract_property_name(full_text: str) -> str | None:
    """Try to pull a property name from the full document text."""
    match = _property_pattern.search(full_text[:2000])
    if match:
        return match.group(1).strip()
    return None


def _page_for_position(pages: list[dict], position: int) -> int:
    """Given a character offset in the full text, return the page number."""
    running = 0
    for page in pages:
        running += len(page["text"]) + 1  # +1 for the \n join
        if position < running:
            return page["page_number"]
    return pages[-1]["page_number"] if pages else 1


def chunk_document(doc: dict) -> list[dict]:
    """Split a loaded document into metadata-enriched chunks.

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

    raw_chunks = _splitter.split_text(full_text)

    # Build a section map: walk through the full text and track
    # which section label is "active" at each character offset.
    current_section: str | None = None
    section_at_offset: list[tuple[int, str | None]] = [(0, None)]

    for m in _section_pattern.finditer(full_text):
        current_section = m.group(1).title()
        section_at_offset.append((m.start(), current_section))

    def _section_for_position(pos: int) -> str | None:
        """Return the active section at a character offset."""
        active = None
        for offset, sec in section_at_offset:
            if offset <= pos:
                active = sec
            else:
                break
        return active

    chunks: list[dict] = []
    search_start = 0

    for i, chunk_text in enumerate(raw_chunks):
        pos = full_text.find(chunk_text, search_start)
        if pos == -1:
            pos = search_start

        section = _section_for_position(pos)
        if section is None:
            section = _detect_section(chunk_text)

        page_number = _page_for_position(pages, pos)

        chunks.append({
            "content": chunk_text,
            "doc_name": doc_name,
            "doc_type": doc_type,
            "section": section,
            "page_number": page_number,
            "property_name": property_name,
            "metadata": {
                "chunk_index": i,
                "total_chunks": len(raw_chunks),
            },
        })

        search_start = pos + 1

    return chunks
