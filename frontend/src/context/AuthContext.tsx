/**
 * AuthContext — global oturum durumu.
 * Uygulama açılışında Keychain'den token'ları okur, /users/me ile doğrular.
 */
import React, {createContext, useContext, useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, View} from 'react-native';
import {loadTokensFromKeychain, setAccessToken} from '@/services/api';
import {login as apiLogin, logout as apiLogout, me as apiMe} from '@/services/authService';
import {UserPublic} from '@/types';
import {colors} from '@/utils/theme';

interface AuthContextValue {
  user: UserPublic | null;
  isAuthenticated: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (u: UserPublic | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const tokens = await loadTokensFromKeychain();
        if (tokens) {
          setAccessToken(tokens.access);
          try {
            const u = await apiMe();
            setUser(u);
          } catch {
            // token geçersiz olabilir; sessizce çık
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      loading,
      setUser,
      signIn: async (email, password) => {
        const auth = await apiLogin(email, password);
        setUser(auth.user);
      },
      signOut: async () => {
        await apiLogout();
        setUser(null);
      },
    }),
    [user, loading],
  );

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.bg,
        }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
