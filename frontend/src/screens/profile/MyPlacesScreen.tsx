/**
 * MyPlacesScreen — kullanıcının beğendiği veya yüklediği yerlerin listesi.
 *
 * route.params.mode:
 *   - 'liked'   → Profil → Beğendiklerim
 *   - 'uploads' → Profil → Yüklediklerim ("uygulamaya katkılarım")
 *
 * Ekran her odaklandığında listeyi yeniler (yeni beğeni/yükleme hemen görünür).
 */
import React, {useCallback, useLayoutEffect, useState} from 'react';
import {ActivityIndicator, FlatList, RefreshControl, StyleSheet, View} from 'react-native';
import {Text} from '@/components/AppText';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';

import {getMyLiked, getMyUploads} from '@/services/userService';
import {PlaceListItem} from '@/types';
import PlaceCard from '@/components/PlaceCard';
import Skeleton from '@/components/Skeleton';
import {useLanguage} from '@/context/LanguageContext';
import {colors, spacing, typography} from '@/utils/theme';

type Mode = 'liked' | 'uploads';

const MyPlacesScreen: React.FC<{route: any; navigation: any}> = ({route, navigation}) => {
  const {t} = useLanguage();
  const mode: Mode = route.params?.mode === 'uploads' ? 'uploads' : 'liked';

  const [items, setItems] = useState<PlaceListItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const titleKey = mode === 'uploads' ? 'myplaces.uploadsTitle' : 'myplaces.likedTitle';
  const emptyKey = mode === 'uploads' ? 'myplaces.uploadsEmpty' : 'myplaces.likedEmpty';
  const emptySubKey =
    mode === 'uploads' ? 'myplaces.uploadsEmptySub' : 'myplaces.likedEmptySub';
  const emptyIcon = mode === 'uploads' ? 'cloud-upload' : 'favorite';

  useLayoutEffect(() => {
    navigation.setOptions({title: t(titleKey)});
  }, [navigation, t, titleKey]);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = mode === 'uploads' ? await getMyUploads() : await getMyLiked();
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setRefreshing(false);
    }
  }, [mode]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        contentContainerStyle={styles.feed}
        data={items ?? []}
        keyExtractor={i => i.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={load}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        renderItem={({item}) => (
          <PlaceCard
            place={item}
            onPress={id => navigation.navigate('PlaceDetail', {placeId: id})}
          />
        )}
        ListEmptyComponent={
          items === null ? (
            <View style={{gap: spacing(1.5)}}>
              {[0, 1].map(i => (
                <View key={i} style={styles.skelCard}>
                  <Skeleton height={200} rounded="md" />
                  <Skeleton width="60%" height={16} style={{marginTop: 12}} />
                  <Skeleton width="40%" height={12} style={{marginTop: 6}} />
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconWrap}>
                <Icon name={emptyIcon} size={34} color={colors.accent} />
              </View>
              <Text
                style={[
                  typography.h3,
                  {color: colors.textPrimary, marginTop: spacing(1.5)},
                ]}>
                {t(emptyKey)}
              </Text>
              <Text
                style={[
                  typography.body,
                  {
                    color: colors.textSecondary,
                    textAlign: 'center',
                    marginTop: 4,
                  },
                ]}>
                {t(emptySubKey)}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          refreshing && items && items.length > 0 ? (
            <View style={{paddingVertical: spacing(2), alignItems: 'center'}}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.bg},
  feed: {paddingHorizontal: spacing(2), paddingVertical: spacing(2), flexGrow: 1},
  skelCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing(1.5),
    marginBottom: spacing(1.5),
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing(8),
    paddingHorizontal: spacing(3),
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default MyPlacesScreen;
