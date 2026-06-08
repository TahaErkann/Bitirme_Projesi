/**
 * Place endpoint istemcileri.
 */
import {api} from './api';
import {
  EnrichResponse,
  PlaceDetail,
  PlaceListResponse,
  TranslationResponse,
  VideosResponse,
  UUID,
} from '@/types';

export async function listPlaces(params: {
  country?: string;
  city?: string;
  category?: string;
  page?: number;
  page_size?: number;
}): Promise<PlaceListResponse> {
  const r = await api.get<PlaceListResponse>('/places', {params});
  return r.data;
}

export async function getPlace(id: UUID): Promise<PlaceDetail> {
  const r = await api.get<PlaceDetail>(`/places/${id}`);
  return r.data;
}

export async function translatePlace(id: UUID, lang: string): Promise<TranslationResponse> {
  const r = await api.get<TranslationResponse>(`/places/${id}/translate/${lang}`);
  return r.data;
}

export async function enrichPlace(id: UUID, lang: string): Promise<EnrichResponse> {
  const r = await api.post<EnrichResponse>(`/places/${id}/enrich`, {language_code: lang});
  return r.data;
}

export async function getVideos(id: UUID): Promise<VideosResponse> {
  const r = await api.get<VideosResponse>(`/places/${id}/videos`);
  return r.data;
}

export async function likePlace(id: UUID): Promise<{liked: boolean; like_count: number}> {
  const r = await api.post<{liked: boolean; like_count: number}>(`/places/${id}/like`);
  return r.data;
}

export async function savePlace(id: UUID): Promise<{saved: boolean}> {
  const r = await api.post<{saved: boolean}>(`/places/${id}/save`);
  return r.data;
}
