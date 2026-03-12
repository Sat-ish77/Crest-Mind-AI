from typing import List
import os
from PIL import Image
import pytesseract
import pdfplumber


def ocr_image(image: Image.Image) -> str:
    """Run Tesseract on a PIL image and return the extracted text."""
    return pytesseract.image_to_string(image)


def extract_text_from_pdf(path: str) -> str:
    """Open a PDF and pull out any native text, falling back to OCR.

    This keeps the dependency list small and works entirely on‑premise.
    Replace or extend the logic later with a call to Google Vision / Vertex AI.
    """
    text: List[str] = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            if page_text.strip():
                text.append(page_text)
            else:
                pil = page.to_image(resolution=300).original
                text.append(ocr_image(pil))
    return "\n".join(text)


def load_document(path: str) -> str:
    """Return the full text for a document regardless of format.

    Supported formats currently are PDF and common image types.  For other
    file types you can extend the loader or convert them before ingestion.
    """
    ext = os.path.splitext(path.lower())[1]
    if ext == ".pdf":
        return extract_text_from_pdf(path)
    elif ext in (".jpg", ".jpeg", ".png", ".tiff", ".bmp"):
        img = Image.open(path)
        return ocr_image(img)
    else:
        raise ValueError(f"Unsupported file type: {ext}")
