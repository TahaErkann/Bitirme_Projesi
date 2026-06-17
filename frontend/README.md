# JourEx — Frontend (React Native CLI)

Bu klasör, master prompt § 2.1'e göre **React Native CLI bare workflow** ile oluşturulmuş frontend uygulamasını içerir.

## 1) Native iskeleti üret

`android/` ve `ios/` klasörleri RN CLI tarafından üretilmelidir. İlk kez kurulumda:

```bash
cd C:\Users\owner\Desktop\Bitirme_App
# Geçici bir konuma RN iskeleti üret:
npx --yes @react-native-community/cli@latest init JourExTemp --version 0.76.5 --skip-install --pm npm

# Sadece android, ios, gradle dosyalarını kopyala:
mv JourExTemp/android frontend/android
# (Android-only ilerleyeceğiz, iOS opsiyonel)
rm -rf JourExTemp
```

Alternatif: Repo'yu zaten init edilmiş şekilde sürdürmek için bu adımı bir kez yapın ve `frontend/android/` klasörünü commit'leyin.

## 2) Bağımlılıkları kur

```bash
cd frontend
cp .env.example .env
npm install
```

## 3) Çalıştır

```bash
# Metro
npm start

# Android (yeni terminal)
npm run android
```

> Android emülatörü backend'e ulaşmak için `API_BASE_URL=http://10.0.2.2:8000/api/v1` kullanır.

## 4) Native ek konfigürasyonlar

`android/app/src/main/AndroidManifest.xml` içine **eklenmesi gerekenler** (RN CLI init sonrası):

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

`<application>` etiketi içine Google Maps API key:

```xml
<meta-data
    android:name="com.google.android.geo.API_KEY"
    android:value="${GOOGLE_MAPS_API_KEY_ANDROID}"/>
```

`android/build.gradle` minSdkVersion = 24 (vision-camera gereksinimi).

## 5) Klasör Yapısı

```
frontend/
  src/
    screens/           # ekranlar (auth, home, upload, discover, profile)
    components/        # tekrar kullanılabilir UI parçaları
    services/          # axios instance + endpoint istemcileri
    hooks/             # custom React hooks
    context/           # global state (auth, theme)
    navigation/        # AppNavigator
    utils/             # constants, helpers
    types/             # TS tip tanımları
  App.tsx
  index.js
  app.json
```
