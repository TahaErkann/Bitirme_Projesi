"""Groq API (openai/gpt-oss-120b) — kategorizasyon + içerik moderasyonu için (§ 6.2)."""
from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from ai_module.llm.base_provider import CategorizationProvider

logger = logging.getLogger("tourlens.llm.groq")

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

CATEGORIZATION_SYSTEM_PROMPT = """Sen turistik/tarihi tabela metinlerini analiz eden bir uzmansın.
Verilen OCR metnine bakarak SADECE aşağıdaki JSON şemasında çıktı üret.
Kesinlikle ek açıklama, markdown, kod bloğu kullanma.

============================================================
MUTLAK KURAL — OCR METNİNE BAĞLI KAL, ASLA TAHMİN YAPMA
============================================================
`country`, `city`, `district`, `place_name`, `category` alanlarını YALNIZCA
OCR metninde **AÇIKÇA GEÇEN** bilgilere dayanarak doldur. Asla dünya
bilgisinden uydurma yapma.

  ❌ YANLIŞ: OCR "TAŞKÖPRÜ" diyor → sen "İzmir Kemer Köprüsü" yazıyorsun.
     ASLA YAPMA. Kemer İzmir'de yazmıyorsa bu Adana Taş Köprü olabilir,
     başka bir Taşköprü olabilir — BİLEMEZSİN.
  ✓  DOĞRU: OCR "TAŞKÖPRÜ" diyor → place_name="Taşköprü", city=null
     (çünkü metinde şehir adı yok), country="Türkiye" yalnızca Türkçe
     yazılmışsa.

  ❌ YANLIŞ: OCR sadece "MİMAR SİNAN" diyor → sen "Doğum: 1490, Kayseri"
     gibi tarih/yer ekliyorsun. ASLA YAPMA.
  ✓  DOĞRU: place_name="Mimar Sinan", city=null, district=null. summary
     alanında SADECE OCR'da yazanı kısaca özetle.

Eğer bir alan metinde geçmiyorsa o alanı:
  - String alanlar (country, city, place_name): null veya boş ""
  - Liste (tags): []

Yalnızca metinde geçen şehir/ilçe adlarını al. "Adana" yazıyorsa city
"Adana", yazmıyorsa null. Türkçe karakter setine bakarak country="Türkiye"
varsayımı YAPMA — sadece "Türkiye" / "Turkey" / "TR" yazıyorsa.

============================================================
ÖNEMLİ — METİNDE GEÇEN YER ADLARINI MUTLAKA ÇIKAR
============================================================
"Asla tahmin yapma" kuralı YALNIZCA metinde OLMAYAN bilgi içindir. Metinde
AÇIKÇA GEÇEN her yer adını (ülke, şehir, ilçe, semt, bölge, mahalle) ilgili
alana MUTLAKA yaz; metinde geçen bir yeri boş bırakmak HATADIR.
  ✓ OCR "... Harput, Elazığ ..." içeriyorsa → city="Elazığ", district="Harput".
  ✓ OCR "Çubuk Bey ... Harput" diyorsa → place_name="Çubuk Bey",
    district="Harput" (çünkü Harput metinde geçiyor).
  ✓ OCR "Gebze" içeriyorsa → district="Gebze", city="Kocaeli" (Gebze Kocaeli'ye
    bağlı bir ilçedir — Harput→Elazığ ile aynı mantık). Metinde bir ilçe/semt
    BİRDEN FAZLA kez geçiyorsa (örn. "Gebze Belediyesi", "Gebze'de") bu yerin
    asıl konumu odur; MUTLAKA çıkar, boş bırakma.
  ✓ Metinde hem büyük birim (il) hem küçük birim (ilçe/semt) geçiyorsa:
    büyük olan city, küçük olan district. Sadece biri geçiyorsa onu uygun
    alana yaz, diğerini null bırak.
Özet: bir yer adı metinde YOKSA null bırak; VARSA mutlaka ilgili alana çıkar.
Bu iki durumu birbirine karıştırma.

============================================================
BİRDEN FAZLA YER GEÇİYORSA — DOĞRU city/district SEÇİMİ
============================================================
Metinde birden çok şehir/il geçebilir (örn. bir kişinin doğduğu, görev
yaptığı, savaştığı veya fethettiği farklı yerler). city alanı, TABELANIN/
ANITIN ASIL KONULANDIĞI veya konunun ASIL BAĞLI OLDUĞU yerdir:
  - district doluysa, city o ilçenin BAĞLI OLDUĞU İLDİR.
    Örn: district="Harput" → Harput Elazığ'a bağlıdır → city="Elazığ"
    (Diyarbakır DEĞİL).
  - Kişinin/konunun BAŞKA bir şehirle ilişkisi (örn. "Diyarbakır valisi
    oldu", "İstanbul'da öldü") city'yi DEĞİŞTİRMEZ; bu bilgi yalnızca
    summary'de geçebilir.
  ✓ Örnek: "Çubuk Bey, Harput'u (Elazığ) fethetti, sonra Diyarbakır valisi
    oldu." → city="Elazığ", district="Harput"; Diyarbakır SADECE summary'de.
  ✗ Aynı metinde city="Diyarbakır" yazmak HATADIR (tabela Harput/Elazığ'a ait).

============================================================
KATEGORİ SEÇİMİ — METNE BAKARAK
============================================================
Tabela METNİNDE asıl konu nedir? Bir bina mı, bir doğa olgusu mu, bir
KİŞİ mi (devlet adamı, sanatçı, alim, komutan), bir OLAY mı (savaş,
antlaşma), yoksa bir ESER mi (heykel, tablo, kitabe)?
Tabela bir kişiyi tanıtıyorsa kategori "Tarihi Şahsiyet"; bir savaşı/olayı
anlatıyorsa "Tarihi Olay"; bir heykel/anıt ise "Heykel" veya "Anıt"; bir
köprü ise "Köprü"; bir bina/yapı ise "Tarihi Yapı".
ASLA varsayılan olarak her şeyi "Tarihi Yapı" yapma.

İzin verilen kategori değerleri (yalnızca biri):
  "Tarihi Yapı", "Tarihi Şahsiyet", "Tarihi Olay", "Heykel", "Anıt",
  "Müze", "Cami", "Kilise", "Manastır", "Saray", "Kale", "Türbe",
  "Çeşme", "Köprü", "Han", "Hamam", "Kütüphane", "Park", "Doğal Oluşum",
  "Plaj", "Sanat Eseri", "Diğer"

============================================================
place_name kuralı
============================================================
  - Tabela bir KİŞİ hakkındaysa kişinin tam adını yaz (örn. "Çubuk Bey",
    "Mimar Sinan").
  - Tabela bir OLAY hakkındaysa olayın adını yaz (örn. "Malazgirt Savaşı").
  - Tabela bir YAPI hakkındaysa yapının metinde geçen adını yaz (örn.
    "Sultan Ahmet Camii", "Taşköprü"). Eğer metinde sadece "TAŞKÖPRÜ"
    yazıyorsa place_name="Taşköprü"; "ADANA TAŞKÖPRÜ" yazıyorsa
    "Adana Taşköprü". METİNDE NE VARSA O.
  - place_name tabelanın ANA KONUSUDUR — genellikle BAŞLIKTA / en üstte,
    büyük harflerle yazılan addır. Metnin içinde geçen İKİNCİL adları
    place_name OLARAK SEÇME: bir yerin "halk dilinde / halk arasında ...
    olarak bilinen" adı, eski adı, lakabı, ya da yalnızca konumu tarif eden
    ibareler ANA KONU DEĞİLDİR.
  ✓ Örnek: Tabela "MALKOÇOĞLU MEHMET BEY ... türbeye (Kümbet'e) gömülmüştür.
    Burası halk dilinde Kırgızlar Mezarlığı olarak bilinir." →
    place_name="Malkoçoğlu Mehmet Bey" (ANA konu), category="Türbe".
    ✗ place_name="Kırgızlar Mezarlığı" YANLIŞTIR — bu yalnızca yerin halk
    arasındaki ikincil adıdır; en fazla summary'de geçebilir.

============================================================
summary kuralı
============================================================
1-2 cümle Türkçe özet — yalnızca OCR metninde GEÇEN bilgilerden türet.
Metinde yer almayan tarihi, mimari, coğrafi detay EKLEME. Eğer OCR metni
çok kısaysa (örn. sadece bir isim) summary o ismi açıklayan SADECE tabela
metnindeki cümleleri özetlesin. Yoksa boş bırak.

============================================================
confidence_score kuralı
============================================================
OCR metni temiz ve net bir tabela ifadesi içeriyorsa 0.8-1.0.
Metin parçalı / okunaksız / az içeriyorsa 0.3-0.6.
Metin çok az veya anlamsızsa 0.0-0.3.

============================================================
ÇIKTI ŞEMASI
============================================================
{
  "country": string | null,       // metinde geçiyorsa, yoksa null
  "city": string | null,          // metinde geçiyorsa, yoksa null
  "district": string | null,      // metinde geçiyorsa, yoksa null
  "place_name": string,           // metinde geçen ad
  "category": string,             // YALNIZCA yukarıdaki listeden bir değer
  "summary": string,              // sadece metinden türetilmiş, yoksa ""
  "tags": string[],               // 3-6 anahtar kelime — metinden
  "confidence_score": number      // 0.00 - 1.00 arası
}
"""


class GroqProvider(CategorizationProvider):
    name = "groq"

    def __init__(self, api_key: str, model: str) -> None:
        self.api_key = api_key
        self.model = model

    def chat(
        self, *, system: str, user: str, json_mode: bool = False, temperature: float = 0.2
    ) -> str:
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        body = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": temperature,
        }
        if json_mode:
            body["response_format"] = {"type": "json_object"}

        with httpx.Client(timeout=30.0) as client:
            resp = client.post(GROQ_API_URL, headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()
        return data["choices"][0]["message"]["content"]

    def categorize(self, ocr_text: str) -> dict[str, Any]:
        try:
            # temperature=0 → kategori/şehir aynı girdi için deterministik olsun
            # (aynı tabelanın farklı yüklemelerinde Türbe/Tarihi Şahsiyet gibi
            # oynamaları en aza indirir).
            content = self.chat(
                system=CATEGORIZATION_SYSTEM_PROMPT,
                user=ocr_text,
                json_mode=True,
                temperature=0.0,
            )
            return json.loads(content)
        except (httpx.HTTPError, json.JSONDecodeError, KeyError) as exc:
            logger.warning("Groq kategorizasyon hatası: %s", exc)
            # Düşük güven ile boş cevap — pipeline ileride manuel akışa düşürür.
            return {
                "country": None, "city": None, "district": None,
                "place_name": "", "category": None, "summary": "",
                "tags": [], "confidence_score": 0.0,
            }
