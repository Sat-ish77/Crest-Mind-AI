"""
CrestMind AI — Document Loader

Reads PDF and DOCX files and returns structured text with
page-level granularity and auto-detected document type.

ON-PREMISE SWAP:
  Saurav replaces this file with a Surya OCR loader.
  Keep the same function signature:
      load_document(filepath: str) -> dict
  The rest of the pipeline stays unchanged.
"""

import os
import fitz  # PyMuPDF
from docx import Document


# ── Document-type detection rules ────────────────────────────
# Each rule is (keywords_to_match, detected_type).
# Checked in order: first match wins.  filename is checked
# first, then file content — so a file named "invoice.pdf"
# is classified even if the word never appears inside.

_DOC_TYPE_RULES: list[tuple[list[str], str]] = [
    (["rent roll"],                          "rent_roll"),
    (["work order", "wo"],                   "work_order"),
    (["amendment", "amend"],                 "amendment"),
    (["lease", "agreement"],                 "lease"),
    (["invoice"],                            "invoice"),
    (["inspection", "hvac inspection"],      "inspection"),
    (["quote", "proposal"],                  "quote"),
]


def _detect_doc_type(filename: str, text: str) -> str:
    """Classify a document by scanning filename then content.

    Returns a doc_type string (e.g. 'lease', 'invoice').
    Falls back to 'unknown' if no rule matches.
    """
    filename_lower = filename.lower()
    text_lower = text[:3000].lower()  # first 3 000 chars is enough

    for keywords, doc_type in _DOC_TYPE_RULES:
        for kw in keywords:
            if kw in filename_lower or kw in text_lower:
                return doc_type

    return "unknown"


# ── PDF loader (PyMuPDF / fitz) ──────────────────────────────

def _load_pdf(filepath: str) -> dict:
    """Extract text page-by-page from a PDF using PyMuPDF."""
    doc = fitz.open(filepath)
    pages = []
    full_text_parts = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text()
        pages.append({"page_number": page_num + 1, "text": text})
        full_text_parts.append(text)

    doc.close()
    return {
        "text": "\n".join(full_text_parts),
        "page_count": len(pages),
        "pages": pages,
    }


# ── DOCX loader (python-docx) ───────────────────────────────

def _load_docx(filepath: str) -> dict:
    """Extract paragraphs and table text from a DOCX file.

    DOCX files don't have native page numbers, so we assign
    page_number = 1 for all content.  Section headers are
    detected downstream by the chunker.
    """
    doc = Document(filepath)
    parts: list[str] = []

    for para in doc.paragraphs:
        text = para.text.strip()
        if text:
            parts.append(text)

    for table in doc.tables:
        for row in table.rows:
            row_text = " | ".join(cell.text.strip() for cell in row.cells)
            if row_text.replace("|", "").strip():
                parts.append(row_text)

    full_text = "\n".join(parts)
    return {
        "text": full_text,
        "page_count": 1,
        "pages": [{"page_number": 1, "text": full_text}],
    }


# ── Public API ───────────────────────────────────────────────

def load_document(filepath: str) -> dict:
    """Load a PDF or DOCX file and return structured text.

    Parameters
    ----------
    filepath : str
        Absolute or relative path to the document.

    Returns
    -------
    dict with keys:
        text          – full concatenated text
        doc_name      – filename only (no directory path)
        doc_type      – auto-detected type string
        page_count    – total number of pages
        pages         – list of {page_number, text} dicts

    Raises
    ------
    FileNotFoundError  – if the file does not exist
    ValueError         – if the file type is not supported
    RuntimeError       – if the file cannot be parsed
    """
    if not os.path.isfile(filepath):
        raise FileNotFoundError(f"File not found: {filepath}")

    ext = os.path.splitext(filepath)[1].lower()
    doc_name = os.path.basename(filepath)

    if ext == ".pdf":
        try:
            result = _load_pdf(filepath)
        except Exception as exc:
            raise RuntimeError(
                f"Failed to read PDF '{doc_name}': {exc}"
            ) from exc

    elif ext == ".docx":
        try:
            result = _load_docx(filepath)
        except Exception as exc:
            raise RuntimeError(
                f"Failed to read DOCX '{doc_name}': {exc}"
            ) from exc

    else:
        raise ValueError(
            f"Unsupported file type '{ext}'. "
            "Only .pdf and .docx files are supported."
        )

    result["doc_name"] = doc_name
    result["doc_type"] = _detect_doc_type(doc_name, result["text"])
    return result
