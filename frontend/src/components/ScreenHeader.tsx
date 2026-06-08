/**
 * ScreenHeader — tüm ekranlarda tutarlı "tarihi doku" başlığı.
 * Altın overline + serif başlık + opsiyonel alt başlık, geri butonu ve sağ
 * aksiyon. Yumuşak giriş animasyonu (fade + lift) içerir.
 */
import React, {useEffect, useRef} from 'react';
import {Animated, Easing, Pressable, StyleProp, StyleSheet, View, ViewStyle} from 'react-native';
import {Text} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {colors, radius, spacing, typography} from '@/utils/theme';

interface Props {
  title: string;
  overline?: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Animasyonu kapat (üst üste binen animasyonları önlemek için). */
  animate?: boolean;
}

const ScreenHeader: React.FC<Props> = ({
  title,
  overline,
  subtitle,
  onBack,
  right,
  style,
  animate = true,
}) => {
  const fade = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const lift = useRef(new Animated.Value(animate ? 14 : 0)).current;

  useEffect(() => {
    if (!animate) return;
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 420,
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
  }, [animate, fade, lift]);

  return (
    <Animated.View
      style={[styles.wrap, {opacity: fade, transform: [{translateY: lift}]}, style]}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={10}>
          <Icon name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
      ) : null}
      <View style={styles.titleCol}>
        {overline ? (
          <Text style={[typography.overline, {color: colors.gold}]}>{overline}</Text>
        ) : null}
        <Text style={[typography.h1, {color: colors.textPrimary}]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[
              typography.body,
              {color: colors.textSecondary, marginTop: 2},
            ]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing(2.5),
    paddingTop: spacing(1),
    paddingBottom: spacing(1.5),
    gap: spacing(1.25),
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCol: {flex: 1},
  right: {marginLeft: 'auto'},
});

export default ScreenHeader;
