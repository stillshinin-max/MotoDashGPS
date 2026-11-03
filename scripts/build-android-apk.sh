#!/usr/bin/env bash
set -euo pipefail

echo "=== Family Bike GPS — Native Android .APK Builder ==="
echo "1. Building production web bundle (dist/)..."
npm run build

echo "2. Installing Capacitor Android packaging tools..."
npm install --no-save @capacitor/core @capacitor/cli @capacitor/android

if [ ! -d "android" ]; then
  echo "3. Initializing native Android project..."
  npx cap add android
fi

MANIFEST="android/app/src/main/AndroidManifest.xml"
if [ -f "$MANIFEST" ] && ! grep -q "ACCESS_FINE_LOCATION" "$MANIFEST"; then
  echo "4. Injecting Android GPS (ACCESS_FINE_LOCATION) & WakeLock permissions..."
  sed -i.bak 's|<uses-permission android:name="android.permission.INTERNET" />|<uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />\n    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />\n    <uses-permission android:name="android.permission.WAKE_LOCK" />\n    <uses-feature android:name="android.hardware.location.gps" android:required="false" />|' "$MANIFEST"
  rm -f "${MANIFEST}.bak"
fi

echo "5. Syncing web assets into Android project..."
npx cap sync android

if command -v java >/dev/null 2>&1 && [ -f "android/gradlew" ]; then
  echo "6. Compiling installable APK via Gradle..."
  (cd android && ./gradlew assembleDebug)
  cp android/app/build/outputs/apk/debug/app-debug.apk ./FamilyBikeGPS-debug.apk
  echo "SUCCESS! Installable APK generated at: ./FamilyBikeGPS-debug.apk"
else
  echo "Android project generated in ./android! Open ./android in Android Studio or push to GitHub Actions to download FamilyBikeGPS-debug.apk."
fi
