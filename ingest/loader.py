"""
CrestMind AI — Document Loader

Reads PDF, DOCX, and legacy DOC files and returns structured text with
page-level granularity and auto-detected document type.

ON-PREMISE SWAP:
  Saurav replaces this file with a Surya OCR loader.
  Keep the same function signature:
      load_document(filepath: str) -> dict
  The rest of the pipeline stays unchanged.
"""

import os
import re
import shutil
import subprocess
import tempfile
import fitz  # PyMuPDF
from docx import Document


# ── Document-type detection rules ────────────────────────────
# Each rule is (regex_patterns, detected_type). Patterns use word
# boundaries so short tokens cannot match inside other words — the old
# substring rule "wo" matched "WOodcrest", "ductWOrk", "tWO" and
# "netWOrk", filing most leases and invoices as work orders.
#
# The filename is checked against EVERY rule before the content is
# checked at all: a file named "... Lease, 2010.docx" is a lease even if
# its first page mentions a work order.

_DOC_TYPE_RULES: list[tuple[list[str], str]] = [
    ([r"\brent\s*roll\b"],                                  "rent_roll"),
    ([r"\bwork\s*orders?\b", r"\bw/?o\s*#?\s*\d+"],          "work_order"),
    ([r"\bamend(?:ment|ed)?\b"],                            "amendment"),
    ([r"\blease\b"],                                       "lease"),
    ([r"\binvoice\b"],                                     "invoice"),
    ([r"\binspection\b"],                                  "inspection"),
    ([r"\bquote\b", r"\bproposal\b"],                       "quote"),
]

_COMPILED_RULES = [
    ([re.compile(p, re.IGNORECASE) for p in patterns], doc_type)
    for patterns, doc_type in _DOC_TYPE_RULES
]


def _match_rules(text: str) -> str | None:
    for patterns, doc_type in _COMPILED_RULES:
        if any(p.search(text) for p in patterns):
            return doc_type
    return None


def _detect_doc_type(filename: str, text: str) -> str:
    """Classify a document by its filename first, then its content.

    Returns a doc_type string (e.g. 'lease', 'invoice').
    Falls back to 'unknown' if no rule matches.
    """
    stem = os.path.splitext(filename)[0]
    # Treat separators in filenames as spaces so "HVAC_Inspection" matches.
    stem = re.sub(r"[_\-.]+", " ", stem)
    return (
        _match_rules(stem)
        or _match_rules(text[:3000])  # first 3 000 chars is enough
        or "unknown"
    )


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

    # Blank-line separators: chunker.chunk_document() splits paragraphs on
    # "\n\n". A single "\n" made every DOCX one giant paragraph, so section
    # headings were never detected and whole leases collapsed into one
    # section label.
    full_text = "\n\n".join(parts)
    return {
        "text": full_text,
        "page_count": 1,
        "pages": [{"page_number": 1, "text": full_text}],
    }


# ── DOC loader (legacy Word via LibreOffice) ─────────────────

def _convert_doc_to_docx(doc_filepath: str) -> str:
    """Convert a legacy .doc file to .docx using LibreOffice.

    Returns the path to the converted .docx file.
    Caller is responsible for cleaning up the temp directory.
    """
    tmp_dir = tempfile.mkdtemp()
    try:
        subprocess.run(
            [
                "libreoffice",
                "--headless",
                "--convert-to", "docx",
                "--outdir", tmp_dir,
                doc_filepath,
            ],
            check=True,
            capture_output=True,
            timeout=60,
        )
    except subprocess.TimeoutExpired:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise RuntimeError("LibreOffice conversion timed out after 60 seconds.")
    except subprocess.CalledProcessError as exc:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise RuntimeError(
            f"LibreOffice conversion failed: {exc.stderr.decode('utf-8', errors='ignore')}"
        )

    # LibreOffice names the output file the same as input but with .docx
    original_name  = os.path.basename(doc_filepath)
    converted_name = os.path.splitext(original_name)[0] + ".docx"
    converted_path = os.path.join(tmp_dir, converted_name)

    if not os.path.isfile(converted_path):
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise RuntimeError(
            f"LibreOffice conversion produced no output. "
            f"Expected: {converted_path}"
        )

    return converted_path


def _load_doc(filepath: str) -> dict:
    """Convert .doc → .docx via LibreOffice then load as DOCX."""
    tmp_dir = None
    try:
        converted_path = _convert_doc_to_docx(filepath)
        tmp_dir = os.path.dirname(converted_path)
        return _load_docx(converted_path)
    finally:
        if tmp_dir and os.path.isdir(tmp_dir):
            shutil.rmtree(tmp_dir, ignore_errors=True)


# ── Public API ───────────────────────────────────────────────

def load_document(filepath: str) -> dict:
    """Load a PDF, DOCX, or legacy DOC file and return structured text.

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

    ext      = os.path.splitext(filepath)[1].lower()
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

    elif ext == ".doc":
        try:
            result = _load_doc(filepath)
        except Exception as exc:
            raise RuntimeError(
                f"Failed to read DOC '{doc_name}': {exc}"
            ) from exc

    else:
        raise ValueError(
            f"Unsupported file type '{ext}'. "
            "Only .pdf, .docx, and .doc files are supported."
        )

    result["doc_name"] = doc_name
    result["doc_type"] = _detect_doc_type(doc_name, result["text"])
    return result