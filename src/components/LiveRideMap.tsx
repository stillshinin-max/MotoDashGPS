import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import {
  Crosshair,
  Plus,
  Minus,
  Navigation,
  WifiOff,
  AlertTriangle,
  Layers,
  Maximize2,
  Minimize2,
  Route,
  Play,
  Pause,
  Square,
  Compass,
  Box,
  Mountain,
  Sliders,
  Check,
  RotateCw,
  Download,
  HardDrive,
} from 'lucide-react';
import {
  groupPointsIntoSegments,
  type GpsPoint,
  type GpsSignalQuality,
  type RawGpsFix,
} from '../utils/telemetry';
import type { CockpitLayoutMode, MapLayerStyle } from '../utils/storage';
import { OfflineResilientTileLayer } from '../utils/offlineTileLayer';

export interface TileLayerConfig {
  id: MapLayerStyle;
  label: string;
  sublabel: string;
  icon: string;
  url: string;
  attribution: string;
  subdomains?: string[] | string;
  maxZoom: number;
}

export const MAP_LAYERS: Record<MapLayerStyle, TileLayerConfig> = {
  cycle: {
    id: 'cycle',
    label: 'Bike Trails',
    sublabel: 'Dedicated bike lanes, trails & topography',
    icon: '🚲',
    url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
    attribution: '&copy; CyclOSM & OpenStreetMap contributors',
    subdomains: ['a', 'b', 'c'],
    maxZoom: 18,
  },
  streets: {
    id: 'streets',
    label: 'Standard Street',
    sublabel: 'Clean road, lane & neighborhood map',
    icon: '🗺️',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
  satellite: {
    id: 'satellite',
    label: 'Satellite Aerial',
    sublabel: 'Photographic aerial satellite imagery',
    icon: '🛰️',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, USDA, USGS, AeroGRID, IGN',
    maxZoom: 19,
  },
  dark: {
    id: 'dark',
    label: 'Dark Navigation',
    sublabel: 'High-contrast inverted night HUD',
    icon: '🌙',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
};

export type Camera3DPitch = 35 | 52 | 62;

interface LiveRideMapProps {
  currentFix: RawGpsFix | null;
  routePoints: GpsPoint[];
  headingDegrees: number | null;
  gpsQuality: GpsSignalQuality;
  gpsLabel: string;
  fixAgeSeconds: number | null;
  isDark: boolean;
  followRider: boolean;
  onToggleFollow: (follow: boolean) => void;
  previewTitle?: string | null;
  onClearPreview?: () => void;
  // Map View customization
  mapLayerStyle?: MapLayerStyle;
  onChangeMapLayerStyle?: (style: MapLayerStyle) => void;
  layoutMode?: CockpitLayoutMode;
  onToggleFullscreenMap?: () => void;
  // 3D Perspective & Immersive navigation props
  is3DView?: boolean;
  onToggle3DView?: (is3D: boolean) => void;
  headingUp?: boolean;
  onToggleHeadingUp?: (headingUp: boolean) => void;
  pitchDegrees?: number;
  onChangePitchDegrees?: (pitch: number) => void;
  isImmersive?: boolean;
  onToggleImmersive?: () => void;
  currentAltitudeFeet?: number | null;
  // Full-map HUD props
  displayedSmoothedMph?: number;
  unit?: 'mph' | 'kmh';
  distanceDisplay?: string;
  elapsedDisplay?: string;
  movingDisplay?: string;
  isRecording?: boolean;
  isPaused?: boolean;
  onPauseRide?: () => void;
  onResumeRide?: () => void;
  onStopRide?: () => void;
  // Offline Maps props
  onOpenOfflineModal?: () => void;
  isSimulatedOffline?: boolean;
  hideInternalHud?: boolean;
}

// Neutral geographic center of contiguous US used ONLY as initial map canvas backdrop before a GPS fix arrives
const NEUTRAL_BACKDROP_CENTER: [number, number] = [39.8283, -98.5795];

export const LiveRideMap: React.FC<LiveRideMapProps> = ({
  currentFix,
  routePoints,
  headingDegrees,
  gpsQuality,
  gpsLabel,
  fixAgeSeconds,
  isDark,
  followRider,
  onToggleFollow,
  previewTitle,
  onClearPreview,
  mapLayerStyle = 'streets',
  onChangeMapLayerStyle,
  layoutMode = 'split',
  onToggleFullscreenMap,
  is3DView: is3DViewProp,
  onToggle3DView,
  headingUp: headingUpProp,
  onToggleHeadingUp,
  pitchDegrees: pitchDegreesProp,
  onChangePitchDegrees,
  isImmersive = false,
  onToggleImmersive,
  currentAltitudeFeet = null,
  displayedSmoothedMph = 0,
  unit = 'mph',
  distanceDisplay = '0.00',
  elapsedDisplay = '00:00:00',
  movingDisplay = '00:00:00',
  isRecording = false,
  isPaused = false,
  onPauseRide,
  onResumeRide,
  onStopRide,
  onOpenOfflineModal,
  isSimulatedOffline = false,
  hideInternalHud = false,
}) => {
  const outerWrapperRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const segmentLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const followRef = useRef<boolean>(followRider);
  const hasCenteredOnFirstFixRef = useRef<boolean>(false);

  // Local fallback states for 3D navigation if not strictly controlled from parent
  const [internal3D, setInternal3D] = useState<boolean>(false);
  const [internalHeadingUp, setInternalHeadingUp] = useState<boolean>(true);
  const [internalPitch, setInternalPitch] = useState<Camera3DPitch>(52);
  const [is3DMenuOpen, setIs3DMenuOpen] = useState<boolean>(false);

  const is3D = is3DViewProp !== undefined ? is3DViewProp : internal3D;
  const isHeadingUp = headingUpProp !== undefined ? headingUpProp : internalHeadingUp;
  const pitchDegrees = (pitchDegreesProp !== undefined ? pitchDegreesProp : internalPitch) as Camera3DPitch;

  // Smoothing for camera heading rotation to keep 3D cockpit turns fluid
  const lastKnownHeadingRef = useRef<number>(0);
  const [smoothedHeading, setSmoothedHeading] = useState<number>(0);

  useEffect(() => {
    if (headingDegrees !== null && Number.isFinite(headingDegrees)) {
      lastKnownHeadingRef.current = headingDegrees;
      setSmoothedHeading(headingDegrees);
    }
  }, [headingDegrees]);

  const effectiveHeading =
    headingDegrees !== null && Number.isFinite(headingDegrees)
      ? headingDegrees
      : lastKnownHeadingRef.current;

  const [isLayersMenuOpen, setIsLayersMenuOpen] = useState<boolean>(false);
  const [showElevationHud, setShowElevationHud] = useState<boolean>(true);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [tileLoadError, setTileLoadError] = useState<boolean>(false);

  useEffect(() => {
    followRef.current = followRider;
  }, [followRider]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setTileLoadError(false);
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Compute real-time grade / slope % from the latest GPS points
  const gradeEstimate = useMemo(() => {
    if (routePoints.length < 2) return null;
    const recent = routePoints.slice(-4);
    if (recent.length < 2) return null;
    const start = recent[0];
    const end = recent[recent.length - 1];
    if (start.altitude === null || end.altitude === null) return null;

    // Approximate horizontal distance in meters
    const dLat = ((end.lat - start.lat) * Math.PI) / 180;
    const dLng = ((end.lng - start.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((start.lat * Math.PI) / 180) *
        Math.cos((end.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distMeters = 6371000 * c;

    if (distMeters < 12) return null; // Avoid division noise at near-zero distance
    const altDeltaMeters = end.altitude - start.altitude;
    const grade = (altDeltaMeters / distMeters) * 100;
    if (Math.abs(grade) > 35) return null; // Filter extreme spikes
    return grade;
  }, [routePoints]);

  const toggle3DMode = () => {
    const nextVal = !is3D;
    if (onToggle3DView) {
      onToggle3DView(nextVal);
    } else {
      setInternal3D(nextVal);
    }
  };

  const toggleHeadingUp = () => {
    const nextVal = !isHeadingUp;
    if (onToggleHeadingUp) {
      onToggleHeadingUp(nextVal);
    } else {
      setInternalHeadingUp(nextVal);
    }
  };

  const handleSelectPitch = (pitch: Camera3DPitch) => {
    if (onChangePitchDegrees) {
      onChangePitchDegrees(pitch);
    } else {
      setInternalPitch(pitch);
    }
  };

  const createRiderIcon = (
    heading: number | null,
    is3DActive: boolean,
    isCourseUp: boolean
  ) => {
    const hasHeading = heading !== null && Number.isFinite(heading);
    // In Heading-Up 3D mode, the entire map ground rotates to face forward;
    // thus the bike's screen-relative orientation is always pointing straight UP (0°).
    const safeRotation =
      is3DActive && isCourseUp ? 0 : hasHeading ? Math.round(heading!) : 0;

    if (is3DActive) {
      return L.divIcon({
        className: 'family-bike-rider-marker-3d',
        iconSize: [60, 60],
        iconAnchor: [30, 30],
        html: `
          <div style="width:60px;height:60px;position:relative;display:flex;align-items:center;justify-content:center;transform:rotate(${safeRotation}deg);pointer-events:none;">
            <!-- Forward 3D Headlight Beam Illuminating Path Ahead -->
            <div style="position:absolute;top:-26px;left:50%;transform:translateX(-50%);width:38px;height:42px;background:linear-gradient(to top, rgba(14,165,233,0.75) 0%, rgba(56,189,248,0.2) 60%, transparent 100%);clip-path:polygon(32% 100%, 68% 100%, 100% 0%, 0% 0%);filter:blur(0.8px);opacity:0.9;"></div>
            
            <!-- Ground Drop Shadow -->
            <div style="position:absolute;width:26px;height:14px;background:rgba(0,0,0,0.5);border-radius:50%;bottom:17px;filter:blur(2px);"></div>

            <!-- Pulsing Concentric Radar Ring -->
            <div class="radar-pulse-ring" style="position:absolute;width:30px;height:30px;border-radius:50%;border:2px solid #38bdf8;pointer-events:none;"></div>

            <!-- 3D Aerodynamic Cockpit Arrow -->
            <svg width="42" height="42" viewBox="0 0 42 42" fill="none" class="bike-rider-3d-beacon" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 4L34 30L21 23L8 30L21 4Z" fill="#0284C7" stroke="#FFFFFF" stroke-width="2.5" stroke-linejoin="round"/>
              <path d="M21 8L30 26L21 21.5L12 26L21 8Z" fill="#38BDF8"/>
              <circle cx="21" cy="19" r="3" fill="#FFFFFF"/>
            </svg>
          </div>
        `,
      });
    }

    return L.divIcon({
      className: 'family-bike-rider-marker',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      html: `
        <div style="width:44px;height:44px;position:relative;display:flex;align-items:center;justify-content:center;transform:rotate(${safeRotation}deg);">
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            ${
              hasHeading
                ? '<path d="M22 3L33 23H11L22 3Z" fill="#0EA5E9" fill-opacity="0.65"/>'
                : ''
            }
            <circle cx="22" cy="22" r="9" fill="#0284C7" stroke="#FFFFFF" stroke-width="3"/>
            <circle cx="22" cy="22" r="3.5" fill="#E0F2FE"/>
          </svg>
        </div>
      `,
    });
  };

  // Initialize Leaflet map and ResizeObserver for landscape/portrait rotation & layout switching
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialCenter: [number, number] = currentFix
      ? [currentFix.lat, currentFix.lng]
      : NEUTRAL_BACKDROP_CENTER;
    const initialZoom = currentFix ? 16 : 4;

    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: false,
      attributionControl: true,
    });

    const activeConfig = MAP_LAYERS[mapLayerStyle] || MAP_LAYERS.streets;
    const tileLayer = new OfflineResilientTileLayer(activeConfig.url, {
      attribution: activeConfig.attribution,
      subdomains: activeConfig.subdomains || 'abc',
      maxZoom: activeConfig.maxZoom || 19,
      isDarkTheme: isDark,
    }).addTo(map);

    tileLayer.on('tileerror', () => {
      setTileLoadError(true);
    });
    tileLayer.on('tileload', () => {
      setTileLoadError(false);
    });
    tileLayerRef.current = tileLayer;

    const segmentGroup = L.layerGroup().addTo(map);

    map.on('dragstart', () => {
      if (followRef.current) {
        onToggleFollow(false);
      }
    });

    mapRef.current = map;
    segmentLayerGroupRef.current = segmentGroup;

    // Recalculate Leaflet map dimensions whenever viewport, layout mode, or orientation changes
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    resizeObserver.observe(containerRef.current);

    const handleOrientationResize = () => {
      setTimeout(() => map.invalidateSize({ animate: false }), 120);
    };
    window.addEventListener('resize', handleOrientationResize);
    window.addEventListener('orientationchange', handleOrientationResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleOrientationResize);
      window.removeEventListener('orientationchange', handleOrientationResize);
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      markerRef.current = null;
      accuracyCircleRef.current = null;
      segmentLayerGroupRef.current = null;
    };
  }, []);

  // Switch map tile layer dynamically when mapLayerStyle changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    const activeConfig = MAP_LAYERS[mapLayerStyle] || MAP_LAYERS.streets;
    const newTileLayer = new OfflineResilientTileLayer(activeConfig.url, {
      attribution: activeConfig.attribution,
      subdomains: activeConfig.subdomains || 'abc',
      maxZoom: activeConfig.maxZoom || 19,
      isDarkTheme: isDark,
    }).addTo(map);

    newTileLayer.on('tileerror', () => setTileLoadError(true));
    newTileLayer.on('tileload', () => setTileLoadError(false));
    tileLayerRef.current = newTileLayer;
  }, [mapLayerStyle]);

  // Recalculate map size whenever layoutMode transitions between split and full_map
  useEffect(() => {
    if (mapRef.current && containerRef.current) {
      mapRef.current.invalidateSize({ animate: false });
      const timer = setTimeout(() => {
        mapRef.current?.invalidateSize({ animate: false });
      }, 140);
      return () => clearTimeout(timer);
    }
  }, [layoutMode, is3D]);

  // Update rider marker and accuracy circle when a real or simulated fix is available
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!currentFix) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      if (accuracyCircleRef.current) {
        accuracyCircleRef.current.remove();
        accuracyCircleRef.current = null;
      }
      return;
    }

    const latLng: L.LatLngExpression = [currentFix.lat, currentFix.lng];
    const radius = Math.max(5, currentFix.accuracy ?? 12);

    if (!accuracyCircleRef.current) {
      accuracyCircleRef.current = L.circle(latLng, {
        radius,
        color: gpsQuality === 'poor' ? '#F59E0B' : '#0284C7',
        weight: 1,
        fillColor: gpsQuality === 'poor' ? '#F59E0B' : '#0284C7',
        fillOpacity: is3D ? 0.08 : 0.14,
      }).addTo(map);
    } else {
      accuracyCircleRef.current.setLatLng(latLng);
      accuracyCircleRef.current.setRadius(radius);
      accuracyCircleRef.current.setStyle({
        color: gpsQuality === 'poor' ? '#F59E0B' : '#0284C7',
        fillColor: gpsQuality === 'poor' ? '#F59E0B' : '#0284C7',
        fillOpacity: is3D ? 0.08 : 0.14,
      });
    }

    const riderIcon = createRiderIcon(headingDegrees, is3D, isHeadingUp);

    if (!markerRef.current) {
      markerRef.current = L.marker(latLng, {
        icon: riderIcon,
        zIndexOffset: 1000,
      }).addTo(map);
    } else {
      markerRef.current.setLatLng(latLng);
      markerRef.current.setIcon(riderIcon);
    }

    if (!hasCenteredOnFirstFixRef.current) {
      hasCenteredOnFirstFixRef.current = true;
      map.setView(latLng, 16, { animate: false });
    } else if (followRider && !previewTitle) {
      map.panTo(latLng, { animate: true, duration: 0.25 });
    }
  }, [currentFix, headingDegrees, gpsQuality, followRider, previewTitle, is3D, isHeadingUp]);

  // Render multi-segment route polylines with 3D elevation depth when 3D mode is active
  useEffect(() => {
    const map = mapRef.current;
    const segmentGroup = segmentLayerGroupRef.current;
    if (!map || !segmentGroup) return;

    segmentGroup.clearLayers();
    const segments = groupPointsIntoSegments(routePoints);

    // Dynamic contrast color based on active tile style
    const routeColor =
      mapLayerStyle === 'satellite' ? '#38BDF8' : '#0284C7';

    for (const seg of segments) {
      if (seg.length === 0) continue;
      const latLngs: L.LatLngExpression[] = seg.map((pt) => [pt.lat, pt.lng]);

      if (is3D) {
        // Dual-layer 3D route effect: dark ground shadow underneath, vibrant neon line on top
        L.polyline(latLngs, {
          color: '#000000',
          weight: 7,
          opacity: 0.35,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(segmentGroup);

        L.polyline(latLngs, {
          color: '#38BDF8',
          weight: 5,
          opacity: 0.98,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(segmentGroup);
      } else {
        L.polyline(latLngs, {
          color: routeColor,
          weight: 5,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(segmentGroup);
      }
    }

    // If previewing a completed ride log, fit map bounds to the recorded route
    if (previewTitle && routePoints.length > 1) {
      const bounds = L.latLngBounds(
        routePoints.map((pt) => [pt.lat, pt.lng] as [number, number])
      );
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [36, 36], maxZoom: 17 });
      }
    }
  }, [routePoints, previewTitle, mapLayerStyle, is3D]);

  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();

  const handleRecenter = () => {
    onToggleFollow(true);
    if (currentFix && mapRef.current) {
      mapRef.current.setView(
        [currentFix.lat, currentFix.lng],
        Math.max(mapRef.current.getZoom(), 16),
        { animate: true }
      );
    }
  };

  const handleFitEntireRoute = () => {
    onToggleFollow(false);
    if (mapRef.current && routePoints.length > 0) {
      const bounds = L.latLngBounds(
        routePoints.map((pt) => [pt.lat, pt.lng] as [number, number])
      );
      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds, { padding: [36, 36], maxZoom: 17 });
      }
    }
  };

  // Only apply dark inversion filter on standard street or explicit dark mode;
  // NEVER invert satellite or dedicated cycling trail tiles!
  const shouldApplyDarkFilter =
    mapLayerStyle === 'dark' || (isDark && mapLayerStyle === 'streets');

  const speedUnitLabel = unit === 'kmh' ? 'KM/H' : 'MPH';
  const isFullscreen = layoutMode === 'full_map';

  // Compute 3D heading rotation
  // In Heading-Up mode: rotate map so rider moves straight UP towards the 3D horizon
  const rotationAngle = is3D && isHeadingUp ? -effectiveHeading : 0;
  // True North needle angle on the Compass Rose
  const compassNeedleAngle = is3D && isHeadingUp ? effectiveHeading : 0;

  return (
    <div
      ref={outerWrapperRef}
      className={`relative isolate w-full h-full min-h-[300px] rounded-2xl overflow-hidden border border-slate-300 dark:border-slate-800 bg-slate-200 dark:bg-[#0d131f] flex flex-col ${
        is3D ? 'leaflet-3d-scene' : ''
      }`}
    >
      {/* 3D Perspective Plane Wrapper: tilted forward and rotated with course in Heading-Up mode */}
      <div
        className={`w-full h-full flex-1 relative ${
          is3D ? 'leaflet-3d-plane' : ''
        }`}
        style={
          is3D
            ? {
                transform: `rotateX(${pitchDegrees}deg) rotateZ(${rotationAngle}deg) scale(1.22)`,
              }
            : undefined
        }
      >
        <div
          ref={containerRef}
          data-testid="live-ride-map"
          className={`w-full h-full z-0 ${
            shouldApplyDarkFilter ? 'family-bike-dark-tiles' : ''
          }`}
        />
      </div>

      {/* Atmospheric Horizon & Distance Fog Fade in 3D Mode */}
      {is3D && (
        <div
          aria-hidden="true"
          className={`absolute top-0 left-0 right-0 h-32 z-[380] pointer-events-none transition-opacity duration-300 ${
            isDark ? 'horizon-atmosphere-dark' : 'horizon-atmosphere-light'
          }`}
        />
      )}

      {/* Top-Left Live Status & Last-Fix Age HUD */}
      <div className="absolute top-3 left-3 z-[400] max-w-[calc(100%-110px)] flex flex-wrap items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-xl bg-white/95 dark:bg-slate-950/90 border border-slate-300 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 shadow-sm backdrop-blur-xs">
        <Navigation className="w-3.5 h-3.5 text-sky-500 shrink-0" />
        <span className="font-semibold">{gpsLabel}</span>
        {fixAgeSeconds !== null && (
          <>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular text-slate-600 dark:text-slate-400">
              Fix {fixAgeSeconds}s ago
            </span>
          </>
        )}
        {currentFix && (
          <>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular hidden sm:inline">
              {currentFix.lat.toFixed(4)}°, {currentFix.lng.toFixed(4)}°
            </span>
          </>
        )}
        <span aria-hidden="true">·</span>
        <span className="font-mono-tabular">
          {routePoints.length} {routePoints.length === 1 ? 'pt' : 'pts'}
        </span>
        <span aria-hidden="true">·</span>
        <span className="font-medium text-sky-600 dark:text-sky-400">
          {MAP_LAYERS[mapLayerStyle]?.label}
        </span>
        {is3D && (
          <>
            <span aria-hidden="true">·</span>
            <span className="font-mono font-bold text-[11px] text-sky-500 dark:text-sky-300 bg-sky-500/10 px-1.5 py-0.5 rounded">
              3D {pitchDegrees}° {isHeadingUp ? 'COURSE' : 'NORTH'}
            </span>
          </>
        )}
      </div>

      {/* Top-Right Interactive Compass Rose HUD (Indicates True North & Quick Course-Up Toggle) */}
      <div className="absolute top-3 right-3 z-[400] flex items-center gap-2">
        <button
          type="button"
          onClick={toggleHeadingUp}
          title={
            isHeadingUp
              ? 'Heading-Up (Course Ahead) active · Click to lock North-Up'
              : 'North-Up locked · Click to follow Course-Up direction'
          }
          aria-label="Toggle Heading-Up or North-Up map orientation"
          className="w-10 h-10 rounded-xl bg-white/95 dark:bg-slate-950/90 border border-slate-300 dark:border-slate-800 shadow-md flex items-center justify-center cursor-pointer transition-transform hover:scale-105"
        >
          <div
            style={{
              transform: `rotate(${compassNeedleAngle}deg)`,
              transition: 'transform 0.25s ease-out',
            }}
            className="flex flex-col items-center justify-center"
          >
            {/* North Red Pointer */}
            <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[8px] border-b-rose-500" />
            {/* South White/Slate Pointer */}
            <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[8px] border-t-slate-400 dark:border-t-slate-500" />
          </div>
        </button>
      </div>

      {/* 3D Topographic Grade & Altitude HUD Overlay */}
      {showElevationHud && (currentAltitudeFeet !== null || gradeEstimate !== null) && (
        <div className="absolute top-12 left-3 z-[400] flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white/90 dark:bg-slate-950/85 border border-slate-200 dark:border-slate-800 text-[11px] font-mono-tabular shadow-sm backdrop-blur-xs">
          <Mountain className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          {currentAltitudeFeet !== null && (
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {unit === 'kmh'
                ? `${Math.round(currentAltitudeFeet * 0.3048)} m`
                : `${Math.round(currentAltitudeFeet)} ft`}
            </span>
          )}
          {gradeEstimate !== null && (
            <>
              <span className="text-slate-400">·</span>
              <span
                className={`font-bold ${
                  gradeEstimate > 1.5
                    ? 'text-amber-500'
                    : gradeEstimate < -1.5
                    ? 'text-sky-500'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {gradeEstimate > 0 ? `+${gradeEstimate.toFixed(1)}%` : `${gradeEstimate.toFixed(1)}%`} grade
              </span>
            </>
          )}
        </div>
      )}

      {/* Previewing Past Ride Banner */}
      {previewTitle && (
        <div className="absolute top-20 left-3 z-[400] flex items-center gap-3 px-3.5 py-2 rounded-xl bg-sky-600 text-white text-xs font-semibold shadow-md">
          <span>Viewing Saved Route: {previewTitle}</span>
          {onClearPreview && (
            <button
              type="button"
              onClick={onClearPreview}
              className="underline hover:text-sky-100 cursor-pointer"
            >
              Return to Live Cockpit
            </button>
          )}
        </div>
      )}

      {/* Offline / Tile Connectivity Banner */}
      {(!isOnline || isSimulatedOffline || tileLoadError) && (
        <div className="absolute bottom-3 left-3 right-24 z-[400] flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-semibold shadow-md">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>
              {!isOnline || isSimulatedOffline
                ? 'Offline Ready (No Signal) — Pre-cached map tiles active. Full bicycle GPS recording continues locally.'
                : 'Map tiles temporarily unreachable — Using cached tiles & GPS route trace.'}
            </span>
          </div>
          {onOpenOfflineModal && (
            <button
              type="button"
              onClick={onOpenOfflineModal}
              className="underline font-bold hover:text-slate-900 cursor-pointer text-[11px] shrink-0"
            >
              Offline Manager
            </button>
          )}
        </div>
      )}

      {/* Waiting for Real GPS Overlay Notice (when no fix is present and not previewing) */}
      {!currentFix && !previewTitle && (
        <div className="absolute inset-x-4 bottom-4 z-[400] pointer-events-none flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-300 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 shadow-lg">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              <strong>Waiting for live GPS signal.</strong> Allow location permission or switch to Demo Simulator for indoor testing.
            </span>
          </div>
        </div>
      )}

      {/* Floating HUD for Full Map Mode (Heads-Up Speedometer & Trip Controls) */}
      {isFullscreen && !hideInternalHud && (
        <aside
          aria-label="Full Map Heads-Up Display"
          className="absolute bottom-4 left-3 z-[400] p-3 sm:p-4 rounded-2xl bg-white/95 dark:bg-[#0B101B]/95 border border-slate-300 dark:border-slate-800 shadow-xl backdrop-blur-md max-w-[280px] sm:max-w-[340px]"
        >
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display font-bold text-4xl sm:text-5xl text-slate-950 dark:text-white font-mono-tabular leading-none">
                {displayedSmoothedMph < 10
                  ? displayedSmoothedMph.toFixed(1)
                  : Math.round(displayedSmoothedMph)}
              </span>
              <span className="font-display text-lg font-bold text-sky-600 dark:text-sky-400">
                {speedUnitLabel}
              </span>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Time
              </div>
              <div className="font-mono-tabular text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                {elapsedDisplay}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-200 dark:border-slate-800/80 text-xs font-mono-tabular">
            <div>
              <span className="text-slate-500 dark:text-slate-400 text-[11px] block">
                Distance
              </span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {distanceDisplay} {unit === 'kmh' ? 'km' : 'mi'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 text-[11px] block">
                Moving
              </span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {movingDisplay}
              </span>
            </div>
          </div>

          {/* Quick Controls in Full Map Mode */}
          {isRecording ? (
            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={onPauseRide}
                className="flex-1 min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </button>
              <button
                type="button"
                onClick={onStopRide}
                className="flex-1 min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop &amp; Save</span>
              </button>
            </div>
          ) : isPaused ? (
            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={onResumeRide}
                className="flex-1 min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Resume</span>
              </button>
              <button
                type="button"
                onClick={onStopRide}
                className="flex-1 min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Save</span>
              </button>
            </div>
          ) : null}
        </aside>
      )}

      {/* Floating 3D Cockpit Settings Menu */}
      {is3DMenuOpen && (
        <section
          role="region"
          aria-label="3D Cockpit Navigation Settings"
          className="absolute bottom-20 right-3 z-[450] p-3 rounded-2xl bg-white/95 dark:bg-[#0B101B]/95 border border-slate-300 dark:border-slate-800 shadow-2xl backdrop-blur-md w-72 space-y-2.5"
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <Box className="w-4 h-4 text-sky-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                3D Cockpit Camera
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIs3DMenuOpen(false)}
              className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer px-1"
            >
              Close
            </button>
          </div>

          {/* Toggle 3D View On/Off */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              3D Tilt Perspective
            </span>
            <button
              type="button"
              onClick={toggle3DMode}
              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                is3D
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {is3D ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* Camera Tilt Angle Presets (Active when 3D is on) */}
          {is3D && (
            <div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Tilt Perspective Pitch
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { pitch: 35 as Camera3DPitch, label: '35° Chase' },
                  { pitch: 52 as Camera3DPitch, label: '52° Cockpit' },
                  { pitch: 62 as Camera3DPitch, label: '62° Horizon' },
                ].map((item) => (
                  <button
                    key={item.pitch}
                    type="button"
                    onClick={() => handleSelectPitch(item.pitch)}
                    className={`px-2 py-1.5 rounded-lg text-xs font-semibold cursor-pointer text-center transition-colors ${
                      pitchDegrees === item.pitch
                        ? 'bg-sky-500/20 text-sky-600 dark:text-sky-300 border border-sky-500/60 font-bold'
                        : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-transparent'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Course-Up (Heading-Up) vs North-Up Toggle */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800">
            <div>
              <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                Course Orientation
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                {isHeadingUp ? 'Road ahead faces top' : 'Locked to True North'}
              </div>
            </div>
            <button
              type="button"
              onClick={toggleHeadingUp}
              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                isHeadingUp
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {isHeadingUp ? 'Course Ahead' : 'North Up'}
            </button>
          </div>

          {/* Elevation HUD Toggle */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800">
            <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
              Grade &amp; Altitude HUD
            </span>
            <button
              type="button"
              onClick={() => setShowElevationHud((prev) => !prev)}
              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                showElevationHud
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {showElevationHud ? 'Shown' : 'Hidden'}
            </button>
          </div>
        </section>
      )}

      {/* Floating Map Layers Selector Menu */}
      {isLayersMenuOpen && (
        <section
          role="region"
          aria-label="Map Tile Layer Selector"
          className="absolute top-12 right-3 z-[450] p-2.5 rounded-2xl bg-white/95 dark:bg-[#0B101B]/95 border border-slate-300 dark:border-slate-800 shadow-2xl backdrop-blur-md w-64 space-y-1.5"
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800 px-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Map View Style
            </span>
            <button
              type="button"
              onClick={() => setIsLayersMenuOpen(false)}
              className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer px-1"
            >
              Close
            </button>
          </div>

          {(Object.keys(MAP_LAYERS) as MapLayerStyle[]).map((styleKey) => {
            const config = MAP_LAYERS[styleKey];
            const isSelected = mapLayerStyle === styleKey;
            return (
              <button
                key={styleKey}
                type="button"
                onClick={() => {
                  onChangeMapLayerStyle?.(styleKey);
                  setIsLayersMenuOpen(false);
                }}
                className={`w-full text-left p-2 rounded-xl transition-colors flex items-center gap-2.5 cursor-pointer ${
                  isSelected
                    ? 'bg-sky-500/15 border border-sky-500/50 text-sky-700 dark:text-sky-300'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-transparent'
                }`}
              >
                <span className="text-lg shrink-0">{config.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold">{config.label}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {config.sublabel}
                  </div>
                </div>
                {isSelected && (
                  <div className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
                )}
              </button>
            );
          })}

          {onOpenOfflineModal && (
            <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsLayersMenuOpen(false);
                  onOpenOfflineModal();
                }}
                className="w-full text-left p-2.5 rounded-xl transition-colors flex items-center gap-2.5 cursor-pointer bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-300 border border-sky-500/30"
              >
                <Download className="w-4 h-4 text-sky-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold">Download Offline Area</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    Pre-cache all views for no signal
                  </div>
                </div>
              </button>
            </div>
          )}
        </section>
      )}

      {/* Right-Side Map Controls Stack (48x48px targets) */}
      <div className="absolute bottom-4 right-3 z-[400] flex flex-col items-end gap-2">
        {/* Offline Maps Pre-caching Manager Button */}
        {onOpenOfflineModal && (
          <button
            type="button"
            onClick={onOpenOfflineModal}
            title="Download Offline Maps & Manage Pre-cached Tile Storage"
            aria-label="Offline Maps and Pre-rendering"
            className={`min-w-[48px] min-h-[48px] px-3.5 rounded-xl border transition-colors flex items-center justify-center gap-2 font-semibold text-xs shadow-md cursor-pointer ${
              !isOnline || isSimulatedOffline
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/60'
                : 'bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Download className="w-5 h-5 text-sky-400" />
            <span className="hidden sm:inline whitespace-nowrap">
              Offline Maps
            </span>
          </button>
        )}

        {/* 3D Perspective Toggle Button & Settings Flyout Trigger */}
        <div className="flex items-center rounded-xl overflow-hidden shadow-md border border-slate-300 dark:border-slate-700">
          <button
            type="button"
            onClick={toggle3DMode}
            title={
              is3D
                ? `3D Cockpit Active (${pitchDegrees}°) — Click for 2D Flat View`
                : 'Switch to 3D Cockpit Perspective'
            }
            aria-label="Toggle 3D Cockpit View"
            className={`min-h-[48px] px-3 transition-colors flex items-center justify-center gap-1.5 font-bold text-xs cursor-pointer ${
              is3D
                ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white'
                : 'bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Box className="w-4 h-4 text-sky-400" />
            <span className="font-mono text-xs">{is3D ? '3D' : '2D'}</span>
          </button>
          <button
            type="button"
            onClick={() => setIs3DMenuOpen((prev) => !prev)}
            title="3D Camera & Orientation Settings"
            aria-label="3D Camera Settings"
            className={`w-9 min-h-[48px] flex items-center justify-center border-l border-slate-200 dark:border-slate-800 cursor-pointer ${
              is3D
                ? 'bg-indigo-700 text-white hover:bg-indigo-600'
                : 'bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Toggle Map Layers Button */}
        <button
          type="button"
          onClick={() => setIsLayersMenuOpen((prev) => !prev)}
          title="Change Map View (Bike Trails, Satellite, Streets, Dark)"
          aria-label="Change Map View Style"
          className={`min-w-[48px] min-h-[48px] px-3.5 rounded-xl border transition-colors flex items-center justify-center gap-2 font-semibold text-xs shadow-md cursor-pointer ${
            isLayersMenuOpen
              ? 'bg-sky-600 text-white border-sky-500'
              : 'bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Layers className="w-5 h-5 text-sky-500" />
          <span className="hidden sm:inline whitespace-nowrap">
            {MAP_LAYERS[mapLayerStyle]?.label ?? 'Layers'}
          </span>
        </button>

        {/* Maximize Map / Toggle Fullscreen Button */}
        {onToggleFullscreenMap && (
          <button
            type="button"
            onClick={onToggleFullscreenMap}
            title={isFullscreen ? 'Return to Split View' : 'Maximize Map View'}
            aria-label={isFullscreen ? 'Exit Full Map' : 'Full Map View'}
            className="w-12 h-12 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-md flex items-center justify-center cursor-pointer transition-colors"
          >
            {isFullscreen ? (
              <Minimize2 className="w-5 h-5 text-sky-500" />
            ) : (
              <Maximize2 className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            )}
          </button>
        )}

        {/* Fit Entire Route in View (Active when points exist) */}
        {routePoints.length > 1 && (
          <button
            type="button"
            onClick={handleFitEntireRoute}
            title="Fit Entire Recorded Route on Map"
            aria-label="Fit Entire Route"
            className="w-12 h-12 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-md flex items-center justify-center cursor-pointer transition-colors"
          >
            <Route className="w-5 h-5 text-sky-500" />
          </button>
        )}

        {/* Recenter & Follow Rider Button */}
        <button
          type="button"
          onClick={handleRecenter}
          disabled={!currentFix}
          aria-label="Recenter map on bicycle"
          className={`min-w-[48px] min-h-[48px] px-3.5 rounded-xl border transition-colors flex items-center justify-center gap-2 font-semibold text-xs shadow-md ${
            !currentFix
              ? 'bg-slate-200/80 dark:bg-slate-900/60 text-slate-400 dark:text-slate-600 border-slate-300 dark:border-slate-800 cursor-not-allowed'
              : followRider
              ? 'bg-sky-600 text-white border-sky-500 cursor-pointer'
              : 'bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer'
          }`}
        >
          <Crosshair className="w-5 h-5" />
          <span className="hidden sm:inline whitespace-nowrap">
            {followRider ? 'Following' : 'Recenter'}
          </span>
        </button>

        {/* Zoom In & Out */}
        <div className="w-12 flex flex-col rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 shadow-md">
          <button
            type="button"
            onClick={handleZoomIn}
            aria-label="Zoom in map"
            className="w-12 h-12 flex items-center justify-center text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 border-b border-slate-200 dark:border-slate-800 cursor-pointer"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            aria-label="Zoom out map"
            className="w-12 h-12 flex items-center justify-center text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <Minus className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
