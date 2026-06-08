"""OCR sonrası metin temizliği (§ 6.1)."""
from __future__ import annotations

import re
import unicodedata


def clean_text(raw: str) -> str:
    """Unicode normalize, fazla boşlukları temizle, OCR artefaktlarını sil."""
    if not raw:
        return ""
    # Unicode NFC
    text = unicodedata.normalize("NFC", raw)

    # Yaygın OCR artefaktları
    text = text.replace(" ", " ")        # non-breaking space
    text = re.sub(r"[‹›«»“”]", '"', text)
    text = re.sub(r"[‘’]", "'", text)

    # Birden fazla boşluk → tek
    text = re.sub(r"[ \t]+", " ", text)

    # Birden fazla yeni satır → tek
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Satır içi gereksiz boşluklar
    lines = [line.strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line)
