/**
 * react-native-vector-icons (v10) alt-yol importları için tip bildirimi.
 * Paket bu alt-yollar için kendi .d.ts'ini sağlamadığından tsc TS7016 verir;
 * bu bildirim modülleri tanıtarak hatayı giderir (default export: ikon bileşeni).
 *
 * IconProps gevşek tutulur: gerçek Icon, prop'ları altındaki <Text>'e geçirir;
 * bu yüzden style/pointerEvents/allowFontScaling gibi alanları kabul eder.
 */
declare module 'react-native-vector-icons/MaterialIcons' {
  import {Component} from 'react';
  import {StyleProp, TextStyle} from 'react-native';
  export interface IconProps {
    name: string;
    size?: number;
    color?: string;
    style?: StyleProp<TextStyle>;
    pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
    allowFontScaling?: boolean;
    accessibilityLabel?: string;
    testID?: string;
    onPress?: () => void;
  }
  export default class Icon extends Component<IconProps> {}
}

declare module 'react-native-vector-icons/MaterialCommunityIcons' {
  import {Component} from 'react';
  import {StyleProp, TextStyle} from 'react-native';
  export interface IconProps {
    name: string;
    size?: number;
    color?: string;
    style?: StyleProp<TextStyle>;
    pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
    allowFontScaling?: boolean;
    accessibilityLabel?: string;
    testID?: string;
    onPress?: () => void;
  }
  export default class Icon extends Component<IconProps> {}
}
