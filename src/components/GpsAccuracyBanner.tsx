import React, { useState } from 'react';
import {
  Navigation,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  X,
  Compass,
  Radio,
  ExternalLink,
} from 'lucide-react';
import type { GpsSignalQuality, RawGpsFix } from '../utils/telemetry';

interface GpsAccuracyBannerProps {
  currentFix: RawGpsFix | null;
  gpsQuality: GpsSignalQuality;
  gpsLabel: string;
  fixAgeSeconds: number | null;
  isDark: boolean;
  onSwitchToSimulation?: () => void;
}

export const GpsAccuracyBanner: React.FC<GpsAccuracyBannerProps> = ({
  currentFix,
  gpsQuality,
  gpsLabel,
  fixAgeSeconds,
  isDark,
  onSwitchToSimulation,
}) => {
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);

  const getStatusColor = () => {
    switch (gpsQuality) {
      case 'good':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'fair':
        return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
      case 'poor':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse';
      case 'waiting':
      case 'unavailable':
      default:
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    }
  };

  const getAccuracyText = () => {
    if (!currentFix) return 'Searching GPS Signal...';
    if (currentFix.accuracy !== null) {
      return `±${Math.round(currentFix.accuracy)}m (${gpsLabel})`;
    }
    return gpsLabel;
  };

  return (
    <div className="relative z-[430]">
      {/* Compact Status Pill */}
      <button
        type="button"
        onClick={() => setIsDetailsOpen((prev) => !prev)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-md backdrop-blur-md text-xs font-semibold cursor-pointer transition-all hover:scale-102 ${getStatusColor()}`}
        title="Click for detailed GPS satellite accuracy diagnostics"
      >
        <span
          className={`w-2 h-2 rounded-full ${
            gpsQuality === 'good'
              ? 'bg-emerald-400'
              : gpsQuality === 'fair'
              ? 'bg-sky-400'
              : gpsQuality === 'poor'
              ? 'bg-amber-400 animate-ping'
              : 'bg-rose-500 animate-pulse'
          }`}
        />
        <span className="font-mono-tabular">{getAccuracyText()}</span>
        <HelpCircle className="w-3.5 h-3.5 opacity-60" />
      </button>

      {/* Detailed Warning & Diagnostics Dropdown */}
      {isDetailsOpen && (
        <div
          className={`absolute top-full left-0 mt-2 w-72 sm:w-80 p-4 rounded-2xl border shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200 ${
            isDark
              ? 'bg-slate-950/95 border-slate-700 text-white'
              : 'bg-white/95 border-slate-200 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700/60">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-bold uppercase tracking-wider">
                GPS Diagnostics & Accuracy
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsDetailsOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Horizontal Precision:</span>
              <span className="font-mono-tabular font-bold">
                {currentFix?.accuracy !== null
                  ? `±${Math.round(currentFix?.accuracy ?? 0)} meters`
                  : 'Acquiring satellites...'}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">Signal Freshness:</span>
              <span className="font-mono-tabular">
                {fixAgeSeconds !== null ? `${fixAgeSeconds}s ago` : 'No fix'}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">Coordinates:</span>
              <span className="font-mono-tabular text-[11px] truncate">
                {currentFix
                  ? `${currentFix.lat.toFixed(5)}°, ${currentFix.lng.toFixed(5)}°`
                  : '--'}
              </span>
            </div>

            {/* Warning advisory when accuracy is degraded */}
            {gpsQuality === 'poor' && (
              <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-[11px] text-amber-200 mt-2 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong>Low GPS Signal Accuracy:</strong> Mountain canyons, tall buildings, or riding indoors can degrade satellite signals. Mount the phone with an unobstructed sky view.
                </div>
              </div>
            )}

            {/* Indoor Testing Tip */}
            {onSwitchToSimulation && (!currentFix || gpsQuality === 'poor') && (
              <div className="pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailsOpen(false);
                    onSwitchToSimulation();
                  }}
                  className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-sky-600/20 text-sky-300 border border-sky-500/30 hover:bg-sky-600/30 transition text-center"
                >
                  Testing indoors? Switch to Demo Simulator
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
