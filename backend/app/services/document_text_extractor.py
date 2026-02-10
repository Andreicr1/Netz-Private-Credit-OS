from __future__ import annotations

from dataclasses import dataclass

from pypdf import PdfReader


@dataclass(frozen=True)
class ExtractedPdfText:
    """
    Deterministic PDF extraction result.
    `pages` preserves page boundaries for audit-friendly chunk metadata.
    """

    pages: list[str]

    @property
    def text(self) -> str:
        # Stable canonical join
        return "\n\n".join([p for p in self.pages if (p or "").strip()]).strip()


def extract_pdf_pages(file_bytes: bytes) -> ExtractedPdfText:
    """
    Extracts text per page using pypdf. Deterministic ordering and stable whitespace.
    OCR fallback is intentionally NOT implemented yet (future EPIC).
    """
    reader = PdfReader(_BytesIO(file_bytes))
    pages: list[str] = []
    for i, page in enumerate(reader.pages, start=1):
        try:
            txt = page.extract_text() or ""
        except Exception:
            txt = ""
        txt = _normalize_text(txt)
        # Keep explicit page markers for traceability (helps excerpts and auditing)
        pages.append(f"[PAGE {i}]\n{txt}".strip())

    return ExtractedPdfText(pages=pages)


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """
    Required interface (EPIC 3B): PDF → text (deterministic).
    """
    return extract_pdf_pages(file_bytes).text


def _normalize_text(t: str) -> str:
    # Normalize newlines and trim trailing spaces to keep extraction stable.
    t = (t or "").replace("\r\n", "\n").replace("\r", "\n")
    lines = [ln.rstrip() for ln in t.split("\n")]
    # Collapse excessive blank lines (max 2 in a row)
    out: list[str] = []
    blank = 0
    for ln in lines:
        if ln.strip() == "":
            blank += 1
            if blank <= 2:
                out.append("")
        else:
            blank = 0
            out.append(ln)
    return "\n".join(out).strip()


class _BytesIO:
    def __init__(self, b: bytes):
        import io

        self._bio = io.BytesIO(b)

    def __getattr__(self, item):
        return getattr(self._bio, item)

