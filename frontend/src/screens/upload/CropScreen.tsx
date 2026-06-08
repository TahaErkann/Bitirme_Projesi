/**
 * CropScreen — galeriden seçilen fotoğrafın istenen bölgesini seçmek için
 * draggable köşeli crop overlay'i.
 *
 * Tasarım kararları:
 *  - Yeni native bağımlılık YOK. PanResponder + react-native primitives.
 *  - Crop koordinatları görüntü oranına göre normalize (0..1) olarak
 *    hesaplanır; backend bu oranı kullanarak Pillow ile gerçek pixel-level
 *    crop uygular. Yani frontend'de gerçek pixel manipülasyonu yapmıyoruz.
 *  - Image.getSize ile orijinal en/boy oranı alınır; ekrana fit edilmiş
 *    "display rect" hesaplanır; crop seçimi bu display rect içinde olur.
 *  - Min crop boyutu 64dp (yanlışlıkla mikro seçimi engeller).
 *
 * Görsel dil ("Tarihi Doku" / heritage): parşömen zemin, altın overline +
 * serif başlık, ornamental ayraç, altın aksanlı yönerge kartı. Crop tuvali
 * (siyah zemin + karartma maskesi) odak için OLDUĞU GİBİ korunur; sadece
 * üst başlık, yönerge metni, footer butonları ve önizleme etiketi temalandı.
 */
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {Text} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {SafeAreaView} from 'react-native-safe-area-context';

import {uploadImage} from '@/services/uploadService';
import {useLanguage} from '@/context/LanguageContext';
import {colors, radius, shadow, spacing, typography} from '@/utils/theme';
import {extractErrorMessage} from '@/utils/helpers';
import AppButton from '@/components/AppButton';
import OrnamentalDivider from '@/components/OrnamentalDivider';

type Corner = 'tl' | 'tr' | 'bl' | 'br';

interface CropScreenParams {
  imageUri: string;
  imageType?: string;
}

const HANDLE_SIZE = 28;
const MIN_DIMENSION = 64;

const CropScreen: React.FC<{route: any; navigation: any}> = ({
  route,
  navigation,
}) => {
  const {t} = useLanguage();
  const params = (route.params ?? {}) as CropScreenParams;
  const {imageUri, imageType = 'image/jpeg'} = params;

  // Görüntü orijinal boyutları (Image.getSize'dan)
  const [imgSize, setImgSize] = useState<{w: number; h: number} | null>(null);
  // Render alanı (canvas) boyutu — onLayout'tan
  const [canvas, setCanvas] = useState<{w: number; h: number} | null>(null);

  // Yumuşak giriş animasyonu (fade + lift) — heritage referans deseni.
  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(16)).current;
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

  // Görüntünün canvas içindeki "fit" yerleşimi (px). Tüm crop hesapları
  // bu rect'e GÖRE yapılır; image padding zone'unda bir şey yapmıyoruz.
  const displayRect = useMemo(() => {
    if (!imgSize || !canvas) return null;
    const ratio = imgSize.w / imgSize.h;
    const cratio = canvas.w / canvas.h;
    let w: number;
    let h: number;
    if (ratio > cratio) {
      // Görüntü canvas'tan daha geniş — yatay sığdır
      w = canvas.w;
      h = canvas.w / ratio;
    } else {
      h = canvas.h;
      w = canvas.h * ratio;
    }
    return {
      x: (canvas.w - w) / 2,
      y: (canvas.h - h) / 2,
      w,
      h,
    };
  }, [imgSize, canvas]);

  // Crop dikdörtgeni — display rect'e göreli (px). Başlangıçta görüntünün
  // tamamı seçili.
  const [cropPx, setCropPx] = useState<{x: number; y: number; w: number; h: number} | null>(
    null,
  );
  // Drag başında "snapshot" — gestür sırasında stabil hesaplama için.
  const dragStartRef = useRef<{x: number; y: number; w: number; h: number} | null>(
    null,
  );

  // PanResponder'lar useRef ile bir kez oluşturuluyor; içleri stale
  // closure'a düşmesin diye state'i ref'lerle ayna tutuyoruz.
  const cropPxRef = useRef<{x: number; y: number; w: number; h: number} | null>(
    null,
  );
  const displayRectRef = useRef<{x: number; y: number; w: number; h: number} | null>(
    null,
  );
  useEffect(() => {
    cropPxRef.current = cropPx;
  }, [cropPx]);
  useEffect(() => {
    displayRectRef.current = displayRect;
  }, [displayRect]);

  const [busy, setBusy] = useState(false);

  // Önizleme paneli sadece kullanıcı görüntüyü "gerçekten" kırptığında
  // görünür — tüm görsel seçili haldeyken bilgi tekrarından ibaret olur.
  const isCropReduced = useMemo(() => {
    if (!cropPx || !displayRect) return false;
    return (
      cropPx.w < displayRect.w * 0.92 || cropPx.h < displayRect.h * 0.92
    );
  }, [cropPx, displayRect]);

  // Görüntü yüklendiğinde orijinal boyutları al
  useEffect(() => {
    if (!imageUri) return;
    Image.getSize(
      imageUri,
      (w, h) => setImgSize({w, h}),
      err => {
        // eslint-disable-next-line no-console
        console.warn('Image.getSize başarısız:', err);
        Alert.alert(t('crop.loadError'), t('crop.loadErrorBody'));
        navigation.goBack();
      },
    );
  }, [imageUri, navigation, t]);

  // displayRect oluşunca crop'u tüm görüntüyle eşitle
  useEffect(() => {
    if (!displayRect) return;
    setCropPx({
      x: displayRect.x,
      y: displayRect.y,
      w: displayRect.w,
      h: displayRect.h,
    });
  }, [displayRect]);

  /**
   * Crop dikdörtgenini görüntü sınırları içinde tutan sabitleyici.
   * displayRect'i ref üzerinden okur — PanResponder closure'ı içinde
   * çağrılabilsin diye (state doğrudan kullanılırsa stale closure olur).
   */
  const clampCrop = (
    next: {x: number; y: number; w: number; h: number},
  ): {x: number; y: number; w: number; h: number} => {
    const dr = displayRectRef.current;
    if (!dr) return next;
    const minW = Math.min(MIN_DIMENSION, dr.w);
    const minH = Math.min(MIN_DIMENSION, dr.h);
    let {x, y, w, h} = next;
    w = Math.max(minW, w);
    h = Math.max(minH, h);
    if (x < dr.x) {
      x = dr.x;
    }
    if (y < dr.y) {
      y = dr.y;
    }
    if (x + w > dr.x + dr.w) {
      w = dr.x + dr.w - x;
    }
    if (y + h > dr.y + dr.h) {
      h = dr.y + dr.h - y;
    }
    return {x, y, w, h};
  };

  /**
   * Köşe responder fabrikası — state'leri cropPxRef üzerinden okuyor;
   * useRef ile bir kez yaratılıyor ama her zaman güncel cropPx'i görüyor.
   */
  const makeCornerResponder = (corner: Corner) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const c = cropPxRef.current;
        if (c) dragStartRef.current = {...c};
      },
      onPanResponderMove: (_evt, g) => {
        const start = dragStartRef.current;
        if (!start) return;
        let {x, y, w, h} = start;
        if (corner === 'tl') {
          x = start.x + g.dx;
          y = start.y + g.dy;
          w = start.w - g.dx;
          h = start.h - g.dy;
        } else if (corner === 'tr') {
          y = start.y + g.dy;
          w = start.w + g.dx;
          h = start.h - g.dy;
        } else if (corner === 'bl') {
          x = start.x + g.dx;
          w = start.w - g.dx;
          h = start.h + g.dy;
        } else if (corner === 'br') {
          w = start.w + g.dx;
          h = start.h + g.dy;
        }
        setCropPx(clampCrop({x, y, w, h}));
      },
      onPanResponderRelease: () => {
        dragStartRef.current = null;
      },
      onPanResponderTerminate: () => {
        dragStartRef.current = null;
      },
    });

  /** Tüm dikdörtgeni sürüklemek için (içeriden parmakla). */
  const moveResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const c = cropPxRef.current;
        if (c) dragStartRef.current = {...c};
      },
      onPanResponderMove: (_evt, g) => {
        const start = dragStartRef.current;
        if (!start) return;
        setCropPx(
          clampCrop({
            x: start.x + g.dx,
            y: start.y + g.dy,
            w: start.w,
            h: start.h,
          }),
        );
      },
      onPanResponderRelease: () => {
        dragStartRef.current = null;
      },
      onPanResponderTerminate: () => {
        dragStartRef.current = null;
      },
    }),
  ).current;

  const tlResponder = useRef(makeCornerResponder('tl')).current;
  const trResponder = useRef(makeCornerResponder('tr')).current;
  const blResponder = useRef(makeCornerResponder('bl')).current;
  const brResponder = useRef(makeCornerResponder('br')).current;

  /** Kullanıcı "Atla"ya basarsa crop'sız yükle. */
  const skipCrop = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const resp = await uploadImage(imageUri, imageType);
      navigation.replace('Processing', {taskId: resp.task_id});
    } catch (e) {
      Alert.alert(t('camera.uploadError'), extractErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmCrop = async () => {
    if (busy) return;
    if (!displayRect || !cropPx) {
      // Görüntü daha yüklenmedi — düz yükle
      skipCrop();
      return;
    }
    // Display rect'e göre normalize edip uploadService'a ver
    const xN = (cropPx.x - displayRect.x) / displayRect.w;
    const yN = (cropPx.y - displayRect.y) / displayRect.h;
    const wN = cropPx.w / displayRect.w;
    const hN = cropPx.h / displayRect.h;

    // Kullanıcı seçimi neredeyse tüm görüntü ise crop göndermeye gerek yok
    const isFullSelection = wN > 0.97 && hN > 0.97 && xN < 0.02 && yN < 0.02;

    setBusy(true);
    try {
      const resp = await uploadImage(
        imageUri,
        imageType,
        isFullSelection ? undefined : {x: xN, y: yN, w: wN, h: hN},
      );
      navigation.replace('Processing', {taskId: resp.task_id});
    } catch (e) {
      Alert.alert(t('camera.uploadError'), extractErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Heritage başlık — altın overline + serif başlık + geri rozeti */}
      <Animated.View
        style={[styles.headerWrap, {opacity: fade, transform: [{translateY: lift}]}]}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            android_ripple={{color: colors.surfaceAlt, borderless: true}}
            hitSlop={10}>
            <Icon name="arrow-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.titleCol}>
            <Text style={[typography.overline, {color: colors.gold}]}>
              {t('crop.preview')}
            </Text>
            <Text style={[typography.h1, {color: colors.textPrimary}]}>
              {t('crop.title')}
            </Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {/* Yönerge — altın aksan kenarlı küçük kart */}
        <View style={styles.instructionCard}>
          <View style={styles.instructionIcon}>
            <Icon name="crop-free" size={16} color={colors.accent} />
          </View>
          <Text
            style={[
              typography.body,
              {color: colors.textSecondary, flex: 1},
            ]}>
            {t('crop.subtitle')}
          </Text>
        </View>

        <OrnamentalDivider style={styles.divider} icon="filter-center-focus" />
      </Animated.View>

      <Animated.View style={[styles.canvasWrap, {opacity: fade}]}>
        <View
          style={styles.canvas}
          onLayout={e => {
            const {width, height} = e.nativeEvent.layout;
            setCanvas({w: width, h: height});
          }}>
          {/* Resim */}
          {displayRect ? (
            <Image
              source={{uri: imageUri}}
              style={{
                position: 'absolute',
                left: displayRect.x,
                top: displayRect.y,
                width: displayRect.w,
                height: displayRect.h,
              }}
              resizeMode="contain"
            />
          ) : null}

          {/* Karartma maskesi — 4 parça (üst, alt, sol, sağ) */}
          {cropPx && canvas ? (
            <>
              <View
                style={[
                  styles.dim,
                  {left: 0, top: 0, width: canvas.w, height: cropPx.y},
                ]}
                pointerEvents="none"
              />
              <View
                style={[
                  styles.dim,
                  {
                    left: 0,
                    top: cropPx.y + cropPx.h,
                    width: canvas.w,
                    height: canvas.h - (cropPx.y + cropPx.h),
                  },
                ]}
                pointerEvents="none"
              />
              <View
                style={[
                  styles.dim,
                  {
                    left: 0,
                    top: cropPx.y,
                    width: cropPx.x,
                    height: cropPx.h,
                  },
                ]}
                pointerEvents="none"
              />
              <View
                style={[
                  styles.dim,
                  {
                    left: cropPx.x + cropPx.w,
                    top: cropPx.y,
                    width: canvas.w - (cropPx.x + cropPx.w),
                    height: cropPx.h,
                  },
                ]}
                pointerEvents="none"
              />

              {/* Crop kutusu (orta, sürüklenebilir) */}
              <View
                {...moveResponder.panHandlers}
                style={[
                  styles.box,
                  {
                    left: cropPx.x,
                    top: cropPx.y,
                    width: cropPx.w,
                    height: cropPx.h,
                  },
                ]}>
                {/* 3x3 grid çizgileri */}
                <View style={[styles.gridV, {left: '33.33%'}]} pointerEvents="none" />
                <View style={[styles.gridV, {left: '66.66%'}]} pointerEvents="none" />
                <View style={[styles.gridH, {top: '33.33%'}]} pointerEvents="none" />
                <View style={[styles.gridH, {top: '66.66%'}]} pointerEvents="none" />
              </View>

              {/* Köşe handle'ları */}
              <View
                {...tlResponder.panHandlers}
                style={[
                  styles.handle,
                  {left: cropPx.x - HANDLE_SIZE / 2, top: cropPx.y - HANDLE_SIZE / 2},
                ]}>
                <View style={styles.handleDot} />
              </View>
              <View
                {...trResponder.panHandlers}
                style={[
                  styles.handle,
                  {
                    left: cropPx.x + cropPx.w - HANDLE_SIZE / 2,
                    top: cropPx.y - HANDLE_SIZE / 2,
                  },
                ]}>
                <View style={styles.handleDot} />
              </View>
              <View
                {...blResponder.panHandlers}
                style={[
                  styles.handle,
                  {
                    left: cropPx.x - HANDLE_SIZE / 2,
                    top: cropPx.y + cropPx.h - HANDLE_SIZE / 2,
                  },
                ]}>
                <View style={styles.handleDot} />
              </View>
              <View
                {...brResponder.panHandlers}
                style={[
                  styles.handle,
                  {
                    left: cropPx.x + cropPx.w - HANDLE_SIZE / 2,
                    top: cropPx.y + cropPx.h - HANDLE_SIZE / 2,
                  },
                ]}>
                <View style={styles.handleDot} />
              </View>

              {/* Canlı zoom önizleme — kullanıcı bölgeyi küçülttükçe
                  seçili alanı büyük şekilde görür. pointerEvents="none"
                  ile köşe handle'larının dokunma alanını bloklamaz. */}
              {isCropReduced && imgSize ? (
                <CropPreview
                  cropPx={cropPx}
                  displayRect={displayRect!}
                  imageUri={imageUri}
                  label={t('crop.preview')}
                />
              ) : null}
            </>
          ) : null}
        </View>
      </Animated.View>

      <View style={styles.footer}>
        <View style={styles.footerSkip}>
          <AppButton
            label={t('crop.skip')}
            onPress={skipCrop}
            variant="secondary"
            icon="crop-original"
            disabled={busy}
          />
        </View>
        <View style={styles.footerConfirm}>
          <AppButton
            label={busy ? t('camera.uploading') : t('crop.confirm')}
            onPress={confirmCrop}
            variant="gold"
            icon="check"
            loading={busy}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

/**
 * CropPreview — kullanıcının seçtiği bölgeyi sabit küçük bir kutuda
 * **büyütülmüş** olarak gösterir. Kullanıcı köşeleri kıstıkça bu kutu
 * içindeki görüntü orantılı olarak yakınlaşır; OCR'a giden görselin
 * neye benzediğini canlı önizler.
 *
 * Matematik: cropPx (display rect içinde px) → preview kutusunun
 * (pW × pH) içinde tam dolacak şekilde kaynak görüntü scale + offset
 * ile yerleştirilir. Aspect ratio crop'a göre uyarlanır.
 */
const PREVIEW_MAX_W = 130;
const PREVIEW_MAX_H = 130;

const CropPreview: React.FC<{
  cropPx: {x: number; y: number; w: number; h: number};
  displayRect: {x: number; y: number; w: number; h: number};
  imageUri: string;
  label: string;
}> = ({cropPx, displayRect, imageUri, label}) => {
  if (cropPx.w <= 0 || cropPx.h <= 0) return null;

  // Crop'un en/boy oranı → preview kutusu boyutu
  const cropAspect = cropPx.w / cropPx.h;
  let pW: number;
  let pH: number;
  if (cropAspect >= 1) {
    pW = PREVIEW_MAX_W;
    pH = PREVIEW_MAX_W / cropAspect;
  } else {
    pH = PREVIEW_MAX_H;
    pW = PREVIEW_MAX_H * cropAspect;
  }

  // Scale: kaynak displayRect'i pW/cropPx.w oranında büyütünce
  // crop bölgesi tam pW × pH'a oturur.
  const scale = pW / cropPx.w;
  const dispW = displayRect.w * scale;
  const dispH = displayRect.h * scale;
  const offsetX = -(cropPx.x - displayRect.x) * scale;
  const offsetY = -(cropPx.y - displayRect.y) * scale;

  return (
    <View
      style={[styles.previewBox, {width: pW + 6}]}
      pointerEvents="none">
      <View style={styles.previewLabelWrap}>
        <Icon name="zoom-in" size={11} color={colors.goldDeep} />
        <Text style={styles.previewLabel}>{label}</Text>
      </View>
      <View
        style={{
          width: pW,
          height: pH,
          overflow: 'hidden',
          borderRadius: radius.sm,
          backgroundColor: '#000',
        }}>
        <Image
          source={{uri: imageUri}}
          style={{
            position: 'absolute',
            left: offsetX,
            top: offsetY,
            width: dispW,
            height: dispH,
          }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.bg},
  headerWrap: {
    paddingTop: spacing(0.5),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing(2.5),
    paddingTop: spacing(1),
    paddingBottom: spacing(1),
    gap: spacing(1.25),
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCol: {flex: 1},
  headerSpacer: {width: 40},
  instructionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.25),
    marginHorizontal: spacing(2.5),
    marginTop: spacing(0.5),
    paddingVertical: spacing(1.25),
    paddingHorizontal: spacing(1.75),
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    ...shadow.sm,
  },
  instructionIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    marginHorizontal: spacing(2.5),
    marginTop: spacing(1.5),
    marginBottom: spacing(0.5),
  },
  canvasWrap: {flex: 1},
  canvas: {
    flex: 1,
    margin: spacing(2),
    borderRadius: radius.lg,
    backgroundColor: '#000',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.md,
  },
  dim: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  box: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: 'transparent',
  },
  gridV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth * 2,
    backgroundColor: 'rgba(176,131,58,0.6)',
  },
  gridH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: 'rgba(176,131,58,0.6)',
  },
  handle: {
    position: 'absolute',
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.onImage,
  },
  previewBox: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 4,
    borderRadius: radius.md,
    backgroundColor: 'rgba(251,248,239,0.92)',
    borderWidth: 1.5,
    borderColor: colors.gold,
    ...shadow.md,
  },
  previewLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
    gap: 3,
  },
  previewLabel: {
    color: colors.goldDeep,
    fontSize: 9.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing(1.5),
    paddingHorizontal: spacing(2.5),
    paddingTop: spacing(1),
    paddingBottom: spacing(2),
  },
  footerSkip: {flex: 1},
  footerConfirm: {flex: 1.4},
});

export default CropScreen;
