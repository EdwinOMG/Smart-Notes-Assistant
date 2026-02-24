# backend/preprocess.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional
import imghdr


PDF_MAGIC = b"%PDF"


@dataclass(frozen=True)
class PreprocessResult:
    data: bytes                # normalized bytes (pdf or image)
    mime_type: str             # "application/pdf" or "image/jpeg"/"image/png"
    was_converted: bool        # True if converted something
    note: str = ""             # debug/info


def _looks_like_pdf(data: bytes) -> bool:
    return data.startswith(PDF_MAGIC)


def _detect_image_type(data: bytes) -> Optional[str]:
    """
    Uses Python's stdlib imghdr. Returns 'jpeg', 'png', etc. or None.
    """
    kind = imghdr.what(None, h=data)
    return kind


def preprocess_upload(data: bytes, filename: str = "", content_type: str = "") -> PreprocessResult:
    """
    Normalize upload into a predictable format.

    MVP behavior (safe for a capstone):
    - If PDF: return as-is.
    - If image (jpeg/png): return as-is for now (no conversion yet).
      (Later you can convert image -> PDF and return application/pdf.)
    - Otherwise: raise ValueError.

    NOTE: This function does NOT touch disk and has no FastAPI deps.
    """
    if not data:
        raise ValueError("Empty file")

    # Prefer sniffing bytes over trusting content_type
    if _looks_like_pdf(data):
        return PreprocessResult(
            data=data,
            mime_type="application/pdf",
            was_converted=False,
            note="Detected PDF by header",
        )

    img_kind = _detect_image_type(data)
    if img_kind in ("jpeg", "png"):
        mime = f"image/{'jpeg' if img_kind == 'jpeg' else 'png'}"
        return PreprocessResult(
            data=data,
            mime_type=mime,
            was_converted=False,
            note=f"Detected image by header: {img_kind}",
        )

    # Fallback: sometimes browsers send content_type correctly
    if content_type == "application/pdf":
        return PreprocessResult(data=data, mime_type="application/pdf", was_converted=False, note="Used content_type")
    if content_type in ("image/jpeg", "image/png"):
        return PreprocessResult(data=data, mime_type=content_type, was_converted=False, note="Used content_type")

    raise ValueError(f"Unsupported file type. filename={filename!r}, content_type={content_type!r}")
