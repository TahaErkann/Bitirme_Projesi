/**
 * Genel yardımcı fonksiyonlar.
 */

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

/** Hata objesinden anlamlı bir TR mesaj çıkarır. */
export function extractErrorMessage(err: unknown, fallback = 'Beklenmeyen bir hata oluştu.'): string {
  // axios hatası standart şekli
  // @ts-expect-error - dynamic
  const axiosMsg = err?.response?.data?.message;
  if (typeof axiosMsg === 'string' && axiosMsg.length > 0) {
    return axiosMsg;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
}

/** YouTube video uri'sini cihazın YouTube uygulamasında açmak için. */
export function youTubeIntent(videoId: string): string {
  return `vnd.youtube://${videoId}`;
}
