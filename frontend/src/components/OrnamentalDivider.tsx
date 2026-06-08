/**
 * OrnamentalDivider — "tarihi doku" ayraç motifi.
 * İki yanda altın hairline + ortada 45° döndürülmüş küçük elmas (ya da ikon).
 * Müze/kitabe estetiğini vurgulamak için bölüm aralarında kullanılır.
 */
import React from 'react';
import {StyleProp, StyleSheet, View, ViewStyle} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {colors, spacing} from '@/utils/theme';

interface Props {
  style?: StyleProp<ViewStyle>;
  /** Ortadaki motif yerine bir MaterialIcons adı gösterir. */
  icon?: string;
  /** Hat + motif rengi (varsayılan altın). */
  tint?: string;
}

const OrnamentalDivider: React.FC<Props> = ({style, icon, tint = colors.gold}) => {
  return (
    <View style={[styles.row, style]}>
      <View style={[styles.line, {backgroundColor: tint}]} />
      {icon ? (
        <Icon name={icon} size={14} color={tint} style={styles.center} />
      ) : (
        <View style={[styles.diamond, {borderColor: tint}]} />
      )}
      <View style={[styles.line, {backgroundColor: tint}]} />
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth * 2,
    opacity: 0.5,
  },
  center: {marginHorizontal: 2},
  diamond: {
    width: 7,
    height: 7,
    borderWidth: 1.4,
    transform: [{rotate: '45deg'}],
  },
});

export default OrnamentalDivider;
