/**
 * AppCard — temalı, basıldığında scale animasyonu yapan kart.
 * Pressable opsiyoneldir; onPress yoksa View davranışı gösterir.
 */
import React, {useRef} from 'react';
import {
  Animated,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import {colors, radius, shadow, spacing} from '@/utils/theme';

interface Props {
  onPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  elevated?: boolean;
  bordered?: boolean;
  /** Sol kenarda altın "kitabe/defter" şeridi (heritage vurgu). */
  accentEdge?: boolean;
}

const AppCard: React.FC<Props> = ({
  onPress,
  children,
  style,
  padded = true,
  elevated = false,
  bordered = true,
  accentEdge = false,
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const containerStyles: StyleProp<ViewStyle> = [
    styles.card,
    bordered && styles.bordered,
    padded && styles.padded,
    elevated && shadow.md,
    accentEdge && styles.accentEdge,
    style,
  ];

  if (!onPress) {
    return <View style={containerStyles}>{children}</View>;
  }

  return (
    <Pressable
      onPressIn={() =>
        Animated.spring(scale, {
          toValue: 0.985,
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
      onPress={onPress}>
      <Animated.View style={[containerStyles, {transform: [{scale}]}]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  bordered: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  padded: {
    padding: spacing(2),
  },
  accentEdge: {
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
  },
});

export default AppCard;
