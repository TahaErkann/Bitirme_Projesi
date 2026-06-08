/**
 * HomeScreen — "Tarihi Doku" karşılama ekranı.
 * - ScreenHeader (altın overline selam + serif ad + avatar)
 * - Büyük keşif banner'ı (heritage, ornamental flourish + accent CTA)
 * - Hızlı eylemler (Keşfet / Harita) altın ikonlu kartlar
 * - OrnamentalDivider + "Son keşifler" yatay şeridi
 * - İpuçları kartı (altın kenarlı)
 * Feed ekran odaklandığında yenilenir (yeni yüklenenler hemen görünür).
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {Text} from '@/components/AppText';
import Icon from 'react-native-vector-icons/MaterialIcons';
import FastImage from 'react-native-fast-image';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';

import {useAuth} from '@/hooks/useAuth';
import {useLanguage} from '@/context/LanguageContext';
import {colors, radius, shadow, spacing, typography} from '@/utils/theme';
import AppCard from '@/components/AppCard';
import ScreenHeader from '@/components/ScreenHeader';
import SectionTitle from '@/components/SectionTitle';
import OrnamentalDivider from '@/components/OrnamentalDivider';
import Skeleton from '@/components/Skeleton';
import {fetchFeed} from '@/services/discoverService';
import {PlaceListItem} from '@/types';

const HomeScreen: React.FC<{navigation: any}> = ({navigation}) => {
  const {user} = useAuth();
  const {t} = useLanguage();
  const [highlights, setHighlights] = useState<PlaceListItem[] | null>(null);

  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        toValue: 0,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, lift]);

  const refresh = useCallback(() => {
    fetchFeed({limit: 6})
      .then(r => setHighlights(r.places))
      .catch(() => setHighlights([]));
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const greeting = useGreeting(t);
  const firstName = user?.display_name?.split(' ')[0] ?? 'Gezgin';
  const initials = (user?.display_name ?? 'U').slice(0, 2).toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        <ScreenHeader
          overline={greeting}
          title={firstName}
          right={
            <Pressable
              onPress={() => navigation.navigate('Profile')}
              android_ripple={{color: colors.surfaceAlt, borderless: true}}
              hitSlop={6}>
              <View style={styles.avatar}>
                <Text style={[typography.h3, {color: colors.accent}]}>
                  {initials}
                </Text>
              </View>
            </Pressable>
          }
        />

        <Animated.View
          style={{opacity: fade, transform: [{translateY: lift}]}}>
          {/* Keşif banner'ı — ana CTA */}
          <AppCard
            onPress={() => navigation.navigate('Upload')}
            padded={false}
            style={styles.heroCard}
            elevated>
            <Icon
              name="account-balance"
              size={140}
              color={colors.accentSoft}
              style={styles.heroWatermark}
            />
            <View style={styles.heroOverlay}>
              <View style={styles.heroBadge}>
                <Icon name="auto-awesome" size={13} color={colors.goldDeep} />
                <Text style={styles.heroBadgeText}>{t('home.heroBadge')}</Text>
              </View>
              <Text style={[typography.h1, styles.heroTitle]}>
                {t('home.heroTitle')}
              </Text>
              <Text
                style={[
                  typography.body,
                  {color: colors.textSecondary, marginTop: 8},
                ]}>
                {t('home.heroSub')}
              </Text>
              <View style={styles.heroCta}>
                <Icon name="add-a-photo" size={16} color={colors.textInverse} />
                <Text style={styles.heroCtaText}>{t('home.heroCta')}</Text>
              </View>
            </View>
          </AppCard>

          {/* Hızlı eylemler */}
          <View style={styles.quickRow}>
            <QuickAction
              icon="explore"
              label={t('home.discover')}
              sub={t('home.discoverSub')}
              onPress={() => navigation.navigate('Discover')}
            />
            <QuickAction
              icon="map"
              label={t('home.map')}
              sub={t('home.mapSub')}
              onPress={() => navigation.navigate('DiscoverMap')}
            />
          </View>

          {/* İpuçları */}
          <AppCard accentEdge style={{marginTop: spacing(2)}}>
            <View style={styles.tipsHead}>
              <Icon name="tips-and-updates" size={18} color={colors.gold} />
              <Text
                style={[
                  typography.h3,
                  {color: colors.textPrimary, marginLeft: 8},
                ]}>
                {t('home.tipsTitle')}
              </Text>
            </View>
            <OrnamentalDivider style={{marginVertical: spacing(1.25)}} />
            <TipRow icon="add-a-photo" text={t('home.tipUpload')} />
            <TipRow icon="explore" text={t('home.tipDiscover')} />
            <TipRow icon="map" text={t('home.tipMap')} />
          </AppCard>
        </Animated.View>

        {/* Son keşfedilenler */}
        <SectionTitle
          overline={t('discover.subtitle')}
          title={t('home.recent')}
          actionLabel={t('home.all')}
          onAction={() => navigation.navigate('Discover')}
          style={styles.sectionHeader}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            gap: spacing(1.5),
            paddingRight: spacing(2.5),
            paddingLeft: spacing(2.5),
          }}>
          {highlights == null
            ? [0, 1, 2].map(i => (
                <View key={i} style={styles.miniCard}>
                  <Skeleton height={120} rounded="md" />
                  <Skeleton width="70%" height={12} style={{marginTop: 8}} />
                  <Skeleton width="40%" height={10} style={{marginTop: 6}} />
                </View>
              ))
            : highlights.length === 0
            ? [0].map(i => (
                <View
                  key={i}
                  style={[
                    styles.miniCard,
                    styles.emptyMini,
                  ]}>
                  <Icon name="explore-off" size={26} color={colors.textMuted} />
                  <Text style={{color: colors.textMuted, marginTop: 6}}>
                    {t('home.empty')}
                  </Text>
                </View>
              ))
            : highlights.map(p => (
                <PlaceMiniCard
                  key={p.id}
                  place={p}
                  onPress={() =>
                    navigation.navigate('PlaceDetail', {placeId: p.id})
                  }
                />
              ))}
        </ScrollView>

        <View style={{height: spacing(3)}} />
      </ScrollView>
    </SafeAreaView>
  );
};

function useGreeting(t: (k: string) => string) {
  const h = new Date().getHours();
  if (h < 6) return t('home.greetingNight');
  if (h < 12) return t('home.greetingMorning');
  if (h < 18) return t('home.greetingAfternoon');
  return t('home.greetingEvening');
}

const QuickAction: React.FC<{
  icon: string;
  label: string;
  sub: string;
  onPress: () => void;
}> = ({icon, label, sub, onPress}) => (
  <AppCard onPress={onPress} style={{flex: 1}} bordered>
    <View style={styles.quickIcon}>
      <Icon name={icon} size={20} color={colors.accent} />
    </View>
    <Text style={[typography.h3, {color: colors.textPrimary, marginTop: 10}]}>
      {label}
    </Text>
    <Text style={[typography.caption, {color: colors.textSecondary}]}>
      {sub}
    </Text>
  </AppCard>
);

const TipRow: React.FC<{icon: string; text: string}> = ({icon, text}) => (
  <View style={styles.tipRow}>
    <View style={styles.tipIcon}>
      <Icon name={icon} size={14} color={colors.gold} />
    </View>
    <Text style={[typography.body, {color: colors.textPrimary, flex: 1}]}>
      {text}
    </Text>
  </View>
);

const PlaceMiniCard: React.FC<{place: PlaceListItem; onPress: () => void}> = ({
  place,
  onPress,
}) => (
  <AppCard onPress={onPress} padded={false} style={styles.miniCard}>
    {place.primary_image_url ? (
      <FastImage
        source={{uri: place.primary_image_url}}
        style={styles.miniImg}
        resizeMode={FastImage.resizeMode.cover}
      />
    ) : (
      <View style={[styles.miniImg, styles.miniImgPlaceholder]}>
        <Icon name="account-balance" size={28} color={colors.textMuted} />
      </View>
    )}
    <View style={{padding: spacing(1.25)}}>
      <Text
        numberOfLines={1}
        style={[
          typography.h3,
          {color: colors.textPrimary, fontSize: 15},
        ]}>
        {place.place_name}
      </Text>
      <Text
        numberOfLines={1}
        style={[typography.caption, {color: colors.textSecondary, marginTop: 2}]}>
        {[place.city, place.country].filter(Boolean).join(', ') ||
          place.category ||
          '—'}
      </Text>
    </View>
  </AppCard>
);

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.bg},
  scroll: {paddingTop: spacing(0.5)},
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    borderWidth: 1.5,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    marginHorizontal: spacing(2.5),
    backgroundColor: colors.surface,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroWatermark: {
    position: 'absolute',
    right: -28,
    bottom: -24,
    opacity: 0.9,
  },
  heroOverlay: {padding: spacing(2.5)},
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.goldSoft,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  heroBadgeText: {
    color: colors.goldDeep,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1.2,
  },
  heroTitle: {color: colors.textPrimary, marginTop: spacing(1.25)},
  heroCta: {
    marginTop: spacing(2),
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: radius.pill,
    gap: 7,
    ...shadow.sm,
  },
  heroCtaText: {
    color: colors.textInverse,
    fontWeight: '700',
    fontSize: 13,
  },
  quickRow: {
    flexDirection: 'row',
    gap: spacing(1.5),
    marginTop: spacing(2),
    paddingHorizontal: spacing(2.5),
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipsHead: {flexDirection: 'row', alignItems: 'center'},
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: spacing(1.25),
  },
  tipIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    marginTop: spacing(3),
    marginBottom: spacing(1.5),
    paddingHorizontal: spacing(2.5),
  },
  miniCard: {
    width: 190,
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderWidth: 1,
  },
  miniImg: {width: '100%', height: 120},
  miniImgPlaceholder: {
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMini: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing(1.5),
  },
});

export default HomeScreen;
