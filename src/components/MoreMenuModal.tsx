import React from 'react';
import {
  X,
  Car,
  Radio,
  WifiOff,
  Download,
  Smartphone,
  Music,
  Check,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  Sliders,
} from 'lucide-react';
import type { RideDataSource } from '../utils/telemetry';
import { SIM_ROUTE_PRESETS } from '../utils/routes';

interface MoreMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  gpsSource: RideDataSource;
  onSelectGpsSource: (source: RideDataSource) => void;
  selectedPresetId: string;
  onSelectPresetId: (id: string) => void;
  isSimulatedOffline: boolean;
  onToggleSimulatedOffline: (enabled: boolean) => void;
  onOpenOfflineMaps: () => void;
  onOpenApkGuide: () => void;
  onOpenMusicPlayer: () => void;
  isRecordingOrPaused: boolean;
}

export const MoreMenuModal: React.FC<MoreMenuModalProps> = ({
  isOpen,
  onClose,
  isDark,
  gpsSource,
  onSelectGpsSource,
  selectedPresetId,
  onSelectPresetId,
  isSimulatedOffline,
  onToggleSimulatedOffline,
  onOpenOfflineMaps,
  onOpenApkGuide,
  onOpenMusicPlayer,
  isRecordingOrPaused,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`w-full max-w-xl max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${
          isDark
            ? 'bg-slate-950 border-slate-800 text-white shadow-black/80'
            : 'bg-white border-slate-200 text-slate-900 shadow-xl'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 py-4 border-b ${
            isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">More Features & Tools</h2>
              <p className="text-xs text-slate-400">
                Test modes, offline maps, Android APK and audio tools
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-xl transition ${
              isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* SECTION 1: TEST MODES */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Test Modes
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold">
                Diagnostics
              </span>
            </div>

            <div className="space-y-3">
              {/* Car Test (Camry) Mode Card */}
              <div
                className={`p-4 rounded-2xl border transition ${
                  gpsSource === 'car_test'
                    ? 'bg-indigo-600/15 border-indigo-500 text-white'
                    : isDark
                    ? 'bg-slate-900/60 border-slate-800 text-slate-300'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        gpsSource === 'car_test'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <Car className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                        Car Test (Camry) Mode
                        {gpsSource === 'car_test' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500 text-white font-bold">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Allows road speeds up to 95 MPH in your Camry. Mileage is
                        explicitly tagged and <strong>strictly excluded</strong> from
                        Azlan, Talha, and Eshal's bicycle totals.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isRecordingOrPaused}
                    onClick={() => {
                      onSelectGpsSource(gpsSource === 'car_test' ? 'live' : 'car_test');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition ${
                      gpsSource === 'car_test'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {gpsSource === 'car_test' ? 'Selected ✓' : 'Switch Mode'}
                  </button>
                </div>
              </div>

              {/* Demo Simulation Mode Card */}
              <div
                className={`p-4 rounded-2xl border transition ${
                  gpsSource === 'simulation'
                    ? 'bg-amber-500/15 border-amber-500 text-white'
                    : isDark
                    ? 'bg-slate-900/60 border-slate-800 text-slate-300'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        gpsSource === 'simulation'
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <Radio className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                        Demo Simulation (Indoor Testing)
                        {gpsSource === 'simulation' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Replays realistic GPS cycling trajectories indoors so you
                        can test 3D navigation, speedometer, chimes and route ribbons without moving.
                      </p>
                      {gpsSource === 'simulation' && (
                        <div className="mt-2.5">
                          <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                            Simulated Route Preset:
                          </label>
                          <select
                            value={selectedPresetId}
                            onChange={(e) => onSelectPresetId(e.target.value)}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-700 text-white"
                          >
                            {SIM_ROUTE_PRESETS.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isRecordingOrPaused}
                    onClick={() => {
                      onSelectGpsSource(gpsSource === 'simulation' ? 'live' : 'simulation');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition ${
                      gpsSource === 'simulation'
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {gpsSource === 'simulation' ? 'Selected ✓' : 'Switch Mode'}
                  </button>
                </div>
              </div>

              {/* Offline Mode Simulator Toggle */}
              <div
                className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                  isSimulatedOffline
                    ? 'bg-amber-500/15 border-amber-500 text-amber-300'
                    : isDark
                    ? 'bg-slate-900/60 border-slate-800 text-slate-300'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      isSimulatedOffline
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <WifiOff className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">Simulate "No Signal" (Airplane Mode)</div>
                    <div className="text-[10px] text-slate-400">
                      Test that pre-cached maps work 100% offline
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onToggleSimulatedOffline(!isSimulatedOffline)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                    isSimulatedOffline
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {isSimulatedOffline ? 'Active ✓' : 'Toggle'}
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 2: INSTALL APP & ANDROID APK */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2.5">
              Install App
            </span>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenApkGuide();
              }}
              className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition hover:scale-[1.01] ${
                isDark
                  ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  : 'bg-slate-50 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    Get Android .APK & Install App
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">
                      Offline Mount
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Step-by-step instructions for Android APK installation & home screen PWA
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* SECTION 3: OFFLINE MAPS & AUDIO TOOLS */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2.5">
              Maps & Audio Tools
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenOfflineMaps();
                }}
                className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition hover:scale-[1.01] ${
                  isDark
                    ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs text-slate-900 dark:text-white">
                    Offline Maps Manager
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Download tiles for all views
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenMusicPlayer();
                }}
                className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition hover:scale-[1.01] ${
                  isDark
                    ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                  <Music className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs text-slate-900 dark:text-white">
                    Cadence Pacer & Audio
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Bicycle bell & rhythm beats
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
