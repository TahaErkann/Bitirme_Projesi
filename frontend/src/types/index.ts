/**
 * Backend response tipleri (DTO'lar).
 */

export type UUID = string;

export interface UserPublic {
  id: UUID;
  email: string;
  display_name: string;
  preferred_language: string;
  avatar_url?: string | null;
  role: 'user' | 'moderator' | 'admin';
  created_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
}

export interface AuthResponse {
  user: UserPublic;
  tokens: TokenPair;
}

// Pipeline durumları (master prompt § 11)
export type TaskStatus =
  | 'PENDING'
  | 'PREPROCESSING'
  | 'OCR_PROCESSING'
  | 'CHECKING_DUPLICATE'
  | 'CATEGORIZING'
  | 'COMPLETED'
  | 'DUPLICATE'
  | 'FAILED';

export interface UploadResponse {
  task_id: string;
  status: TaskStatus;
  image_id?: UUID | null;
}

export interface UploadStatusResponse {
  task_id: string;
  status: TaskStatus;
  progress: number;
  place_id?: UUID | null;
  duplicate_of?: UUID | null;
  error?: string | null;
}

export interface PlaceImage {
  id: UUID;
  image_url: string;
  thumbnail_url?: string | null;
  is_primary: boolean;
}

export interface OCRResult {
  raw_text: string;
  cleaned_text: string;
  detected_language?: string | null;
  confidence?: number | null;
}

export interface PlaceListItem {
  id: UUID;
  place_name: string;
  country?: string | null;
  city?: string | null;
  category?: string | null;
  primary_image_url?: string | null;
  like_count: number;
  view_count: number;
  liked?: boolean;
  created_at: string;
}

export interface PlaceDetail {
  id: UUID;
  place_name: string;
  country?: string | null;
  city?: string | null;
  district?: string | null;
  category?: string | null;
  original_text: string;
  summary?: string | null;
  tags?: string[] | null;
  latitude?: number | null;
  longitude?: number | null;
  confidence_score?: number | null;
  view_count: number;
  like_count: number;
  is_verified: boolean;
  images: PlaceImage[];
  ocr_results: OCRResult[];
  created_at: string;
}

export interface PlaceListResponse {
  places: PlaceListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface TranslationResponse {
  place_id: UUID;
  language_code: string;
  translated_text: string;
  translated_summary?: string | null;
  cached: boolean;
}

export interface EnrichResponse {
  place_id: UUID;
  language_code: string;
  enriched_text: string;
  llm_provider: string;
  cached: boolean;
}

export interface YouTubeVideo {
  video_id: string;
  title: string;
  thumbnail_url: string;
  channel_title: string;
  deeplink: string;
  web_url: string;
}

export interface VideosResponse {
  place_id: UUID;
  videos: YouTubeVideo[];
}

export interface DiscoverFeedResponse {
  places: PlaceListItem[];
  next_cursor: string | null;
}
