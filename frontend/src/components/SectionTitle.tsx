/**
 * SectionTitle — ekran içi bölüm başlığı (serif) + opsiyonel overline ve
 * sağda metin aksiyonu ("Tümü →" gibi).
 */
import React from 'react';
import {Pressable, StyleProp, StyleSheet, View, ViewStyle} from 'react-native';
import {Text} from 'react-native-paper';
import {colors, spacing, typography} from '@/utils/theme';

interface Props {
  title: string;
  overline?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

const SectionTitle: React.FC<Props> = ({
  title,
  overline,
  actionLabel,
  onAction,
  style,
}) => {
  return (
    <View style={[styles.row, style]}>
      <View style={{flex: 1}}>
        {overline ? (
          <Text style={[typography.overline, {color: colors.gold}]}>{overline}</Text>
        ) : null}
        <Text style={[typography.h2, {color: colors.textPrimary}]}>{title}</Text>
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={[typography.button, {color: colors.accent}]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
});

export default SectionTitle;
