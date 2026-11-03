import React from 'react';
import {
  Play,
  UserCheck,
  MapPin,
  Clock,
  Compass,
  Trophy,
  Activity,
  Download,
  Car,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  PlusCircle,
} from 'lucide-react';
import {
  RIDER_PROFILES,
  calculateRiderRealTotals,
  type RiderId,
  type SavedRide,
} from '../utils/telemetry';

interface HomeScreenProps {
  activeRiderId: RiderId;
  onSelectRider: (rider: RiderId) => void;
  savedRides: SavedRide[];
  unit: 'mph' | 'kmh';
  isDark: boolean;
  onNavigateToRide: () => void;
  onNavigateToHistory: () => void;
  onOpenOfflineMaps: () => void;
  onOpenTestModes: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  activeRiderId,
  onSelectRider,
  savedRides,
  unit,
  isDark,
  onNavigateToRide,
  onNavigateToHistory,
  onOpenOfflineMaps,
  onOpenTestModes,
}) => {
  const activeProfile = RIDER_PROFILES[activeRiderId];
  const distUnit = unit === 'kmh' ? 'km' : 'mi';
  const multiplier = unit === 'kmh' ? 1.60934 : 1;

  // Compute rider totals
  const allRiderIds: RiderId[] = ['talha', 'azlan', 'eshal', 'guest'];
  const riderTotals = allRiderIds.map((rId) => {
    const stats = calculateRiderRealTotals(savedRides, rId);
    return {
      riderId: rId,
      profile: RIDER_PROFILES[rId],
      stats,
      distanceDisplay: (stats.totalDistanceMiles * multiplier).toFixed(1),
    };
  });

  const activeStats = calculateRiderRealTotals(savedRides, activeRiderId);
  const activeDistance = (activeStats.totalDistanceMiles * multiplier).toFixed(1);

  // Find latest ride
  const latestRide = savedRides.length > 0 ? savedRides[0] : null;

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto px-4 py-4 space-y-6 animate-in fade-in duration-200">
      {/* Top Welcome & Active Rider Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-sky-500">
            Family Bicycle Cockpit
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Welcome back, {activeProfile.name}!
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Local-first GPS speedometer, offline bike maps & ride recorder
          </p>
        </div>

        {/* Compact Rider Badge */}
        <div
          className={`flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border shadow-sm self-start sm:self-auto ${
            isDark
              ? 'bg-slate-900 border-slate-700 text-white'
              : 'bg-white border-slate-200 text-slate-800'
          }`}
        >
          <span className="text-lg">{activeProfile.badgeEmoji}</span>
          <div className="text-xs">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Active Rider</span>
            <span className="font-bold">{activeProfile.name}</span>
          </div>
        </div>
      </div>

      {/* COMPACT RIDER SELECTOR (Home compact selector for Talha / Azlan / Eshal / Guest) */}
      <div
        className={`p-4 rounded-2xl border ${
          isDark
            ? 'bg-slate-950/70 border-slate-800 shadow-xl'
            : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-sky-400" />
            <span>Select Rider Profile</span>
          </label>
          <span className="text-[11px] text-slate-500">Separate mileage totals</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {riderTotals.map((item) => {
            const isSelected = item.riderId === activeRiderId;
            return (
              <button
                key={item.riderId}
                type="button"
                onClick={() => onSelectRider(item.riderId)}
                className={`p-3 rounded-xl border text-left transition-all relative cursor-pointer ${
                  isSelected
                    ? 'border-2 shadow-md transform scale-[1.02]'
                    : isDark
                    ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
                style={{
                  borderColor: isSelected ? item.profile.accentColor : undefined,
                  backgroundColor: isSelected
                    ? `${item.profile.accentColor}18`
                    : undefined,
                }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-2xl">{item.profile.badgeEmoji}</span>
                  {isSelected && (
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: item.profile.accentColor }}
                    />
                  )}
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-white">
                  {item.profile.name}
                </div>
                <div className="text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400 mt-0.5">
                  {item.distanceDisplay} {distUnit} · {item.stats.completedRideCount} rides
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* PRIMARY CTA: START RIDE HERO CARD */}
      <div
        onClick={onNavigateToRide}
        className="relative overflow-hidden p-6 rounded-3xl bg-gradient-to-br from-sky-600 via-indigo-600 to-slate-900 text-white shadow-2xl cursor-pointer group hover:scale-[1.01] transition-transform"
      >
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-semibold backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ride Cockpit Ready</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Start {activeProfile.name}'s Bicycle Ride
            </h2>
            <p className="text-xs sm:text-sm text-sky-100 max-w-md">
              Full map navigation, 2D/3D perspective, live GPS speedometer & expandable recording dashboard.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <div className="w-14 h-14 rounded-full bg-white text-sky-600 shadow-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Play className="w-7 h-7 fill-current translate-x-0.5" />
            </div>
          </div>
        </div>
      </div>

      {/* FAMILY MILEAGE STATS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div
          className={`p-4 rounded-2xl border ${
            isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="text-xs font-semibold text-slate-400">Total Family Distance</div>
          <div className="font-mono-tabular font-extrabold text-2xl text-slate-900 dark:text-white mt-1">
            {(
              calculateRiderRealTotals(savedRides, 'all').totalDistanceMiles * multiplier
            ).toFixed(1)}{' '}
            <span className="text-xs font-normal text-slate-400">{distUnit}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Real bicycle rides (Car tests excluded)
          </div>
        </div>

        <div
          className={`p-4 rounded-2xl border ${
            isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="text-xs font-semibold text-slate-400">{activeProfile.name}'s Recorded Rides</div>
          <div className="font-mono-tabular font-extrabold text-2xl text-sky-400 mt-1">
            {activeStats.completedRideCount}{' '}
            <span className="text-xs font-normal text-slate-400">rides completed</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {activeDistance} {distUnit} logged on bicycle
          </div>
        </div>

        <div
          className={`p-4 rounded-2xl border ${
            isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="text-xs font-semibold text-slate-400">Offline Maps Ready</div>
          <div className="font-mono-tabular font-extrabold text-2xl text-emerald-400 mt-1">
            100% Offline
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Cached for zero-signal trail rides
          </div>
        </div>
      </div>

      {/* QUICK ACCESS TILES (Offline Maps, History, Test Modes) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        <button
          type="button"
          onClick={onOpenOfflineMaps}
          className={`p-4 rounded-2xl border text-left flex items-center justify-between transition hover:scale-[1.01] ${
            isDark
              ? 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-slate-900 dark:text-white">Offline Maps</div>
              <div className="text-[11px] text-slate-400">Pre-render map areas</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        <button
          type="button"
          onClick={onNavigateToHistory}
          className={`p-4 rounded-2xl border text-left flex items-center justify-between transition hover:scale-[1.01] ${
            isDark
              ? 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-slate-900 dark:text-white">Ride Logs</div>
              <div className="text-[11px] text-slate-400">{savedRides.length} saved rides & GPX</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        <button
          type="button"
          onClick={onOpenTestModes}
          className={`p-4 rounded-2xl border text-left flex items-center justify-between transition hover:scale-[1.01] ${
            isDark
              ? 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-slate-900 dark:text-white">Test Modes</div>
              <div className="text-[11px] text-slate-400">Camry Car Test & Simulator</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
      </div>
    </div>
  );
};
