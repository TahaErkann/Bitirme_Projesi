/**
 * Eksen Axios instance'ı + interceptor'lar:
 *  - Bearer token ekleme
 *  - 401 -> refresh dene -> başarısızsa logout
 */
import axios, {AxiosError, AxiosInstance, InternalAxiosRequestConfig} from 'axios';
import * as Keychain from 'react-native-keychain';
import {API_BASE_URL, KEYCHAIN_SERVICE} from '@/utils/constants';

let inMemoryAccessToken: string | null = null;

export function setAccessToken(token: string | null) {
  inMemoryAccessToken = token;
}

export async function loadTokensFromKeychain(): Promise<{
  access: string;
  refresh: string;
} | null> {
  const creds = await Keychain.getGenericPassword({service: KEYCHAIN_SERVICE});
  if (!creds) return null;
  try {
    const parsed = JSON.parse(creds.password);
    if (parsed.access && parsed.refresh) {
      inMemoryAccessToken = parsed.access;
      return parsed;
    }
  } catch {
    // bozuk kayıt
  }
  return null;
}

export async function persistTokens(access: string, refresh: string) {
  inMemoryAccessToken = access;
  await Keychain.setGenericPassword(
    'tokens',
    JSON.stringify({access, refresh}),
    {service: KEYCHAIN_SERVICE},
  );
}

export async function clearTokens() {
  inMemoryAccessToken = null;
  await Keychain.resetGenericPassword({service: KEYCHAIN_SERVICE});
}

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (inMemoryAccessToken) {
    config.headers.set('Authorization', `Bearer ${inMemoryAccessToken}`);
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const creds = await Keychain.getGenericPassword({service: KEYCHAIN_SERVICE});
      if (!creds) return null;
      const parsed = JSON.parse(creds.password);
      const resp = await axios.post(
        `${API_BASE_URL}/auth/refresh`,
        {refresh_token: parsed.refresh},
        {timeout: 15_000},
      );
      const access = resp.data.access_token as string;
      const refresh = resp.data.refresh_token as string;
      await persistTokens(access, refresh);
      return access;
    } catch {
      await clearTokens();
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

api.interceptors.response.use(
  r => r,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {_retry?: boolean};
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes('/auth/refresh')
    ) {
      original._retry = true;
      const newAccess = await tryRefresh();
      if (newAccess) {
        original.headers.set('Authorization', `Bearer ${newAccess}`);
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);
