/**
 * CameraScreen — "Tarihi Doku" heritage redesign.
 * Galeriden seç veya kameradan çek.
 *
 * - Manifestte CAMERA izni var; bu yüzden launchCamera öncesi runtime izni
 *   istemek gerekiyor (image-picker'ın gereksinimi).
 * - Yükleme başarılı olunca pipeline ekranına (Processing) geçilir.
 *
 * Görsel dil: parşömen zemin, altın halkalı dairesel kahraman ikon, serif
 * başlık + altın overline, yeşil/altın aksiyon butonları (AppButton) ve
 * OrnamentalDivider ile ayrılmış "kitabe" hissi veren ipuçları kartı.
 */
import React, {useEffect, useRef, useState} from 'react';
import {
  Alert,
  Animated,
  Easing,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {Text} from '@/components/AppText';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {SafeAreaView} from 'react-native-safe-area-context';
import {launchCamera, launchImageLibrary, Asset} from 'react-native-image-picker';

import {uploadImage} from '@/services/uploadService';
import {extractErrorMessage} from '@/utils/helpers';
import {useLanguage} from '@/context/LanguageContext';
import {colors, spacing, typography, shadow} from '@/utils/theme';
import AppButton from '@/components/AppButton';
import AppCard from '@/components/AppCard';
import OrnamentalDivider from '@/components/OrnamentalDivider';

const CameraScreen: React.FC<{navigation: any}> = ({navigation}) => {
  const {t} = useLanguage();
  const [busy, setBusy] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(20)).current;
  const ring = useRef(new Animated.Value(0)).current;

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

  // Kahraman ikonun altın halkasında yumuşak "nabız" döngüsü.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ring, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(ring, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [ring]);

  const requestCameraPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    const has = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.CAMERA,
    );
    if (has) return true;
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: t('camera.permTitle'),
        message: t('camera.permMessage'),
        buttonPositive: t('camera.permGrant'),
        buttonNegative: t('common.cancel'),
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  };

  /** Doğrudan yükleme — kamera akışı için (crop'sız). */
  const uploadDirect = async (asset?: Asset) => {
    if (!asset?.uri) return;
    setBusy(true);
    try {
      const resp = await uploadImage(asset.uri, asset.type ?? 'image/jpeg');
      navigation.navigate('Processing', {taskId: resp.task_id});
    } catch (e) {
      Alert.alert(t('camera.uploadError'), extractErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  /** Galeri akışı — kullanıcı önce CropScreen'de istediği bölgeyi seçer. */
  const pickFromGallery = async () => {
    const r = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: 0.8,
    });
    if (r.didCancel) return;
    if (r.errorCode) {
      Alert.alert(t('camera.galleryError'), r.errorMessage ?? r.errorCode);
      return;
    }
    const asset = r.assets?.[0];
    if (!asset?.uri) return;
    navigation.navigate('Crop', {
      imageUri: asset.uri,
      imageType: asset.type ?? 'image/jpeg',
    });
  };

  const takePhoto = async () => {
    const granted = await requestCameraPermission();
    if (!granted) {
      Alert.alert(t('camera.permDenied'), t('camera.permDeniedSub'));
      return;
    }
    const r = await launchCamera({
      mediaType: 'photo',
      quality: 0.8,
      saveToPhotos: false,
    });
    if (r.didCancel) return;
    if (r.errorCode) {
      Alert.alert(t('camera.cameraError'), r.errorMessage ?? r.errorCode);
      return;
    }
    uploadDirect(r.assets?.[0]);
  };

  const ringScale = ring.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });
  const ringOpacity = ring.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 0],
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        {/* Kahraman bölümü — altın halkalı dairesel ikon + serif başlık */}
        <Animated.View
          style={[
            styles.heroWrap,
            {opacity: fade, transform: [{translateY: lift}]},
          ]}>
          <View style={styles.heroIconWrap}>
            <Animated.View
              style={[
                styles.heroPulse,
                {opacity: ringOpacity, transform: [{scale: ringScale}]},
              ]}
            />
            <View style={styles.heroIcon}>
              <Icon name="photo-camera" size={40} color={colors.accent} />
            </View>
          </View>

          <Text style={[typography.overline, styles.overline]}>
            {t('camera.tipSize')}
          </Text>
          <Text style={[typography.h1, styles.heroTitle]}>
            {t('camera.title')}
          </Text>
          <Text style={[typography.bodyLarge, styles.heroSub]}>
            {t('camera.subtitle')}
          </Text>
        </Animated.View>

        {/* Aksiyonlar — yeşil ana CTA + altın galeri CTA */}
        <Animated.View
          style={[
            styles.actions,
            {opacity: fade, transform: [{translateY: lift}]},
          ]}>
          <AppButton
            variant="primary"
            icon="photo-camera"
            label={busy ? t('camera.uploading') : t('camera.takePhoto')}
            onPress={takePhoto}
            loading={busy}
            block
          />
          <AppButton
            variant="gold"
            icon="photo-library"
            label={t('camera.gallery')}
            onPress={pickFromGallery}
            disabled={busy}
            block
          />
        </Animated.View>

        {/* İpuçları — kitabe hissi veren altın kenarlı kart */}
        <Animated.View
          style={[
            styles.tipsWrap,
            {opacity: fade, transform: [{translateY: lift}]},
          ]}>
          <OrnamentalDivider
            icon="auto-awesome"
            style={styles.tipsDivider}
          />
          <AppCard accentEdge>
            <TipRow icon="straighten" text={t('camera.tipSize')} />
            <TipRow icon="center-focus-strong" text={t('camera.tipFraming')} />
            <TipRow icon="rotate-90-degrees-ccw" text={t('camera.tipTilted')} />
          </AppCard>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

const TipRow: React.FC<{icon: string; text: string}> = ({icon, text}) => (
  <View style={styles.tipRow}>
    <View style={styles.tipIcon}>
      <Icon name={icon} size={15} color={colors.gold} />
    </View>
    <Text style={[typography.body, {color: colors.textPrimary, flex: 1}]}>
      {text}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.bg},
  scroll: {
    flexGrow: 1,
    padding: spacing(3),
    justifyContent: 'center',
  },
  heroWrap: {alignItems: 'center', marginBottom: spacing(4)},
  heroIconWrap: {
    width: 104,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(2.5),
  },
  heroPulse: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.accentSoft,
  },
  heroIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.accentSoft,
    borderWidth: 1.5,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.md,
  },
  overline: {color: colors.gold, marginBottom: spacing(0.75)},
  heroTitle: {
    color: colors.textPrimary,
    textAlign: 'center',
  },
  heroSub: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing(1),
    paddingHorizontal: spacing(1),
  },
  actions: {gap: spacing(1.5)},
  tipsWrap: {marginTop: spacing(4)},
  tipsDivider: {marginBottom: spacing(2)},
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing(0.75),
    gap: spacing(1.25),
  },
  tipIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default CameraScreen;
