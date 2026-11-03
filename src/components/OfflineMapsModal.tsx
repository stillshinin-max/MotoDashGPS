import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Download,
  HardDrive,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Wifi,
  WifiOff,
  Layers,
  MapPin,
  Clock,
  Sparkles,
  RefreshCw,
  X,
  Compass,
  Check,
  ShieldAlert,
} from 'lucide-react';
import {
  downloadOfflineArea,
  getSavedOfflineRegions,
  deleteOfflineRegion,
  clearAllOfflineTileCache,
  getOfflineCacheStats,
  calculateBoundingBox,
  calculateTileList,
  getSimulatedOfflineMode,
  setSimulatedOfflineMode,
  type OfflineRegionRecord,
  type OfflineDownloadProgress,
} from '../utils/offlineMapManager';
import type { MapLayerStyle } from '../utils/storage';
import { bikeAudioEngine } from '../utils/audioEngine';

interface OfflineMapsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  currentLat: number | null;
  currentLng: number | null;
  currentMapLayer: MapLayerStyle;
  onSimulatedOfflineChange?: (enabled: boolean) => void;
}

const RADIUS_PRESETS = [
  {
    id: 'local',
    radiusKm: 1.5,
    label: 'Neighborhood / Park',
    subtitle: '~1.5 km (0.9 mi) · Quick download',
    approxTilesPerLayer: 180,
  },
  {
    id: 'city',
    radiusKm: 3.5,
    label: 'City & Trail Loop',
    subtitle: '~3.5 km (2.2 mi) · Recommended',
    approxTilesPerLayer: 650,
  },
  {
    id: 'extended',
    radiusKm: 7.0,
    label: 'Extended County Ride',
    subtitle: '~7.0 km (4.3 mi) · Long adventures',
    approxTilesPerLayer: 2200,
  },
];

export const OfflineMapsModal: React.FC<OfflineMapsModalProps> = ({
  isOpen,
  onClose,
  isDark,
  currentLat,
  currentLng,
  currentMapLayer,
  onSimulatedOfflineChange,
}) => {
  const [activeTab, setActiveTab] = useState<'download' | 'saved'>('download');
  const [regionName, setRegionName] = useState<string>('');
  const [selectedRadiusKm, setSelectedRadiusKm] = useState<number>(3.5);
  const [minZoom] = useState<number>(13);
  const [maxZoom, setMaxZoom] = useState<number>(17);

  // Selected layers to download
  const [selectedLayers, setSelectedLayers] = useState<MapLayerStyle[]>([
    'cycle',
    'streets',
    'satellite',
    'dark',
  ]);

  // Center coordinate state (defaults to current GPS or Plano bike trail sample)
  const defaultLat = currentLat ?? 33.003;
  const defaultLng = currentLng ?? -96.672;
  const [centerLat, setCenterLat] = useState<number>(defaultLat);
  const [centerLng, setCenterLng] = useState<number>(defaultLng);

  // Download state & progress
  const [downloadProgress, setDownloadProgress] =
    useState<OfflineDownloadProgress | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Saved regions & cache storage metrics
  const [savedRegions, setSavedRegions] = useState<OfflineRegionRecord[]>([]);
  const [cacheStats, setCacheStats] = useState<{
    totalEntries: number;
    estimatedBytes: number;
  }>({ totalEntries: 0, estimatedBytes: 0 });

  // Simulated offline mode state
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(
    getSimulatedOfflineMode()
  );

  useEffect(() => {
    if (isOpen) {
      refreshSavedData();
      if (currentLat && currentLng) {
        setCenterLat(currentLat);
        setCenterLng(currentLng);
      }
      if (!regionName) {
        setRegionName(
          `Bicycle Route (${(currentLat ?? defaultLat).toFixed(3)}°, ${(currentLng ?? defaultLng).toFixed(3)}°)`
        );
      }
    }
  }, [isOpen, currentLat, currentLng]);

  const refreshSavedData = async () => {
    const list = getSavedOfflineRegions();
    setSavedRegions(list);
    const stats = await getOfflineCacheStats();
    setCacheStats(stats);
    setIsSimulatedOffline(getSimulatedOfflineMode());
  };

  // Calculate estimated tile count for current configuration
  const estimatedTiles = useMemo(() => {
    const bbox = calculateBoundingBox(centerLat, centerLng, selectedRadiusKm);
    const list = calculateTileList(bbox, minZoom, maxZoom, selectedLayers);
    return list.length;
  }, [centerLat, centerLng, selectedRadiusKm, minZoom, maxZoom, selectedLayers]);

  const estimatedSizeMb = useMemo(() => {
    return ((estimatedTiles * 18.5) / 1024).toFixed(1);
  }, [estimatedTiles]);

  const toggleLayer = (layer: MapLayerStyle) => {
    if (selectedLayers.includes(layer)) {
      if (selectedLayers.length === 1) return; // Keep at least one
      setSelectedLayers(selectedLayers.filter((l) => l !== layer));
    } else {
      setSelectedLayers([...selectedLayers, layer]);
    }
  };

  const selectAllViews = () => {
    setSelectedLayers(['cycle', 'streets', 'satellite', 'dark']);
  };

  const handleStartDownload = async () => {
    if (isDownloading) return;

    setIsDownloading(true);
    abortControllerRef.current = new AbortController();

    try {
      await downloadOfflineArea(
        regionName,
        centerLat,
        centerLng,
        selectedRadiusKm,
        minZoom,
        maxZoom,
        selectedLayers,
        (progress) => {
          setDownloadProgress(progress);
        },
        abortControllerRef.current.signal
      );

      // Play joyful bicycle chime when download succeeds!
      try {
        bikeAudioEngine.playBicycleBell();
      } catch {
        // Audio context fallback
      }

      await refreshSavedData();
      setActiveTab('saved');
    } catch (err: unknown) {
      if ((err as Error)?.message?.includes('cancelled')) {
        // User intentionally cancelled
      }
    } finally {
      setIsDownloading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelDownload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleDeleteRegion = async (id: string) => {
    deleteOfflineRegion(id);
    await refreshSavedData();
  };

  const handleClearAll = async () => {
    if (
      window.confirm(
        'Are you sure you want to delete all cached offline map tiles? This will free up storage but require downloading maps again for offline use.'
      )
    ) {
      await clearAllOfflineTileCache();
      await refreshSavedData();
    }
  };

  const handleToggleSimulatedOffline = (enabled: boolean) => {
    setIsSimulatedOffline(enabled);
    setSimulatedOfflineMode(enabled);
    if (onSimulatedOfflineChange) {
      onSimulatedOfflineChange(enabled);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md">
      <div
        className={`w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${
          isDark
            ? 'bg-slate-900 border-slate-700/80 text-white'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 py-4 border-b ${
            isDark
              ? 'bg-slate-950/70 border-slate-800'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                Offline Maps & Prerendering
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">
                  Zero-Signal Ready
                </span>
              </h2>
              <p
                className={`text-xs ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Download bike trails, streets & aerial views for Azlan & Talha's
                phone mounts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition ${
              isDark
                ? 'hover:bg-slate-800 text-slate-400 hover:text-white'
                : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'
            }`}
            aria-label="Close offline maps modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          className={`flex items-center gap-2 px-5 pt-3 border-b ${
            isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50/50'
          }`}
        >
          <button
            onClick={() => setActiveTab('download')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === 'download'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-4 h-4" />
            Download Offline Area
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === 'saved'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            Saved Regions & Cache ({savedRegions.length})
          </button>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {activeTab === 'download' ? (
            <>
              {/* Region Name & GPS coordinates */}
              <div
                className={`p-4 rounded-xl border ${
                  isDark
                    ? 'bg-slate-950/60 border-slate-800'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Region Name & Center Point
                  </label>
                  {currentLat && currentLng && (
                    <button
                      onClick={() => {
                        setCenterLat(currentLat);
                        setCenterLng(currentLng);
                      }}
                      className="text-xs text-sky-400 hover:underline flex items-center gap-1"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      Sync with Current GPS ({currentLat.toFixed(3)}°,{' '}
                      {currentLng.toFixed(3)}°)
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={regionName}
                  onChange={(e) => setRegionName(e.target.value)}
                  placeholder="e.g. Plano Park Trail Network"
                  disabled={isDownloading}
                  className={`w-full px-3.5 py-2 rounded-xl text-sm border font-medium transition focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500'
                      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>

              {/* Area Radius Presets */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Select Coverage Radius
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {RADIUS_PRESETS.map((preset) => {
                    const isSelected = selectedRadiusKm === preset.radiusKm;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setSelectedRadiusKm(preset.radiusKm)}
                        disabled={isDownloading}
                        className={`p-3 text-left rounded-xl border transition relative flex flex-col justify-between ${
                          isSelected
                            ? 'bg-sky-500/15 border-sky-500 text-white shadow-sm'
                            : isDark
                            ? 'bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-sm flex items-center justify-between">
                            {preset.label}
                            {isSelected && (
                              <CheckCircle2 className="w-4 h-4 text-sky-400" />
                            )}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {preset.subtitle}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Multi-view layer selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Map Views to Prerender
                  </label>
                  <button
                    type="button"
                    onClick={selectAllViews}
                    disabled={isDownloading}
                    className="text-xs text-sky-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Select All Views (Recommended)
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* Bike Trails */}
                  <button
                    type="button"
                    onClick={() => toggleLayer('cycle')}
                    disabled={isDownloading}
                    className={`p-3 rounded-xl border text-left transition ${
                      selectedLayers.includes('cycle')
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                        : isDark
                        ? 'bg-slate-950/40 border-slate-800 text-slate-400'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className="text-lg mb-1">🚲</div>
                    <div className="font-bold text-xs">Bike Trails</div>
                    <div className="text-[10px] text-slate-400">CyclOSM</div>
                  </button>

                  {/* Standard Streets */}
                  <button
                    type="button"
                    onClick={() => toggleLayer('streets')}
                    disabled={isDownloading}
                    className={`p-3 rounded-xl border text-left transition ${
                      selectedLayers.includes('streets')
                        ? 'bg-sky-500/15 border-sky-500 text-sky-300'
                        : isDark
                        ? 'bg-slate-950/40 border-slate-800 text-slate-400'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className="text-lg mb-1">🗺️</div>
                    <div className="font-bold text-xs">Standard Streets</div>
                    <div className="text-[10px] text-slate-400">OpenStreetMap</div>
                  </button>

                  {/* Dark Navigation */}
                  <button
                    type="button"
                    onClick={() => toggleLayer('dark')}
                    disabled={isDownloading}
                    className={`p-3 rounded-xl border text-left transition ${
                      selectedLayers.includes('dark')
                        ? 'bg-indigo-500/15 border-indigo-500 text-indigo-300'
                        : isDark
                        ? 'bg-slate-950/40 border-slate-800 text-slate-400'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className="text-lg mb-1">🌙</div>
                    <div className="font-bold text-xs">Dark Navigation</div>
                    <div className="text-[10px] text-slate-400">Night HUD</div>
                  </button>

                  {/* Satellite Aerial */}
                  <button
                    type="button"
                    onClick={() => toggleLayer('satellite')}
                    disabled={isDownloading}
                    className={`p-3 rounded-xl border text-left transition ${
                      selectedLayers.includes('satellite')
                        ? 'bg-amber-500/15 border-amber-500 text-amber-300'
                        : isDark
                        ? 'bg-slate-950/40 border-slate-800 text-slate-400'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className="text-lg mb-1">🛰️</div>
                    <div className="font-bold text-xs">Satellite Aerial</div>
                    <div className="text-[10px] text-slate-400">Esri Imagery</div>
                  </button>
                </div>
              </div>

              {/* Zoom Level Coverage */}
              <div
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isDark
                    ? 'bg-slate-950/40 border-slate-800'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Zoom Detail Level
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    Covers Zoom 13 (High Overview) up to Zoom {maxZoom} (Detailed
                    Bike Lane & Trail Paths)
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-semibold">
                    Max Zoom:
                  </span>
                  <button
                    type="button"
                    disabled={isDownloading}
                    onClick={() => setMaxZoom(16)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition ${
                      maxZoom === 16
                        ? 'bg-sky-500 text-white border-sky-400'
                        : 'border-slate-700 text-slate-400'
                    }`}
                  >
                    16 (Normal)
                  </button>
                  <button
                    type="button"
                    disabled={isDownloading}
                    onClick={() => setMaxZoom(17)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition ${
                      maxZoom === 17
                        ? 'bg-sky-500 text-white border-sky-400'
                        : 'border-slate-700 text-slate-400'
                    }`}
                  >
                    17 (High Detail)
                  </button>
                </div>
              </div>

              {/* Estimate Pill Box */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between ${
                  isDark
                    ? 'bg-sky-950/30 border-sky-800/60'
                    : 'bg-sky-50 border-sky-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-sky-400" />
                  <div>
                    <div className="font-bold text-sm text-sky-300">
                      Estimated Package: ~{estimatedTiles.toLocaleString()} Tiles (
                      {estimatedSizeMb} MB)
                    </div>
                    <div className="text-xs text-slate-400">
                      Covers {selectedLayers.length} view layers · Saved directly
                      to browser Cache Storage
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Download Progress Display */}
              {isDownloading && downloadProgress && (
                <div
                  className={`p-4 rounded-xl border space-y-3 ${
                    isDark
                      ? 'bg-slate-950 border-slate-700'
                      : 'bg-white border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-sky-400 flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Prerendering & Caching Tiles...
                    </span>
                    <span>{downloadProgress.percent}%</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 rounded-full transition-all duration-200"
                      style={{ width: `${downloadProgress.percent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      {downloadProgress.completedTiles.toLocaleString()} /{' '}
                      {downloadProgress.totalTiles.toLocaleString()} tiles
                      downloaded
                    </span>
                    <span>
                      Speed: {downloadProgress.speedTilesPerSec} tiles/sec
                    </span>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleCancelDownload}
                      className="px-3 py-1.5 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs font-semibold transition"
                    >
                      Cancel Download
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Saved Regions Tab */
            <div className="space-y-4">
              {/* Simulator & Status Toggle */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between ${
                  isSimulatedOffline
                    ? 'bg-amber-950/30 border-amber-600/50 text-amber-200'
                    : isDark
                    ? 'bg-slate-950/50 border-slate-800'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      isSimulatedOffline
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isSimulatedOffline ? (
                      <WifiOff className="w-5 h-5" />
                    ) : (
                      <Wifi className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-sm">
                      Simulate "No Signal" / Offline Riding
                    </div>
                    <div className="text-xs text-slate-400">
                      Force the map into offline mode to test and verify cached
                      tiles without cutting Wi-Fi
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleToggleSimulatedOffline(!isSimulatedOffline)
                  }
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition ${
                    isSimulatedOffline
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                      : isDark
                      ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {isSimulatedOffline ? 'Offline Active ✓' : 'Test Offline'}
                </button>
              </div>

              {/* Cache Stats Bar */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between ${
                  isDark
                    ? 'bg-slate-950/40 border-slate-800'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Offline Cache Storage
                  </div>
                  <div className="text-base font-bold text-sky-400 mt-0.5">
                    {cacheStats.totalEntries.toLocaleString()} Map Tiles
                    <span className="text-xs text-slate-400 font-normal ml-2">
                      (~{(cacheStats.estimatedBytes / 1024 / 1024).toFixed(1)} MB
                      stored on device)
                    </span>
                  </div>
                </div>
                {cacheStats.totalEntries > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs font-semibold transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear Cache
                  </button>
                )}
              </div>

              {/* Saved Regions List */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Downloaded Offline Packages ({savedRegions.length})
                </label>
                {savedRegions.length === 0 ? (
                  <div
                    className={`p-8 text-center rounded-xl border border-dashed ${
                      isDark
                        ? 'border-slate-800 text-slate-500'
                        : 'border-slate-300 text-slate-400'
                    }`}
                  >
                    <Download className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <div className="font-semibold text-sm">
                      No Offline Regions Downloaded Yet
                    </div>
                    <div className="text-xs mt-1">
                      Switch to "Download Offline Area" above to pre-cache tiles
                      around your riding route.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {savedRegions.map((region) => (
                      <div
                        key={region.id}
                        className={`p-3.5 rounded-xl border flex items-center justify-between ${
                          isDark
                            ? 'bg-slate-950/60 border-slate-800'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-sm text-slate-200 flex items-center gap-2">
                            {region.name}
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-semibold">
                              {region.radiusKm} km radius
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                            <span>
                              {region.totalTiles.toLocaleString()} tiles (~
                              {(region.approximateBytes / 1024 / 1024).toFixed(
                                1
                              )}{' '}
                              MB)
                            </span>
                            <span>
                              Zoom {region.minZoom}–{region.maxZoom}
                            </span>
                            <span>
                              Layers:{' '}
                              {region.layerStyles
                                .map((l) =>
                                  l === 'cycle'
                                    ? 'Trails'
                                    : l === 'streets'
                                    ? 'Streets'
                                    : l === 'satellite'
                                    ? 'Satellite'
                                    : 'Dark'
                                )
                                .join(', ')}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteRegion(region.id)}
                          className="p-2 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition"
                          title="Delete offline region"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div
          className={`flex items-center justify-between px-5 py-4 border-t ${
            isDark
              ? 'bg-slate-950/70 border-slate-800'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-emerald-400" />
            <span>Local-first storage · Works 100% in airplane mode</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isDownloading}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                isDark
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              Close
            </button>

            {activeTab === 'download' && !isDownloading && (
              <button
                type="button"
                onClick={handleStartDownload}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-md transition"
              >
                <Download className="w-4 h-4" />
                Download {estimatedTiles.toLocaleString()} Tiles
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
