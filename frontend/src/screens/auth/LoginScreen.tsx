/**
 * LoginScreen — e-posta/şifre giriş.
 * "Tarihi Doku" açık teması: parşömen zemin, altın halkalı marka logosu,
 * serif marka başlığı + altın overline, ornamental ayraç, kart içinde form.
 * Tüm mantık (useAuth signIn, doğrulama, busy, i18n, animasyon) korunmuştur.
 */
import React, {useEffect, useRef, useState} from 'react';
import {
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {Text} from '@/components/AppText';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {SafeAreaView} from 'react-native-safe-area-context';

import {useAuth} from '@/hooks/useAuth';
import {useLanguage} from '@/context/LanguageContext';
import {extractErrorMessage} from '@/utils/helpers';
import {colors, radius, shadow, spacing, typography} from '@/utils/theme';
import AppButton from '@/components/AppButton';
import AppCard from '@/components/AppCard';
import AppInput from '@/components/AppInput';
import OrnamentalDivider from '@/components/OrnamentalDivider';

const LoginScreen: React.FC<{navigation: any}> = ({navigation}) => {
  const {t} = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const {signIn} = useAuth();

  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 480,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        toValue: 0,
        duration: 480,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, lift]);

  const submit = async () => {
    if (!email || !password) {
      Alert.alert(t('common.required'), t('auth.fillFields'));
      return;
    }
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      Alert.alert(t('auth.signInFailed'), extractErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Parşömen dokusu için sönük tarihi filigran */}
          <Icon
            name="account-balance"
            size={220}
            color={colors.accentSoft}
            style={styles.watermark}
            pointerEvents="none"
          />

          {/* Marka bloğu — altın halkalı logo + serif başlık + tagline */}
          <Animated.View
            style={[
              styles.brandWrap,
              {opacity: fade, transform: [{translateY: lift}]},
            ]}>
            <View style={styles.logoRing}>
              <View style={styles.logoInner}>
                <Icon name="travel-explore" size={38} color={colors.accent} />
              </View>
            </View>
            <Text style={[typography.display, styles.brand]}>
              {t('auth.brand')}
            </Text>
            <OrnamentalDivider style={styles.brandDivider} icon="auto-awesome" />
            <Text style={[typography.body, styles.tagline]}>
              {t('auth.tagline')}
            </Text>
          </Animated.View>

          {/* Form kartı — altın "kitabe/defter" kenarlı */}
          <Animated.View
            style={[
              styles.formWrap,
              {opacity: fade, transform: [{translateY: lift}]},
            ]}>
            <AppCard accentEdge elevated style={styles.formCard}>
              <AppInput
                label={t('auth.email')}
                icon="mail-outline"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
                placeholder="ornek@mail.com"
              />
              <AppInput
                label={t('auth.password')}
                icon="lock-outline"
                secureTextEntry={!showPass}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
              />
              <Pressable
                style={styles.toggleRow}
                onPress={() => setShowPass(s => !s)}
                hitSlop={8}>
                <Icon
                  name={showPass ? 'visibility-off' : 'visibility'}
                  size={16}
                  color={colors.gold}
                />
                <Text style={styles.toggleText}>
                  {showPass ? t('auth.passwordHide') : t('auth.passwordShow')}
                </Text>
              </Pressable>

              <AppButton
                label={t('auth.signIn')}
                onPress={submit}
                loading={busy}
                icon="login"
                style={{marginTop: spacing(1)}}
              />

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t('auth.newHere')}</Text>
                <View style={styles.dividerLine} />
              </View>

              <AppButton
                label={t('auth.signUp')}
                variant="secondary"
                onPress={() => navigation.navigate('Register')}
                icon="person-add-alt"
              />
            </AppCard>
          </Animated.View>

          <Animated.Text style={[styles.footer, {opacity: fade}]}>
            {t('auth.terms')}
          </Animated.Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.bg},
  scroll: {flexGrow: 1, padding: spacing(3), justifyContent: 'center'},
  watermark: {
    position: 'absolute',
    top: -40,
    right: -64,
    opacity: 0.7,
  },
  brandWrap: {alignItems: 'center', marginBottom: spacing(4)},
  logoRing: {
    width: 92,
    height: 92,
    borderRadius: radius.xl,
    backgroundColor: colors.goldSoft,
    borderWidth: 1.5,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(2),
    ...shadow.sm,
  },
  logoInner: {
    width: 70,
    height: 70,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overline: {
    ...typography.overline,
    color: colors.gold,
    marginBottom: 4,
  },
  brand: {color: colors.textPrimary, marginBottom: spacing(0.5)},
  brandDivider: {
    width: 132,
    marginTop: spacing(1),
    marginBottom: spacing(1.5),
  },
  tagline: {
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  formWrap: {},
  formCard: {
    padding: spacing(2.5),
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: -spacing(0.5),
    marginBottom: spacing(1),
    gap: 4,
  },
  toggleText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing(2.5),
    gap: spacing(1.5),
  },
  dividerLine: {flex: 1, height: 1, backgroundColor: colors.borderSoft},
  dividerText: {
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  footer: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: spacing(3),
    paddingHorizontal: spacing(2),
    lineHeight: 16,
  },
});

export default LoginScreen;
