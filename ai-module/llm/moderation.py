"""İçerik moderasyonu — yüklenen görselin uygulamanın amacıyla bağdaşıp
bağdaşmadığını OCR sonrası belirler (yükleme kontrol mekanizması).

Pipeline'da `run_ocr` ile `check_duplicate` arasında çalışan `moderate_content`
task'ı bu modülü kullanır. İki sinyal birleştirilir:

  1) LLM metin sınıflandırması (`moderate_text`) — OCR metnine bakarak içeriğin
     bir tarihi/turistik/kültürel YER/KİŞİ/OLAY/ESER tabelası mı, yoksa
     alakasız (reklam, e-posta/kişisel mesaj, rastgele not) veya GÜVENSİZ
     (küfür/nefret/cinsel/şiddet/kişisel veri) içerik mi olduğunu söyler.
  2) Google Vision SafeSearch + etiketler — OCR ile AYNI çağrıda gelir; metin
     olmadan da uygunsuz görseli yakalar ve metinsiz doğa/hayvan fotoğrafları
     için red gerekçesini zenginleştirir.

`decide_moderation` bu sinyalleri birleştirip karar döndürür. Tasarım kararı:
tabelanın TANIMLAYICI özelliği METNİDİR; bu yüzden "okunabilir tabela metni
yok" tek başına red sebebidir (doğa/hayvan vb. burada elenir), metin varsa
alaka kararını LLM verir, güvenlik ise hem Vision hem LLM ile çapraz kontrol
edilir.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

logger = logging.getLogger("jourex.llm.moderation")

# İngilizce yazıldı (Gemini/Groq prompt dilini yanıt diline taşıyabiliyor —
# §7.16 dersi). Çıktı JSON; "reason" alanı Türkçe istenir, gerisi makine için.
MODERATION_SYSTEM_PROMPT = """You are a STRICT content moderator for "JourEx", an app where tourists photograph HISTORICAL / CULTURAL / TOURISTIC information signs: plaques, monuments, museum labels, and signboards that DESCRIBE a place, a historical figure, an event, a religious or natural landmark, or an artwork.

You are given ONLY the OCR text extracted from an uploaded image. Decide whether this content belongs in the app.

Return ONLY a JSON object (no markdown, no prose, no code fences) with EXACTLY this schema:
{
  "is_relevant": boolean,
  "is_safe": boolean,
  "content_type": "heritage_sign" | "place_info" | "event_or_institution" | "other_irrelevant" | "profanity_hate" | "personal_communication" | "advertisement" | "random_text" | "empty",
  "reason": string,
  "confidence": number
}

Field rules:
- "is_relevant": true ONLY if the text is an INFORMATIONAL/heritage sign that DESCRIBES a historical, cultural or touristic subject - e.g. the history/description of a place, a historical or cultural figure, a historical event, a monument, a museum exhibit label, a religious or natural landmark, a castle/palace/bridge/fountain/tomb, or an artwork. Merely MENTIONING a place or institution NAME is NOT enough - the text must actually INFORM about its history, culture or touristic value. Otherwise false.
- "is_safe": false if the text contains profanity, insults, hate speech, sexual content, violent threats, or exposed personal/private data (emails, phone numbers, ID numbers, private chat messages). Otherwise true.
- "content_type": pick the single best label. Use "empty" if the text is blank or just a few meaningless characters.
- "reason": ONE short sentence IN TURKISH explaining your decision.
- "confidence": your confidence from 0.0 to 1.0.

Decision guidance (STRICT - when in doubt, set is_relevant=false):
- ACCEPT genuine heritage/place INFORMATION even if brief. Short names like "Taşköprü", "Mimar Sinan", "Malazgirt Savaşı" ARE relevant when they identify a historical place/person/event. A modern museum label or a tourist information board IS relevant - the subject does NOT have to be ancient.
- REJECT (is_relevant=false), EVEN IF a place or institution name appears, when the text is:
  - an event/ceremony/welcome banner (e.g. graduation, conference, opening, "hoş geldiniz" / "welcome");
  - operational, directional or promotional signage of a modern institution (university, school, hospital, stadium, municipality, office, shop, restaurant);
  - a celebration / congratulation / joke / personal placard, a poster, a slogan, a meme, song lyrics, or homework;
  - an advertisement, menu, receipt, product label, or a personal message/email/chat.
- Example: "FIRAT ÜNİVERSİTESİ - GENEL MEZUNİYET TÖRENİNE HOŞ GELDİNİZ ... KISA DEVRE YAPMADI MEZUN OLDU" -> is_relevant=false, content_type="event_or_institution". It only names a university and announces a graduation event; it does NOT inform about a historical/touristic subject.
- A plain commercial shop name or brand with no heritage information is NOT relevant.
- Judge ONLY by the given text. Do not invent context.
"""

# content_type → frontend red gerekçesi kodu (i18n anahtarına eşlenir).
_CONTENT_TYPE_REASON_CODE = {
    "advertisement": "advertisement",
    "personal_communication": "personal",
    "profanity_hate": "unsafe",
    "random_text": "irrelevant",
    "other_irrelevant": "irrelevant",
    "event_or_institution": "irrelevant",
    "empty": "no_text",
}

# SafeSearch seviyeleri sıralı (eşik karşılaştırması için).
_SAFE_LEVELS = ["VERY_UNLIKELY", "UNLIKELY", "POSSIBLE", "LIKELY", "VERY_LIKELY"]


def _meaningful_len(text: str | None) -> int:
    """Boşluk/noktalama dışı (harf+rakam, tüm alfabeler) karakter sayısı.

    Doğa/hayvan gibi metinsiz görsellerde OCR ya boş ya da birkaç gürültü
    karakteri döndürür; bu ölçüt onları "okunabilir tabela metni yok"
    kategorisine indirir.
    """
    if not text:
        return 0
    return len(re.sub(r"[\W_]+", "", text, flags=re.UNICODE))


def _top_labels(labels: list[dict[str, Any]] | None, *, n: int = 3, min_score: float = 0.6) -> str:
    """Vision etiketlerinden yüksek skorlu ilk n tanesini virgülle birleştirir.

    Metinsiz görsel reddinde gerekçeyi zenginleştirmek için kullanılır
    (örn. "algılanan içerik: Cat, Wildlife"). Etiket sırası Vision skoruna göre
    gelir; düşük skorlu gürültü elenir.
    """
    if not labels:
        return ""
    picked = [
        str(lbl.get("description") or "").strip()
        for lbl in labels
        if float(lbl.get("score") or 0.0) >= min_score and lbl.get("description")
    ]
    return ", ".join(picked[:n])


def moderate_text(ocr_text: str, *, provider_name: str | None = None) -> dict[str, Any] | None:
    """OCR metnini LLM ile sınıflandırır. Başarısızsa None döner (fail-open
    kararını çağıran verir)."""
    from app.core.config import settings  # type: ignore

    from ai_module.llm.factory import get_categorization_provider

    chosen = provider_name or settings.llm_moderation_provider
    try:
        provider = get_categorization_provider(chosen)
        content = provider.chat(
            system=MODERATION_SYSTEM_PROMPT,
            user=ocr_text,
            json_mode=True,
        )
        data = json.loads(content)
        if not isinstance(data, dict):
            return None
        # Karar için kritik anahtarlar yoksa yanıtı GEÇERSİZ say → None döndür ki
        # decide_moderation'ın açık fail-open dalına yönlensin (sessizce "is_safe/
        # is_relevant=True varsayıp kabul etme" tuzağını kapatır).
        if "is_relevant" not in data or "is_safe" not in data:
            logger.warning("Moderasyon LLM yanıtı eksik anahtar içeriyor: %r", data)
            return None
        return data
    except Exception as exc:  # pragma: no cover - ağ/kota/parse
        logger.warning("Moderasyon LLM sınıflandırması başarısız (%s): %s", chosen, exc)
        return None


def _safe_search_unsafe(safe_search: dict[str, Any] | None, block_level: str) -> bool:
    """SafeSearch'te adult/violence/racy alanlarından biri engel eşiğini aşıyor mu?"""
    if not safe_search:
        return False
    try:
        threshold = _SAFE_LEVELS.index(block_level.upper())
    except ValueError:
        threshold = _SAFE_LEVELS.index("LIKELY")
    for key in ("adult", "violence", "racy"):
        level = str(safe_search.get(key) or "").upper()
        if level in _SAFE_LEVELS and _SAFE_LEVELS.index(level) >= threshold:
            return True
    return False


def _accept(text_result: dict[str, Any] | None) -> dict[str, Any]:
    tr = text_result or {}
    return {
        "rejected": False,
        "reason_code": None,
        "reason": tr.get("reason") or "",
        "content_type": tr.get("content_type"),
        "is_relevant": bool(tr.get("is_relevant", True)),
        "is_safe": bool(tr.get("is_safe", True)),
        "confidence": float(tr.get("confidence") or 0.0),
    }


def _reject(
    reason_code: str,
    reason: str,
    text_result: dict[str, Any] | None,
) -> dict[str, Any]:
    tr = text_result or {}
    return {
        "rejected": True,
        "reason_code": reason_code,
        "reason": reason,
        "content_type": tr.get("content_type"),
        "is_relevant": bool(tr.get("is_relevant", False)),
        "is_safe": bool(tr.get("is_safe", True)),
        "confidence": float(tr.get("confidence") or 0.0),
    }


def decide_moderation(
    *,
    text_result: dict[str, Any] | None,
    cleaned_text: str,
    labels: list[dict[str, Any]] | None,
    safe_search: dict[str, Any] | None,
    min_text_chars: int,
    safe_search_block: str,
    fail_open: bool,
) -> dict[str, Any]:
    """Metin (LLM) + görsel (Vision) sinyallerini birleştirip karar döndürür.

    Karar sırası:
      1) GÜVENLİK — Vision SafeSearch VEYA LLM is_safe=false → reddet (unsafe).
      2) METİN YOK — anlamlı metin eşiğin altında → reddet (no_text). Doğa/hayvan
         vb. metinsiz görseller buradan elenir.
      3) LLM ERİŞİLEMEDİ ama metin var — fail_open: kabul; değilse reddet.
      4) ALAKA — LLM is_relevant=false → reddet (content_type'a göre kod).
      5) Aksi halde kabul.
    """
    llm_ok = isinstance(text_result, dict)
    is_relevant = bool(text_result.get("is_relevant", True)) if llm_ok else True
    is_safe = bool(text_result.get("is_safe", True)) if llm_ok else True
    content_type = (text_result.get("content_type") if llm_ok else None) or "unknown"
    llm_reason = (text_result.get("reason") if llm_ok else "") or ""

    meaningful = _meaningful_len(cleaned_text) >= int(min_text_chars)
    unsafe_vision = _safe_search_unsafe(safe_search, safe_search_block)

    # 1) Güvenlik
    if unsafe_vision or (llm_ok and not is_safe):
        reason = llm_reason if (llm_ok and not is_safe) else "Görselde uygunsuz içerik tespit edildi."
        return _reject("unsafe", reason, text_result)

    # 2) Okunabilir tabela metni yok (doğa/hayvan/boş görsel). Eleme METNE
    # dayalıdır; Vision etiketleri yalnızca red gerekçesini zenginleştirir.
    if not meaningful:
        base = "Görselde okunabilir bir tabela metni bulunamadı."
        hint = _top_labels(labels)
        reason = f"{base} (algılanan içerik: {hint})" if hint else base
        return _reject("no_text", reason, text_result)

    # 3) LLM erişilemedi ama metin var → fail-open kararı
    if not llm_ok:
        if fail_open:
            logger.info("Moderasyon LLM erişilemedi; metin mevcut → fail-open kabul.")
            return _accept(None)
        return _reject("irrelevant", "İçerik doğrulanamadı.", None)

    # 4) Alaka
    if not is_relevant:
        code = _CONTENT_TYPE_REASON_CODE.get(content_type, "irrelevant")
        reason = llm_reason or "İçerik uygulamanın amacıyla bağdaşmıyor."
        return _reject(code, reason, text_result)

    # 5) Kabul
    return _accept(text_result)
