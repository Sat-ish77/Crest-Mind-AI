from .ocr import load_document


def loader(file_path: str) -> str:
    """Simple wrapper used by the ingestion script(s).

    Takes a filesystem path and returns the raw text extracted from it.  The
    heavy lifting is handled in ``ingest/ocr.py`` so this module stays small.
    """
    return load_document(file_path)
