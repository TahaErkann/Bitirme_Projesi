/**
 * YouTube video listesi — yatay scroll, dış uygulamada açar (antrasit tema).
 */
import React from 'react';
import {Alert, Linking, Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {Text} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialIcons';
import FastImage from 'react-native-fast-image';

import {YouTubeVideo} from '@/types';
import {colors, radius, spacing, typography} from '@/utils/theme';

interface Props {
  videos: YouTubeVideo[];
}

const YouTubeVideoList: React.FC<Props> = ({videos}) => {
  if (!videos?.length) return null;

  // Android 11+ paket görünürlüğü nedeniyle `canOpenURL` çoğu zaman false
  // dönebilir; o yüzden doğrudan `openURL` deniyoruz ve sırayla fallback
  // ediyoruz: önce YouTube deeplink (uygulama varsa onu açar), sonra web
  // URL (tarayıcıda açar).
  const open = async (v: YouTubeVideo) => {
    const candidates = [v.deeplink, v.web_url];
    for (const url of candidates) {
      try {
        await Linking.openURL(url);
        return;
      } catch {
        // sıradakine geç
      }
    }
    Alert.alert(
      'YouTube',
      'Video açılamadı. YouTube uygulaması veya bir tarayıcı yüklü olduğundan emin olun.',
    );
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}>
      {videos.map(v => (
        <Pressable
          key={v.video_id}
          onPress={() => open(v)}
          style={styles.card}>
          <View>
            <FastImage
              source={{uri: v.thumbnail_url}}
              style={styles.thumb}
              resizeMode={FastImage.resizeMode.cover}
            />
            <View style={styles.playOverlay}>
              <View style={styles.playCircle}>
                <Icon name="play-arrow" size={22} color={colors.textInverse} />
              </View>
            </View>
          </View>
          <Text
            numberOfLines={2}
            style={[typography.body, {color: colors.textPrimary, marginTop: 6}]}>
            {v.title}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              typography.caption,
              {color: colors.textSecondary, marginTop: 2},
            ]}>
            {v.channel_title}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  row: {paddingVertical: spacing(1.25), gap: spacing(1.25), paddingRight: spacing(2)},
  card: {width: 220, marginRight: 10},
  thumb: {width: '100%', height: 124, borderRadius: radius.md},
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(63,107,79,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default YouTubeVideoList;
