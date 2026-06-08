/**
 * RegisterScreen — yeni hesap oluştur.
 * "Tarihi Doku" açık tema: parşömen zemin, altın overline + serif başlık,
 * ornamental ayraç, altın kenarlı kayıt kartı, canlı validasyon ipuçları
 * (yeşil başarı / soluk durum). Animasyonlu giriş (fade + lift).
 */
import React, {useEffect, useMemo, useRef, useState} from 'react';
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

import {register} from '@/services/authService';
import {useAuth} from '@/hooks/useAuth';
import {useLanguage} from '@/context/LanguageContext';
import {extractErrorMessage} from '@/utils/helpers';
import {colors, radius, shadow, spacing, typography} from '@/utils/theme';
import AppButton from '@/components/AppButton';
import AppInput from '@/components/AppInput';
import AppCard from '@/components/AppCard';
import OrnamentalDivider from '@/components/OrnamentalDivider';

const RegisterScreen: React.FC<{navigation: any}> = ({navigation}) => {
  const {t, lang} = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const {setUser} = useAuth();

  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 460,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        toValue: 0,
        duration: 460,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, lift]);

  const checks = useMemo(
    () => ({
      nameOk: name.trim().length >= 2,
      emailOk: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
      passLong: password.length >= 8,
      passMixed: /[A-Za-z]/.test(password) && /\d/.test(password),
    }),
    [name, email, password],
  );
  const allOk = Object.values(checks).every(Boolean);

  const submit = async () => {
    if (!allOk) {
      Alert.alert(t('common.required'), t('register.invalid'));
      return;
    }
    setBusy(true);
    try {
      const auth = await register({
        email: email.trim(),
        password,
        display_name: name.trim(),
        preferred_language: lang,
      });
      setUser(auth.user);
    } catch (e) {
      Alert.alert(t('register.failed'), extractErrorMessage(e));
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
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={10}>
            <Icon name="arrow-back" size={22} color={colors.textPrimary} />
          </Pressable>

          <Animated.View
            style={{opacity: fade, transform: [{translateY: lift}]}}>
            {/* Başlık bloğu — altın amblem + overline + serif başlık */}
            <View style={styles.headerWrap}>
              <View style={styles.crest}>
                <Icon
                  name="how-to-reg"
                  size={30}
                  color={colors.accent}
                />
              </View>
              <Text style={[typography.overline, styles.overline]}>
                {t('auth.brand')}
              </Text>
              <Text style={[typography.h1, styles.title]}>
                {t('register.title')}
              </Text>
              <Text style={[typography.body, styles.subtitle]}>
                {t('register.subtitle')}
              </Text>
            </View>

            <OrnamentalDivider
              icon="auto-awesome"
              style={styles.headerDivider}
            />

            {/* Kayıt kartı — altın "kitabe" kenarlı */}
            <AppCard accentEdge elevated style={styles.formCard}>
              <AppInput
                label={t('register.fullName')}
                icon="badge"
                value={name}
                onChangeText={setName}
                placeholder={t('register.fullNamePlaceholder')}
              />
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
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                placeholder={t('register.passwordHint')}
                containerStyle={styles.lastInput}
              />

              <View style={styles.checksWrap}>
                <CheckRow ok={checks.nameOk} label={t('register.checkName')} />
                <CheckRow
                  ok={checks.emailOk}
                  label={t('register.checkEmail')}
                />
                <CheckRow
                  ok={checks.passLong}
                  label={t('register.checkPassLong')}
                />
                <CheckRow
                  ok={checks.passMixed}
                  label={t('register.checkPassMixed')}
                />
              </View>
            </AppCard>

            <AppButton
              label={t('auth.signUp')}
              onPress={submit}
              loading={busy}
              disabled={!allOk}
              icon="how-to-reg"
              style={{marginTop: spacing(2.5)}}
            />
            <AppButton
              label={t('register.backToLogin')}
              variant="ghost"
              onPress={() => navigation.goBack()}
              style={{marginTop: spacing(0.5)}}
            />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const CheckRow: React.FC<{ok: boolean; label: string}> = ({ok, label}) => (
  <View style={styles.checkRow}>
    <View
      style={[
        styles.checkBullet,
        {
          backgroundColor: ok ? colors.successSoft : colors.surfaceAlt,
          borderColor: ok ? colors.success : colors.border,
        },
      ]}>
      <Icon
        name={ok ? 'check' : 'remove'}
        size={13}
        color={ok ? colors.success : colors.textMuted}
      />
    </View>
    <Text
      style={[
        typography.caption,
        {color: ok ? colors.textPrimary : colors.textSecondary, flex: 1},
      ]}>
      {label}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.bg},
  scroll: {flexGrow: 1, padding: spacing(3)},
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(2),
  },
  headerWrap: {alignItems: 'center'},
  crest: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    backgroundColor: colors.accentSoft,
    borderWidth: 1.5,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(1.5),
    ...shadow.sm,
  },
  overline: {
    color: colors.gold,
    textAlign: 'center',
  },
  title: {
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: 6,
  },
  subtitle: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: spacing(1),
  },
  headerDivider: {
    marginTop: spacing(2),
    marginBottom: spacing(2.5),
    paddingHorizontal: spacing(2),
  },
  formCard: {
    padding: spacing(2.5),
  },
  lastInput: {marginBottom: spacing(0.5)},
  checksWrap: {marginTop: spacing(1), gap: 8},
  checkRow: {flexDirection: 'row', alignItems: 'center', gap: 10},
  checkBullet: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default RegisterScreen;
