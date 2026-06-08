/**
 * Keşfet endpoint istemcileri.
 */
import {api} from './api';
import {DiscoverFeedResponse, PlaceListItem} from '@/types';

export async function fetchFeed(params: {
  cursor?: string;
  limit?: number;
  country?: string;
}): Promise<DiscoverFeedResponse> {
  const r = await api.get<DiscoverFeedResponse>('/discover', {params});
  return r.data;
}

export async function fetchCategories(): Promise<string[]> {
  const r = await api.get<{categories: string[]}>('/discover/categories');
  return r.data.categories;
}

export async function fetchNearby(lat: number, lng: number, radius_km = 10): Promise<PlaceListItem[]> {
  const r = await api.get<{places: PlaceListItem[]}>('/discover/nearby', {
    params: {lat, lng, radius_km},
  });
  return r.data.places;
}
