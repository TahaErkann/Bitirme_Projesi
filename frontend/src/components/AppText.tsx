/**
 * AppText — React Native'in kendi <Text>'ini saran ince bileşen.
 *
 * Neden var: react-native-paper'ın <Text> bileşeni `=> ReactNode` olarak
 * tiplenmiştir; @types/react 18.x altında `ReactNode` döndüren bir fonksiyon
 * geçerli bir JSX bileşeni SAYILMAZ ve tsc "TS2786: 'Text' cannot be used as a
 * JSX component" hatası verir. Bu wrapper geçerli bir JSX.Element döndürdüğü
 * için sorunu kökten çözer. Paper'ın `variant`'ını kullanmadığımız ve metin
 * stillerini her yerde açıkça (typography token'larıyla) verdiğimiz için
 * görsel davranış birebir aynıdır.
 *
 * Kullanım, Paper ile aynı:  import {Text} from '@/components/AppText';
 */
import React from 'react';
import {Text as RNText, TextProps} from 'react-native';

export const Text: React.FC<TextProps> = props => <RNText {...props} />;

export default Text;
