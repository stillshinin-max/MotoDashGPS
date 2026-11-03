import { useEffect, useRef, useState, useMemo } from 'react';
import {
  Navigation,
  Home,
  Activity,
  Sliders,
  MoreHorizontal,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Download,
  Car,
  Radio,
  Minimize,
  Maximize,
  Sparkles,
} from 'lucide-react';
import {
  RIDER_PROFILES,
  calculateAverageSpeeds,
  calculateRiderRealTotals,
  calculateSessionElapsedSeconds,
  createInitialRideSession,
  evaluateGpsQuality,
  exportRideToGpx,
  finalizeRideSession,
  formatAltitudeDisplay,
  formatDistanceValue,
  formatElapsedTime,
  formatHeadingDisplay,
  formatSpeedValue,
  formatStatSpeed,
  ingestFixIntoSession,
  pauseRideSession,
  resumeRideSession,
  smoothSpeedMph,
  type ActiveRideSession,
  type GpsPoint,
  type RawGpsFix,
  type RideDataSource,
  type RiderId,
  type SavedRide,
} from './utils/telemetry';
import {
  clearActiveSessionCheckpoint,
  deleteCompletedRideFromStorage,
  loadActiveSessionCheckpoint,
  loadCompletedRidesFromStorage,
  loadPreferences,
  parseAndValidateBackupJson,
  reassignCompletedRideRider,
  reassignCompletedRideSource,
  saveActiveSessionCheckpoint,
  saveCompletedRideToStorage,
  savePreferences,
  type CockpitLayoutMode,
  type MapLayerStyle,
} from './utils/storage';
import {
  SIM_ROUTE_PRESETS,
  getInterpolatedRoutePoint,
} from './utils/routes';
import { LiveRideMap } from './components/LiveRideMap';
import { PWAInstallButton } from './components/PWAInstallButton';
import { ApkSetupModal } from './components/ApkSetupModal';
import { OfflineMapsModal } from './components/OfflineMapsModal';
import { CockpitMusicPlayer } from './components/CockpitMusicPlayer';
import { ExpandableRideDashboard } from './components/ExpandableRideDashboard';
import { GpsAccuracyBanner } from './components/GpsAccuracyBanner';
import { HomeScreen } from './components/HomeScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { MoreMenuModal } from './components/MoreMenuModal';
import { bikeAudioEngine } from './utils/audioEngine';
import { getSimulatedOfflineMode, setSimulatedOfflineMode } from './utils/offlineMapManager';

export type NavTab = 'ride' | 'home' | 'history' | 'settings';

export default function App() {
  const initialPrefs = loadPreferences();

  // Navigation tab state (Ride is the main cockpit screen with the map & expandable dashboard)
  const [activeNavTab, setActiveNavTab] = useState<NavTab>('ride');
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState<boolean>(false);

  // Rider & preference state (Talha, Azlan, Eshal, Guest)
  const [activeRiderId, setActiveRiderId] = useState<RiderId>(
    initialPrefs.activeRiderId || 'talha'
  );
  const [unit, setUnit] = useState<'mph' | 'kmh'>(initialPrefs.unit);
  const [themePreference, setThemePreference] = useState<'auto' | 'dark' | 'light'>(
    initialPrefs.themePreference ?? (initialPrefs.isDark ? 'dark' : 'light')
  );
  const [isDark, setIsDark] = useState<boolean>(initialPrefs.isDark);
  const [mapLayerStyle, setMapLayerStyle] = useState<MapLayerStyle>(
    initialPrefs.mapLayerStyle ?? 'streets'
  );
  const [milestoneChimeEnabled, setMilestoneChimeEnabled] = useState<boolean>(
    initialPrefs.milestoneChimeEnabled ?? true
  );
  const [is3DView, setIs3DView] = useState<boolean>(
    initialPrefs.is3DView ?? false
  );
  const [headingUp, setHeadingUp] = useState<boolean>(
    initialPrefs.headingUp ?? true
  );
  const [pitchDegrees, setPitchDegrees] = useState<number>(
    initialPrefs.pitchDegrees ?? 52
  );
  const [isImmersive, setIsImmersive] = useState<boolean>(
    initialPrefs.isImmersive ?? false
  );

  // Auto Night Mode determination
  useEffect(() => {
    if (themePreference === 'auto') {
      const matchDark = window.matchMedia('(prefers-color-scheme: dark)');
      const updateTheme = () => {
        const hour = new Date().getHours();
        const isNight = hour >= 19 || hour < 7;
        setIsDark(matchDark.matches || isNight);
      };
      updateTheme();
      matchDark.addEventListener('change', updateTheme);
      return () => matchDark.removeEventListener('change', updateTheme);
    } else {
      setIsDark(themePreference === 'dark');
    }
  }, [themePreference]);

  // Modal states
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState<boolean>(false);
  const [isApkGuideOpen, setIsApkGuideOpen] = useState<boolean>(false);
  const [isMusicModalOpen, setIsMusicModalOpen] = useState<boolean>(false);
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(() =>
    getSimulatedOfflineMode()
  );

  // GPS Data Source (default: live phone GPS; test modes: car_test, simulation)
  const [gpsSource, setGpsSource] = useState<RideDataSource>('live');
  const [selectedPresetId, setSelectedPresetId] = useState<string>(
    SIM_ROUTE_PRESETS[0].id
  );

  // Live GPS Fix & Telemetry state
  const [currentFix, setCurrentFix] = useState<RawGpsFix | null>(null);
  const [displayedSmoothedMph, setDisplayedSmoothedMph] = useState<number>(0);
  const [currentHeading, setCurrentHeading] = useState<number | null>(null);
  const [currentCredibleAltFeet, setCurrentCredibleAltFeet] = useState<number | null>(null);
  const [gpsPermissionError, setGpsPermissionError] = useState<string | null>(null);
  const [nowTickMs, setNowTickMs] = useState<number>(() => Date.now());

  // Active recording session & crash-recovery state
  const [activeSession, setActiveSession] = useState<ActiveRideSession | null>(null);
  const [recoverableSession, setRecoverableSession] = useState<ActiveRideSession | null>(null);
  const [savedRides, setSavedRides] = useState<SavedRide[]>([]);
  const [previewRide, setPreviewRide] = useState<SavedRide | null>(null);

  // Safety & Warning states
  const [confirmDiscardActive, setConfirmDiscardActive] = useState<boolean>(false);
  const [confirmDiscardRecovery, setConfirmDiscardRecovery] = useState<boolean>(false);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [followRider, setFollowRider] = useState<boolean>(true);

  // Refs for tracking mutable intervals & smoothing
  const activeSessionRef = useRef<ActiveRideSession | null>(null);
  const smoothedSpeedRef = useRef<number>(0);
  const lastChimedMilestoneRef = useRef<number>(0);
  const simStepRef = useRef<number>(0);
  const lastFixTimestampRef = useRef<number>(Date.now());

  // Synchronize activeSessionRef
  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  // Handle Immersive Fullscreen toggle
  const handleToggleImmersive = () => {
    const nextVal = !isImmersive;
    setIsImmersive(nextVal);
    savePreferences({
      ...loadPreferences(),
      isImmersive: nextVal,
    });
    if (nextVal) {
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch {
        // Fallback for sandboxed iFrames
      }
    } else {
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      } catch {
        // Fallback
      }
    }
  };

  // 1-second UI clock tick for duration timers
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTickMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load saved completed rides and interrupted active checkpoint on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const storedRides = await loadCompletedRidesFromStorage();
      if (!isMounted) return;
      setSavedRides(storedRides);

      const activeCheckpoint = await loadActiveSessionCheckpoint();
      if (!isMounted) return;
      if (activeCheckpoint) {
        setRecoverableSession(activeCheckpoint);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Save display preferences when updated
  const handleThemePreferenceChange = (pref: 'auto' | 'dark' | 'light') => {
    setThemePreference(pref);
    let nextIsDark = isDark;
    if (pref === 'dark') nextIsDark = true;
    else if (pref === 'light') nextIsDark = false;
    else {
      const hour = new Date().getHours();
      nextIsDark = (hour >= 19 || hour < 7) || (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    setIsDark(nextIsDark);
    savePreferences({
      ...loadPreferences(),
      themePreference: pref,
      isDark: nextIsDark,
    });
  };

  const handleUnitChange = (newUnit: 'mph' | 'kmh') => {
    setUnit(newUnit);
    savePreferences({
      ...loadPreferences(),
      unit: newUnit,
    });
  };

  const handleSelectRider = (newRiderId: RiderId) => {
    setActiveRiderId(newRiderId);
    savePreferences({
      ...loadPreferences(),
      activeRiderId: newRiderId,
    });
    setStatusNotice(`Switched active rider to ${RIDER_PROFILES[newRiderId].name}.`);
  };

  // Watch Live GPS when source is 'live' or 'car_test'
  useEffect(() => {
    if (gpsSource !== 'live' && gpsSource !== 'car_test') return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsPermissionError('Geolocation is not supported by your browser.');
      return;
    }

    setGpsPermissionError(null);
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsPermissionError(null);
        const rawFix: RawGpsFix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          altitude: pos.coords.altitude,
          altitudeAccuracy: pos.coords.altitudeAccuracy,
          speedMps: pos.coords.speed,
          heading: pos.coords.heading,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp || Date.now(),
        };

        lastFixTimestampRef.current = rawFix.timestamp;
        setCurrentFix(rawFix);

        if (rawFix.heading !== null && Number.isFinite(rawFix.heading)) {
          setCurrentHeading(rawFix.heading);
        }

        if (
          rawFix.altitude !== null &&
          Number.isFinite(rawFix.altitude) &&
          (rawFix.altitudeAccuracy == null || rawFix.altitudeAccuracy < 50)
        ) {
          setCurrentCredibleAltFeet(rawFix.altitude * 3.28084);
        }

        // Ingest into active session if recording
        const session = activeSessionRef.current;
        if (session && session.status === 'recording') {
          const { session: updatedSession, lastValidation } = ingestFixIntoSession(
            session,
            rawFix
          );
          activeSessionRef.current = updatedSession;
          setActiveSession(updatedSession);

          const smoothed = smoothSpeedMph(
            smoothedSpeedRef.current,
            lastValidation.validatedSpeedMph
          );
          smoothedSpeedRef.current = smoothed;
          setDisplayedSmoothedMph(smoothed);

          saveActiveSessionCheckpoint(updatedSession).then((res) => {
            if (!res.ok && res.error) setStorageWarning(res.error);
          });
        } else {
          // Live display when idle
          const speedMph = rawFix.speedMps ? rawFix.speedMps * 2.23694 : 0;
          const smoothed = smoothSpeedMph(smoothedSpeedRef.current, speedMph);
          smoothedSpeedRef.current = smoothed;
          setDisplayedSmoothedMph(smoothed);
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGpsPermissionError('Location permission denied. Enable GPS permissions in settings.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGpsPermissionError('GPS position unavailable. Ensure device location is on.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [gpsSource]);

  // Demo Simulation interval
  useEffect(() => {
    if (gpsSource !== 'simulation') return;
    const preset =
      SIM_ROUTE_PRESETS.find((p) => p.id === selectedPresetId) ||
      SIM_ROUTE_PRESETS[0];

    const simInterval = setInterval(() => {
      simStepRef.current += 1;
      const simFix = getInterpolatedRoutePoint(preset, simStepRef.current);

      setCurrentFix(simFix);
      if (simFix.heading !== null) {
        setCurrentHeading(simFix.heading);
      }
      if (simFix.altitude !== null) {
        setCurrentCredibleAltFeet(simFix.altitude * 3.28084);
      }

      const session = activeSessionRef.current;
      if (session && session.status === 'recording') {
        const { session: updatedSession, lastValidation } = ingestFixIntoSession(
          session,
          simFix
        );
        activeSessionRef.current = updatedSession;
        setActiveSession(updatedSession);
        setDisplayedSmoothedMph(lastValidation.validatedSpeedMph);
        saveActiveSessionCheckpoint(updatedSession);
      } else {
        const mph = (simFix.speedMps ?? 0) * 2.23694;
        setDisplayedSmoothedMph(mph);
      }
    }, 1000);

    return () => clearInterval(simInterval);
  }, [gpsSource, selectedPresetId]);

  // Switch GPS source handler
  const handleSwitchGpsSource = (nextSource: RideDataSource) => {
    if (activeSession) return;
    const prevWasSimulation = gpsSource === 'simulation';
    setGpsSource(nextSource);
    smoothedSpeedRef.current = 0;
    setDisplayedSmoothedMph(0);
    setCurrentHeading(null);
    setCurrentCredibleAltFeet(null);

    if (nextSource === 'live') {
      if (prevWasSimulation) setCurrentFix(null);
      setStatusNotice('Live Bike GPS active — rides count toward bicycle totals.');
    } else if (nextSource === 'car_test') {
      if (prevWasSimulation) setCurrentFix(null);
      setStatusNotice('Car Test (Camry) active — up to 95 MPH allowed, excluded from bicycle totals.');
    } else {
      simStepRef.current = 0;
      setStatusNotice('Demo Simulator active — indoor testing mode.');
    }
  };

  // Evaluate GPS signal quality
  const gpsAssessment = evaluateGpsQuality(
    currentFix,
    nowTickMs,
    Boolean(gpsPermissionError)
  );

  const isGpsReadyForStart =
    gpsSource === 'simulation' ||
    (currentFix !== null &&
      !gpsPermissionError &&
      (gpsAssessment.quality === 'good' || gpsAssessment.quality === 'fair'));

  // Start Ride
  const handleStartRide = async () => {
    if (!isGpsReadyForStart) {
      setStatusNotice('Waiting for GPS signal before starting ride.');
      return;
    }

    setPreviewRide(null);
    setConfirmDiscardActive(false);
    const now = Date.now();
    const sessionStartMs =
      currentFix && Math.abs(now - currentFix.timestamp) < 10000
        ? Math.min(now, currentFix.timestamp)
        : now;

    let newSession = createInitialRideSession(activeRiderId, gpsSource, sessionStartMs);
    if (currentFix && Math.abs(now - currentFix.timestamp) < 10000) {
      newSession = ingestFixIntoSession(newSession, {
        ...currentFix,
        timestamp: sessionStartMs,
      }).session;
    }

    lastChimedMilestoneRef.current = 0;
    activeSessionRef.current = newSession;
    setActiveSession(newSession);
    setFollowRider(true);

    const res = await saveActiveSessionCheckpoint(newSession);
    if (!res.ok && res.error) setStorageWarning(res.error);
  };

  // Pause Ride
  const handlePauseRide = async () => {
    if (!activeSession || activeSession.status !== 'recording') return;
    const paused = pauseRideSession(activeSession, Date.now());
    activeSessionRef.current = paused;
    setActiveSession(paused);
    smoothedSpeedRef.current = 0;
    setDisplayedSmoothedMph(0);
    const res = await saveActiveSessionCheckpoint(paused);
    if (!res.ok && res.error) setStorageWarning(res.error);
  };

  // Resume Ride
  const handleResumeRide = async () => {
    if (!activeSession || activeSession.status !== 'paused') return;
    const resumed = resumeRideSession(activeSession, Date.now());
    activeSessionRef.current = resumed;
    setActiveSession(resumed);
    setFollowRider(true);
    const res = await saveActiveSessionCheckpoint(resumed);
    if (!res.ok && res.error) setStorageWarning(res.error);
  };

  // Stop & Save Ride
  const handleStopAndSaveRide = async () => {
    if (!activeSession) return;
    const finalized = finalizeRideSession(activeSession, Date.now());
    const saveResult = await saveCompletedRideToStorage(finalized);

    if (!saveResult.ok) {
      setStorageWarning(`Failed to save completed ride: ${saveResult.error}`);
      return;
    }

    await clearActiveSessionCheckpoint();
    setActiveSession(null);
    activeSessionRef.current = null;
    smoothedSpeedRef.current = 0;
    setDisplayedSmoothedMph(0);

    const refreshedRides = await loadCompletedRidesFromStorage();
    setSavedRides(refreshedRides);
    setStatusNotice(`Ride successfully saved for ${RIDER_PROFILES[finalized.riderId].name}!`);

    // Switch to History tab so rider can see the recorded ride
    setActiveNavTab('history');
  };

  // Discard Ride
  const handleDiscardActiveSession = async () => {
    await clearActiveSessionCheckpoint();
    setActiveSession(null);
    activeSessionRef.current = null;
    smoothedSpeedRef.current = 0;
    setDisplayedSmoothedMph(0);
    setConfirmDiscardActive(false);
    setStatusNotice('Ride discarded.');
  };

  // Resume Interrupted Session
  const handleAcceptRecovery = async () => {
    if (!recoverableSession) return;
    activeSessionRef.current = recoverableSession;
    setActiveSession(recoverableSession);
    setActiveRiderId(recoverableSession.riderId);
    setGpsSource(recoverableSession.source);
    setRecoverableSession(null);
    setStatusNotice('Recovered previous ride session.');
    setActiveNavTab('ride');
  };

  const handleDiscardRecovery = async () => {
    await clearActiveSessionCheckpoint();
    setRecoverableSession(null);
    setConfirmDiscardRecovery(false);
  };

  // Delete & Reassign handlers for History screen
  const handleDeleteSavedRide = async (id: string) => {
    await deleteCompletedRideFromStorage(id);
    const updated = await loadCompletedRidesFromStorage();
    setSavedRides(updated);
  };

  const handleReassignRider = async (rideId: string, newRider: RiderId) => {
    await reassignCompletedRideRider(rideId, newRider);
    const updated = await loadCompletedRidesFromStorage();
    setSavedRides(updated);
  };

  const handleReassignRideSource = async (
    rideId: string,
    newSource: 'live' | 'car_test'
  ) => {
    await reassignCompletedRideSource(rideId, newSource);
    const updated = await loadCompletedRidesFromStorage();
    setSavedRides(updated);
  };

  const handlePreviewRideOnMap = (ride: SavedRide) => {
    setPreviewRide(ride);
    setActiveNavTab('ride');
  };

  const handleImportBackupJson = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const validation = parseAndValidateBackupJson(parsed);
      if (!validation.ok || validation.rides.length === 0) {
        setImportFeedback(validation.error || 'No valid rides found in file.');
        return { success: false, message: validation.error || 'Invalid file format.' };
      }

      for (const r of validation.rides) {
        await saveCompletedRideToStorage(r);
      }
      const updated = await loadCompletedRidesFromStorage();
      setSavedRides(updated);
      const msg = `Successfully imported ${validation.rides.length} rides!`;
      setImportFeedback(msg);
      return { success: true, message: msg };
    } catch {
      const msg = 'Failed to parse JSON file.';
      setImportFeedback(msg);
      return { success: false, message: msg };
    }
  };

  // Active metrics calculations
  const distanceMiles = activeSession
    ? activeSession.distanceMiles
    : previewRide
    ? previewRide.distanceMiles
    : 0;

  const elapsedSeconds = activeSession
    ? calculateSessionElapsedSeconds(
        activeSession.startedAtMs,
        nowTickMs,
        activeSession.totalPausedMs,
        activeSession.pausedAtMs
      )
    : previewRide
    ? previewRide.elapsedSeconds
    : 0;

  const movingSeconds = activeSession
    ? activeSession.movingTimeSeconds
    : previewRide
    ? previewRide.movingSeconds
    : 0;

  const { avgOverallSpeedMph, avgMovingSpeedMph } = calculateAverageSpeeds(
    distanceMiles,
    elapsedSeconds,
    movingSeconds
  );

  const maxValidatedSpeedMph = activeSession
    ? activeSession.maxValidatedSpeedMph
    : previewRide
    ? previewRide.maxValidatedSpeedMph
    : 0;

  // Real elevation gain in feet calculated from GPS points
  const elevationGainFeet = useMemo(() => {
    const points = activeSession ? activeSession.points : previewRide ? previewRide.points : [];
    if (points.length < 2) return 0;
    let gainMeters = 0;
    let lastAlt: number | null = null;
    for (const p of points) {
      if (p.altitude !== null && Number.isFinite(p.altitude)) {
        if (lastAlt !== null && p.altitude > lastAlt) {
          const delta = p.altitude - lastAlt;
          if (delta > 0.8 && delta < 50) {
            gainMeters += delta;
          }
        }
        lastAlt = p.altitude;
      }
    }
    return gainMeters * 3.28084;
  }, [activeSession, previewRide]);

  // Real-time slope grade % from recent GPS fixes
  const gradeEstimate = useMemo(() => {
    const points = activeSession ? activeSession.points : [];
    if (points.length < 2) return null;
    const recent = points.slice(-4);
    if (recent.length < 2) return null;
    const start = recent[0];
    const end = recent[recent.length - 1];
    if (start.altitude === null || end.altitude === null) return null;

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
    if (distMeters < 12) return null;
    const altDeltaMeters = end.altitude - start.altitude;
    const grade = (altDeltaMeters / distMeters) * 100;
    if (Math.abs(grade) > 35) return null;
    return grade;
  }, [activeSession]);

  const routePointsToDisplay: GpsPoint[] = useMemo(() => {
    if (previewRide) return previewRide.points;
    if (activeSession) return activeSession.points;
    return [];
  }, [previewRide, activeSession]);

  const activeRiderProfile = RIDER_PROFILES[activeRiderId] || RIDER_PROFILES.talha;

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Immersive Handlebar Mode Floating Header */}
      {isImmersive ? (
        <aside
          aria-label="Immersive Cockpit Banner"
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-900/95 text-white border border-slate-700 shadow-2xl backdrop-blur-md text-xs font-semibold"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span>Handlebar Cockpit · {activeRiderProfile.name}</span>
          <button
            type="button"
            onClick={handleToggleImmersive}
            className="ml-2 px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold border border-slate-700 cursor-pointer transition-colors"
          >
            Exit Immersive ✕
          </button>
        </aside>
      ) : (
        /* Top Chrome Navigation (Desktop & Tablet) */
        <header
          className={`flex items-center justify-between px-4 sm:px-6 py-2.5 border-b shrink-0 ${
            isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">{activeRiderProfile.badgeEmoji}</span>
            <span className="font-extrabold text-base sm:text-lg tracking-tight">
              Family Bike GPS
            </span>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-slate-800/40 border border-slate-700/50">
            <button
              type="button"
              onClick={() => setActiveNavTab('ride')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeNavTab === 'ride'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Ride Cockpit</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveNavTab('home')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeNavTab === 'home'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span>Home ({activeRiderProfile.name})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveNavTab('history')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeNavTab === 'history'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Ride Logs ({savedRides.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveNavTab('settings')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeNavTab === 'settings'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <PWAInstallButton onOpenApkGuide={() => setIsApkGuideOpen(true)} />
            <button
              type="button"
              onClick={() => setIsMoreMenuOpen(true)}
              className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/50 border border-slate-700/60"
              title="More tools & test modes"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </header>
      )}

      {/* Interrupted Ride Recovery Banner */}
      {recoverableSession && !activeSession && (
        <div
          role="alert"
          className="mx-3 sm:mx-6 my-2 p-3.5 rounded-2xl bg-amber-500/20 border border-amber-500/50 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Unfinished ride found for {RIDER_PROFILES[recoverableSession.riderId]?.name || 'Rider'} (
              {formatDistanceValue(recoverableSession.distanceMiles, unit)} {unit === 'kmh' ? 'km' : 'mi'})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAcceptRecovery}
              className="px-3 py-1 rounded-xl bg-amber-500 text-slate-950 font-bold"
            >
              Resume Ride
            </button>
            <button
              type="button"
              onClick={handleDiscardRecovery}
              className="px-3 py-1 rounded-xl bg-slate-800 text-slate-300"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* MAIN SCREEN ROUTER */}
      <main className="flex-1 relative flex flex-col overflow-hidden pb-14 sm:pb-16">
        {/* TAB 1: RIDE COCKPIT SCREEN (Full Map + Expandable Recording Dashboard) */}
        {activeNavTab === 'ride' && (
          <div className="relative w-full h-[calc(100vh-112px)] sm:h-[calc(100vh-124px)] flex-1 overflow-hidden">
            {/* Full Map Canvas */}
            <LiveRideMap
              currentFix={currentFix}
              routePoints={routePointsToDisplay}
              headingDegrees={currentHeading}
              gpsQuality={gpsAssessment.quality}
              gpsLabel={gpsAssessment.label}
              fixAgeSeconds={gpsAssessment.ageSeconds}
              isDark={isDark}
              followRider={followRider}
              onToggleFollow={setFollowRider}
              previewTitle={previewRide?.title ?? null}
              onClearPreview={() => setPreviewRide(null)}
              mapLayerStyle={mapLayerStyle}
              onChangeMapLayerStyle={setMapLayerStyle}
              layoutMode="full_map"
              is3DView={is3DView}
              onToggle3DView={setIs3DView}
              headingUp={headingUp}
              onToggleHeadingUp={setHeadingUp}
              pitchDegrees={pitchDegrees}
              onChangePitchDegrees={setPitchDegrees}
              isImmersive={isImmersive}
              onToggleImmersive={handleToggleImmersive}
              currentAltitudeFeet={currentCredibleAltFeet}
              displayedSmoothedMph={displayedSmoothedMph}
              unit={unit}
              distanceDisplay={formatDistanceValue(distanceMiles, unit)}
              elapsedDisplay={formatElapsedTime(elapsedSeconds)}
              movingDisplay={formatElapsedTime(movingSeconds)}
              isRecording={activeSession?.status === 'recording'}
              isPaused={activeSession?.status === 'paused'}
              onPauseRide={handlePauseRide}
              onResumeRide={handleResumeRide}
              onStopRide={handleStopAndSaveRide}
              onOpenOfflineModal={() => setIsOfflineModalOpen(true)}
              isSimulatedOffline={isSimulatedOffline}
              hideInternalHud={true}
            />

            {/* Top Overlays on Ride Screen */}
            <div className="absolute top-3 left-3 right-3 z-[430] pointer-events-none flex items-center justify-between gap-2">
              {/* Compact GPS Accuracy Status & Diagnostics Dropdown */}
              <div className="pointer-events-auto">
                <GpsAccuracyBanner
                  currentFix={currentFix}
                  gpsQuality={gpsAssessment.quality}
                  gpsLabel={gpsAssessment.label}
                  fixAgeSeconds={gpsAssessment.ageSeconds}
                  isDark={isDark}
                  onSwitchToSimulation={() => handleSwitchGpsSource('simulation')}
                />
              </div>

              {/* Compact Active Rider Indicator Pill */}
              <button
                type="button"
                onClick={() => setActiveNavTab('home')}
                className={`pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-md backdrop-blur-md text-xs font-bold transition hover:scale-102 ${
                  isDark
                    ? 'bg-slate-900/90 border-slate-700 text-white'
                    : 'bg-white/95 border-slate-200 text-slate-900'
                }`}
                title="Click to change rider on Home screen"
              >
                <span className="text-base">{activeRiderProfile.badgeEmoji}</span>
                <span>{activeRiderProfile.name}</span>
                {gpsSource === 'car_test' && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                    Camry
                  </span>
                )}
                {gpsSource === 'simulation' && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                    Sim
                  </span>
                )}
              </button>
            </div>

            {/* EXPANDABLE RECORDING DASHBOARD (Ride with GPS Signature Element!) */}
            <ExpandableRideDashboard
              isRecording={activeSession?.status === 'recording'}
              isPaused={activeSession?.status === 'paused'}
              isGpsReady={isGpsReadyForStart}
              speedMph={displayedSmoothedMph}
              distanceMiles={distanceMiles}
              elapsedSeconds={elapsedSeconds}
              movingSeconds={movingSeconds}
              avgOverallSpeedMph={avgOverallSpeedMph}
              avgMovingSpeedMph={avgMovingSpeedMph}
              maxSpeedMph={maxValidatedSpeedMph}
              currentAltitudeFeet={currentCredibleAltFeet}
              elevationGainFeet={elevationGainFeet}
              gradeEstimate={gradeEstimate}
              unit={unit}
              isDark={isDark}
              gpsQuality={gpsAssessment.quality}
              riderName={activeRiderProfile.name}
              sourceLabel={
                gpsSource === 'car_test'
                  ? 'Camry Test'
                  : gpsSource === 'simulation'
                  ? 'Simulator'
                  : undefined
              }
              onStartRide={handleStartRide}
              onPauseRide={handlePauseRide}
              onResumeRide={handleResumeRide}
              onStopRide={handleStopAndSaveRide}
              onDiscardRide={handleDiscardActiveSession}
            />
          </div>
        )}

        {/* TAB 2: HOME SCREEN (Compact Rider Selector for Talha/Azlan/Eshal/Guest + Family Mileage) */}
        {activeNavTab === 'home' && (
          <div className="flex-1 overflow-y-auto">
            <HomeScreen
              activeRiderId={activeRiderId}
              onSelectRider={handleSelectRider}
              savedRides={savedRides}
              unit={unit}
              isDark={isDark}
              onNavigateToRide={() => setActiveNavTab('ride')}
              onNavigateToHistory={() => setActiveNavTab('history')}
              onOpenOfflineMaps={() => setIsOfflineModalOpen(true)}
              onOpenTestModes={() => setIsMoreMenuOpen(true)}
            />
          </div>
        )}

        {/* TAB 3: HISTORY SCREEN (Full Ride Logs, Filters, GPX Downloads, JSON Backup) */}
        {activeNavTab === 'history' && (
          <div className="flex-1 overflow-y-auto">
            <HistoryScreen
              rides={savedRides}
              unit={unit}
              activeRiderId={activeRiderId}
              onDeleteRide={handleDeleteSavedRide}
              onReassignRider={handleReassignRider}
              onReassignRideSource={handleReassignRideSource}
              onPreviewRideOnMap={handlePreviewRideOnMap}
              onImportBackupJson={handleImportBackupJson}
              importFeedback={importFeedback}
              isDark={isDark}
            />
          </div>
        )}

        {/* TAB 4: SETTINGS SCREEN (MPH/KMH, Night Mode with Auto Option, Milestone Chimes, 3D Defaults) */}
        {activeNavTab === 'settings' && (
          <div className="flex-1 overflow-y-auto">
            <SettingsScreen
              unit={unit}
              onChangeUnit={handleUnitChange}
              themePreference={themePreference}
              onChangeThemePreference={handleThemePreferenceChange}
              milestoneChimeEnabled={milestoneChimeEnabled}
              onToggleMilestoneChime={setMilestoneChimeEnabled}
              is3DView={is3DView}
              onToggle3DView={setIs3DView}
              headingUp={headingUp}
              onToggleHeadingUp={setHeadingUp}
              pitchDegrees={pitchDegrees}
              onChangePitchDegrees={setPitchDegrees}
              mapLayerStyle={mapLayerStyle}
              onChangeMapLayerStyle={setMapLayerStyle}
              isDark={isDark}
              onClearCache={() => setIsOfflineModalOpen(true)}
              onExportBackupJson={() => {
                const json = JSON.stringify(savedRides, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `family_bike_rides_backup_${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            />
          </div>
        )}
      </main>

      {/* BOTTOM APP NAVIGATION BAR (Always accessible on Mobile & Mounts) */}
      <nav
        aria-label="App Navigation"
        className={`fixed bottom-0 inset-x-0 z-[450] h-14 sm:h-16 border-t backdrop-blur-xl flex items-center justify-around px-2 sm:px-6 transition-transform ${
          isImmersive ? 'translate-y-full pointer-events-none' : 'translate-y-0'
        } ${
          isDark
            ? 'bg-slate-950/95 border-slate-800 text-slate-400'
            : 'bg-white/95 border-slate-200 text-slate-500 shadow-lg'
        }`}
      >
        <button
          type="button"
          onClick={() => setActiveNavTab('ride')}
          className={`flex flex-col items-center justify-center w-14 sm:w-20 h-full transition relative cursor-pointer ${
            activeNavTab === 'ride'
              ? 'text-sky-500 font-bold'
              : 'hover:text-slate-200'
          }`}
        >
          <Navigation className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Ride</span>
          {activeNavTab === 'ride' && (
            <span className="absolute bottom-1 w-4 h-1 rounded-full bg-sky-500" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveNavTab('home')}
          className={`flex flex-col items-center justify-center w-14 sm:w-20 h-full transition relative cursor-pointer ${
            activeNavTab === 'home'
              ? 'text-sky-500 font-bold'
              : 'hover:text-slate-200'
          }`}
        >
          <Home className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Home</span>
          {activeNavTab === 'home' && (
            <span className="absolute bottom-1 w-4 h-1 rounded-full bg-sky-500" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveNavTab('history')}
          className={`flex flex-col items-center justify-center w-14 sm:w-20 h-full transition relative cursor-pointer ${
            activeNavTab === 'history'
              ? 'text-sky-500 font-bold'
              : 'hover:text-slate-200'
          }`}
        >
          <Activity className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">History</span>
          {activeNavTab === 'history' && (
            <span className="absolute bottom-1 w-4 h-1 rounded-full bg-sky-500" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveNavTab('settings')}
          className={`flex flex-col items-center justify-center w-14 sm:w-20 h-full transition relative cursor-pointer ${
            activeNavTab === 'settings'
              ? 'text-sky-500 font-bold'
              : 'hover:text-slate-200'
          }`}
        >
          <Sliders className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Settings</span>
          {activeNavTab === 'settings' && (
            <span className="absolute bottom-1 w-4 h-1 rounded-full bg-sky-500" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setIsMoreMenuOpen(true)}
          className="flex flex-col items-center justify-center w-14 sm:w-20 h-full transition hover:text-slate-200 relative text-slate-400 cursor-pointer"
        >
          <MoreHorizontal className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">More</span>
          {gpsSource !== 'live' && (
            <span className="absolute top-2 right-3 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          )}
        </button>
      </nav>

      {/* MORE MODAL (Houses Test Modes: Camry & Simulator; Install App: Android APK; Offline Maps) */}
      <MoreMenuModal
        isOpen={isMoreMenuOpen}
        onClose={() => setIsMoreMenuOpen(false)}
        isDark={isDark}
        gpsSource={gpsSource}
        onSelectGpsSource={handleSwitchGpsSource}
        selectedPresetId={selectedPresetId}
        onSelectPresetId={setSelectedPresetId}
        isSimulatedOffline={isSimulatedOffline}
        onToggleSimulatedOffline={(enabled) => {
          setIsSimulatedOffline(enabled);
          setSimulatedOfflineMode(enabled);
        }}
        onOpenOfflineMaps={() => setIsOfflineModalOpen(true)}
        onOpenApkGuide={() => setIsApkGuideOpen(true)}
        onOpenMusicPlayer={() => setIsMusicModalOpen(true)}
        isRecordingOrPaused={activeSession !== null}
      />

      {/* OFFLINE MAPS PRE-RENDERING & TILE STORAGE MODAL */}
      <OfflineMapsModal
        isOpen={isOfflineModalOpen}
        onClose={() => setIsOfflineModalOpen(false)}
        isDark={isDark}
        currentLat={currentFix?.lat ?? null}
        currentLng={currentFix?.lng ?? null}
        currentMapLayer={mapLayerStyle}
        onSimulatedOfflineChange={(enabled) => setIsSimulatedOffline(enabled)}
      />

      {/* PHONE MOUNTING & ANDROID APK GUIDE MODAL */}
      <ApkSetupModal
        isOpen={isApkGuideOpen}
        onClose={() => setIsApkGuideOpen(false)}
      />

      {/* COCKPIT MUSIC & CADENCE AUDIO */}
      <CockpitMusicPlayer
        isDark={isDark}
        unit={unit}
        milestoneChimeEnabled={milestoneChimeEnabled}
        onToggleMilestoneChime={setMilestoneChimeEnabled}
      />
    </div>
  );
}
