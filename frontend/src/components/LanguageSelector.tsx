/**
 * Dil seçim bileşeni — antrasit tema ile uyumlu chip'ler.
 * Aktif chip antrasit yerine accent dolgulu, sıcak görünüm sağlar.
 */
import React from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {Text} from '@/components/AppText';

import {LanguageCode, SUPPORTED_LANGUAGES} from '@/utils/constants';
import {colors, radius, typography} from '@/utils/theme';

interface Props {
  value: LanguageCode;
  onChange: (lang: LanguageCode) => void;
}

const LanguageSelector: React.FC<Props> = ({value, onChange}) => {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.row}>
        {SUPPORTED_LANGUAGES.map(l => {
          const active = value === l.code;
          return (
            <Pressable
              key={l.code}
              onPress={() => onChange(l.code)}
              style={[styles.chip, active && styles.chipActive]}
              hitSlop={4}>
              <Text
                style={[
                  typography.caption,
                  {
                    color: active ? colors.textInverse : colors.textPrimary,
                    fontWeight: active ? '700' : '500',
                  },
                ]}>
                {l.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  row: {flexDirection: 'row', paddingVertical: 4},
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
});

export default LanguageSelector;
