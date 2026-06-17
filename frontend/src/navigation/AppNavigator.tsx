/**
 * AppNavigator — auth durumuna göre AuthStack veya MainTabs.
 * (master prompt § 10.1)
 *
 * Tema: utils/theme.ts (antrasit gri + amber vurgu).
 */
import React, {useEffect, useRef} from 'react';
import {Animated, Easing, Pressable, StyleSheet, View} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  NativeStackNavigationOptions,
} from '@react-navigation/native-stack';
import {
  BottomTabBarProps,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Text} from '@/components/AppText';

import {useAuth} from '@/hooks/useAuth';
import {useLanguage} from '@/context/LanguageContext';
import {colors, navTheme, radius, spacing, typography} from '@/utils/theme';

import LoginScreen from '@/screens/auth/LoginScreen';
import RegisterScreen from '@/screens/auth/RegisterScreen';
import HomeScreen from '@/screens/home/HomeScreen';
import CameraScreen from '@/screens/upload/CameraScreen';
import CropScreen from '@/screens/upload/CropScreen';
import UploadScreen from '@/screens/upload/UploadScreen';
import ResultScreen from '@/screens/upload/ResultScreen';
import DiscoverFeedScreen from '@/screens/discover/DiscoverFeedScreen';
import DiscoverMapScreen from '@/screens/discover/DiscoverMapScreen';
import PlaceDetailScreen from '@/screens/discover/PlaceDetailScreen';
import ProfileScreen from '@/screens/profile/ProfileScreen';
import SettingsScreen from '@/screens/profile/SettingsScreen';
import MyPlacesScreen from '@/screens/profile/MyPlacesScreen';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Main: undefined;
  Result: {taskId: string; placeId?: string} | {placeId: string};
  Processing: {taskId: string};
  PlaceDetail: {placeId: string};
  DiscoverMap:
    | {
        focusLat: number;
        focusLng: number;
        focusLabel?: string;
        focusSubtitle?: string;
        focusCategory?: string;
      }
    | undefined;
  Settings: undefined;
  Crop: {imageUri: string; imageType?: string};
  MyPlaces: {mode: 'liked' | 'uploads'};
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

// --------------------------------------------------------------- Tab bar ---

const TAB_ICONS: Record<string, string> = {
  Home: 'home-filled',
  Upload: 'add-a-photo',
  Discover: 'explore',
  Profile: 'person',
};

const TAB_LABEL_KEYS: Record<string, string> = {
  Home: 'tab.home',
  Upload: 'tab.upload',
  Discover: 'tab.discover',
  Profile: 'tab.profile',
};

function CustomTabBar({state, descriptors, navigation}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const {t} = useLanguage();
  return (
    <View
      style={[
        styles.tabBar,
        {paddingBottom: Math.max(insets.bottom, spacing(1))},
      ]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const {options} = descriptors[route.key];
        const labelKey = TAB_LABEL_KEYS[route.name];
        const label = labelKey
          ? t(labelKey)
          : (typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : undefined) ??
            options.title ??
            route.name;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name as never);
          }
        };

        return (
          <TabBarItem
            key={route.key}
            iconName={TAB_ICONS[route.name] ?? 'circle'}
            label={label}
            focused={focused}
            onPress={onPress}
          />
        );
      })}
    </View>
  );
}

const TabBarItem: React.FC<{
  iconName: string;
  label: string;
  focused: boolean;
  onPress: () => void;
}> = ({iconName, label, focused, onPress}) => {
  const anim = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: focused ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [focused, anim]);

  const indicatorWidth = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 22],
  });

  return (
    <Pressable
      style={styles.tabItem}
      onPress={onPress}
      android_ripple={{color: colors.surfaceAlt, borderless: true}}>
      <Animated.View
        style={[
          styles.tabIconWrap,
          focused && {
            backgroundColor: anim.interpolate({
              inputRange: [0, 1],
              outputRange: ['rgba(63,107,79,0)', colors.accentSoft],
            }) as unknown as string,
          },
        ]}>
        <Icon
          name={iconName}
          size={22}
          color={focused ? colors.tabActive : colors.tabInactive}
        />
      </Animated.View>
      <Text
        style={[
          typography.caption,
          {color: focused ? colors.tabActive : colors.tabInactive},
        ]}>
        {label}
      </Text>
      <Animated.View
        style={[styles.tabIndicator, {width: indicatorWidth}]}
      />
    </Pressable>
  );
};

// --------------------------------------------------------------- Stacks ---

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{headerShown: false}}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Upload" component={CameraScreen} />
      <Tab.Screen name="Discover" component={DiscoverFeedScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const headerOpts: NativeStackNavigationOptions = {
  headerStyle: {backgroundColor: colors.bg},
  headerTintColor: colors.textPrimary,
  headerTitleStyle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  headerShadowVisible: false,
  headerBackTitle: '',
  contentStyle: {backgroundColor: colors.bg},
  animation: 'slide_from_right',
};

const authHeaderOpts: NativeStackNavigationOptions = {
  ...headerOpts,
  headerShown: false,
};

export default function AppNavigator() {
  const {isAuthenticated} = useAuth();
  const {t} = useLanguage();
  return (
    <NavigationContainer theme={navTheme as any}>
      <Stack.Navigator screenOptions={headerOpts}>
        {isAuthenticated ? (
          <>
            <Stack.Screen
              name="Main"
              component={MainTabs}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="Result"
              component={ResultScreen}
              options={{title: t('result.signText')}}
            />
            <Stack.Screen
              name="PlaceDetail"
              component={PlaceDetailScreen}
              options={{title: t('result.signText')}}
            />
            <Stack.Screen
              name="DiscoverMap"
              component={DiscoverMapScreen}
              options={{title: t('home.map')}}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{title: t('profile.settings')}}
            />
            <Stack.Screen
              name="MyPlaces"
              component={MyPlacesScreen as any}
              options={{title: ''}}
            />
            <Stack.Screen
              name="Processing"
              component={UploadScreen as any}
              options={{
                title: '',
                animation: 'fade',
                headerBackVisible: false,
                gestureEnabled: false,
              }}
            />
            <Stack.Screen
              name="Crop"
              component={CropScreen as any}
              options={{
                headerShown: false,
                animation: 'slide_from_bottom',
              }}
            />
          </>
        ) : (
          <>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={authHeaderOpts}
            />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={authHeaderOpts}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.tabBg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSoft,
    paddingTop: spacing(1),
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabIconWrap: {
    width: 40,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  tabIndicator: {
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.accent,
    marginTop: 4,
  },
});
