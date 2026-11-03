import React, { useState } from 'react';
import {
  X,
  Smartphone,
  Download,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  FileCode,
  Package,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface ApkSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CAPACITOR_CONFIG_JSON = `{
  "appId": "com.azeemfamily.bikegps",
  "appName": "Family Bike GPS",
  "webDir": "dist",
  "bundledWebRuntime": false,
  "server": {
    "androidScheme": "https"
  }
}
`;

const GITHUB_WORKFLOW_YML = `name: Build Android APK (Family Bike GPS)

on:
  push:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  build-apk:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'

      - name: Set up JDK 21 for Android Gradle
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '21'

      - name: Setup Android SDK
        uses: android-actions/setup-android@v3

      - name: Install web dependencies & build production bundle
        run: |
          npm install
          npm run build

      - name: Add Capacitor Android & configure GPS permissions
        run: |
          npm install --no-save @capacitor/core @capacitor/cli @capacitor/android
          npx cap add android
          MANIFEST="android/app/src/main/AndroidManifest.xml"
          if ! grep -q "ACCESS_FINE_LOCATION" "$MANIFEST"; then
            sed -i 's|<uses-permission android:name="android.permission.INTERNET" />|<uses-permission android:name="android.permission.INTERNET" />\\n    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />\\n    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />\\n    <uses-permission android:name="android.permission.WAKE_LOCK" />\\n    <uses-feature android:name="android.hardware.location.gps" android:required="false" />|' "$MANIFEST"
          fi
          npx cap sync android

      - name: Build installable Android APK
        working-directory: android
        run: ./gradlew assembleDebug

      - name: Upload FamilyBikeGPS.apk Artifact
        uses: actions/upload-artifact@v4
        with:
          name: FamilyBikeGPS-Android-APK
          path: android/app/build/outputs/apk/debug/app-debug.apk
`;

const BUILD_APK_SH = `#!/usr/bin/env bash
set -euo pipefail

echo "=== Family Bike GPS — Native Android .APK Builder ==="
npm run build
npm install --no-save @capacitor/core @capacitor/cli @capacitor/android

if [ ! -d "android" ]; then
  npx cap add android
fi

MANIFEST="android/app/src/main/AndroidManifest.xml"
if [ -f "$MANIFEST" ] && ! grep -q "ACCESS_FINE_LOCATION" "$MANIFEST"; then
  sed -i.bak 's|<uses-permission android:name="android.permission.INTERNET" />|<uses-permission android:name="android.permission.INTERNET" />\\n    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />\\n    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />\\n    <uses-permission android:name="android.permission.WAKE_LOCK" />\\n    <uses-feature android:name="android.hardware.location.gps" android:required="false" />|' "$MANIFEST"
  rm -f "\${MANIFEST}.bak"
fi

npx cap sync android

if command -v java >/dev/null 2>&1 && [ -f "android/gradlew" ]; then
  (cd android && ./gradlew assembleDebug)
  cp android/app/build/outputs/apk/debug/app-debug.apk ./FamilyBikeGPS-debug.apk
  echo "SUCCESS! Installable APK generated at: ./FamilyBikeGPS-debug.apk"
else
  echo "Android project generated in ./android! Open ./android in Android Studio or push to GitHub Actions to download FamilyBikeGPS-debug.apk."
fi
`;

export const ApkSetupModal: React.FC<ApkSetupModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [copiedUrl, setCopiedUrl] = useState(false);

  if (!isOpen) return null;

  const liveAppUrl =
    typeof window !== 'undefined' ? window.location.origin : 'https://localhost:3000';

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(liveAppUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch {
      // Fallback if clipboard is restricted
    }
  };

  const triggerDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="apk-modal-title"
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4"
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Package className="w-5 h-5 text-sky-500" />
            <h2
              id="apk-modal-title"
              className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100"
            >
              Get Android .APK &amp; Phone Installation
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close APK & phone setup guide"
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-sm text-slate-700 dark:text-slate-300">
          {/* Option 1: Generate Signed Android .APK in 30 Seconds via PWABuilder */}
          <div className="p-4 rounded-xl border border-sky-500/40 bg-sky-500/10 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Option 1: Generate a Signed .APK in 30 Seconds (No Coding Needed)
              </h3>
              <span className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                Fastest .APK File
              </span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              This app is configured with a complete Android Web App Manifest. You can package the live URL into a signed, sideloadable <code>FamilyBike.apk</code> right in your browser using Microsoft’s free <strong>PWABuilder</strong> tool:
            </p>
            <ol className="list-decimal pl-5 text-xs space-y-1 text-slate-700 dark:text-slate-300">
              <li>
                Copy your app’s URL below, then open <strong>pwabuilder.com</strong>.
              </li>
              <li>
                Paste the URL and click <strong>Start</strong>, then click <strong>Package for stores</strong>.
              </li>
              <li>
                Under <strong>Android</strong>, click <strong>Download Package</strong> to get your signed <code>.apk</code> file ready to install on Azlan’s phone.
              </li>
            </ol>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <code className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs font-mono-tabular text-slate-800 dark:text-slate-200 truncate">
                {liveAppUrl}
              </code>
              <button
                type="button"
                onClick={handleCopyUrl}
                className="min-h-[38px] px-3.5 py-2 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied URL!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy App URL</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Option 2: Download Native Capacitor Android .APK Build Kit / GitHub Auto-Builder */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Option 2: Native Offline Capacitor .APK (GitHub Actions or Local Build)
              </h3>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                100% Standalone .APK
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              This project includes a pre-configured <strong>Capacitor Android</strong> setup (<code>com.azeemfamily.bikegps</code>) with native <code>ACCESS_FINE_LOCATION</code> and <code>WAKE_LOCK</code> permissions.
            </p>
            <ul className="list-disc pl-5 text-xs space-y-1 text-slate-600 dark:text-slate-300">
              <li>
                <strong>Cloud Build (Zero Setup on Your PC):</strong> Export this project to GitHub. The included workflow (<code>.github/workflows/build-android-apk.yml</code>) automatically compiles <code>FamilyBikeGPS-Android-APK.zip</code> (containing <code>app-debug.apk</code>) under the GitHub <strong>Actions</strong> tab.
              </li>
              <li>
                <strong>Local One-Command Build:</strong> Run <code>npm run apk:prepare</code> to generate <code>./FamilyBikeGPS-debug.apk</code> locally.
              </li>
            </ul>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  triggerDownload(
                    BUILD_APK_SH,
                    'build-android-apk.sh',
                    'application/x-sh'
                  )
                }
                className="min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download build-android-apk.sh</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  triggerDownload(
                    GITHUB_WORKFLOW_YML,
                    'build-android-apk.yml',
                    'text/yaml'
                  )
                }
                className="min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Download GitHub APK Workflow</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  triggerDownload(
                    CAPACITOR_CONFIG_JSON,
                    'capacitor.config.json',
                    'application/json'
                  )
                }
                className="min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>capacitor.config.json</span>
              </button>
            </div>
          </div>

          {/* Option 3: Instant Chrome Home Screen Install (Works identically to an APK on handlebars) */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                <Smartphone className="w-4 h-4 text-sky-500 shrink-0" />
                <span>Option 3: Direct Install from Chrome on Azlan’s Phone</span>
              </div>
              {isInstallable && !isInstalled && (
                <button
                  type="button"
                  onClick={install}
                  className="min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Install Now</span>
                </button>
              )}
            </div>
            {isIOS ? (
              <p className="text-xs text-slate-600 dark:text-slate-300">
                In Safari: Tap <strong>Share</strong> and choose <strong>Add to Home Screen</strong>.
              </p>
            ) : (
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Open this URL in <strong>Chrome on Azlan’s Android phone</strong>, tap the menu (<strong>⋮</strong>), and tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>). Android installs a dedicated home-screen icon that launches full-screen in landscape with offline ride logging—without needing to enable &ldquo;Install unknown apps&rdquo;.
              </p>
            )}
          </div>

          {/* Required Android GPS & Battery Settings */}
          <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Checklist for Azlan’s &amp; Talha’s Phone</span>
            </div>
            <ul className="list-disc pl-5 text-xs space-y-1 text-slate-700 dark:text-slate-300">
              <li>
                <strong>Precise Location:</strong> Grant <strong>Allow while using the app</strong> with <strong>Use precise location</strong> enabled.
              </li>
              <li>
                <strong>Keep Screen On While Mounted:</strong> Keep the cockpit visible on the handlebars during rides (if the screen is locked in a pocket, Android pauses GPS updates until the screen wakes up).
              </li>
              <li>
                <strong>Turn Off Battery Saver:</strong> Android Battery Saver throttles GPS refresh rates.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
