/**
 * Kullanıcıya özel liste istemcileri — beğeniler ve yüklemeler.
 */
import {api} from './api';
import {PlaceListItem} from '@/types';

/** Kullanıcının beğendiği yerler (Profil → Beğendiklerim). */
export async function getMyLiked(): Promise<PlaceListItem[]> {
  const r = await api.get<PlaceListItem[]>('/users/me/liked');
  return r.data;
}

/** Kullanıcının uygulamaya yüklediği yerler (Profil → Yüklediklerim). */
export async function getMyUploads(): Promise<PlaceListItem[]> {
  const r = await api.get<PlaceListItem[]>('/users/me/uploads');
  return r.data;
}
