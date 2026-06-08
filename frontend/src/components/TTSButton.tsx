/**
 * Sesli okuma butonu — useTTS hook'u sarmalar, antrasit tema uyumlu.
 */
import React from 'react';
import {Pressable, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useTTS} from '@/hooks/useTTS';
import {colors, radius} from '@/utils/theme';

interface Props {
  text: string;
  language?: string; // BCP-47 (örn. en-US, tr-TR)
}

const TTSButton: React.FC<Props> = ({text, language = 'en-US'}) => {
  const {speak, stop, speaking} = useTTS();
  const disabled = !text;

  return (
    <Pressable
      onPress={() => (speaking ? stop() : speak(text, language))}
      disabled={disabled}
      style={({pressed}) => [
        styles.btn,
        speaking && styles.active,
        disabled && styles.disabled,
        pressed && {opacity: 0.7},
      ]}
      hitSlop={6}
      accessibilityLabel="Sesli oku">
      <Icon
        name={speaking ? 'stop-circle' : 'volume-up'}
        size={22}
        color={speaking ? colors.textInverse : colors.accent}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  btn: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  active: {
    backgroundColor: colors.accent,
  },
  disabled: {opacity: 0.4},
});

export default TTSButton;
