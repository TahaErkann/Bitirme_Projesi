/**
 * UploadScreen — pipeline ilerlemesini animasyonlu, adım adım gösterir.
 *
 * "Tarihi Doku" yeniden tasarımı: parşömen zemin, serif aktif aşama başlığı,
 * yeşil/altın ilerleme çubuğu, heritage aşama noktaları (geçilen = yeşil tik,
 * aktif = altın halka) ve parşömen yüzeyde nabız atan dairesel ikon.
 *
 * Tasarım kuralı: Asla %0'dan %100'e atlamasın. Backend hızlı bitirse bile
 * her adım minimum bir süre ekranda kalır; backend daha yavaş ilerlerse
 * o aşamada bekler. Böylece kullanıcı "donmuş gibi" hissetmez.
 */
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Alert, Animated, Easing, StyleSheet, View} from 'react-native';
import {Text} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {SafeAreaView} from 'react-native-safe-area-context';

import {useUploadStatus} from '@/hooks/useUploadStatus';
import {useLanguage} from '@/context/LanguageContext';
import {colors, radius, shadow, spacing, typography} from '@/utils/theme';
import OrnamentalDivider from '@/components/OrnamentalDivider';

interface Stage {
  key: string;
  /** i18n key */
  labelKey: string;
  icon: string;
  /** Backend progress'i bu eşiği geçtiğinde "geçilebilir" sayılır. */
  unlockAt: number;
  /** Bu aşamayı sahnede tutmak için minimum süre (ms). */
  minMs: number;
  /** Görsel progress bar yüzdesi (sahnedeki adım). */
  visualPercent: number;
}

const STAGES: Stage[] = [
  {key: 'uploading', labelKey: 'upload.stage.uploading', icon: 'cloud-upload', unlockAt: 5, minMs: 800, visualPercent: 12},
  {key: 'preprocessing', labelKey: 'upload.stage.preprocessing', icon: 'tune', unlockAt: 18, minMs: 1100, visualPercent: 28},
  {key: 'ocr', labelKey: 'upload.stage.ocr', icon: 'text-fields', unlockAt: 40, minMs: 1400, visualPercent: 50},
  {key: 'duplicate', labelKey: 'upload.stage.duplicate', icon: 'compare-arrows', unlockAt: 60, minMs: 1100, visualPercent: 68},
  {key: 'categorizing', labelKey: 'upload.stage.categorizing', icon: 'category', unlockAt: 78, minMs: 1300, visualPercent: 84},
  {key: 'saving', labelKey: 'upload.stage.saving', icon: 'save', unlockAt: 92, minMs: 900, visualPercent: 96},
];

const UploadScreen: React.FC<{route: any; navigation: any}> = ({route, navigation}) => {
  const {t} = useLanguage();
  const {taskId} = route.params ?? {};
  const status = useUploadStatus(taskId);

  // Sahnede gösterilen adım (gerçek backend adımından bağımsız ilerler)
  const [shownStageIndex, setShownStageIndex] = useState(0);
  const stageEnteredAtRef = useRef<number>(Date.now());

  // Görsel progress bar (animated)
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Ekran giriş animasyonu (fade + lift)
  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        toValue: 0,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, lift]);

  // Backend'den gelen "izin verilen" en yüksek adım indexini hesapla
  const allowedStageIndex = useMemo(() => {
    const p = status?.progress ?? 0;
    let idx = 0;
    for (let i = 0; i < STAGES.length; i++) {
      if (p >= STAGES[i].unlockAt) idx = i;
    }
    return idx;
  }, [status?.progress]);

  const isBackendDone =
    status?.status === 'COMPLETED' ||
    status?.status === 'DUPLICATE' ||
    status?.status === 'FAILED';

  const isFailed = status?.status === 'FAILED';

  // Sahnedeki adım son aşamaya geldi mi (görsel olarak tamamlandı)?
  const isVisuallyComplete = shownStageIndex >= STAGES.length - 1;

  // Minimum dwell saatçisi: shownStageIndex'i ilerletmek için.
  // Backend hızlı bitirse bile sahnedeki her adım minimum süre kadar görünür
  // kalır → kullanıcı %0 → %100 atlamasını yaşamaz.
  useEffect(() => {
    if (isFailed) return;
    // Sahne tamamlandıysa daha fazla ilerleme yok
    if (isVisuallyComplete) return;

    // Backend bittiyse (COMPLETED/DUPLICATE) tüm aşamalar "açık" sayılır;
    // dolayısıyla dwell süresi dolduğunda bir sonrakine geçeriz.
    const effectiveAllowedIndex = isBackendDone
      ? STAGES.length - 1
      : allowedStageIndex;

    const tick = () => {
      const stage = STAGES[shownStageIndex];
      const elapsed = Date.now() - stageEnteredAtRef.current;
      const canAdvance =
        elapsed >= stage.minMs && effectiveAllowedIndex > shownStageIndex;
      if (canAdvance) {
        setShownStageIndex(i => Math.min(i + 1, STAGES.length - 1));
        stageEnteredAtRef.current = Date.now();
      }
    };
    const id = setInterval(tick, 150);
    return () => clearInterval(id);
  }, [shownStageIndex, allowedStageIndex, isBackendDone, isFailed, isVisuallyComplete]);

  // shownStageIndex değiştiğinde dwell saatçisini sıfırla
  useEffect(() => {
    stageEnteredAtRef.current = Date.now();
  }, [shownStageIndex]);

  // Progress bar'ı SADECE sahnedeki adıma göre doldur — backend hızlı bitse
  // bile bar adımları takip eder, %12 → %100 zıplaması olmaz.
  useEffect(() => {
    if (isFailed) return;
    const target =
      isVisuallyComplete && isBackendDone && !isFailed
        ? 100
        : STAGES[shownStageIndex].visualPercent;
    Animated.timing(progressAnim, {
      toValue: target,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [shownStageIndex, isVisuallyComplete, isBackendDone, isFailed, progressAnim]);

  // Final navigation — backend bitti VE sahnedeki tüm adımlar görsel olarak
  // tamamlandı. Aksi halde dwell zinciri çalışmaya devam eder.
  useEffect(() => {
    if (!status) return;
    if (!isVisuallyComplete) return;
    if (status.status === 'COMPLETED' && status.place_id) {
      const placeId = status.place_id;
      const timer = setTimeout(
        () => navigation.replace('PlaceDetail', {placeId}),
        500,
      );
      return () => clearTimeout(timer);
    }
    if (status.status === 'DUPLICATE' && status.duplicate_of) {
      const duplicateId = status.duplicate_of;
      const timer = setTimeout(() => {
        Alert.alert(
          t('upload.duplicateTitle'),
          t('upload.duplicateBody'),
          [
            {
              text: t('common.continue'),
              onPress: () =>
                navigation.replace('PlaceDetail', {placeId: duplicateId}),
            },
          ],
          {cancelable: false},
        );
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [status, navigation, isVisuallyComplete]);

  const widthInterp = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const activeStage = STAGES[shownStageIndex];
  const allDone = isVisuallyComplete && isBackendDone && !isFailed;
  const displayProgress = allDone ? 100 : activeStage.visualPercent;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Animated.View
        style={[
          styles.container,
          {opacity: fade, transform: [{translateY: lift}]},
        ]}>
        {/* Üst rozet — altın overline (kitabe hissi) */}
        <View style={styles.kicker}>
          <Icon
            name={isFailed ? 'report-problem' : 'auto-awesome'}
            size={13}
            color={isFailed ? colors.error : colors.goldDeep}
          />
          <Text
            style={[
              typography.overline,
              {color: isFailed ? colors.error : colors.goldDeep},
            ]}>
            {isFailed ? t('upload.failed') : t('upload.running')}
          </Text>
        </View>

        <PulsingIcon icon={isFailed ? 'error-outline' : activeStage.icon} failed={isFailed} />

        {/* Aktif aşama serif başlığı */}
        <Text
          style={[
            typography.h2,
            {color: colors.textPrimary, marginTop: spacing(2.5), textAlign: 'center'},
          ]}>
          {isFailed ? t('upload.failed') : t(activeStage.labelKey)}
        </Text>
        <Text
          style={[
            typography.body,
            {color: colors.textSecondary, textAlign: 'center', marginTop: 6},
          ]}>
          {isFailed ? status?.error ?? t('upload.failed') : t('upload.running')}
        </Text>

        {/* Yeşil/altın ilerleme çubuğu */}
        <View style={styles.progressBlock}>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: widthInterp,
                  backgroundColor: isFailed
                    ? colors.error
                    : allDone
                    ? colors.success
                    : colors.accent,
                },
              ]}
            />
          </View>
          <View style={styles.progressMeta}>
            <Text
              style={[
                typography.overline,
                {color: isFailed ? colors.error : colors.gold},
              ]}>
              {`%${Math.round(displayProgress)}`}
            </Text>
          </View>
        </View>

        {/* Ornamental ayraç + aşama listesi */}
        <OrnamentalDivider
          icon="account-balance"
          tint={isFailed ? colors.error : colors.gold}
          style={styles.divider}
        />

        <View style={styles.stagesWrap}>
          {STAGES.map((s, i) => {
            const isReached = i <= shownStageIndex || allDone;
            const isCurrent = i === shownStageIndex && !allDone && !isFailed;
            const done = isReached && !isCurrent;
            return (
              <View key={s.key} style={styles.stageRow}>
                <View style={styles.dotWrap}>
                  {/* Aktif adım için altın halka */}
                  {isCurrent ? <View style={styles.currentRing} /> : null}
                  <View
                    style={[
                      styles.stageDot,
                      done && styles.stageDotDone,
                      isCurrent && styles.stageDotCurrent,
                      !isReached && styles.stageDotIdle,
                    ]}>
                    {done ? (
                      <Icon name="check" size={13} color={colors.textInverse} />
                    ) : isCurrent ? (
                      <Icon name={s.icon} size={13} color={colors.goldDeep} />
                    ) : (
                      <View style={styles.stageDotInner} />
                    )}
                  </View>
                </View>
                <Text
                  style={[
                    isCurrent ? typography.h3 : typography.body,
                    {
                      color: isCurrent
                        ? colors.textPrimary
                        : isReached
                        ? colors.textSecondary
                        : colors.textMuted,
                    },
                  ]}
                  numberOfLines={1}>
                  {t(s.labelKey)}
                </Text>
              </View>
            );
          })}
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};

/** Aktif aşamayı vurgulamak için yumuşak nabız atan ikon. */
const PulsingIcon: React.FC<{icon: string; failed: boolean}> = ({icon, failed}) => {
  const pulse = useRef(new Animated.Value(1)).current;
  const halo = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (failed) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 760,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 760,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, failed]);

  // Dışarı doğru genişleyen yumuşak altın halka (yalnızca dekoratif).
  useEffect(() => {
    if (failed) return;
    const loop = Animated.loop(
      Animated.timing(halo, {
        toValue: 1,
        duration: 1900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [halo, failed]);

  const haloScale = halo.interpolate({inputRange: [0, 1], outputRange: [0.9, 1.45]});
  const haloOpacity = halo.interpolate({inputRange: [0, 0.6, 1], outputRange: [0.45, 0.15, 0]});

  return (
    <View style={styles.iconStage}>
      {!failed ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.halo,
            {opacity: haloOpacity, transform: [{scale: haloScale}]},
          ]}
        />
      ) : null}
      <Animated.View
        style={[
          styles.iconCircle,
          {transform: [{scale: failed ? 1 : pulse}]},
          failed && {backgroundColor: colors.errorSoft, borderColor: colors.error},
        ]}>
        <Icon name={icon} size={50} color={failed ? colors.error : colors.accent} />
      </Animated.View>
    </View>
  );
};

const ICON_SIZE = 118;

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.bg},
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing(3),
  },
  kicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: colors.gold,
    marginBottom: spacing(3),
  },
  iconStage: {
    width: ICON_SIZE * 1.5,
    height: ICON_SIZE * 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    borderWidth: 1.5,
    borderColor: colors.gold,
    backgroundColor: colors.goldSoft,
  },
  iconCircle: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadow.md,
  },
  progressBlock: {
    alignSelf: 'stretch',
    marginTop: spacing(3),
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  progressFill: {height: '100%', borderRadius: radius.pill},
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  divider: {
    alignSelf: 'stretch',
    marginTop: spacing(3),
    marginBottom: spacing(2.5),
  },
  stagesWrap: {
    alignSelf: 'stretch',
    gap: spacing(1.5),
    paddingHorizontal: spacing(1),
  },
  stageRow: {flexDirection: 'row', alignItems: 'center', gap: spacing(1.75)},
  dotWrap: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentRing: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: colors.gold,
    backgroundColor: colors.goldSoft,
  },
  stageDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  stageDotDone: {
    backgroundColor: colors.accent,
    borderColor: colors.accentDeep,
  },
  stageDotCurrent: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.gold,
  },
  stageDotIdle: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.borderSoft,
  },
  stageDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textMuted,
  },
});

export default UploadScreen;
