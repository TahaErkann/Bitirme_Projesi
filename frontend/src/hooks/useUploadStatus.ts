/**
 * useUploadStatus — bir taskId verildiğinde pipeline'ı poll'lar.
 */
import {useEffect, useState} from 'react';
import {getUploadStatus} from '@/services/uploadService';
import {UploadStatusResponse} from '@/types';
import {UPLOAD_POLL_INTERVAL_MS} from '@/utils/constants';

export function useUploadStatus(taskId: string | null) {
  const [status, setStatus] = useState<UploadStatusResponse | null>(null);

  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      if (!taskId || cancelled) return;
      try {
        const s = await getUploadStatus(taskId);
        if (cancelled) return;
        setStatus(s);
        if (
          s.status === 'COMPLETED' ||
          s.status === 'DUPLICATE' ||
          s.status === 'REJECTED' ||
          s.status === 'FAILED'
        ) {
          return;
        }
      } catch {
        // ağ hatası — yeniden dene
      }
      timer = setTimeout(tick, UPLOAD_POLL_INTERVAL_MS);
    }
    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [taskId]);

  return status;
}
