import React, { useState } from 'react';
import {
  ChevronUp,
  ChevronDown,
  Pause,
  Play,
  Square,
  RotateCcw,
  Mountain,
  Gauge,
  Activity,
  Compass,
  Clock,
  Layers,
  Box,
  Sliders,
  Maximize2,
  Sparkles,
} from 'lucide-react';
import type { GpsSignalQuality } from '../utils/telemetry';

interface ExpandableRideDashboardProps {
  isRecording: boolean;
  isPaused: boolean;
  isGpsReady: boolean;
  speedMph: number;
  distanceMiles: number;
  elapsedSeconds: number;
  movingSeconds: number;
  avgOverallSpeedMph: number;
  avgMovingSpeedMph: number;
  maxSpeedMph: number;
  currentAltitudeFeet: number | null;
  elevationGainFeet?: number;
  gradeEstimate: number | null;
  unit: 'mph' | 'kmh';
  isDark: boolean;
  gpsQuality: GpsSignalQuality;
  riderName: string;
  sourceLabel?: string;
  onStartRide: () => void;
  onPauseRide: () => void;
  onResumeRide: () => void;
  onStopRide: () => void;
  onDiscardRide?: () => void;
}

export const ExpandableRideDashboard: React.FC<ExpandableRideDashboardProps> = ({
  isRecording,
  isPaused,
  isGpsReady,
  speedMph,
  distanceMiles,
  elapsedSeconds,
  movingSeconds,
  avgOverallSpeedMph,
  avgMovingSpeedMph,
  maxSpeedMph,
  currentAltitudeFeet,
  elevationGainFeet = 0,
  gradeEstimate,
  unit,
  isDark,
  gpsQuality,
  riderName,
  sourceLabel,
  onStartRide,
  onPauseRide,
  onResumeRide,
  onStopRide,
  onDiscardRide,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [showConfirmDiscard, setShowConfirmDiscard] = useState<boolean>(false);

  // Formatting helpers
  const distMultiplier = unit === 'kmh' ? 1.60934 : 1;
  const speedMultiplier = unit === 'kmh' ? 1.60934 : 1;
  const distUnit = unit === 'kmh' ? 'km' : 'mi';
  const speedUnit = unit === 'kmh' ? 'km/h' : 'mph';
  const altUnit = unit === 'kmh' ? 'm' : 'ft';

  const displayDistance = (distanceMiles * distMultiplier).toFixed(2);
  const displaySpeed = (speedMph * speedMultiplier).toFixed(1);
  const displayAvgMoving = (avgMovingSpeedMph * speedMultiplier).toFixed(1);
  const displayAvgOverall = (avgOverallSpeedMph * speedMultiplier).toFixed(1);
  const displayMaxSpeed = (maxSpeedMph * speedMultiplier).toFixed(1);
  const displayElevGain = unit === 'kmh' ? Math.round(elevationGainFeet * 0.3048) : Math.round(elevationGainFeet);
  const displayAltitude =
    currentAltitudeFeet !== null
      ? unit === 'kmh'
        ? Math.round(currentAltitudeFeet * 0.3048)
        : Math.round(currentAltitudeFeet)
      : '--';

  const formatTimer = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-[420] pointer-events-auto transition-all duration-300">
      {/* Semi-transparent Backdrop gradient */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/60 to-transparent" />

      {/* Main Container Card (Styled after Ride with GPS expandable dashboard) */}
      <div
        className={`relative mx-2 sm:mx-4 mb-2 rounded-2xl sm:rounded-3xl border shadow-2xl backdrop-blur-xl transition-all duration-300 ${
          isDark
            ? 'bg-slate-950/95 border-slate-800 text-white shadow-black/80'
            : 'bg-white/95 border-slate-200 text-slate-900 shadow-slate-400/50'
        }`}
      >
        {/* Top Handle / Pagination & Expand Toggle */}
        <div
          onClick={() => setIsExpanded((prev) => !prev)}
          className="flex items-center justify-between px-4 pt-2.5 pb-1 cursor-pointer select-none"
        >
          {/* Rider / Mode Badge */}
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="truncate max-w-[140px]">{riderName}</span>
            {sourceLabel && <span className="opacity-75">· {sourceLabel}</span>}
          </div>

          {/* Page Indicators (Orange / Gray dots matching Ride with GPS) */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActivePageIndex(0);
              }}
              className={`w-2 h-2 rounded-full transition-all ${
                activePageIndex === 0 ? 'bg-orange-500 w-3' : 'bg-slate-500/50'
              }`}
              aria-label="Metrics Page 1"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActivePageIndex(1);
              }}
              className={`w-2 h-2 rounded-full transition-all ${
                activePageIndex === 1 ? 'bg-orange-500 w-3' : 'bg-slate-500/50'
              }`}
              aria-label="Metrics Page 2"
            />
          </div>

          {/* Chevron Expand / Collapse Toggle Button */}
          <button
            type="button"
            aria-label={isExpanded ? 'Collapse Dashboard' : 'Expand Dashboard'}
            className={`p-1 rounded-lg text-slate-400 hover:text-slate-200 transition ${
              isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
            }`}
          >
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            )}
          </button>
        </div>

        {/* PRIMARY METRICS ROW (Ride with GPS Layout: Distance | Speed (Center Prominent) | Duration) */}
        {activePageIndex === 0 ? (
          <div className="px-4 py-1">
            <div className="grid grid-cols-3 items-baseline text-center">
              {/* Distance */}
              <div className="text-left">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Distance
                </span>
                <div className="font-mono-tabular font-extrabold text-2xl sm:text-3xl tracking-tight text-slate-900 dark:text-white leading-tight">
                  {displayDistance}
                  <span className="text-xs font-semibold text-slate-400 ml-1">
                    {distUnit}
                  </span>
                </div>
              </div>

              {/* Speed (Large Center Number) */}
              <div className="text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Speed
                </span>
                <div className="font-mono-tabular font-black text-3xl sm:text-4xl lg:text-5xl tracking-tighter text-slate-950 dark:text-white leading-none">
                  {displaySpeed}
                  <span className="text-xs font-bold text-sky-500 dark:text-sky-400 ml-1">
                    {speedUnit}
                  </span>
                </div>
              </div>

              {/* Duration */}
              <div className="text-right">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Duration
                </span>
                <div className="font-mono-tabular font-extrabold text-2xl sm:text-3xl tracking-tight text-slate-900 dark:text-white leading-tight">
                  {formatTimer(elapsedSeconds)}
                </div>
              </div>
            </div>

            {/* Row 2 (Elevation Gain & Avg Moving Speed matching screenshot) */}
            <div className="grid grid-cols-2 items-baseline pt-2 mt-1 border-t border-slate-200/80 dark:border-slate-800/80 text-left">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Elevation Gain
                </span>
                <div className="font-mono-tabular font-bold text-lg sm:text-xl text-slate-800 dark:text-slate-100">
                  {displayElevGain}
                  <span className="text-xs font-medium text-slate-400 ml-1">
                    {altUnit}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Avg Mv Speed
                </span>
                <div className="font-mono-tabular font-bold text-lg sm:text-xl text-slate-800 dark:text-slate-100">
                  {displayAvgMoving}
                  <span className="text-xs font-medium text-slate-400 ml-1">
                    {speedUnit}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* PAGE 2 METRICS: Road Slope, Max Speed, Altitude & Moving Time */
          <div className="px-4 py-1">
            <div className="grid grid-cols-3 items-baseline text-center">
              <div className="text-left">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Road Slope
                </span>
                <div className="font-mono-tabular font-extrabold text-xl sm:text-2xl text-slate-900 dark:text-white">
                  {gradeEstimate !== null ? (
                    <span className={gradeEstimate > 0 ? 'text-amber-400' : 'text-sky-400'}>
                      {gradeEstimate > 0 ? `+${gradeEstimate.toFixed(1)}%` : `${gradeEstimate.toFixed(1)}%`}
                    </span>
                  ) : (
                    '0.0%'
                  )}
                </div>
              </div>

              <div className="text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Max Speed
                </span>
                <div className="font-mono-tabular font-black text-2xl sm:text-3xl text-slate-950 dark:text-white">
                  {displayMaxSpeed}
                  <span className="text-xs font-bold text-slate-400 ml-1">{speedUnit}</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Altitude
                </span>
                <div className="font-mono-tabular font-extrabold text-xl sm:text-2xl text-slate-900 dark:text-white">
                  {displayAltitude}
                  <span className="text-xs font-medium text-slate-400 ml-1">{altUnit}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 items-baseline pt-2 mt-1 border-t border-slate-200/80 dark:border-slate-800/80 text-left">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Moving Time
                </span>
                <div className="font-mono-tabular font-bold text-lg sm:text-xl text-slate-800 dark:text-slate-100">
                  {formatTimer(movingSeconds)}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Avg Overall
                </span>
                <div className="font-mono-tabular font-bold text-lg sm:text-xl text-slate-800 dark:text-slate-100">
                  {displayAvgOverall}
                  <span className="text-xs font-medium text-slate-400 ml-1">{speedUnit}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* EXPANDED ADDITIONAL METRICS DRAWER */}
        {isExpanded && (
          <div className="px-4 py-3 border-t border-slate-200/80 dark:border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="p-2.5 rounded-xl bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">
                Stopped Time
              </span>
              <span className="font-mono-tabular text-base font-bold text-slate-900 dark:text-white">
                {formatTimer(Math.max(0, elapsedSeconds - movingSeconds))}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">
                GPS Accuracy
              </span>
              <span className="font-mono-tabular text-base font-bold text-emerald-400">
                {gpsQuality === 'good'
                  ? 'High (±5m)'
                  : gpsQuality === 'fair'
                  ? 'Fair (±15m)'
                  : gpsQuality === 'poor'
                  ? 'Low (±50m)'
                  : 'Searching...'}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">
                Max Validated
              </span>
              <span className="font-mono-tabular text-base font-bold text-slate-900 dark:text-white">
                {displayMaxSpeed} {speedUnit}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">
                Rider Session
              </span>
              <span className="font-semibold text-sky-400 truncate block">
                {riderName} Cockpit
              </span>
            </div>
          </div>
        )}

        {/* BOTTOM ACTION BUTTONS ROW (Featuring Large Circular Button matching screenshot) */}
        <div className="relative pt-2 pb-3 px-4 flex items-center justify-between">
          {/* Left Secondary Action (Discard if paused, or View Toggle) */}
          <div className="w-24">
            {isPaused ? (
              showConfirmDiscard ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      onDiscardRide?.();
                      setShowConfirmDiscard(false);
                    }}
                    className="px-2 py-1 rounded-lg text-xs font-bold bg-red-600 text-white"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConfirmDiscard(false)}
                    className="px-2 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowConfirmDiscard(true)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 transition flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Discard</span>
                </button>
              )
            ) : null}
          </div>

          {/* CENTER: LARGE VIBRANT CIRCULAR ACTION BUTTON (Ride with GPS Signature Element) */}
          <div className="flex items-center justify-center -mt-6 sm:-mt-7">
            {!isRecording && !isPaused ? (
              /* START RIDE BUTTON */
              <button
                type="button"
                onClick={onStartRide}
                disabled={!isGpsReady}
                title={isGpsReady ? 'Start Recording Bicycle Ride' : 'Waiting for GPS Fix...'}
                className={`w-16 h-16 sm:w-18 sm:h-18 rounded-full shadow-2xl flex items-center justify-center transition-all transform active:scale-95 cursor-pointer border-4 ${
                  isGpsReady
                    ? 'bg-gradient-to-tr from-emerald-600 to-teal-400 text-white border-white dark:border-slate-900 ring-4 ring-emerald-500/30 hover:scale-105'
                    : 'bg-slate-700 text-slate-400 border-slate-600 cursor-not-allowed opacity-80'
                }`}
              >
                <Play className="w-8 h-8 fill-current translate-x-0.5" />
              </button>
            ) : isRecording ? (
              /* RECORDING: LARGE ORANGE PAUSE BUTTON (Matching the screenshot!) */
              <button
                type="button"
                onClick={onPauseRide}
                title="Pause Ride"
                className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-gradient-to-tr from-orange-600 to-amber-500 text-white shadow-2xl flex items-center justify-center transition-all transform active:scale-95 hover:scale-105 cursor-pointer border-4 border-white dark:border-slate-900 ring-4 ring-orange-500/30"
              >
                <Pause className="w-8 h-8 fill-current" />
              </button>
            ) : (
              /* PAUSED: RESUME BUTTON */
              <button
                type="button"
                onClick={onResumeRide}
                title="Resume Ride"
                className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-gradient-to-tr from-sky-600 to-blue-500 text-white shadow-2xl flex items-center justify-center transition-all transform active:scale-95 hover:scale-105 cursor-pointer border-4 border-white dark:border-slate-900 ring-4 ring-sky-500/30"
              >
                <Play className="w-8 h-8 fill-current translate-x-0.5" />
              </button>
            )}
          </div>

          {/* Right Action (Stop & Save button when paused or recording) */}
          <div className="w-24 flex justify-end">
            {isRecording || isPaused ? (
              <button
                type="button"
                onClick={onStopRide}
                title="Finish & Save Ride"
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition flex items-center gap-1.5"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Finish</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
