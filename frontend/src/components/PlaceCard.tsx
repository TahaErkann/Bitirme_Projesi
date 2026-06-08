/**
 * Keşfet feed'inde tek bir yer kartı — antrasit tema, hover/press animasyonu.
 * - Kategori rozeti seçili dile çevrilir (translateCategory).
 * - Kalp artık interaktif: dokununca beğeni toggle olur (optimistic + rollback).
 *   Başlangıç durumu (liked) sunucudan gelir (discover feed DTO'su).
 */
import React, {useRef, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {Text} from '@/components/AppText';
import Icon from 'react-native-vector-icons/MaterialIcons';
import FastImage from 'react-native-fast-image';

import {PlaceListItem} from '@/types';
import {useLanguage} from '@/context/LanguageContext';
import {translateCategory} from '@/utils/i18n';
import {likePlace} from '@/services/placeService';
import {colors, radius, spacing, typography} from '@/utils/theme';
import AppCard from './AppCard';

interface Props {
  place: PlaceListItem;
  onPress?: (id: string) => void;
}

const PlaceCard: React.FC<Props> = ({place, onPress}) => {
  const {lang} = useLanguage();
  return (
    <AppCard
      onPress={() => onPress?.(place.id)}
      padded={false}
      style={styles.card}>
      {place.primary_image_url ? (
        <FastImage
          source={{uri: place.primary_image_url}}
          style={styles.img}
          resizeMode={FastImage.resizeMode.cover}
        />
      ) : (
        <View style={[styles.img, styles.imgPlaceholder]}>
          <Icon name="image" size={32} color={colors.textMuted} />
        </View>
      )}

      {place.category ? (
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>
            {translateCategory(place.category, lang)}
          </Text>
        </View>
      ) : null}

      <View style={styles.body}>
        <Text
          numberOfLines={1}
          style={[
            typography.h3,
            {color: colors.textPrimary, marginBottom: 2},
          ]}>
          {place.place_name}
        </Text>
        <View style={styles.row}>
          <Icon name="place" size={13} color={colors.textSecondary} />
          <Text
            numberOfLines={1}
            style={[
              typography.caption,
              {color: colors.textSecondary, marginLeft: 4, flex: 1},
            ]}>
            {[place.city, place.country].filter(Boolean).join(', ') || '—'}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <LikeButton
            placeId={place.id}
            initialLiked={!!place.liked}
            initialCount={place.like_count}
          />
          <Meta icon="visibility" value={place.view_count} />
        </View>
      </View>
    </AppCard>
  );
};

/**
 * İnteraktif kalp — optimistic toggle + sunucu yanıtı senkronu + rollback.
 * Kendi Pressable'ı olduğu için dokunması kartın onPress'ini (navigasyon)
 * tetiklemez (iç responder dış responder'ı önceler).
 */
const LikeButton: React.FC<{
  placeId: string;
  initialLiked: boolean;
  initialCount: number;
}> = ({placeId, initialLiked, initialCount}) => {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const busyRef = useRef(false);

  const toggle = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    const prevLiked = liked;
    const prevCount = count;
    // Optimistic: anında güncelle
    setLiked(!prevLiked);
    setCount(Math.max(0, prevCount + (prevLiked ? -1 : 1)));
    try {
      const r = await likePlace(placeId);
      setLiked(r.liked);
      setCount(r.like_count);
    } catch {
      // Hata (örn. 401) → optimistic değişikliği geri al
      setLiked(prevLiked);
      setCount(prevCount);
    } finally {
      busyRef.current = false;
    }
  };

  return (
    <Pressable
      onPress={toggle}
      hitSlop={8}
      style={({pressed}) => [styles.row, pressed && {opacity: 0.6}]}>
      <Icon
        name={liked ? 'favorite' : 'favorite-border'}
        size={14}
        color={liked ? colors.error : colors.textMuted}
      />
      <Text
        style={[
          typography.caption,
          {color: liked ? colors.error : colors.textSecondary, marginLeft: 4},
        ]}>
        {count}
      </Text>
    </Pressable>
  );
};

const Meta: React.FC<{icon: string; value: number}> = ({icon, value}) => (
  <View style={styles.row}>
    <Icon name={icon} size={13} color={colors.textMuted} />
    <Text
      style={[
        typography.caption,
        {color: colors.textSecondary, marginLeft: 4},
      ]}>
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing(1.5),
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderWidth: 1,
  },
  img: {width: '100%', height: 200},
  imgPlaceholder: {
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(251,248,239,0.92)',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accentSoft,
  },
  categoryText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  body: {padding: spacing(1.5)},
  row: {flexDirection: 'row', alignItems: 'center'},
  metaRow: {flexDirection: 'row', gap: spacing(2), marginTop: 8},
});

export default PlaceCard;
