from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class TextChunk:
    chunk_id: str
    content: str


def simple_chunk_text(*, text: str, max_chars: int = 1200, overlap: int = 200) -> list[TextChunk]:
    """
    Deterministic chunker (idempotente): chunk_id = zero-based index.
    """
    t = (text or "").strip()
    if not t:
        return []

    chunks: list[TextChunk] = []
    start = 0
    idx = 0
    n = len(t)
    while start < n:
        end = min(n, start + max_chars)
        piece = t[start:end].strip()
        if piece:
            chunks.append(TextChunk(chunk_id=str(idx), content=piece))
            idx += 1
        if end >= n:
            break
        start = max(0, end - overlap)
    return chunks


@dataclass(frozen=True)
class DocumentChunkDraft:
    chunk_index: int
    text: str
    page_start: int | None
    page_end: int | None


def chunk_pdf_pages(
    *,
    pages: list[str],
    max_chars: int = 4200,
    overlap_pages: int = 1,
) -> list[DocumentChunkDraft]:
    """
    Canonical, audit-friendly chunking for PDFs using page boundaries.

    - Deterministic output (stable order, stable join)
    - Preserves page range metadata
    - Overlap implemented at page granularity (default: 1 page)
    """
    clean_pages = [(p or "").strip() for p in pages]
    # Keep page numbering from extractor markers when present; page_start/end use 1-based indices.
    n = len(clean_pages)
    if n == 0:
        return []

    chunks: list[DocumentChunkDraft] = []
    idx = 0
    i = 0
    while i < n:
        start_page = i + 1
        buf: list[str] = []
        j = i
        total = 0
        while j < n:
            piece = clean_pages[j]
            if piece:
                # +2 for join newlines
                added = len(piece) + (2 if buf else 0)
                if buf and (total + added) > max_chars:
                    break
                buf.append(piece)
                total += added
            j += 1

        end_page = j  # already 1-based because j is count of pages consumed
        text = "\n\n".join(buf).strip()
        if text:
            chunks.append(DocumentChunkDraft(chunk_index=idx, text=text, page_start=start_page, page_end=end_page))
            idx += 1

        if j >= n:
            break

        # Overlap: step back a few pages so next chunk includes prior context.
        back = max(0, overlap_pages)
        i = max(0, j - back)
        if i == j:  # safeguard
            i = j

    return chunks

