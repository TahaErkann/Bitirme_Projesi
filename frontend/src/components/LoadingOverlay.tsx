/**
 * Tam ekran yükleniyor göstergesi (antrasit tema).
 */
import React from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import {Text} from 'react-native-paper';
import {colors, typography} from '@/utils/theme';

interface Props {
  visible?: boolean;
  label?: string;
}

const LoadingOverlay: React.FC<Props> = ({visible = true, label}) => {
  if (!visible) return null;
  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="large" color={colors.accent} />
      {!!label && (
        <Text
          style={[
            typography.body,
            {marginTop: 12, color: colors.textPrimary},
          ]}>
          {label}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(243,237,221,0.88)',
  },
});

export default LoadingOverlay;
