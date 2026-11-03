import React, { useRef, useState } from 'react';
import {
  X,
  Download,
  Trash2,
  MapPin,
  FileCode,
  Upload,
  ShieldAlert,
  ArrowLeftRight,
} from 'lucide-react';
import {
  RIDER_PROFILES,
  calculateRiderRealTotals,
  exportRideToGpx,
  formatAltitudeDisplay,
  formatDistanceValue,
  formatElapsedTime,
  formatStatSpeed,
  type RiderId,
  type SavedRide,
} from '../utils/telemetry';

interface RideHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  rides: SavedRide[];
  unit: 'mph' | 'kmh';
  activeRiderId: RiderId;
  onDeleteRide: (id: string) => void;
  onReassignRider: (rideId: string, newRiderId: RiderId) => void;
  onReassignRideSource: (rideId: string, newSource: 'live' | 'car_test') => void;
  onPreviewRideOnMap: (ride: SavedRide) => void;
  onImportBackupJson: (rawJson: string) => void;
  importFeedback: { type: 'success' | 'error'; message: string } | null;
}

export const RideHistoryModal: React.FC<RideHistoryModalProps> = ({
  isOpen,
  onClose,
  rides,
  unit,
  activeRiderId,
  onDeleteRide,
  onReassignRider,
  onReassignRideSource,
  onPreviewRideOnMap,
  onImportBackupJson,
  importFeedback,
}) => {
  const [riderFilter, setRiderFilter] = useState<'all' | RiderId>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const speedLabel = unit === 'kmh' ? 'KM/H' : 'MPH';
  const distLabel = unit === 'kmh' ? 'km' : 'mi';

  const azlanTotals = calculateRiderRealTotals(rides, 'azlan');
  const talhaTotals = calculateRiderRealTotals(rides, 'talha');

  const filteredRides = rides.filter((r) => {
    if (riderFilter !== 'all' && r.riderId !== riderFilter) return false;
    if (dateFilter) {
      const localDate = new Date(r.startedAt).toLocaleDateString('en-CA'); // YYYY-MM-DD
      if (localDate !== dateFilter) return false;
    }
    return true;
  });

  const triggerFileDownload = (content: string, filename: string, mimeType: string) => {
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

  const handleExportGpx = (ride: SavedRide) => {
    const gpx = exportRideToGpx(ride);
    const safeName = ride.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    triggerFileDownload(gpx, `${safeName}.gpx`, 'application/gpx+xml');
  };

  const handleExportJson = (ride: SavedRide) => {
    const json = JSON.stringify(ride, null, 2);
    const safeName = ride.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    triggerFileDownload(json, `${safeName}.json`, 'application/json');
  };

  const handleExportFullBackup = () => {
    const bundle = {
      exportedAt: new Date().toISOString(),
      application: 'Family Bicycle Cockpit & Ride Logger',
      rides,
    };
    triggerFileDownload(
      JSON.stringify(bundle, null, 2),
      `family-bicycle-rides-backup-${new Date().toISOString().slice(0, 10)}.json`,
      'application/json'
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onImportBackupJson(reader.result);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ride-history-title"
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4"
    >
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2
              id="ride-history-title"
              className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100"
            >
              Family Bicycle Ride Log — Azlan &amp; Talha
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              All records are stored locally on this phone. Car Test (Camry) and Simulation sessions are excluded from real bicycle mileage totals.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close ride logs modal"
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Rider Personal Summaries (Derived exclusively from real 'live' sessions) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-5 py-3.5 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800">
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-sky-600 dark:text-sky-400">
                Azlan’s Real Bicycle Totals
              </div>
              <div className="font-mono-tabular text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                {formatDistanceValue(azlanTotals.totalDistanceMiles, unit)} {distLabel}
              </div>
            </div>
            <div className="text-right text-xs text-slate-600 dark:text-slate-400 font-mono-tabular">
              <div>{azlanTotals.completedRideCount} completed rides</div>
              <div>Moving: {formatElapsedTime(azlanTotals.totalMovingSeconds)}</div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Talha’s Real Bicycle Totals
              </div>
              <div className="font-mono-tabular text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                {formatDistanceValue(talhaTotals.totalDistanceMiles, unit)} {distLabel}
              </div>
            </div>
            <div className="text-right text-xs text-slate-600 dark:text-slate-400 font-mono-tabular">
              <div>{talhaTotals.completedRideCount} completed rides</div>
              <div>Moving: {formatElapsedTime(talhaTotals.totalMovingSeconds)}</div>
            </div>
          </div>
        </div>

        {/* Filter & Backup Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Filter by Rider"
              className="flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800"
            >
              {(['all', 'azlan', 'talha'] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setRiderFilter(id)}
                  className={`min-h-[34px] px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    riderFilter === id
                      ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {id === 'all' ? 'All Riders' : RIDER_PROFILES[id].name}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <label htmlFor="ride-date-filter" className="text-xs text-slate-500">
                Date:
              </label>
              <input
                id="ride-date-filter"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="min-h-[34px] px-2.5 py-1 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700"
              />
              {dateFilter && (
                <button
                  type="button"
                  onClick={() => setDateFilter('')}
                  className="text-xs text-sky-600 dark:text-sky-400 underline cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportFullBackup}
              disabled={rides.length === 0}
              className="min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Backup JSON</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Restore JSON</span>
            </button>
          </div>
        </div>

        {importFeedback && (
          <div
            className={`px-5 py-2 text-xs font-semibold ${
              importFeedback.type === 'success'
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                : 'bg-red-500/15 text-red-700 dark:text-red-300'
            }`}
          >
            {importFeedback.message}
          </div>
        )}

        {/* Ride List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
          {filteredRides.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-slate-300 dark:border-slate-800 rounded-xl p-6">
              <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
                No Recorded Bicycle Rides Found
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                Select {RIDER_PROFILES[activeRiderId].name} on the main cockpit, tap &ldquo;Start Ride&rdquo;, and tap &ldquo;Stop &amp; Save&rdquo; when finished.
              </p>
            </div>
          ) : (
            filteredRides.map((ride) => {
              const otherRider: RiderId = ride.riderId === 'azlan' ? 'talha' : 'azlan';
              const isAzlanView = activeRiderId === 'azlan' && ride.riderId === 'azlan';
              return (
                <div
                  key={ride.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-3"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                          Rider: {RIDER_PROFILES[ride.riderId]?.name ?? ride.riderId}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`text-xs font-semibold ${
                            ride.source === 'car_test'
                              ? 'text-indigo-600 dark:text-indigo-400'
                              : ride.source === 'simulation'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {ride.source === 'simulation'
                            ? 'Demo Simulation (Excluded from Bike Totals)'
                            : ride.source === 'car_test'
                            ? 'Car Test · Camry (Excluded from Bike Totals)'
                            : 'Verified Live Bicycle Ride'}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {ride.title}
                      </h3>
                    </div>

                    {/* Rider & Source Reassignment Controls */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {ride.source !== 'simulation' && (
                        <button
                          type="button"
                          onClick={() =>
                            onReassignRideSource(
                              ride.id,
                              ride.source === 'car_test' ? 'live' : 'car_test'
                            )
                          }
                          className="min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>
                            {ride.source === 'car_test'
                              ? 'Mark as Bicycle Ride'
                              : 'Mark as Car Test (Camry)'}
                          </span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onReassignRider(ride.id, otherRider)}
                        className="min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        <span>Move to {RIDER_PROFILES[otherRider].name}</span>
                      </button>
                    </div>
                  </div>

                  {/* Detailed Metrics Row */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-700 dark:text-slate-300 font-mono-tabular">
                    <span>
                      {new Date(ride.startedAt).toLocaleString([], {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      <strong>{formatDistanceValue(ride.distanceMiles, unit)} {distLabel}</strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Elapsed {formatElapsedTime(ride.elapsedSeconds)}</span>
                    <span aria-hidden="true">·</span>
                    <span>Moving {formatElapsedTime(ride.movingSeconds)}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Avg Overall {formatStatSpeed(ride.avgOverallSpeedMph, unit)} {speedLabel}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Avg Moving {formatStatSpeed(ride.avgMovingSpeedMph, unit)} {speedLabel}
                    </span>
                    {!isAzlanView && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>
                          Max Validated {formatStatSpeed(ride.maxValidatedSpeedMph, unit)} {speedLabel}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Max Alt {formatAltitudeDisplay(ride.maxAltitudeFeet, unit)}
                        </span>
                      </>
                    )}
                  </div>

                  {/* GPS Quality Audit Summary + Action Buttons */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
                      GPS Quality: {ride.quality?.acceptedFixes ?? ride.points.length} accepted /{' '}
                      {ride.quality?.totalRawFixes ?? ride.points.length} fixes
                      {ride.quality?.averageAccuracyMeters !== null &&
                      ride.quality?.averageAccuracyMeters !== undefined
                        ? ` · Avg ±${ride.quality.averageAccuracyMeters}m`
                        : ''}
                      {ride.quality?.outageGapCount
                        ? ` · ${ride.quality.outageGapCount} gap(s)`
                        : ''}
                      {ride.quality?.rejectedSpikeCount
                        ? ` · ${ride.quality.rejectedSpikeCount} spike(s) filtered`
                        : ''}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onPreviewRideOnMap(ride);
                          onClose();
                        }}
                        disabled={ride.points.length === 0}
                        className="min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
                      >
                        <MapPin className="w-3.5 h-3.5 text-sky-500" />
                        <span>View Route</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExportGpx(ride)}
                        className="min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>GPX</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExportJson(ride)}
                        className="min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
                      >
                        <FileCode className="w-3.5 h-3.5" />
                        <span>JSON</span>
                      </button>

                      {confirmDeleteId === ride.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteRide(ride.id);
                              setConfirmDeleteId(null);
                            }}
                            className="min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white cursor-pointer"
                          >
                            Confirm Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs border border-slate-300 dark:border-slate-700 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(ride.id)}
                          aria-label={`Delete ${ride.title}`}
                          className="min-w-[38px] min-h-[38px] rounded-lg border border-slate-300 dark:border-slate-800 text-slate-500 hover:text-red-600 dark:hover:text-red-400 flex items-center justify-center cursor-pointer"
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

        {/* Footer Privacy Notice */}
        <div className="px-5 py-3 bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
          <span>
            <strong>Family Privacy Notice:</strong> Ride history stays strictly on this device with zero cloud uploads or analytics. Exported GPX and JSON files contain exact location coordinates and timestamps.
          </span>
        </div>
      </div>
    </div>
  );
};
