import React from 'react';
import {
  Sun,
  Moon,
  Smartphone,
  Gauge,
  Bell,
  Box,
  Compass,
  Layers,
  HardDrive,
  Download,
  Trash2,
  Check,
  Shield,
  Sparkles,
} from 'lucide-react';
import type { MapLayerStyle } from '../utils/storage';
import { MAP_LAYERS } from './LiveRideMap';
import { bikeAudioEngine } from '../utils/audioEngine';

interface SettingsScreenProps {
  unit: 'mph' | 'kmh';
  onChangeUnit: (unit: 'mph' | 'kmh') => void;
  themePreference: 'auto' | 'dark' | 'light';
  onChangeThemePreference: (pref: 'auto' | 'dark' | 'light') => void;
  milestoneChimeEnabled: boolean;
  onToggleMilestoneChime: (enabled: boolean) => void;
  is3DView: boolean;
  onToggle3DView: (is3D: boolean) => void;
  headingUp: boolean;
  onToggleHeadingUp: (headingUp: boolean) => void;
  pitchDegrees: number;
  onChangePitchDegrees: (pitch: number) => void;
  mapLayerStyle: MapLayerStyle;
  onChangeMapLayerStyle: (style: MapLayerStyle) => void;
  isDark: boolean;
  onClearCache?: () => void;
  onExportBackupJson?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  unit,
  onChangeUnit,
  themePreference,
  onChangeThemePreference,
  milestoneChimeEnabled,
  onToggleMilestoneChime,
  is3DView,
  onToggle3DView,
  headingUp,
  onToggleHeadingUp,
  pitchDegrees,
  onChangePitchDegrees,
  mapLayerStyle,
  onChangeMapLayerStyle,
  isDark,
  onClearCache,
  onExportBackupJson,
}) => {
  const handleTestBell = () => {
    try {
      bikeAudioEngine.playBicycleBell();
    } catch {
      // Audio fallback
    }
  };

  return (
    <div className="flex-1 w-full max-w-3xl mx-auto px-4 py-5 space-y-6 animate-in fade-in duration-200">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Cockpit Settings
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Customize speed units, auto night mode, 3D navigation and audio feedback
        </p>
      </div>

      {/* Speed & Distance Units (MPH / KM/H) */}
      <section
        className={`p-4 rounded-2xl border ${
          isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Gauge className="w-4 h-4 text-sky-400" />
              <span>Speed & Distance Units</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Affects speedometer, averages, distance and ride logs
            </div>
          </div>
          <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => onChangeUnit('mph')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                unit === 'mph'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              MPH
            </button>
            <button
              type="button"
              onClick={() => onChangeUnit('kmh')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                unit === 'kmh'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              KM/H
            </button>
          </div>
        </div>
      </section>

      {/* Night Mode with Auto Option */}
      <section
        className={`p-4 rounded-2xl border ${
          isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div className="mb-3">
          <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Moon className="w-4 h-4 text-indigo-400" />
            <span>Theme & Night Mode</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Choose high-contrast dark navigation HUD, daylight mode, or automatic switching
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {/* Auto Mode */}
          <button
            type="button"
            onClick={() => onChangeThemePreference('auto')}
            className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
              themePreference === 'auto'
                ? 'bg-sky-500/15 border-sky-500 text-sky-400 shadow-sm'
                : isDark
                ? 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <Smartphone className="w-4 h-4" />
              {themePreference === 'auto' && <Check className="w-4 h-4" />}
            </div>
            <div>
              <div className="text-xs font-bold">Auto</div>
              <div className="text-[10px] text-slate-500 truncate">Time & system</div>
            </div>
          </button>

          {/* Dark Mode */}
          <button
            type="button"
            onClick={() => onChangeThemePreference('dark')}
            className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
              themePreference === 'dark'
                ? 'bg-indigo-500/15 border-indigo-500 text-indigo-300 shadow-sm'
                : isDark
                ? 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <Moon className="w-4 h-4" />
              {themePreference === 'dark' && <Check className="w-4 h-4" />}
            </div>
            <div>
              <div className="text-xs font-bold">Dark HUD</div>
              <div className="text-[10px] text-slate-500 truncate">High contrast night</div>
            </div>
          </button>

          {/* Light Mode */}
          <button
            type="button"
            onClick={() => onChangeThemePreference('light')}
            className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
              themePreference === 'light'
                ? 'bg-amber-500/15 border-amber-500 text-amber-500 shadow-sm'
                : isDark
                ? 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <Sun className="w-4 h-4" />
              {themePreference === 'light' && <Check className="w-4 h-4" />}
            </div>
            <div>
              <div className="text-xs font-bold">Daylight</div>
              <div className="text-[10px] text-slate-500 truncate">Sun glare clarity</div>
            </div>
          </button>
        </div>
      </section>

      {/* Audio Bell Milestone Chimes */}
      <section
        className={`p-4 rounded-2xl border ${
          isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" />
              <span>Milestone Bicycle Bell</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Plays metallic dual-resonance chime ("Ding-Ding!") on each mile or km
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestBell}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
            >
              Test Bell 🔔
            </button>
            <button
              type="button"
              onClick={() => onToggleMilestoneChime(!milestoneChimeEnabled)}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                milestoneChimeEnabled ? 'bg-emerald-600' : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  milestoneChimeEnabled ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* 3D Cockpit Camera & Course Settings */}
      <section
        className={`p-4 rounded-2xl border space-y-3.5 ${
          isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div>
          <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Box className="w-4 h-4 text-sky-400" />
            <span>3D Cockpit & Orientation Defaults</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Configure map tilt angle and road-ahead alignment
          </div>
        </div>

        {/* 3D Perspective Pitch Angle */}
        <div>
          <div className="text-xs font-semibold text-slate-400 mb-1.5">
            Default 3D Camera Tilt Pitch
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { pitch: 35, label: '35° High Chase' },
              { pitch: 52, label: '52° Cockpit (Default)' },
              { pitch: 62, label: '62° Deep Horizon' },
            ].map((p) => (
              <button
                key={p.pitch}
                type="button"
                onClick={() => onChangePitchDegrees(p.pitch)}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                  pitchDegrees === p.pitch
                    ? 'bg-sky-500/20 text-sky-400 border-sky-500'
                    : isDark
                    ? 'bg-slate-900 border-slate-800 text-slate-400'
                    : 'bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Course-Up vs North-Up */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <div>
            <div className="text-xs font-bold text-slate-300">Map Orientation</div>
            <div className="text-[11px] text-slate-500">
              {headingUp ? 'Heading-Up: Map rotates so road ahead is up' : 'North-Up: Map is locked north'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onToggleHeadingUp(!headingUp)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              headingUp
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {headingUp ? 'Course-Up' : 'North-Up'}
          </button>
        </div>
      </section>

      {/* Default Map Layer */}
      <section
        className={`p-4 rounded-2xl border ${
          isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div className="mb-3">
          <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span>Default Map Layer</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Selected layer will be active when the app opens
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(Object.keys(MAP_LAYERS) as MapLayerStyle[]).map((key) => {
            const config = MAP_LAYERS[key];
            const isSelected = mapLayerStyle === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChangeMapLayerStyle(key)}
                className={`p-2.5 rounded-xl border text-left transition ${
                  isSelected
                    ? 'bg-sky-500/15 border-sky-500 text-white shadow-sm'
                    : isDark
                    ? 'bg-slate-900 border-slate-800 text-slate-400'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <div className="text-base mb-1">{config.icon}</div>
                <div className="text-xs font-bold text-slate-200">{config.label}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Data Backup & Privacy */}
      <section
        className={`p-4 rounded-2xl border space-y-3 ${
          isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div>
          <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Local Storage & Privacy</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            100% on-device IndexedDB storage. No account, no cloud login, no subscriptions required.
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5 pt-1">
          {onExportBackupJson && (
            <button
              type="button"
              onClick={onExportBackupJson}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-sky-600 text-white hover:bg-sky-500 transition flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Backup Family Data (JSON)</span>
            </button>
          )}

          {onClearCache && (
            <button
              type="button"
              onClick={onClearCache}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-red-500/40 text-red-400 hover:bg-red-500/10 transition flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Offline Map Cache</span>
            </button>
          )}
        </div>
      </section>
    </div>
  );
};
