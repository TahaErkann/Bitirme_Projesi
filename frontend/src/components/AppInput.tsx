/**
 * AppInput — özel temalı input. Focus halinde border accent rengine geçer
 * (animasyonlu), label hata durumunda kırmızıya döner.
 */
import React, {useRef, useState} from 'react';
import {
  Animated,
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Text} from 'react-native-paper';

import {colors, radius, spacing, typography} from '@/utils/theme';

interface Props extends TextInputProps {
  label?: string;
  icon?: string;
  error?: string | null;
  containerStyle?: StyleProp<ViewStyle>;
}

const AppInput: React.FC<Props> = ({
  label,
  icon,
  error,
  containerStyle,
  onFocus,
  onBlur,
  ...rest
}) => {
  const [focused, setFocused] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const animate = (to: number) =>
    Animated.timing(anim, {
      toValue: to,
      duration: 180,
      useNativeDriver: false,
    }).start();

  const borderColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, error ? colors.error : colors.accent],
  });

  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? (
        <Text
          style={[
            typography.overline,
            {color: error ? colors.error : colors.textSecondary, marginBottom: 6},
          ]}>
          {label}
        </Text>
      ) : null}
      <Animated.View
        style={[
          styles.fieldWrap,
          {
            borderColor,
            backgroundColor: focused ? colors.surfaceAlt : colors.surface,
          },
        ]}>
        {icon ? (
          <Icon
            name={icon}
            size={20}
            color={focused ? colors.accent : colors.textMuted}
            style={{marginRight: 8}}
          />
        ) : null}
        <TextInput
          {...rest}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.accent}
          style={[styles.input, rest.style]}
          onFocus={e => {
            setFocused(true);
            animate(1);
            onFocus?.(e);
          }}
          onBlur={e => {
            setFocused(false);
            animate(0);
            onBlur?.(e);
          }}
        />
      </Animated.View>
      {error ? (
        <Text style={[typography.caption, {color: colors.error, marginTop: 4}]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {marginBottom: spacing(1.5)},
  fieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing(1.75),
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
    paddingVertical: 0,
  },
});

export default AppInput;
