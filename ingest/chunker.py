from typing import List


def chunk_text(text: str, size: int = 500) -> List[str]:
    """Split a large block of text into fixed-size chunks.

    The loader returns plain text; the next step in the pipeline is to break
    that text into 500‑character windows so we can embed each piece
    independently and later perform similarity search.
    """
    return [text[i : i + size] for i in range(0, len(text), size)]
