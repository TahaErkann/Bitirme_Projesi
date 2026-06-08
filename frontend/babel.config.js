// Babel konfigürasyonu — RN 0.76 + module-resolver
// Not: react-native-reanimated paketi kaldırıldı (RN 0.76 ile uyumlu sabit
// sürüm bulmakta sorun çıkardı). Animasyonlar React Native'in kendi
// `Animated` API'siyle yapılır; navigation native-stack zaten reanimated
// gerektirmez.
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@': './src',
        },
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
      },
    ],
  ],
};
