/**
 * Auth servis çağrıları.
 */
import {api, persistTokens, clearTokens, setAccessToken} from './api';
import {AuthResponse, TokenPair, UserPublic} from '@/types';

export async function register(payload: {
  email: string;
  password: string;
  display_name: string;
  preferred_language?: string;
}): Promise<AuthResponse> {
  const r = await api.post<AuthResponse>('/auth/register', payload);
  await persistTokens(r.data.tokens.access_token, r.data.tokens.refresh_token);
  return r.data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const r = await api.post<AuthResponse>('/auth/login', {email, password});
  await persistTokens(r.data.tokens.access_token, r.data.tokens.refresh_token);
  return r.data;
}

export async function googleSignIn(idToken: string): Promise<AuthResponse> {
  const r = await api.post<AuthResponse>('/auth/google', {google_id_token: idToken});
  await persistTokens(r.data.tokens.access_token, r.data.tokens.refresh_token);
  return r.data;
}

export async function refresh(refreshToken: string): Promise<TokenPair> {
  const r = await api.post<TokenPair>('/auth/refresh', {refresh_token: refreshToken});
  await persistTokens(r.data.access_token, r.data.refresh_token);
  return r.data;
}

export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } catch {
    // sunucu erişilmezse de yereli temizle
  }
  setAccessToken(null);
  await clearTokens();
}

export async function me(): Promise<UserPublic> {
  const r = await api.get<UserPublic>('/users/me');
  return r.data;
}

export async function updateMe(payload: {
  display_name?: string;
  preferred_language?: string;
}): Promise<UserPublic> {
  const r = await api.put<UserPublic>('/users/me', payload);
  return r.data;
}

export async function changePassword(payload: {
  current_password: string;
  new_password: string;
}): Promise<{message: string}> {
  const r = await api.post<{message: string}>(
    '/users/me/change-password',
    payload,
  );
  return r.data;
}
