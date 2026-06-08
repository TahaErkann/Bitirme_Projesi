/**
 * TourLens Tasarım Sistemi — "Tarihi Doku" açık (light) teması.
 *
 * Konsept: tarihi yerleri/şahsiyetleri tanıtan bir uygulama için müze/arşiv
 * hissi veren bir palet. Parşömen krem zemin, derin zeytin-orman yeşili ana
 * renk, antik altın/bronz ikincil vurgu, sepya metin ve serif başlıklar.
 *
 * Renk paleti, tipografi, spacing, gölge ve hareket token'ları.
 * Tüm bileşenler buradaki sabitleri kullanır → tutarlı, sıcak, davetkâr görünüm.
 *
 * NOT: Token İSİMLERİ korunmuştur (accent, surface, textInverse, ...) ki
 * mevcut tüm ekranlar değişiklik gerektirmeden yeni paleti alsın. Yeni
 * eklenenler: gold*, onImage, imageScrim, scrim, gradient yardımcıları.
 */
import {Platform, TextStyle, ViewStyle} from 'react-native';

// ---------------------------------------------------------------- Renkler ---
export const colors = {
  // Parşömen / krem tonları (açık zemin)
  bg: '#F3EDDD', // Ana arka plan — parşömen krem
  bgElevated: '#FBF8EF', // Modal/yükseltilmiş yüzey — açık parşömen
  surface: '#FCFAF2', // Card/yüzey — sıcak beyaz
  surfaceAlt: '#ECE3CF', // Hover/press hali — kum
  surfaceMuted: '#F0E8D6', // Subtle iç bölme
  border: '#DBCFB4', // Hat/ayraç — kum sınırı
  borderSoft: '#E8DFC9', // Yumuşak sınır

  // Vurgu — derin zeytin-orman yeşili (ana marka rengi)
  accent: '#3F6B4F',
  accentSoft: 'rgba(63,107,79,0.13)',
  accentDeep: '#2F5640',

  // İkincil sıcak vurgu — antik altın / bronz (CTA, rozet, başlık süsü)
  gold: '#B0833A',
  goldSoft: 'rgba(176,131,58,0.15)',
  goldDeep: '#8C6526',

  // İkincil soğuk vurgu — soluk teal (info, link)
  info: '#4F8079',
  infoSoft: 'rgba(79,128,121,0.15)',

  // Durum renkleri (heritage paletine uyumlu)
  success: '#4C9A5E',
  successSoft: 'rgba(76,154,94,0.16)',
  warning: '#C2902F',
  error: '#BB4A33', // terracotta kırmızısı
  errorSoft: 'rgba(187,74,51,0.13)',

  // Yazı — sepya / espresso
  textPrimary: '#2A2A20',
  textSecondary: '#6B6552',
  textMuted: '#9A917B',
  textInverse: '#FBF8EF', // Yeşil/altın üstüne yazılan açık metin

  // Görsel üstü (foto üzerine) — açık tema olsa da fotoğraf üstünde
  // okunabilirlik için sabit açık metin + sıcak koyu maske gerekir.
  onImage: '#FBF8EF',
  imageScrim: 'rgba(28,25,15,0.55)',

  // Tab bar / system
  tabActive: '#3F6B4F',
  tabInactive: '#9A917B',
  tabBg: '#FBF8EF',

  // Diğer
  divider: '#E4DAC2',
  shimmer: '#EAE0CA',
  overlay: 'rgba(40,38,28,0.42)', // sıcak yarı saydam katman
  scrim: 'rgba(36,32,20,0.55)', // modal arka plan karartması
} as const;

// -------------------------------------------------------------- Spacing ---
// 8px grid — `spacing(1)` = 8, `spacing(2)` = 16, `spacing(0.5)` = 4
export const spacing = (n: number) => n * 8;

// -------------------------------------------------------------- Radius ---
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

// -------------------------------------------------------------- Typography ---
// Serif başlıklar "tarihi doku" hissini güçlendirir (müze/kitabe estetiği).
// Gövde metni okunabilirlik için sans-serif kalır.
const baseFont = Platform.select({
  ios: 'System',
  default: 'sans-serif',
});

const titleFont = Platform.select({
  ios: 'System',
  default: 'sans-serif-medium',
});

const serifFont = Platform.select({
  ios: 'Georgia',
  default: 'serif',
});

export const typography = {
  display: {
    fontFamily: serifFont,
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '700' as TextStyle['fontWeight'],
    letterSpacing: -0.4,
  },
  h1: {
    fontFamily: serifFont,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700' as TextStyle['fontWeight'],
    letterSpacing: -0.2,
  },
  h2: {
    fontFamily: serifFont,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700' as TextStyle['fontWeight'],
  },
  h3: {
    fontFamily: titleFont,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600' as TextStyle['fontWeight'],
  },
  bodyLarge: {
    fontFamily: baseFont,
    fontSize: 16,
    lineHeight: 25,
    fontWeight: '400' as TextStyle['fontWeight'],
  },
  body: {
    fontFamily: baseFont,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as TextStyle['fontWeight'],
  },
  caption: {
    fontFamily: baseFont,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as TextStyle['fontWeight'],
  },
  button: {
    fontFamily: titleFont,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '600' as TextStyle['fontWeight'],
    letterSpacing: 0.2,
  },
  overline: {
    fontFamily: titleFont,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600' as TextStyle['fontWeight'],
    letterSpacing: 1.4,
    textTransform: 'uppercase' as TextStyle['textTransform'],
  },
  // Serif alt başlık — küçük, italik, "kitabe" hissi (opsiyonel kullanım)
  serifLabel: {
    fontFamily: serifFont,
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic' as TextStyle['fontStyle'],
    fontWeight: '400' as TextStyle['fontWeight'],
  },
} satisfies Record<string, TextStyle>;

// -------------------------------------------------------------- Shadows ---
// Açık tema: sıcak, yumuşak gölgeler (düşük opaklık, sepya ton).
export const shadow = {
  sm: {
    shadowColor: '#5A4A2A',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 2,
  } as ViewStyle,
  md: {
    shadowColor: '#5A4A2A',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 5,
  } as ViewStyle,
  lg: {
    shadowColor: '#4A3C1E',
    shadowOffset: {width: 0, height: 12},
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  } as ViewStyle,
} as const;

// -------------------------------------------------------------- Animation ---
export const motion = {
  fast: 180,
  base: 260,
  slow: 420,
  ease: {
    standard: [0.4, 0, 0.2, 1] as const,
    decel: [0.0, 0, 0.2, 1] as const,
    accel: [0.4, 0, 1, 1] as const,
  },
} as const;

// -------------------------------------------------------------- Paper Theme Adapter ---
// react-native-paper'a verilecek MD3 LIGHT teması — kendi sistemimizle uyumlu.
import {MD3LightTheme} from 'react-native-paper';

export const paperTheme = {
  ...MD3LightTheme,
  dark: false,
  roundness: 3,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.accent,
    onPrimary: colors.textInverse,
    primaryContainer: colors.accentSoft,
    onPrimaryContainer: colors.accentDeep,
    secondary: colors.gold,
    onSecondary: colors.textInverse,
    secondaryContainer: colors.goldSoft,
    onSecondaryContainer: colors.goldDeep,
    tertiary: colors.info,
    background: colors.bg,
    onBackground: colors.textPrimary,
    surface: colors.surface,
    onSurface: colors.textPrimary,
    surfaceVariant: colors.surfaceAlt,
    onSurfaceVariant: colors.textSecondary,
    outline: colors.border,
    outlineVariant: colors.borderSoft,
    error: colors.error,
    onError: colors.textInverse,
    elevation: {
      ...MD3LightTheme.colors.elevation,
      level0: 'transparent',
      level1: colors.surface,
      level2: colors.surfaceAlt,
      level3: colors.bgElevated,
      level4: colors.bgElevated,
      level5: colors.bgElevated,
    },
  },
};

export const navTheme = {
  dark: false,
  colors: {
    primary: colors.accent,
    background: colors.bg,
    card: colors.bg,
    text: colors.textPrimary,
    border: colors.borderSoft,
    notification: colors.gold,
  },
  fonts: {
    regular: {fontFamily: baseFont as string, fontWeight: '400' as TextStyle['fontWeight']},
    medium: {fontFamily: titleFont as string, fontWeight: '500' as TextStyle['fontWeight']},
    bold: {fontFamily: serifFont as string, fontWeight: '700' as TextStyle['fontWeight']},
    heavy: {fontFamily: serifFont as string, fontWeight: '900' as TextStyle['fontWeight']},
  },
};

export type Colors = typeof colors;
