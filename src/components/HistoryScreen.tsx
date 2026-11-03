import React, { useState, useMemo } from 'react';
import {
  Activity,
  Calendar,
  Clock,
  Download,
  Trash2,
  UserCheck,
  Search,
  Filter,
  MapPin,
  Car,
  ChevronRight,
  Upload,
  Eye,
  Route,
  Sparkles,
} from 'lucide-react';
import {
  RIDER_PROFILES,
  exportRideToGpx,
  formatDistanceValue,
  formatElapsedTime,
  formatStatSpeed,
  type RiderId,
  type SavedRide,
} from '../utils/telemetry';

interface HistoryScreenProps {
  rides: SavedRide[];
  unit: 'mph' | 'kmh';
  activeRiderId: RiderId;
  onDeleteRide: (id: string) => void;
  onReassignRider: (rideId: string, newRider: RiderId) => void;
  onReassignRideSource: (
    rideId: string,
    newSource: 'live' | 'car_test'
  ) => void;
  onPreviewRideOnMap: (ride: SavedRide) => void;
  onImportBackupJson: (file: File) => Promise<{ success: boolean; message: string }>;
  importFeedback: string | null;
  isDark: boolean;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  rides,
  unit,
  activeRiderId,
  onDeleteRide,
  onReassignRider,
  onReassignRideSource,
  onPreviewRideOnMap,
  onImportBackupJson,
  importFeedback,
  isDark,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<RiderId | 'all' | 'car_test'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const speedUnitLabel = unit === 'kmh' ? 'km/h' : 'mph';
  const distUnitLabel = unit === 'kmh' ? 'km' : 'mi';

  // Filter rides based on search query and rider tab
  const filteredRides = useMemo(() => {
    return rides.filter((ride) => {
      if (selectedFilter === 'car_test') {
        if (ride.source !== 'car_test') return false;
      } else if (selectedFilter !== 'all') {
        if (ride.riderId !== selectedFilter) return false;
      }

      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase();
        return (
          ride.title.toLowerCase().includes(query) ||
          ride.startedAt.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [rides, selectedFilter, searchQuery]);

  const handleExportSingleGpx = (ride: SavedRide) => {
    const xml = exportRideToGpx(ride);
    const blob = new Blob([xml], { type: 'application/gpx+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = ride.title.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    a.download = `${safeTitle || 'bicycle_ride'}.gpx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportBackupJson(file);
      e.target.value = '';
    }
  };

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto px-4 py-5 space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-sky-400" />
            <span>Family Ride History</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {rides.length} recorded rides stored on device · Export GPX routes & view traces
          </p>
        </div>

        {/* JSON Backup / Restore Actions */}
        <div className="flex items-center gap-2">
          <label className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 transition cursor-pointer flex items-center gap-1.5 border border-slate-700">
            <Upload className="w-3.5 h-3.5" />
            <span>Import JSON</span>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {importFeedback && (
        <div className="p-3 rounded-xl bg-sky-500/15 border border-sky-500/40 text-xs text-sky-300">
          {importFeedback}
        </div>
      )}

      {/* Filter Chips (All, Talha, Azlan, Eshal, Guest, Camry) */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSelectedFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
            selectedFilter === 'all'
              ? 'bg-sky-600 text-white shadow-sm'
              : isDark
              ? 'bg-slate-900 text-slate-400 hover:text-white'
              : 'bg-slate-100 text-slate-600 hover:text-slate-900'
          }`}
        >
          All Rides ({rides.length})
        </button>

        {(['talha', 'azlan', 'eshal', 'guest'] as RiderId[]).map((rId) => {
          const profile = RIDER_PROFILES[rId];
          const count = rides.filter((r) => r.riderId === rId && r.source !== 'car_test').length;
          return (
            <button
              key={rId}
              type="button"
              onClick={() => setSelectedFilter(rId)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                selectedFilter === rId
                  ? 'bg-sky-600 text-white shadow-sm font-bold'
                  : isDark
                  ? 'bg-slate-900 text-slate-400 hover:text-white'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>{profile.badgeEmoji}</span>
              <span>{profile.name} ({count})</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setSelectedFilter('car_test')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
            selectedFilter === 'car_test'
              ? 'bg-indigo-600 text-white shadow-sm font-bold'
              : isDark
              ? 'bg-slate-900 text-slate-400 hover:text-white'
              : 'bg-slate-100 text-slate-600 hover:text-slate-900'
          }`}
        >
          <Car className="w-3.5 h-3.5" />
          <span>Car Test ({rides.filter((r) => r.source === 'car_test').length})</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          placeholder="Search rides by title or date..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={`w-full pl-10 pr-4 py-2 rounded-xl text-xs border transition focus:outline-none focus:ring-2 focus:ring-sky-500 ${
            isDark
              ? 'bg-slate-900/80 border-slate-800 text-white placeholder-slate-500'
              : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 shadow-sm'
          }`}
        />
      </div>

      {/* Rides List */}
      <div className="space-y-3">
        {filteredRides.length === 0 ? (
          <div
            className={`p-10 text-center rounded-2xl border border-dashed ${
              isDark ? 'border-slate-800 text-slate-500' : 'border-slate-300 text-slate-400'
            }`}
          >
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <div className="font-semibold text-sm">No Rides Found</div>
            <div className="text-xs mt-1">
              Start a ride from the Ride screen to begin logging family mileage.
            </div>
          </div>
        ) : (
          filteredRides.map((ride) => {
            const profile = RIDER_PROFILES[ride.riderId] || RIDER_PROFILES.azlan;
            const dateStr = new Date(ride.startedAt).toLocaleDateString([], {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            });
            const timeStr = new Date(ride.startedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={ride.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isDark
                    ? 'bg-slate-950/70 border-slate-800/90 shadow-md'
                    : 'bg-white border-slate-200 shadow-sm'
                }`}
              >
                {/* Top Title & Metadata */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/80 dark:border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{profile.badgeEmoji}</span>
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                        {ride.title}
                        {ride.source === 'car_test' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/40">
                            Camry Car Test
                          </span>
                        )}
                        {ride.source === 'simulation' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                            Simulation
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {dateStr} at {timeStr} · Rider: {profile.name}
                      </div>
                    </div>
                  </div>

                  {/* Top Actions: View on Map & Export GPX */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => onPreviewRideOnMap(ride)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 transition flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Route</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExportSingleGpx(ride)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>GPX</span>
                    </button>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 font-mono-tabular">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Distance
                    </span>
                    <span className="font-extrabold text-base text-slate-900 dark:text-white">
                      {formatDistanceValue(ride.distanceMiles, unit)} {distUnitLabel}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Moving Time
                    </span>
                    <span className="font-extrabold text-base text-slate-900 dark:text-white">
                      {formatElapsedTime(ride.movingSeconds)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Avg Speed
                    </span>
                    <span className="font-extrabold text-base text-slate-900 dark:text-white">
                      {formatStatSpeed(ride.avgMovingSpeedMph, unit)} {speedUnitLabel}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Max Speed
                    </span>
                    <span className="font-extrabold text-base text-slate-900 dark:text-white">
                      {formatStatSpeed(ride.maxValidatedSpeedMph, unit)} {speedUnitLabel}
                    </span>
                  </div>
                </div>

                {/* Bottom Row: Reassign Rider & Delete */}
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-[11px]">Reassign:</span>
                    <select
                      value={ride.riderId}
                      onChange={(e) => onReassignRider(ride.id, e.target.value as RiderId)}
                      className="px-2 py-1 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-700 text-white cursor-pointer"
                    >
                      <option value="talha">Talha</option>
                      <option value="azlan">Azlan</option>
                      <option value="eshal">Eshal</option>
                      <option value="guest">Guest</option>
                    </select>
                  </div>

                  <div>
                    {deleteConfirmId === ride.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteRide(ride.id);
                            setDeleteConfirmId(null);
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-red-600 text-white"
                        >
                          Confirm Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-2 py-1 rounded-lg text-xs bg-slate-800 text-slate-300"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(ride.id)}
                        className="text-slate-500 hover:text-red-400 transition p-1"
                        title="Delete ride"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
