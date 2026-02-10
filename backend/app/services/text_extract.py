from __future__ import annotations

from dataclasses import dataclass

from pypdf import PdfReader

try:
    import docx  # python-docx
except Exception:  # pragma: no cover
    docx = None


@dataclass(frozen=True)
class ExtractResult:
    text: str
    method: str
    page_count: int | None = None


def extract_text_from_pdf(data: bytes) -> ExtractResult:
    reader = PdfReader(io_bytes := _BytesIO(data))
    parts: list[str] = []
    for i, page in enumerate(reader.pages, start=1):
        try:
            t = page.extract_text() or ""
        except Exception:
            t = ""
        if t.strip():
            parts.append(f"[PAGE {i}]\n{t}")
    txt = "\n\n".join(parts).strip()
    return ExtractResult(text=txt, method="pypdf", page_count=len(reader.pages))


def extract_text_from_docx(data: bytes) -> ExtractResult:
    if docx is None:
        raise RuntimeError("python-docx not installed")
    d = docx.Document(_BytesIO(data))
    parts = [p.text for p in d.paragraphs if p.text and p.text.strip()]
    return ExtractResult(text="\n".join(parts).strip(), method="python-docx", page_count=None)


class _BytesIO:
    # Minimal BytesIO to avoid importing io in hotpath with pypdf
    def __init__(self, b: bytes):
        import io

        self._bio = io.BytesIO(b)

    def __getattr__(self, item):
        return getattr(self._bio, item)

