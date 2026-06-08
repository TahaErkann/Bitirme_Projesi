/**
 * useTTS — react-native-tts (cihaz yerel TTS motoru) hook'u.
 * Master prompt § 14: Sunucu TTS KURULMAYACAK.
 *
 * Davranış / çözülen sorunlar:
 *  - UZUN METİN (§ "Daha Fazla Bilgi" 500-1000 kelime): Android TextToSpeech'in
 *    `speak()` girişi ~4000 karakterle sınırlıdır. Bu sınır aşılınca native
 *    çağrı ERROR döner; react-native-tts'in speak promise'i REJECT eder. Promise
 *    yakalanmadığı için "Possible unhandled promise rejection" uyarısı çıkıyor
 *    ("Open debugger to view warnings" bandı) ve hiç ses çıkmıyordu. ÇÖZÜM:
 *    metni cümle sınırlarından ~3800 karakterlik parçalara bölüp sırayla
 *    kuyruğa atıyoruz (react-native-tts Android'de QUEUE_ADD kullanır →
 *    parçalar art arda kesintisiz okunur) ve her speak'i try/catch ile sarıyoruz.
 *  - `speaking` state'i parça sayacı (remainingRef) ile yönetilir: tts-finish
 *    HER parça için tetiklenir; yalnızca SON parça bitince speaking=false olur.
 *  - speak(): önce motorun init'ini bekler → stop'u await eder → (gerekiyorsa)
 *    dili ayarlar → küçük tampon → parçaları kuyruğa atar.
 *  - Seçilen dil cihazda YOKSA setDefaultLanguage patlar → en-US'e düşeriz.
 *  - busyRef art arda hızlı tıklamada yarış koşulunu engeller.
 */
import {useCallback, useEffect, useRef, useState} from 'react';
import Tts from 'react-native-tts';

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

// Android TextToSpeech.getMaxSpeechInputLength() tipik olarak 4000'dir; güvenli
// pay bırakıyoruz.
const MAX_TTS_CHARS = 3800;

/** Uzun metni cümle sınırlarından MAX_TTS_CHARS altı parçalara böler. */
function chunkText(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  if (clean.length <= MAX_TTS_CHARS) return [clean];

  // Latin (.!?), CJK (。！？) ve Arapça (؟) cümle sonlarını yakala.
  const sentences = clean.match(/[^.!?。！？؟]+[.!?。！？؟]*\s*/g) ?? [clean];
  const chunks: string[] = [];
  let cur = '';

  for (const s of sentences) {
    if ((cur + s).length > MAX_TTS_CHARS) {
      if (cur) {
        chunks.push(cur.trim());
        cur = '';
      }
      if (s.length > MAX_TTS_CHARS) {
        // Tek cümle bile çok uzunsa kelime bazlı böl.
        let rest = s;
        while (rest.length > MAX_TTS_CHARS) {
          let cut = rest.lastIndexOf(' ', MAX_TTS_CHARS);
          if (cut <= 0) cut = MAX_TTS_CHARS;
          chunks.push(rest.slice(0, cut).trim());
          rest = rest.slice(cut);
        }
        cur = rest;
      } else {
        cur = s;
      }
    } else {
      cur += s;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.filter(Boolean);
}

export function useTTS() {
  const [speaking, setSpeaking] = useState(false);
  const initialized = useRef(false);
  const readyRef = useRef(false);
  const initPromiseRef = useRef<Promise<unknown> | null>(null);
  const lastLangRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  // Kuyruktaki kalan parça sayısı — son parça bitince speaking=false.
  const remainingRef = useRef(0);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // getInitStatus motoru hazırlar; sonucunu saklıyoruz ki speak ilk çağrıda
    // init bitene kadar beklesin (yarış koşulunu önler). Hata olursa SESSİZCE
    // bayrak düşürüyoruz — console.warn KULLANMIYORUZ ki dev'de "Open debugger
    // to view warnings" bandı tetiklenmesin.
    initPromiseRef.current = Tts.getInitStatus()
      .then(() => {
        readyRef.current = true;
      })
      .catch(() => {
        readyRef.current = false;
      });

    const startSub = Tts.addEventListener('tts-start', () => setSpeaking(true));
    const finishSub = Tts.addEventListener('tts-finish', () => {
      remainingRef.current = Math.max(0, remainingRef.current - 1);
      if (remainingRef.current === 0) setSpeaking(false);
    });
    const cancelSub = Tts.addEventListener('tts-cancel', () => {
      remainingRef.current = 0;
      setSpeaking(false);
    });

    return () => {
      // react-native-tts'in addEventListener'ı çalışma zamanında bir
      // EmitterSubscription döndürür; paketin tip tanımı `void` dediği için
      // güvenli erişim (cast + optional chaining) kullanıyoruz.
      (startSub as any)?.remove?.();
      (finishSub as any)?.remove?.();
      (cancelSub as any)?.remove?.();
    };
  }, []);

  const speak = useCallback(async (text: string, lang = 'en-US') => {
    if (!text) return;
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      // 1) Motor init'inin tamamlanmasını bekle (ilk konuşmada kritik).
      if (initPromiseRef.current) {
        try {
          await initPromiseRef.current;
        } catch {
          // yutuldu — aşağıda son bir deneme yapılır
        }
      }
      if (!readyRef.current) {
        try {
          await Tts.getInitStatus();
          readyRef.current = true;
        } catch {
          // Cihazda hiç TTS motoru yok — sessizce çık.
          return;
        }
      }

      // 2) Önceki konuşmayı bitir ve bitmesini bekle.
      remainingRef.current = 0;
      try {
        await Tts.stop();
      } catch {
        // sessiz
      }

      // 3) Dil değiştiyse ayarla; cihazda o dil yoksa en-US'e düş.
      if (lang !== lastLangRef.current) {
        try {
          await Tts.setDefaultLanguage(lang);
          lastLangRef.current = lang;
        } catch {
          try {
            await Tts.setDefaultLanguage('en-US');
            lastLangRef.current = 'en-US';
          } catch {
            // dil hiç ayarlanamadı — engine varsayılan dille konuşmayı dener
          }
        }
      }

      // 4) Uzun metni parçalara böl; her parçayı kuyruğa at (QUEUE_ADD).
      //    Voice yüklemesi tamamlansın diye küçük tampon.
      const chunks = chunkText(text);
      if (chunks.length === 0) return;
      await wait(120);

      remainingRef.current = chunks.length;
      setSpeaking(true);
      for (const chunk of chunks) {
        try {
          // speak promise'i kuyruğa eklenince çözülür; reddi yutarak
          // "unhandled promise rejection" uyarısını engelliyoruz.
          await Tts.speak(chunk);
        } catch {
          // Tek parça başarısız olsa bile sayaç tts-finish ile düzeltilir;
          // burada en azından rejection'ı yutuyoruz.
        }
      }
    } finally {
      busyRef.current = false;
    }
  }, []);

  const stop = useCallback(() => {
    remainingRef.current = 0;
    setSpeaking(false);
    Tts.stop().catch(() => undefined);
  }, []);

  return {speak, stop, speaking};
}
