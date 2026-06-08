"""Görsel ön işleme (§ 6.1).

Adımlar:
  - (Opsiyonel) crop — kullanıcının seçtiği bölge
  - Maks 4096px resize (Vision API ~20MB sınırı + bant genişliği için)
  - JPEG yeniden kodlama (kalite 95)

NOTE — Aggressive preprocessing kaldırıldı (2026-05-25):
  Eski pipeline grayscale + CLAHE + deskew + denoise yapıyordu. Bu set
  **Tesseract** OCR için optimize edilmiş bir kalıp — biz **Google Cloud
  Vision** kullanıyoruz, ki Vision in-the-wild renkli fotoğraflar için
  eğitilmiş ve kendi içinde otomatik preprocessing yapıyor.

  Özellikle eski `_deskew` fonksiyonu `cv2.minAreaRect`'i TÜM karanlık
  piksellere (gray < 128) uyduruyordu. Tabela fotoğraflarında bu küme
  text'in oryantasyonuyla alakasız (taş, sky shadow, bitki örtüsü) olduğu
  için rastgele açılarla döndürüyor, OCR'ı bozuyordu.

  Vision API'ye orijinal renkli görseli minimum müdahaleyle göndermek
  daha doğru sonuç veriyor.

OpenCV bağımlılığı korundu (gelecekteki cv2 ihtiyaçları için import'ta;
şu an aktif kullanılmıyor).
"""
from __future__ import annotations

import io
import logging

from PIL import Image

logger = logging.getLogger("tourlens.ocr.preprocessor")

MAX_DIM = 4096
JPEG_QUALITY = 95


def preprocess_bytes(
    image_bytes: bytes,
    *,
    crop: tuple[float, float, float, float] | None = None,
) -> bytes:
    """Görsel byte'larını alıp Vision API'ye gönderilecek JPEG byte'larını döner.

    Args:
        image_bytes: orijinal görsel byte'ları.
        crop: opsiyonel `(x, y, w, h)` — hepsi 0..1 normalize. Verilirse OCR
              sadece bu bölgeyi görür; kullanıcının "tabela neresinde?"
              kararını backend'e taşıyan kontrat.
    """
    pil = Image.open(io.BytesIO(image_bytes))
    # EXIF rotation'ı uygula (telefon fotoğraflarında yaygın)
    pil = _apply_exif_orientation(pil)
    if pil.mode != "RGB":
        pil = pil.convert("RGB")

    # Crop (kullanıcı seçimi)
    if crop is not None:
        cw, ch = pil.size
        x_n, y_n, w_n, h_n = crop
        x_n = max(0.0, min(1.0, float(x_n)))
        y_n = max(0.0, min(1.0, float(y_n)))
        w_n = max(0.0, min(1.0 - x_n, float(w_n)))
        h_n = max(0.0, min(1.0 - y_n, float(h_n)))
        if w_n > 0.05 and h_n > 0.05:
            left = int(round(x_n * cw))
            top = int(round(y_n * ch))
            right = int(round((x_n + w_n) * cw))
            bottom = int(round((y_n + h_n) * ch))
            pil = pil.crop((left, top, right, bottom))
            logger.info(
                "Crop uygulandı: %dx%d → %dx%d",
                cw, ch, pil.size[0], pil.size[1],
            )

    # Resize (Vision API'ye gönderilen payload'u makul tut)
    if max(pil.size) > MAX_DIM:
        pil.thumbnail((MAX_DIM, MAX_DIM), Image.LANCZOS)

    # JPEG encode — yüksek kaliteyle Vision'a gönder
    out = io.BytesIO()
    pil.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    logger.info(
        "Preprocess tamamlandı: %dx%d, %d bytes",
        pil.size[0], pil.size[1], out.tell(),
    )
    return out.getvalue()


def _apply_exif_orientation(pil: Image.Image) -> Image.Image:
    """EXIF Orientation tag'ini uygula — telefon fotoğrafları çoğu zaman
    sensör yönünde kaydedilir ve EXIF ile döndürülmek üzere işaretlenir.
    Vision OCR'a göndermeden önce bu rotasyonu materialize ediyoruz."""
    try:
        from PIL import ImageOps  # local import — modül yükleme süresini etkilemesin
        return ImageOps.exif_transpose(pil)
    except Exception as exc:  # pragma: no cover
        logger.debug("EXIF orientation uygulanamadı: %s", exc)
        return pil
