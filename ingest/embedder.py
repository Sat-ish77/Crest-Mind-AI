from typing import Iterable, List


def embed_chunks(chunks: Iterable[str]) -> List[dict]:
    """Turn a list of text chunks into embedding vectors.

    During development we call OpenAI; in production the same interface can be
    wired to Vertex AI embeddings or any other provider.  The caller is
    responsible for writing the result to Supabase (see ``db/client.py``).
    """
    # placeholder, implement with openai or gcp libraries
    raise NotImplementedError("Embedding logic needs to be added")
