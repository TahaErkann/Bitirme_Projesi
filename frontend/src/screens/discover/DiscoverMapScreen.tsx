/**
 * DiscoverMapScreen — yakındakileri haritada göster.
 * Google Maps + "Tarihi Doku" açık (parşömen) harita stili; alt seçim kartı.
 *
 * Tasarım: yüzen geri FAB, alttan kayan seçim kartı ve harita teşhis overlay'i
 * heritage diline uyarlandı — parşömen yüzey, altın/yeşil vurgular, serif
 * başlık, altın "kitabe/defter" kenarı ve süs ayraç. Harita mantığı (MapView,
 * PROVIDER_GOOGLE, LIGHT_MAP_STYLE, marker'lar, fetchNearby, kart slide
 * animasyonu, MapTimeoutHint) AYNEN korundu.
 */
import React, {useEffect, useRef, useState} from 'react';
import {Animated, Easing, Pressable, StyleSheet, View} from 'react-native';
import {Text} from '@/components/AppText';
import Icon from 'react-native-vector-icons/MaterialIcons';
import MapView, {Marker, PROVIDER_GOOGLE} from 'react-native-maps';

import {fetchNearby} from '@/services/discoverService';
import {PlaceListItem} from '@/types';
import {colors, radius, shadow, spacing, typography} from '@/utils/theme';
import OrnamentalDivider from '@/components/OrnamentalDivider';

// Açık "parşömen/heritage" harita stili (Google Maps Style v1) — yalnızca
// PROVIDER_GOOGLE ile aktiftir. Krem zemin, soluk yeşil park, sıcak yollar.
const LIGHT_MAP_STYLE = [
  {elementType: 'geometry', stylers: [{color: '#EDE6D4'}]},
  {elementType: 'labels.text.fill', stylers: [{color: '#5B5446'}]},
  {elementType: 'labels.text.stroke', stylers: [{color: '#FBF8EF'}]},
  {featureType: 'landscape.natural', elementType: 'geometry', stylers: [{color: '#DEE6CD'}]},
  {featureType: 'poi.park', elementType: 'geometry', stylers: [{color: '#CFE0BE'}]},
  {featureType: 'road', elementType: 'geometry', stylers: [{color: '#FBF7EC'}]},
  {featureType: 'road', elementType: 'geometry.stroke', stylers: [{color: '#E2D6BC'}]},
  {featureType: 'road.arterial', elementType: 'geometry', stylers: [{color: '#FFFFFF'}]},
  {featureType: 'water', elementType: 'geometry', stylers: [{color: '#BFD6CF'}]},
  {featureType: 'poi', elementType: 'labels', stylers: [{visibility: 'off'}]},
  {featureType: 'transit', stylers: [{visibility: 'off'}]},
  {featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{color: '#C9BB9C'}]},
];

const DiscoverMapScreen: React.FC<{navigation: any}> = ({navigation}) => {
  const [items, setItems] = useState<PlaceListItem[]>([]);
  const [selected, setSelected] = useState<PlaceListItem | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const cardLift = useRef(new Animated.Value(140)).current;

  const initialRegion = {
    latitude: 41.0086,
    longitude: 28.9802,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  useEffect(() => {
    fetchNearby(initialRegion.latitude, initialRegion.longitude, 50)
      .then(setItems)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    Animated.timing(cardLift, {
      toValue: selected ? 0 : 140,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [selected, cardLift]);

  return (
    <View style={styles.root}>
      <MapView
        provider={PROVIDER_GOOGLE}
        customMapStyle={LIGHT_MAP_STYLE}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsCompass
        showsMyLocationButton={false}
        onMapReady={() => setMapReady(true)}
        onMapLoaded={() => setMapReady(true)}>
        {items.map((p, idx) => (
          <Marker
            key={p.id}
            coordinate={{
              latitude: initialRegion.latitude + (idx % 5) * 0.005,
              longitude: initialRegion.longitude + (idx % 5) * 0.005,
            }}
            title={p.place_name}
            description={p.city ?? undefined}
            onPress={() => setSelected(p)}
            pinColor={colors.accent}
          />
        ))}
      </MapView>

      {/*
        Harita 6 saniye içinde tile'ları çizemediyse büyük ihtimalle Google
        Cloud tarafında "Maps SDK for Android" etkin değil ya da API key
        kısıtlamaları doğru değil. Kullanıcıya net bir tanı mesajı gösteriyoruz.
      */}
      <MapTimeoutHint ready={mapReady} />

      <Pressable
        onPress={() => navigation.goBack()}
        style={styles.fab}
        android_ripple={{color: colors.surfaceAlt, borderless: true}}
        hitSlop={8}>
        <Icon name="arrow-back" size={20} color={colors.accent} />
      </Pressable>

      <Animated.View
        style={[
          styles.bottomCard,
          {transform: [{translateY: cardLift}]},
        ]}>
        {selected ? (
          <Pressable
            style={styles.cardInner}
            android_ripple={{color: colors.surfaceAlt}}
            onPress={() =>
              navigation.navigate('PlaceDetail', {placeId: selected.id})
            }>
            <View style={styles.cardThumb}>
              <Icon name="place" size={24} color={colors.accent} />
            </View>
            <View style={{flex: 1}}>
              <Text style={styles.cardOverline}>{selected.category || '—'}</Text>
              <Text
                numberOfLines={1}
                style={[typography.h3, {color: colors.textPrimary, marginTop: 2}]}>
                {selected.place_name}
              </Text>
              <View style={styles.cardMetaRow}>
                <Icon
                  name="location-on"
                  size={13}
                  color={colors.gold}
                  style={{marginRight: 3}}
                />
                <Text
                  numberOfLines={1}
                  style={[typography.caption, {color: colors.textSecondary, flex: 1}]}>
                  {[selected.city, selected.country].filter(Boolean).join(', ') ||
                    selected.category ||
                    '—'}
                </Text>
              </View>
            </View>
            <View style={styles.cardChevron}>
              <Icon name="chevron-right" size={22} color={colors.accent} />
            </View>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
};

/**
 * Harita render olmadıysa 6 saniye sonra teşhis mesajı gösteren overlay.
 * onMapReady tetiklenmediyse büyük ihtimalle API key/Cloud Console sorunu.
 */
const MapTimeoutHint: React.FC<{ready: boolean}> = ({ready}) => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (ready) {
      setShow(false);
      return;
    }
    const t = setTimeout(() => setShow(true), 6000);
    return () => clearTimeout(t);
  }, [ready]);

  if (!show) return null;
  return (
    <View style={styles.hintOverlay}>
      <View style={styles.hintIconWrap}>
        <Icon name="map" size={30} color={colors.accent} />
      </View>
      <Text style={styles.hintOverline}>TOURLENS</Text>
      <Text
        style={[
          typography.h2,
          {color: colors.textPrimary, marginTop: 4, textAlign: 'center'},
        ]}>
        Harita yüklenemedi
      </Text>
      <OrnamentalDivider style={styles.hintDivider} />
      <Text
        style={[
          typography.body,
          {color: colors.textSecondary, textAlign: 'center'},
        ]}>
        Google Cloud Console'da{' '}
        <Text style={{color: colors.gold, fontWeight: '700'}}>
          Maps SDK for Android
        </Text>
        {' '}etkin mi ve API key kısıtlaması bu uygulamayı içeriyor mu kontrol edin.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.bg},
  hintOverlay: {
    position: 'absolute',
    left: spacing(2.5),
    right: spacing(2.5),
    top: '30%',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(3),
    alignItems: 'center',
    ...shadow.lg,
  },
  hintIconWrap: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(1.5),
  },
  hintOverline: {
    ...typography.overline,
    color: colors.gold,
  },
  hintDivider: {
    alignSelf: 'stretch',
    marginVertical: spacing(1.75),
  },
  fab: {
    position: 'absolute',
    top: spacing(6),
    left: spacing(2.5),
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.md,
  },
  bottomCard: {
    position: 'absolute',
    left: spacing(2.5),
    right: spacing(2.5),
    bottom: spacing(3),
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    ...shadow.lg,
    overflow: 'hidden',
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing(2),
    gap: spacing(1.75),
  },
  cardThumb: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardOverline: {
    ...typography.overline,
    color: colors.gold,
    fontSize: 10,
    letterSpacing: 1.2,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  cardChevron: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default DiscoverMapScreen;
