/**
 * SettingsScreen — "Tarihi Doku" (heritage) açık tema yeniden tasarımı.
 * - Hesap bilgisi (parşömen kart, altın overline)
 * - Uygulama dili (canlı değişir, AsyncStorage'a yazılır + backend preferred_language sync)
 * - Şifre değiştirme (parşömen modal — serif başlık)
 * - Tehlikeli bölge: hesabı sil (terracotta/error tonlu kart)
 * Tüm mantık (state, handler'lar, servis çağrıları, i18n anahtarları) korunmuştur.
 */
import React, {useEffect, useRef, useState} from 'react';
import {
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {Text} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {SafeAreaView} from 'react-native-safe-area-context';

import {api} from '@/services/api';
import {changePassword, updateMe} from '@/services/authService';
import {useAuth} from '@/hooks/useAuth';
import {useLanguage} from '@/context/LanguageContext';
import {extractErrorMessage} from '@/utils/helpers';
import {LanguageCode, SUPPORTED_LANGUAGES} from '@/utils/constants';
import {colors, radius, shadow, spacing, typography} from '@/utils/theme';
import AppButton from '@/components/AppButton';
import AppCard from '@/components/AppCard';
import AppInput from '@/components/AppInput';
import ScreenHeader from '@/components/ScreenHeader';
import OrnamentalDivider from '@/components/OrnamentalDivider';

const SettingsScreen: React.FC = () => {
  const {signOut, user, setUser} = useAuth();
  const {lang, setLang, t} = useLanguage();

  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);

  // Yumuşak giriş animasyonu (fade + lift) — yalnızca görsel.
  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(18)).current;

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

  const onPickLanguage = async (code: LanguageCode) => {
    setLangPickerOpen(false);
    if (code === lang) return;
    await setLang(code);
    try {
      const updated = await updateMe({preferred_language: code});
      setUser(updated);
    } catch (e) {
      Alert.alert(t('common.error'), extractErrorMessage(e));
    }
  };

  const deleteAccount = () => {
    Alert.alert(
      t('settings.deleteConfirmTitle'),
      t('settings.deleteConfirmBody'),
      [
        {text: t('common.cancel'), style: 'cancel'},
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete('/users/me');
              await signOut();
            } catch (e) {
              Alert.alert(t('common.error'), extractErrorMessage(e));
            }
          },
        },
      ],
    );
  };

  const currentLangLabel =
    SUPPORTED_LANGUAGES.find(l => l.code === lang)?.label ?? lang.toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        <ScreenHeader
          overline={t('tab.profile')}
          title={t('profile.settings')}
          subtitle={t('profile.settingsSub')}
        />

        <Animated.View
          style={{opacity: fade, transform: [{translateY: lift}]}}>
          {/* Hesap */}
          <Text style={[typography.overline, styles.overline]}>
            {t('settings.account')}
          </Text>
          <AppCard accentEdge elevated style={styles.card}>
            <View style={styles.row}>
              <View style={styles.iconBadge}>
                <Icon name="mail-outline" size={18} color={colors.accent} />
              </View>
              <View style={{marginLeft: spacing(1.5), flex: 1}}>
                <Text style={[typography.caption, {color: colors.textMuted}]}>
                  {t('settings.account')}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    typography.body,
                    {color: colors.textPrimary, fontWeight: '600', marginTop: 2},
                  ]}>
                  {user?.email ?? '—'}
                </Text>
              </View>
            </View>
          </AppCard>

          {/* Uygulama dili */}
          <Text
            style={[
              typography.overline,
              styles.overline,
              {marginTop: spacing(2.5)},
            ]}>
            {t('settings.changeLanguage')}
          </Text>
          <AppCard onPress={() => setLangPickerOpen(true)} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.iconBadge}>
                <Icon name="translate" size={18} color={colors.accent} />
              </View>
              <View style={{marginLeft: spacing(1.5), flex: 1}}>
                <Text
                  style={[
                    typography.h3,
                    {color: colors.textPrimary},
                  ]}>
                  {currentLangLabel}
                </Text>
                <Text
                  style={[
                    typography.caption,
                    {color: colors.textSecondary, marginTop: 2},
                  ]}>
                  {t('settings.changeLanguageSub')}
                </Text>
              </View>
              <Icon name="chevron-right" size={22} color={colors.gold} />
            </View>
          </AppCard>

          {/* Şifre */}
          <Text
            style={[
              typography.overline,
              styles.overline,
              {marginTop: spacing(2.5)},
            ]}>
            {t('settings.password')}
          </Text>
          <AppCard onPress={() => setPwOpen(true)} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.iconBadge}>
                <Icon name="lock-outline" size={18} color={colors.accent} />
              </View>
              <Text
                style={[
                  typography.h3,
                  {color: colors.textPrimary, marginLeft: spacing(1.5), flex: 1},
                ]}>
                {t('settings.changePassword')}
              </Text>
              <Icon name="chevron-right" size={22} color={colors.gold} />
            </View>
          </AppCard>

          <OrnamentalDivider
            icon="warning-amber"
            tint={colors.error}
            style={{marginTop: spacing(3), marginBottom: spacing(0.5)}}
          />

          {/* Tehlikeli bölge */}
          <Text
            style={[
              typography.overline,
              styles.overline,
              {color: colors.error, marginTop: spacing(1.5)},
            ]}>
            {t('settings.danger')}
          </Text>
          <AppCard style={[styles.card, styles.dangerCard]}>
            <View style={styles.dangerHead}>
              <View style={styles.dangerIcon}>
                <Icon name="warning-amber" size={20} color={colors.error} />
              </View>
              <Text
                style={[
                  typography.h2,
                  {color: colors.error, marginLeft: spacing(1.25), flex: 1},
                ]}>
                {t('settings.deleteAccount')}
              </Text>
            </View>
            <Text
              style={[
                typography.body,
                {
                  color: colors.textSecondary,
                  marginTop: spacing(1),
                  lineHeight: 21,
                },
              ]}>
              {t('settings.deleteSub')}
            </Text>
            <AppButton
              label={t('settings.deleteAccount')}
              variant="danger"
              icon="delete-outline"
              onPress={deleteAccount}
              style={{marginTop: spacing(2)}}
            />
          </AppCard>
        </Animated.View>

        <View style={{height: spacing(3)}} />
      </ScrollView>

      <LanguagePickerModal
        visible={langPickerOpen}
        current={lang}
        onClose={() => setLangPickerOpen(false)}
        onPick={onPickLanguage}
        title={t('settings.changeLanguage')}
        cancelLabel={t('common.cancel')}
      />

      <ChangePasswordModal
        visible={pwOpen}
        onClose={() => setPwOpen(false)}
      />
    </SafeAreaView>
  );
};

// ---------------- Language picker ----------------

const LanguagePickerModal: React.FC<{
  visible: boolean;
  current: LanguageCode;
  onClose: () => void;
  onPick: (l: LanguageCode) => void;
  title: string;
  cancelLabel: string;
}> = ({visible, current, onClose, onPick, title, cancelLabel}) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onClose}>
    <Pressable style={styles.modalScrim} onPress={onClose}>
      <Pressable style={styles.modalCard} onPress={() => undefined}>
        <View style={styles.modalHeader}>
          <View style={styles.modalIcon}>
            <Icon name="translate" size={20} color={colors.accent} />
          </View>
          <Text style={[typography.h2, {color: colors.textPrimary, marginTop: spacing(1)}]}>
            {title}
          </Text>
          <OrnamentalDivider style={{marginTop: spacing(1.25)}} />
        </View>
        <ScrollView style={{maxHeight: 360}}>
          {SUPPORTED_LANGUAGES.map(l => {
            const active = l.code === current;
            return (
              <Pressable
                key={l.code}
                onPress={() => onPick(l.code)}
                style={({pressed}) => [
                  styles.langRow,
                  active && styles.langRowActive,
                  pressed && {backgroundColor: colors.surfaceAlt},
                ]}>
                <View style={[styles.langCodeChip, active && styles.langCodeChipActive]}>
                  <Text
                    style={[
                      styles.langCode,
                      {color: active ? colors.textInverse : colors.goldDeep},
                    ]}>
                    {l.code.toUpperCase()}
                  </Text>
                </View>
                <Text
                  style={[
                    typography.body,
                    {
                      color: active ? colors.accent : colors.textPrimary,
                      flex: 1,
                      fontWeight: active ? '700' : '400',
                    },
                  ]}>
                  {l.label}
                </Text>
                {active ? (
                  <Icon name="check-circle" size={20} color={colors.accent} />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={{padding: spacing(2), paddingTop: spacing(1.5)}}>
          <AppButton label={cancelLabel} variant="ghost" onPress={onClose} />
        </View>
      </Pressable>
    </Pressable>
  </Modal>
);

// ---------------- Change password ----------------

const ChangePasswordModal: React.FC<{
  visible: boolean;
  onClose: () => void;
}> = ({visible, onClose}) => {
  const {t} = useLanguage();
  const [cur, setCur] = useState('');
  const [n1, setN1] = useState('');
  const [n2, setN2] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setCur('');
    setN1('');
    setN2('');
  };

  const submit = async () => {
    if (n1.length < 8) {
      Alert.alert(t('common.required'), t('settings.passwordTooShort'));
      return;
    }
    if (n1 !== n2) {
      Alert.alert(t('common.required'), t('settings.passwordMismatch'));
      return;
    }
    setBusy(true);
    try {
      await changePassword({current_password: cur, new_password: n1});
      Alert.alert(t('common.success'), t('settings.passwordChanged'));
      reset();
      onClose();
    } catch (e) {
      Alert.alert(t('common.error'), extractErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <Pressable style={styles.modalScrim} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => undefined}>
          <View style={styles.modalHeader}>
            <View style={styles.modalIcon}>
              <Icon name="lock-outline" size={20} color={colors.accent} />
            </View>
            <Text style={[typography.h2, {color: colors.textPrimary, marginTop: spacing(1)}]}>
              {t('settings.changePassword')}
            </Text>
            <OrnamentalDivider style={{marginTop: spacing(1.25)}} />
          </View>
          <View style={{padding: spacing(2)}}>
            <AppInput
              label={t('settings.currentPassword')}
              icon="lock-outline"
              secureTextEntry
              value={cur}
              onChangeText={setCur}
            />
            <AppInput
              label={t('settings.newPassword')}
              icon="lock-reset"
              secureTextEntry
              value={n1}
              onChangeText={setN1}
            />
            <AppInput
              label={t('settings.newPasswordRepeat')}
              icon="lock-reset"
              secureTextEntry
              value={n2}
              onChangeText={setN2}
            />
            <View style={{flexDirection: 'row', gap: spacing(1)}}>
              <AppButton
                label={t('common.cancel')}
                variant="ghost"
                onPress={() => {
                  reset();
                  onClose();
                }}
                block={false}
                style={{flex: 1}}
              />
              <AppButton
                label={t('common.save')}
                onPress={submit}
                loading={busy}
                block={false}
                style={{flex: 1}}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.bg},
  scroll: {paddingBottom: spacing(2), paddingHorizontal: spacing(2.5)},
  overline: {
    color: colors.gold,
    marginBottom: spacing(1),
  },
  card: {backgroundColor: colors.surface},
  row: {flexDirection: 'row', alignItems: 'center', paddingVertical: 2},
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dangerCard: {
    borderColor: colors.error,
    backgroundColor: colors.errorSoft,
    borderLeftWidth: 3,
    borderLeftColor: colors.error,
  },
  dangerHead: {flexDirection: 'row', alignItems: 'center'},
  dangerIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalScrim: {
    flex: 1,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing(2),
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.lg,
  },
  modalHeader: {
    padding: spacing(2),
    paddingBottom: spacing(1.5),
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    backgroundColor: colors.surfaceMuted,
  },
  modalIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing(2),
    gap: spacing(1.5),
  },
  langRowActive: {
    backgroundColor: colors.accentSoft,
  },
  langCodeChip: {
    width: 40,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langCodeChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  langCode: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
});

export default SettingsScreen;
