/**
 * PlaceDetailScreen — keşfetten gelen yerin detay ekranı.
 * Aslında ResultScreen ile çok benzer; aynı bileşeni kullanır.
 */
import React from 'react';
import ResultScreen from '@/screens/upload/ResultScreen';

const PlaceDetailScreen: React.FC<{route: any; navigation: any}> = props => {
  return <ResultScreen {...props} />;
};

export default PlaceDetailScreen;
