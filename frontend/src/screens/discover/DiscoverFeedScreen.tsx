/**
 * DiscoverFeedScreen — "Tarihi Doku" topluluk feed'i.
 * - ScreenHeader (altın overline + serif başlık + harita pill aksiyonu)
 * - Kategori filtre chip'leri (seçili: zeytin yeşili dolgu + krem metin)
 * - OrnamentalDivider ile bölüm ayracı
 * - Sonsuz scroll + RefreshControl + skeleton/boş/footer halleri
 * Ekran odaklandığında en güncel listeyi çeker; yeni yüklenenler hemen görünür.
 */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import {Text} from '@/components/AppText';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';

import {fetchCategories, fetchFeed} from '@/services/discoverService';
import {PlaceListItem} from '@/types';
import PlaceCard from '@/components/PlaceCard';
import Skeleton from '@/components/Skeleton';
import ScreenHeader from '@/components/ScreenHeader';
import OrnamentalDivider from '@/components/OrnamentalDivider';
import {useLanguage} from '@/context/LanguageContext';
import {translateCategory} from '@/utils/i18n';
import {colors, radius, shadow, spacing, typography} from '@/utils/theme';

const DiscoverFeedScreen: React.FC<{navigation: any}> = ({navigation}) => {
  const {t, lang} = useLanguage();
  const [items, setItems] = useState<PlaceListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [done, setDone] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    fetchCategories()
      .then(setCategories)
      .catch(() => undefined);
  }, [fade]);

  const fetchFirst = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await fetchFeed({limit: 20});
      setItems(r.places);
      setCursor(r.next_cursor);
      setDone(!r.next_cursor);
    } catch {
      // ağ hatası — sessizce yut
    } finally {
      setRefreshing(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loading || done || refreshing) return;
    setLoading(true);
    try {
      const r = await fetchFeed({
        cursor: cursor ?? undefined,
        limit: 20,
      });
      setItems(prev => [...prev, ...r.places]);
      if (r.next_cursor) setCursor(r.next_cursor);
      else setDone(true);
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, done, refreshing]);

  // Ekran odaklandığında en güncel veriyi çek (yeni yüklenenler dahil)
  useFocusEffect(
    useCallback(() => {
      fetchFirst();
    }, [fetchFirst]),
  );

  const filtered = useMemo(
    () =>
      activeCat
        ? items.filter(i => (i.category ?? '').toLowerCase() === activeCat)
        : items,
    [activeCat, items],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Animated.View style={{opacity: fade}}>
        <ScreenHeader
          overline={t('discover.subtitle')}
          title={t('discover.title')}
          right={
            <Pressable
              onPress={() => navigation.navigate('DiscoverMap')}
              android_ripple={{color: colors.accentSoft, borderless: false}}
              style={styles.mapBtn}
              hitSlop={6}>
              <Icon name="map" size={16} color={colors.accent} />
              <Text style={[typography.button, styles.mapBtnText]}>
                {t('discover.openMap')}
              </Text>
            </Pressable>
          }
        />

        {/* Kategori filtreleri */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[t('discover.all'), ...categories]}
          keyExtractor={c => c}
          contentContainerStyle={styles.chipRow}
          renderItem={({item, index}) => {
            const value = index === 0 ? null : item.toLowerCase();
            const active =
              (value === null && activeCat === null) || activeCat === value;
            return (
              <Pressable
                onPress={() => setActiveCat(value)}
                android_ripple={{color: colors.accentSoft}}
                style={[styles.chip, active && styles.chipActive]}>
                <Text
                  style={[
                    typography.caption,
                    styles.chipText,
                    {
                      color: active ? colors.textInverse : colors.textPrimary,
                      fontWeight: active ? '700' : '500',
                    },
                  ]}>
                  {index === 0 ? item : translateCategory(item, lang)}
                </Text>
              </Pressable>
            );
          }}
        />

        <OrnamentalDivider style={styles.headerDivider} />
      </Animated.View>

      <FlatList
        contentContainerStyle={styles.feed}
        data={filtered}
        keyExtractor={i => i.id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={fetchFirst}
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
        onEndReachedThreshold={0.4}
        onEndReached={loadMore}
        ListEmptyComponent={
          refreshing ? (
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
                <Icon
                  name="travel-explore"
                  size={42}
                  color={colors.accent}
                />
              </View>
              <Text style={[typography.h2, styles.emptyTitle]}>
                {t('discover.empty')}
              </Text>
              <OrnamentalDivider style={styles.emptyDivider} />
              <Text style={[typography.body, styles.emptySub]}>
                {t('discover.emptySub')}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          loading && items.length > 0 ? (
            <View style={styles.footerWrap}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : done && items.length > 0 ? (
            <View style={styles.endWrap}>
              <OrnamentalDivider />
              <Text style={[typography.overline, styles.endText]}>
                {t('discover.endOfFeed')}
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.bg},
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
    gap: 5,
    ...shadow.sm,
  },
  mapBtnText: {color: colors.accent},
  chipRow: {
    paddingHorizontal: spacing(2.5),
    paddingTop: spacing(0.5),
    paddingBottom: spacing(1.5),
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accentDeep,
    ...shadow.sm,
  },
  chipText: {letterSpacing: 0.3},
  headerDivider: {
    marginHorizontal: spacing(2.5),
    marginBottom: spacing(1),
  },
  feed: {
    paddingHorizontal: spacing(2.5),
    paddingTop: spacing(0.5),
    paddingBottom: spacing(3),
  },
  skelCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing(1.5),
    marginBottom: spacing(1.5),
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing(7),
    paddingHorizontal: spacing(3),
  },
  emptyIconWrap: {
    width: 84,
    height: 84,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(2),
  },
  emptyTitle: {color: colors.textPrimary, textAlign: 'center'},
  emptyDivider: {
    alignSelf: 'stretch',
    marginVertical: spacing(1.5),
    paddingHorizontal: spacing(4),
  },
  emptySub: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footerWrap: {paddingVertical: spacing(2), alignItems: 'center'},
  endWrap: {
    marginVertical: spacing(2.5),
    paddingHorizontal: spacing(4),
    alignItems: 'center',
    gap: spacing(1),
  },
  endText: {color: colors.gold, letterSpacing: 2},
});

export default DiscoverFeedScreen;
