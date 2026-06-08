/**
 * Görsel yükleme + task durumu polling.
 */
import {api} from './api';
import {UploadResponse, UploadStatusResponse} from '@/types';
import {UPLOAD_POLL_INTERVAL_MS, UPLOAD_POLL_MAX_ATTEMPTS} from '@/utils/constants';

/** Normalize crop dikdörtgeni (hepsi 0..1 arası). */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export async function uploadImage(
  localUri: string,
  mimeType = 'image/jpeg',
  crop?: CropRect,
): Promise<UploadResponse> {
  const form = new FormData();
  // RN multipart formdata: dosya {uri, name, type}
  form.append('image', {
    uri: localUri,
    name: localUri.split('/').pop() ?? 'photo.jpg',
    type: mimeType,
  } as unknown as Blob);

  // Crop verilirse 4 alanı da forma ekle. Backend dördünü birden bekler;
  // birinin eksikliği crop'u tamamen yoksayar.
  if (crop) {
    form.append('crop_x', String(crop.x));
    form.append('crop_y', String(crop.y));
    form.append('crop_w', String(crop.w));
    form.append('crop_h', String(crop.h));
  }

  const r = await api.post<UploadResponse>('/upload/image', form, {
    headers: {'Content-Type': 'multipart/form-data'},
    timeout: 60_000,
  });
  return r.data;
}

export async function getUploadStatus(taskId: string): Promise<UploadStatusResponse> {
  const r = await api.get<UploadStatusResponse>(`/upload/status/${taskId}`);
  return r.data;
}

/**
 * Pipeline tamamlanana kadar poll'lar; status COMPLETED|DUPLICATE|FAILED'ta döner.
 */
export async function pollUploadUntilDone(taskId: string): Promise<UploadStatusResponse> {
  for (let i = 0; i < UPLOAD_POLL_MAX_ATTEMPTS; i++) {
    const s = await getUploadStatus(taskId);
    if (s.status === 'COMPLETED' || s.status === 'DUPLICATE' || s.status === 'FAILED') {
      return s;
    }
    await new Promise(r => setTimeout(r, UPLOAD_POLL_INTERVAL_MS));
  }
  return {
    task_id: taskId,
    status: 'FAILED',
    progress: 0,
    error: 'Zaman aşımı',
  };
}
