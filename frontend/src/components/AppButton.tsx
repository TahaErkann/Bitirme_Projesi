/**
 * AppButton — temalı, animasyonlu (press: scale + opacity) primary/secondary/ghost buton.
 */
import React, {useRef} from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Text} from 'react-native-paper';

import {colors, radius, shadow, spacing, typography} from '@/utils/theme';

export type AppButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'gold';

interface Props {
  label: string;
  onPress: () => void;
  variant?: AppButtonVariant;
  icon?: string;
  iconRight?: string;
  loading?: boolean;
  disabled?: boolean;
  block?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}

const AppButton: React.FC<Props> = ({
  label,
  onPress,
  variant = 'primary',
  icon,
  iconRight,
  loading,
  disabled,
  block = true,
  small = false,
  style,
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const v = computeVariant(variant);

  return (
    <Pressable
      onPressIn={() =>
        Animated.spring(scale, {
          toValue: 0.97,
          useNativeDriver: true,
        }).start()
      }
      onPressOut={() =>
        Animated.spring(scale, {
          toValue: 1,
          friction: 4,
          useNativeDriver: true,
        }).start()
      }
      onPress={onPress}
      disabled={loading || disabled}>
      <Animated.View
        style={[
          styles.base,
          block && styles.block,
          small && styles.small,
          v.container,
          {transform: [{scale}], opacity: loading || disabled ? 0.55 : 1},
          variant === 'primary' || variant === 'gold' ? shadow.md : undefined,
          style,
        ]}>
        {loading ? (
          <ActivityIndicator size="small" color={v.fg} />
        ) : (
          <View style={styles.row}>
            {icon ? (
              <Icon
                name={icon}
                size={small ? 16 : 18}
                color={v.fg}
                style={styles.iconLeft}
              />
            ) : null}
            <Text
              style={[
                small ? typography.caption : typography.button,
                {color: v.fg},
              ]}>
              {label}
            </Text>
            {iconRight ? (
              <Icon
                name={iconRight}
                size={small ? 16 : 18}
                color={v.fg}
                style={styles.iconRight}
              />
            ) : null}
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
};

function computeVariant(v: AppButtonVariant): {container: ViewStyle; fg: string} {
  switch (v) {
    case 'primary':
      return {
        container: {backgroundColor: colors.accent},
        fg: colors.textInverse,
      };
    case 'gold':
      return {
        container: {backgroundColor: colors.gold},
        fg: colors.textInverse,
      };
    case 'secondary':
      return {
        container: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
        fg: colors.textPrimary,
      };
    case 'ghost':
      return {
        container: {backgroundColor: 'transparent'},
        fg: colors.accent,
      };
    case 'danger':
      return {
        container: {backgroundColor: colors.errorSoft, borderWidth: 1, borderColor: colors.error},
        fg: colors.error,
      };
  }
}

const styles = StyleSheet.create({
  base: {
    height: 50,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(2.5),
  },
  small: {
    height: 36,
    paddingHorizontal: spacing(1.5),
    borderRadius: radius.md,
  },
  block: {alignSelf: 'stretch'},
  row: {flexDirection: 'row', alignItems: 'center'},
  iconLeft: {marginRight: 8},
  iconRight: {marginLeft: 8},
});

export default AppButton;
