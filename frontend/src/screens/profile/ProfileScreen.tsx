/**
 * ProfileScreen — "Tarihi Doku" profil & hesap menüsü.
 * - Parşömen krem zemin, sepya metin, zeytin yeşili + antik altın vurgu.
 * - Avatar başlığı (altın halka) + altın rol rozeti.
 * - Menü satırları tek bir AppCard içinde ince ayraçlarla.
 * - OrnamentalDivider dokunuşları, serif başlıklar.
 * Logic (hook'lar, navigation, i18n) birebir korunmuştur.
 */
import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Easing,
  Modal,
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
import AppButton from '@/components/AppButton';
import AppCard from '@/components/AppCard';
import OrnamentalDivider from '@/components/OrnamentalDivider';
import {colors, radius, shadow, spacing, typography} from '@/utils/theme';

const ProfileScreen: React.FC<{navigation: any}> = ({navigation}) => {
  const {user, signOut} = useAuth();
  const {t} = useLanguage();
  const [aboutOpen, setAboutOpen] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(18)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, lift]);

  const initials = (user?.display_name ?? 'U').slice(0, 2).toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        <Animated.View
          style={{opacity: fade, transform: [{translateY: lift}]}}>
          {/* Profil başlığı — altın halka avatar */}
          <AppCard padded={false} elevated style={styles.header}>
            <Icon
              name="account-balance"
              size={120}
              color={colors.accentSoft}
              style={styles.headerWatermark}
            />
            <View style={styles.headerInner}>
              <View style={styles.avatarRing}>
                <View style={styles.avatar}>
                  <Text style={[typography.h1, {color: colors.accent}]}>
                    {initials}
                  </Text>
                </View>
              </View>
              <Text
                style={[
                  typography.h2,
                  {color: colors.textPrimary, marginTop: spacing(1.5)},
                ]}>
                {user?.display_name ?? 'Gezgin'}
              </Text>
              <Text
                style={[
                  typography.body,
                  {color: colors.textSecondary, marginTop: 2},
                ]}>
                {user?.email ?? '—'}
              </Text>
              {user?.role ? (
                <View style={styles.roleBadge}>
                  <Icon
                    name="verified"
                    size={12}
                    color={colors.goldDeep}
                  />
                  <Text style={styles.roleText}>{user.role.toUpperCase()}</Text>
                </View>
              ) : null}
              <OrnamentalDivider style={styles.headerDivider} />
            </View>
          </AppCard>

          {/* Hesap menüsü — tek kart, ince ayraçlar */}
          <AppCard padded={false} bordered style={styles.menu}>
            <MenuRow
              icon="settings"
              label={t('profile.settings')}
              sub={t('profile.settingsSub')}
              onPress={() => navigation.navigate('Settings')}
            />
            <MenuRow
              icon="favorite-border"
              label={t('profile.likes')}
              sub={t('profile.likesSub')}
              onPress={() => navigation.navigate('MyPlaces', {mode: 'liked'})}
            />
            <MenuRow
              icon="photo-library"
              label={t('profile.uploads')}
              sub={t('profile.uploadsSub')}
              onPress={() => navigation.navigate('MyPlaces', {mode: 'uploads'})}
            />
            <MenuRow
              icon="info-outline"
              label={t('profile.about')}
              sub={t('profile.aboutSub')}
              onPress={() => setAboutOpen(true)}
            />
            <MenuRow
              icon="logout"
              label={t('profile.signOut')}
              onPress={signOut}
              destructive
              last
            />
          </AppCard>

          <Text style={styles.tagline}>{t('profile.tagline')}</Text>
        </Animated.View>
      </ScrollView>

      <AboutModal visible={aboutOpen} onClose={() => setAboutOpen(false)} />
    </SafeAreaView>
  );
};

// ---------------- Hakkında modalı ----------------

const AboutModal: React.FC<{visible: boolean; onClose: () => void}> = ({
  visible,
  onClose,
}) => {
  const {t} = useLanguage();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <Pressable style={styles.modalScrim} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => undefined}>
          <View style={styles.aboutHeader}>
            <View style={styles.aboutLogo}>
              <Icon name="travel-explore" size={28} color={colors.accent} />
            </View>
            <Text style={[typography.overline, styles.aboutOverline]}>
              {t('about.version')}
            </Text>
            <Text
              style={[
                typography.h2,
                {color: colors.textPrimary, marginTop: 2},
              ]}>
              JourEx
            </Text>
            <OrnamentalDivider style={styles.aboutTopDivider} />
          </View>
          <View style={styles.aboutBody}>
            <Text
              style={[
                typography.bodyLarge,
                {color: colors.textSecondary},
              ]}>
              {t('about.description')}
            </Text>
            <OrnamentalDivider
              icon="auto-stories"
              style={{marginVertical: spacing(1.75)}}
            />
            <AboutRow icon="translate" text={t('about.feat1')} />
            <AboutRow icon="photo-camera" text={t('about.feat2')} />
            <AboutRow icon="explore" text={t('about.feat3')} />
            <Text style={styles.aboutClosing}>{t('about.closing')}</Text>
          </View>
          <View style={{padding: spacing(2), paddingTop: 0}}>
            <AppButton
              label={t('common.close')}
              variant="secondary"
              onPress={onClose}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const AboutRow: React.FC<{icon: string; text: string}> = ({icon, text}) => (
  <View style={styles.aboutRow}>
    <View style={styles.aboutRowIcon}>
      <Icon name={icon} size={14} color={colors.gold} />
    </View>
    <Text
      style={[
        typography.body,
        {color: colors.textPrimary, flex: 1},
      ]}>
      {text}
    </Text>
  </View>
);

const MenuRow: React.FC<{
  icon: string;
  label: string;
  sub?: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
  last?: boolean;
}> = ({icon, label, sub, onPress, disabled, destructive, last}) => {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={{color: colors.surfaceAlt}}
      style={({pressed}) => [
        styles.menuRow,
        !last && styles.menuRowBorder,
        disabled && {opacity: 0.4},
        pressed && {backgroundColor: colors.surfaceAlt},
      ]}>
      <View
        style={[
          styles.menuIcon,
          destructive && {backgroundColor: colors.errorSoft},
        ]}>
        <Icon
          name={icon}
          size={20}
          color={destructive ? colors.error : colors.accent}
        />
      </View>
      <View style={{flex: 1}}>
        <Text
          style={[
            typography.body,
            {
              color: destructive ? colors.error : colors.textPrimary,
              fontWeight: '600',
            },
          ]}>
          {label}
        </Text>
        {sub ? (
          <Text
            style={[
              typography.caption,
              {color: colors.textMuted, marginTop: 2},
            ]}>
            {sub}
          </Text>
        ) : null}
      </View>
      <Icon
        name="chevron-right"
        size={22}
        color={destructive ? colors.error : colors.gold}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.bg},
  scroll: {padding: spacing(2.5), paddingBottom: spacing(4)},

  // Profil başlığı
  header: {
    alignItems: 'stretch',
    backgroundColor: colors.surface,
  },
  headerWatermark: {
    position: 'absolute',
    right: -24,
    top: -18,
    opacity: 0.8,
  },
  headerInner: {
    alignItems: 'center',
    paddingTop: spacing(3),
    paddingBottom: spacing(2),
    paddingHorizontal: spacing(2.5),
  },
  avatarRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 1.5,
    borderColor: colors.gold,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.accentSoft,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing(1.25),
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: colors.goldSoft,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  roleText: {
    color: colors.goldDeep,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  headerDivider: {
    marginTop: spacing(2.5),
    alignSelf: 'stretch',
  },

  // Menü
  menu: {
    marginTop: spacing(2.5),
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: spacing(2),
    gap: spacing(1.5),
  },
  menuRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagline: {
    ...typography.serifLabel,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing(3),
    letterSpacing: 0.3,
  },

  // Hakkında modalı
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
  aboutHeader: {
    alignItems: 'center',
    paddingTop: spacing(2.5),
    paddingHorizontal: spacing(2),
  },
  aboutLogo: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
    borderWidth: 1.5,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(1),
  },
  aboutOverline: {
    color: colors.gold,
  },
  aboutTopDivider: {
    marginTop: spacing(2),
    alignSelf: 'stretch',
  },
  aboutBody: {padding: spacing(2)},
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    gap: spacing(1.25),
  },
  aboutRowIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aboutClosing: {
    ...typography.serifLabel,
    color: colors.gold,
    textAlign: 'center',
    marginTop: spacing(1.75),
  },
});

export default ProfileScreen;
