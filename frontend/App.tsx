/**
 * JourEx — uygulama kök bileşeni.
 * Sıralama (önemli):
 *   GestureHandlerRootView → SafeAreaProvider → QueryClientProvider
 *   → PaperProvider → LanguageProvider → AuthProvider → AppNavigator
 *
 * Tema: antrasit gri ana renk + sıcak amber vurgu (utils/theme.ts).
 */
import React from 'react';
import {StatusBar, StyleSheet, View} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {PaperProvider} from 'react-native-paper';

import {AuthProvider} from '@/context/AuthContext';
import {LanguageProvider} from '@/context/LanguageContext';
import AppNavigator from '@/navigation/AppNavigator';
import {colors, paperTheme} from '@/utils/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {staleTime: 60_000, retry: 1},
  },
});

export default function App(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.root}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.bg}
          translucent={false}
        />
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <PaperProvider theme={paperTheme}>
              <LanguageProvider>
                <AuthProvider>
                  <AppNavigator />
                </AuthProvider>
              </LanguageProvider>
            </PaperProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.bg},
});
