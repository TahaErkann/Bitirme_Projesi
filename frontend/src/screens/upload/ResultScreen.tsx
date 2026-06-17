/**
 * ResultScreen — master prompt § 10.2 (en kritik ekran).
 * - Yer adı + konum + kategori + güven skoru
 * - OCR sonucu metin
 * - Dil seçim + çeviri + 🔊 Sesli Oku
 * - "Daha Fazla Bilgi" butonu (chat değil — tek istek/cevap)
 * - YouTube videoları (yatay scroll)
 * - Haritada Gör
 *
 * "Tarihi Doku" açık tema — parşömen zemin, sepya metin, zeytin yeşili ana
 * vurgu, antik altın ikincil vurgu. Serif başlıklar (kitabe estetiği), altın
 * overline'lar, ornamental ayraçlar. Fotoğraf üstü hero metin koyu maske
 * (imageScrim) + açık metin (onImage) ile okunur kalır.
 */
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  Animated,
  Easing,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {Text} from '@/components/AppText';
import Icon from 'react-native-vector-icons/MaterialIcons';
import FastImage from 'react-native-fast-image';
import {SafeAreaView} from 'react-native-safe-area-context';

import {useUploadStatus} from '@/hooks/useUploadStatus';
import {LanguageCode} from '@/utils/constants';
import {useLanguage} from '@/context/LanguageContext';
import {translateCategory} from '@/utils/i18n';
import {colors, radius, shadow, spacing, typography} from '@/utils/theme';
import {
  enrichPlace,
  getPlace,
  getVideos,
  translatePlace,
} from '@/services/placeService';
import {
  EnrichResponse,
  PlaceDetail,
  TranslationResponse,
  VideosResponse,
} from '@/types';
import LanguageSelector from '@/components/LanguageSelector';
import LoadingOverlay from '@/components/LoadingOverlay';
import TTSButton from '@/components/TTSButton';
import YouTubeVideoList from '@/components/YouTubeVideoList';
import AppButton from '@/components/AppButton';
import AppCard from '@/components/AppCard';
import OrnamentalDivider from '@/components/OrnamentalDivider';
import Skeleton from '@/components/Skeleton';
import {extractErrorMessage} from '@/utils/helpers';

const ResultScreen: React.FC<{route: any; navigation: any}> = ({route, navigation}) => {
  const {t, lang} = useLanguage();
  const taskIdParam = route.params?.taskId as string | undefined;
  const initialPlaceId = route.params?.placeId as string | undefined;

  const status = useUploadStatus(taskIdParam ?? null);
  const placeId =
    initialPlaceId ??
    (status?.status === 'COMPLETED'
      ? status.place_id
      : status?.status === 'DUPLICATE'
      ? status.duplicate_of
      : null);

  const [place, setPlace] = useState<PlaceDetail | null>(null);
  const [language, setLanguage] = useState<LanguageCode>(lang);
  const [translation, setTranslation] = useState<TranslationResponse | null>(null);
  const [enrichment, setEnrichment] = useState<EnrichResponse | null>(null);
  const [videos, setVideos] = useState<VideosResponse | null>(null);
  const [loadingPlace, setLoadingPlace] = useState(false);
  const [loadingTrans, setLoadingTrans] = useState(false);
  const [loadingEnrich, setLoadingEnrich] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(18)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, lift]);

  // Place'i yükle
  useEffect(() => {
    if (!placeId) return;
    setLoadingPlace(true);
    getPlace(placeId)
      .then(setPlace)
      .catch(e => Alert.alert(t('result.placeError'), extractErrorMessage(e)))
      .finally(() => setLoadingPlace(false));
    getVideos(placeId)
      .then(setVideos)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId]);

  // Dil değiştiğinde çeviri yenile
  useEffect(() => {
    if (!placeId) return;
    setLoadingTrans(true);
    setEnrichment(null);
    translatePlace(placeId, language)
      .then(setTranslation)
      .catch(() => setTranslation(null))
      .finally(() => setLoadingTrans(false));
  }, [placeId, language]);

  const ttsLang = useMemo(() => {
    const map: Record<string, string> = {
      tr: 'tr-TR', en: 'en-US', de: 'de-DE', fr: 'fr-FR',
      es: 'es-ES', ar: 'ar-SA', ru: 'ru-RU', zh: 'zh-CN',
      ja: 'ja-JP', ko: 'ko-KR', pt: 'pt-PT', it: 'it-IT',
    };
    return map[language] ?? 'en-US';
  }, [language]);

  const onEnrich = async () => {
    if (!placeId) return;
    setLoadingEnrich(true);
    try {
      // Zaten metin varsa "Tekrar Üret" → cache'i atla, taze kaynaklarla üret.
      const force = !!enrichment?.enriched_text;
      const r = await enrichPlace(placeId, language, force);
      setEnrichment(r);
    } catch (e) {
      Alert.alert(t('result.enrichError'), extractErrorMessage(e));
    } finally {
      setLoadingEnrich(false);
    }
  };

  const openMap = () => {
    if (place?.latitude == null || place.longitude == null) {
      // Koordinat henüz çözülmediyse (geocode boş döndü) genel haritayı aç.
      navigation.navigate('DiscoverMap');
      return;
    }
    // Uygulama içi haritada yeri kırmızı işaretle göster (il/ilçe merkezi).
    navigation.navigate('DiscoverMap', {
      focusLat: Number(place.latitude),
      focusLng: Number(place.longitude),
      focusLabel: place.place_name,
      focusSubtitle:
        [place.district, place.city, place.country].filter(Boolean).join(', ') ||
        undefined,
      focusCategory: place.category
        ? translateCategory(place.category, language)
        : undefined,
    });
  };

  if (!placeId) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.pendingWrap}>
          <View style={styles.pendingIconRing}>
            <Icon name="hourglass-empty" size={36} color={colors.gold} />
          </View>
          <Text
            style={[typography.overline, {color: colors.gold, marginTop: spacing(2)}]}>
            TourLens
          </Text>
          <Text
            style={[typography.h2, {color: colors.textPrimary, marginTop: 6}]}>
            {status?.status ?? 'PENDING'}
          </Text>
          <OrnamentalDivider style={{marginVertical: spacing(1.75), width: 160}} />
          <Text
            style={[
              typography.body,
              {color: colors.textSecondary, textAlign: 'center'},
            ]}>
            {t('upload.running')} (%{status?.progress ?? 0})
          </Text>
          {status?.error ? (
            <Text
              style={[
                typography.body,
                {color: colors.error, marginTop: spacing(1), textAlign: 'center'},
              ]}>
              {status.error}
            </Text>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        {/* Hero görsel — foto üstü koyu maske + açık metin */}
        <Animated.View style={{opacity: fade, transform: [{translateY: lift}]}}>
          <View style={styles.heroWrap}>
            {place?.images?.[0]?.image_url ? (
              <FastImage
                source={{uri: place.images[0].image_url}}
                style={styles.hero}
                resizeMode={FastImage.resizeMode.cover}
              />
            ) : (
              <Skeleton height={280} rounded="lg" />
            )}
            <View style={styles.heroGradient} />
            <View style={styles.heroContent}>
              {place?.category ? (
                <View style={styles.catBadge}>
                  <Icon name="local-offer" size={11} color={colors.goldDeep} />
                  <Text style={styles.catText}>
                    {translateCategory(place.category, language)}
                  </Text>
                </View>
              ) : null}
              <Text
                style={[typography.h1, {color: colors.onImage}]}
                numberOfLines={2}>
                {place?.place_name ?? '—'}
              </Text>
              <View style={styles.row}>
                <Icon name="place" size={14} color={colors.gold} />
                <Text
                  style={[
                    typography.body,
                    {color: colors.onImage, marginLeft: 5},
                  ]}>
                  {[place?.city, place?.country].filter(Boolean).join(', ') || '—'}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Stat şeridi — kitabe rozeti hissi */}
        <View style={styles.statsRow}>
          {place?.confidence_score != null ? (
            <>
              <Stat
                icon="verified"
                value={`%${(Number(place.confidence_score) * 100).toFixed(0)}`}
                label={t('result.confidence')}
              />
              <View style={styles.statSep} />
            </>
          ) : null}
          <Stat
            icon="favorite"
            value={place?.like_count ?? 0}
            label={t('result.likes')}
          />
          <View style={styles.statSep} />
          <Stat
            icon="visibility"
            value={place?.view_count ?? 0}
            label={t('result.views')}
          />
        </View>

        {/* Aksiyon — Haritada Gör (Daha Fazla Bilgi butonu artık kendi kartında) */}
        <View style={styles.actionRow}>
          <AppButton
            label={t('result.openMap')}
            variant="secondary"
            icon="map"
            onPress={openMap}
            small
            block={false}
            style={{flex: 1}}
          />
        </View>

        {/* Dil seçici */}
        <View style={{marginTop: spacing(2.5)}}>
          <Text
            style={[
              typography.overline,
              {color: colors.gold, marginBottom: 8},
            ]}>
            {t('result.lang')}
          </Text>
          <LanguageSelector value={language} onChange={setLanguage} />
        </View>

        <OrnamentalDivider
          icon="translate"
          style={{marginTop: spacing(2.5), marginBottom: spacing(0.5)}}
        />

        {/* OCR + çeviri */}
        <AppCard style={{marginTop: spacing(1.5)}}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.cardIcon}>
                <Icon name="text-snippet" size={16} color={colors.accent} />
              </View>
              <View>
                <Text
                  style={[typography.overline, {color: colors.gold}]}>
                  {t('result.lang')}
                </Text>
                <Text
                  style={[
                    typography.h3,
                    {color: colors.textPrimary},
                  ]}>
                  {t('result.signText')}
                </Text>
              </View>
            </View>
            <TTSButton
              text={translation?.translated_text ?? place?.original_text ?? ''}
              language={ttsLang}
            />
          </View>
          <OrnamentalDivider style={{marginVertical: spacing(1.25)}} />
          {loadingTrans ? (
            <View>
              <Text
                style={[
                  typography.caption,
                  {color: colors.textSecondary, marginBottom: 8},
                ]}>
                {t('result.translating')}
              </Text>
              <Skeleton width="90%" height={12} />
              <Skeleton width="80%" height={12} style={{marginTop: 8}} />
              <Skeleton width="70%" height={12} style={{marginTop: 8}} />
            </View>
          ) : (
            <Text
              style={[
                typography.bodyLarge,
                {color: colors.textPrimary, lineHeight: 26},
              ]}>
              {translation?.translated_text || place?.original_text || '—'}
            </Text>
          )}
        </AppCard>

        {/* Daha Fazla Bilgi — buton + TTS bu kartın içinde (altın kenarlı) */}
        <AppCard accentEdge style={{marginTop: spacing(2)}}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.cardIconGold}>
                <Icon name="menu-book" size={16} color={colors.gold} />
              </View>
              <View>
                <Text
                  style={[typography.overline, {color: colors.gold}]}>
                  TourLens
                </Text>
                <Text
                  style={[
                    typography.h3,
                    {color: colors.textPrimary},
                  ]}>
                  {t('result.moreInfo')}
                </Text>
              </View>
            </View>
            {enrichment?.enriched_text ? (
              <TTSButton
                text={enrichment.enriched_text}
                language={ttsLang}
              />
            ) : null}
          </View>
          <OrnamentalDivider style={{marginVertical: spacing(1.25)}} />
          {enrichment?.enriched_text ? (
            <Text
              style={[
                typography.bodyLarge,
                {color: colors.textPrimary, lineHeight: 26},
              ]}>
              {enrichment.enriched_text}
            </Text>
          ) : (
            <Text
              style={[typography.body, {color: colors.textSecondary, lineHeight: 21}]}>
              {t('result.moreInfoEmpty')}
            </Text>
          )}

          {/* Kaynaklar — LLM'in grounding ile dayandığı gerçek web kaynakları */}
          {enrichment?.sources && enrichment.sources.length > 0 ? (
            <View style={styles.sourcesBox}>
              <View style={styles.sourcesHeader}>
                <Icon name="link" size={14} color={colors.gold} />
                <Text
                  style={[
                    typography.overline,
                    {color: colors.gold, marginLeft: 6},
                  ]}>
                  {t('result.sources')}
                </Text>
              </View>
              {enrichment.sources.map((s, i) => (
                <Pressable
                  key={`${s.url}-${i}`}
                  onPress={() => Linking.openURL(s.url).catch(() => undefined)}
                  hitSlop={4}
                  style={({pressed}) => [
                    styles.sourceRow,
                    pressed && {opacity: 0.55},
                  ]}>
                  <Icon name="open-in-new" size={14} color={colors.accent} />
                  <Text
                    numberOfLines={1}
                    style={[typography.caption, styles.sourceText]}>
                    {s.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <AppButton
            label={
              enrichment?.enriched_text
                ? t('result.enrichRegen')
                : t('result.enrich')
            }
            variant="gold"
            icon="auto-awesome"
            onPress={onEnrich}
            loading={loadingEnrich}
            block
            style={{marginTop: spacing(2)}}
          />
        </AppCard>

        {/* YouTube */}
        {videos && videos.videos.length > 0 ? (
          <AppCard style={{marginTop: spacing(2)}} padded={false}>
            <View style={styles.videoHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={styles.cardIcon}>
                  <Icon name="play-circle" size={16} color={colors.accent} />
                </View>
                <View>
                  <Text
                    style={[typography.overline, {color: colors.gold}]}>
                    YouTube
                  </Text>
                  <Text
                    style={[
                      typography.h3,
                      {color: colors.textPrimary},
                    ]}>
                    {t('result.videos')}
                  </Text>
                </View>
              </View>
            </View>
            <View style={{paddingHorizontal: spacing(1.5)}}>
              <YouTubeVideoList videos={videos.videos} />
            </View>
          </AppCard>
        ) : null}

        <LoadingOverlay visible={loadingPlace} label={t('result.placeLoading')} />
        <View style={{height: spacing(3)}} />
      </ScrollView>
    </SafeAreaView>
  );
};

const Stat: React.FC<{icon: string; value: string | number; label: string}> = ({
  icon,
  value,
  label,
}) => (
  <View style={styles.stat}>
    <View style={styles.statIcon}>
      <Icon name={icon} size={15} color={colors.accent} />
    </View>
    <Text style={[typography.h3, {color: colors.textPrimary, marginTop: 6}]}>
      {value}
    </Text>
    <Text style={[typography.overline, {color: colors.textMuted, marginTop: 2}]}>
      {label}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.bg},
  scroll: {paddingHorizontal: spacing(2.5), paddingTop: spacing(1.5)},
  pendingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing(3),
  },
  pendingIconRing: {
    width: 84,
    height: 84,
    borderRadius: radius.pill,
    backgroundColor: colors.goldSoft,
    borderWidth: 1.5,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroWrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.md,
  },
  hero: {width: '100%', height: 280},
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 190,
    backgroundColor: colors.imageScrim,
  },
  heroContent: {
    position: 'absolute',
    left: spacing(2),
    right: spacing(2),
    bottom: spacing(2),
  },
  catBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(251,248,239,0.92)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radius.pill,
    marginBottom: 10,
  },
  catText: {
    color: colors.goldDeep,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  row: {flexDirection: 'row', alignItems: 'center', marginTop: 7},
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingVertical: spacing(1.75),
    marginTop: spacing(2),
    ...shadow.sm,
  },
  stat: {flex: 1, alignItems: 'center'},
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statSep: {
    width: 1,
    height: 40,
    backgroundColor: colors.borderSoft,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing(1),
    marginTop: spacing(1.5),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.25),
    flex: 1,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconGold: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoHeader: {
    padding: spacing(2),
    paddingBottom: spacing(1),
  },
  sourcesBox: {
    marginTop: spacing(2),
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    padding: spacing(1.5),
  },
  sourcesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing(1),
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing(0.75),
    gap: 8,
  },
  sourceText: {
    color: colors.info,
    flex: 1,
    textDecorationLine: 'underline',
  },
});

export default ResultScreen;
