export type RiderId = 'talha' | 'azlan' | 'eshal' | 'guest';
export type RideDataSource = 'live' | 'car_test' | 'simulation';
export type GpsSignalQuality = 'unavailable' | 'waiting' | 'poor' | 'fair' | 'good';

export interface RiderProfile {
  id: RiderId;
  name: string;
  roleLabel: string;
  viewMode: 'simple' | 'full';
  accentColor: string;
  badgeEmoji: string;
}

export const RIDER_PROFILES: Record<RiderId, RiderProfile> = {
  talha: {
    id: 'talha',
    name: 'Talha',
    roleLabel: 'Bicycle Cockpit & Full Telemetry',
    viewMode: 'full',
    accentColor: '#10B981',
    badgeEmoji: '🚴‍♂️',
  },
  azlan: {
    id: 'azlan',
    name: 'Azlan',
    roleLabel: 'Bicycle Cockpit (Simple View)',
    viewMode: 'simple',
    accentColor: '#0EA5E9',
    badgeEmoji: '⚡',
  },
  eshal: {
    id: 'eshal',
    name: 'Eshal',
    roleLabel: 'Trail Explorer & Cruiser',
    viewMode: 'simple',
    accentColor: '#F59E0B',
    badgeEmoji: '🌸',
  },
  guest: {
    id: 'guest',
    name: 'Guest',
    roleLabel: 'Visiting Rider',
    viewMode: 'simple',
    accentColor: '#8B5CF6',
    badgeEmoji: '🚲',
  },
};

/**
 * Raw observation directly from Geolocation API or simulator before filtering.
 */
export interface RawGpsFix {
  lat: number;
  lng: number;
  altitude: number | null;         // meters above WGS84 ellipsoid
  altitudeAccuracy?: number | null;// meters
  speedMps: number | null;         // Doppler/sensor speed in m/s
  heading: number | null;          // degrees [0..360)
  accuracy: number | null;         // horizontal accuracy radius in meters
  timestamp: number;               // epoch ms
}

/**
 * Audited GPS point stored in session history with validation metadata.
 */
export interface GpsPoint extends RawGpsFix {
  validatedSpeedMph: number;
  acceptedForDistance: boolean;
  segmentIndex: number;
  rejectionReason?: string;
}

export interface GpsQualitySummary {
  totalRawFixes: number;
  acceptedFixes: number;
  rejectedLowAccuracyCount: number;
  rejectedSpikeCount: number;
  outageGapCount: number;
  averageAccuracyMeters: number | null;
}

export interface ActiveRideSession {
  sessionId: string;
  riderId: RiderId;
  source: RideDataSource;
  status: 'recording' | 'paused';
  startedAtMs: number;
  lastUpdatedAtMs: number;
  pausedAtMs: number | null;
  totalPausedMs: number;
  distanceMiles: number;
  movingTimeSeconds: number;
  maxValidatedSpeedMph: number;
  currentSegmentIndex: number;
  isCurrentlyMoving: boolean;
  lastValidatedPoint: GpsPoint | null;
  points: GpsPoint[];
  quality: GpsQualitySummary;
}

export interface SavedRide {
  id: string;
  riderId: RiderId;
  source: RideDataSource;
  title: string;
  startedAt: string;               // ISO string
  endedAt: string;                 // ISO string
  elapsedSeconds: number;          // Total session duration excluding manual pauses
  movingSeconds: number;           // Validated moving duration
  distanceMiles: number;           // Exact validated distance (can be 0)
  avgOverallSpeedMph: number;      // distanceMiles / (elapsedSeconds / 3600)
  avgMovingSpeedMph: number;       // distanceMiles / (movingSeconds / 3600)
  maxValidatedSpeedMph: number;    // Highest validated speed (never invented)
  maxAltitudeFeet: number | null;  // Credible sensor altitude or null
  points: GpsPoint[];
  quality: GpsQualitySummary;
}

const EARTH_RADIUS_MILES = 3958.7613;
const EARTH_RADIUS_METERS = 6371008.8;
const MPS_TO_MPH = 2.23693629;
const MPH_TO_KMH = 1.609344;
const MILES_TO_KM = 1.609344;
const METERS_TO_FEET = 3.28084;

// Bicycle & Car Test telemetry physical thresholds
export const MAX_ACCEPTABLE_ACCURACY_METERS = 35;
export const MAX_DISPLAY_ACCURACY_METERS = 75;
export const MAX_PLAUSIBLE_BIKE_SPEED_MPH = 48; // ~77 km/h max plausible family bicycle speed
export const MAX_PLAUSIBLE_CAR_TEST_SPEED_MPH = 95; // ~153 km/h max plausible Camry road test speed
export const MAX_PLAUSIBLE_ACCEL_MPH_PER_SEC = 14; // ~6.2 m/s^2 for bicycle
export const MAX_PLAUSIBLE_CAR_ACCEL_MPH_PER_SEC = 22; // ~9.8 m/s^2 for car test
export const OUTAGE_GAP_THRESHOLD_MS = 15000; // >15s without fix is treated as a GPS gap/outage
export const MOVING_START_THRESHOLD_MPH = 1.5; // Hysteresis upper bound to enter moving state
export const MOVING_STOP_THRESHOLD_MPH = 1.0;  // Hysteresis lower bound to exit moving state

export function createEmptyQualitySummary(): GpsQualitySummary {
  return {
    totalRawFixes: 0,
    acceptedFixes: 0,
    rejectedLowAccuracyCount: 0,
    rejectedSpikeCount: 0,
    outageGapCount: 0,
    averageAccuracyMeters: null,
  };
}

export function createInitialRideSession(
  riderId: RiderId,
  source: RideDataSource,
  nowMs = Date.now(),
  sessionId = `session-${nowMs}-${Math.random().toString(36).slice(2, 8)}`
): ActiveRideSession {
  return {
    sessionId,
    riderId,
    source,
    status: 'recording',
    startedAtMs: nowMs,
    lastUpdatedAtMs: nowMs,
    pausedAtMs: null,
    totalPausedMs: 0,
    distanceMiles: 0,
    movingTimeSeconds: 0,
    maxValidatedSpeedMph: 0,
    currentSegmentIndex: 0,
    isCurrentlyMoving: false,
    lastValidatedPoint: null,
    points: [],
    quality: createEmptyQualitySummary(),
  };
}

/**
 * Converts meters per second to miles per hour.
 */
export function mpsToMph(mps: number): number {
  if (!Number.isFinite(mps) || mps < 0) return 0;
  return mps * MPS_TO_MPH;
}

/**
 * Formats speed in MPH or KM/H with 1 decimal or integer precision.
 */
export function formatSpeedValue(mph: number | null | undefined, unit: 'mph' | 'kmh'): string {
  if (mph === null || mph === undefined || !Number.isFinite(mph) || mph < 0) {
    return '0.0';
  }
  const val = unit === 'kmh' ? mph * MPH_TO_KMH : mph;
  return val < 10 ? val.toFixed(1) : Math.round(val).toString();
}

/**
 * Formats numeric speed rounded for secondary stats.
 */
export function formatStatSpeed(mph: number | null | undefined, unit: 'mph' | 'kmh'): string {
  if (mph === null || mph === undefined || !Number.isFinite(mph) || mph < 0) {
    return '0.0';
  }
  const val = unit === 'kmh' ? mph * MPH_TO_KMH : mph;
  return val.toFixed(1);
}

/**
 * Converts distance in miles to target unit (mi or km) without fabricating minimum distance.
 */
export function formatDistanceValue(miles: number, unit: 'mph' | 'kmh'): string {
  const safeMiles = Math.max(0, Number.isFinite(miles) ? miles : 0);
  const val = unit === 'kmh' ? safeMiles * MILES_TO_KM : safeMiles;
  return val.toFixed(2);
}

/**
 * Formats credible altitude in feet or meters, or returns "Unavailable" when null.
 */
export function formatAltitudeDisplay(
  altitudeFeet: number | null | undefined,
  unit: 'mph' | 'kmh'
): string {
  if (altitudeFeet === null || altitudeFeet === undefined || !Number.isFinite(altitudeFeet)) {
    return 'Unavailable';
  }
  const val = unit === 'kmh' ? Math.round(altitudeFeet / METERS_TO_FEET) : Math.round(altitudeFeet);
  const suffix = unit === 'kmh' ? 'm' : 'ft';
  return `${val} ${suffix}`;
}

/**
 * Great-circle Haversine distance in miles.
 */
export function calculateHaversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return EARTH_RADIUS_MILES * c;
}

export function calculateHaversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculates initial compass bearing (0-360 degrees) between two coordinates.
 */
export function calculateBearingDegrees(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  if (lat1 === lat2 && lng1 === lng2) return 0;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaLambda = toRad(lng2 - lng1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);
  return (toDeg(theta) + 360) % 360;
}

/**
 * Converts a compass degree (0-360) to a 16-point cardinal string, or returns null if unavailable.
 */
export function degreesToCardinal(degrees: number | null | undefined): string {
  if (degrees === null || degrees === undefined || !Number.isFinite(degrees)) {
    return '—';
  }
  const normalized = ((degrees % 360) + 360) % 360;
  const directions = [
    'N', 'NNE', 'NE', 'ENE',
    'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW',
    'W', 'WNW', 'NW', 'NNW',
  ];
  const index = Math.round(normalized / 22.5) % 16;
  return directions[index];
}

export function formatHeadingDisplay(headingDegrees: number | null | undefined): string {
  if (headingDegrees === null || headingDegrees === undefined || !Number.isFinite(headingDegrees)) {
    return 'Unavailable';
  }
  const norm = Math.round(((headingDegrees % 360) + 360) % 360);
  return `${String(norm).padStart(3, '0')}° ${degreesToCardinal(norm)}`;
}

/**
 * Evaluates GPS signal quality tier based on accuracy and fix age.
 */
export function evaluateGpsQuality(
  fix: RawGpsFix | null,
  nowMs = Date.now(),
  hasPermissionError = false
): { quality: GpsSignalQuality; label: string; ageSeconds: number | null } {
  if (hasPermissionError) {
    return { quality: 'unavailable', label: 'GPS Unavailable', ageSeconds: null };
  }
  if (!fix) {
    return { quality: 'waiting', label: 'Waiting for GPS', ageSeconds: null };
  }
  const ageSeconds = Math.max(0, Math.round((nowMs - fix.timestamp) / 1000));
  if (ageSeconds > 15) {
    return { quality: 'poor', label: `Stale GPS (${ageSeconds}s ago)`, ageSeconds };
  }
  const acc = fix.accuracy;
  if (acc === null || !Number.isFinite(acc)) {
    return { quality: 'fair', label: 'GPS Active (Accuracy Unknown)', ageSeconds };
  }
  if (acc > MAX_ACCEPTABLE_ACCURACY_METERS) {
    return {
      quality: 'poor',
      label: `Low GPS Accuracy (±${Math.round(acc)}m)`,
      ageSeconds,
    };
  }
  if (acc <= 12) {
    return {
      quality: 'good',
      label: `Strong GPS (±${Math.round(acc)}m)`,
      ageSeconds,
    };
  }
  return {
    quality: 'fair',
    label: `Fair GPS (±${Math.round(acc)}m)`,
    ageSeconds,
  };
}

/**
 * Exponential Moving Average (EMA) speed smoother for visual display only.
 * Never used to inflate historical max speed or distance.
 */
export function smoothSpeedMph(
  previousSmoothedMph: number,
  validatedInstantMph: number,
  alpha = 0.45
): number {
  const clampedAlpha = Math.min(1, Math.max(0.05, alpha));
  const raw = Math.max(0, Number.isFinite(validatedInstantMph) ? validatedInstantMph : 0);
  if (raw < MOVING_STOP_THRESHOLD_MPH) {
    return 0;
  }
  const blended = clampedAlpha * raw + (1 - clampedAlpha) * previousSmoothedMph;
  return blended < MOVING_STOP_THRESHOLD_MPH ? 0 : Number(blended.toFixed(1));
}

/**
 * Calculates actual elapsed ride duration in seconds from timestamps (excluding manual paused durations).
 * Survives tab backgrounding, timer throttling, or delayed callbacks.
 */
export function calculateSessionElapsedSeconds(
  startedAtMs: number,
  nowMs: number,
  totalPausedMs: number,
  pausedAtMs: number | null
): number {
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(nowMs) || nowMs <= startedAtMs) {
    return 0;
  }
  const activePauseMs =
    pausedAtMs !== null && nowMs > pausedAtMs ? nowMs - pausedAtMs : 0;
  const netMs = Math.max(0, nowMs - startedAtMs - totalPausedMs - activePauseMs);
  return Math.floor(netMs / 1000);
}

/**
 * Calculates overall average speed (distance / elapsed time) and moving average speed (distance / moving time).
 */
export function calculateAverageSpeeds(
  distanceMiles: number,
  elapsedSeconds: number,
  movingSeconds: number
): { avgOverallSpeedMph: number; avgMovingSpeedMph: number } {
  const safeDist = Math.max(0, Number.isFinite(distanceMiles) ? distanceMiles : 0);
  const avgOverallSpeedMph =
    elapsedSeconds > 0 ? Number(((safeDist / elapsedSeconds) * 3600).toFixed(2)) : 0;
  const avgMovingSpeedMph =
    movingSeconds > 0 ? Number(((safeDist / movingSeconds) * 3600).toFixed(2)) : 0;
  return { avgOverallSpeedMph, avgMovingSpeedMph };
}

export interface FixValidationResult {
  isValidFix: boolean;
  acceptedForDistance: boolean;
  isOutageGap: boolean;
  validatedSpeedMph: number;
  segmentDeltaMiles: number;
  movingDeltaSeconds: number;
  nextIsMoving: boolean;
  derivedHeading: number | null;
  credibleAltitudeFeet: number | null;
  rejectionReason?: string;
}

/**
 * Core Bicycle GPS Validation & Noise Rejection Pipeline.
 * Audits a raw GPS fix against the previous validated fix.
 */
export function validateBicycleGpsFix(
  raw: RawGpsFix,
  previous: GpsPoint | null,
  wasMoving = false,
  source: RideDataSource = 'live'
): FixValidationResult {
  const maxPlausibleSpeedMph =
    source === 'car_test'
      ? MAX_PLAUSIBLE_CAR_TEST_SPEED_MPH
      : MAX_PLAUSIBLE_BIKE_SPEED_MPH;
  const maxPlausibleAccelMphPerSec =
    source === 'car_test'
      ? MAX_PLAUSIBLE_CAR_ACCEL_MPH_PER_SEC
      : MAX_PLAUSIBLE_ACCEL_MPH_PER_SEC;

  // 1. Coordinate & timestamp sanity check
  if (
    !Number.isFinite(raw.lat) ||
    !Number.isFinite(raw.lng) ||
    raw.lat < -90 ||
    raw.lat > 90 ||
    raw.lng < -180 ||
    raw.lng > 180 ||
    !Number.isFinite(raw.timestamp) ||
    raw.timestamp <= 0
  ) {
    return {
      isValidFix: false,
      acceptedForDistance: false,
      isOutageGap: false,
      validatedSpeedMph: 0,
      segmentDeltaMiles: 0,
      movingDeltaSeconds: 0,
      nextIsMoving: false,
      derivedHeading: null,
      credibleAltitudeFeet: null,
      rejectionReason: 'invalid_coordinates_or_timestamp',
    };
  }

  // Evaluate credible altitude (reject if altitude is null or altitudeAccuracy > 50m)
  const credibleAltitudeFeet =
    raw.altitude !== null &&
    Number.isFinite(raw.altitude) &&
    raw.altitude > -500 &&
    raw.altitude < 9000 &&
    (raw.altitudeAccuracy === undefined ||
      raw.altitudeAccuracy === null ||
      raw.altitudeAccuracy <= 50)
      ? Math.round(raw.altitude * METERS_TO_FEET)
      : null;

  // 2. Accuracy gate
  const accuracy = raw.accuracy !== null && Number.isFinite(raw.accuracy) ? raw.accuracy : 15;
  if (accuracy > MAX_ACCEPTABLE_ACCURACY_METERS) {
    return {
      isValidFix: true,
      acceptedForDistance: false,
      isOutageGap: false,
      validatedSpeedMph: 0,
      segmentDeltaMiles: 0,
      movingDeltaSeconds: 0,
      nextIsMoving: false,
      derivedHeading: null,
      credibleAltitudeFeet,
      rejectionReason: 'low_gps_accuracy',
    };
  }

  // 3. First validated point in a session or segment
  if (!previous) {
    const initialDopplerMph =
      raw.speedMps !== null && Number.isFinite(raw.speedMps) && raw.speedMps >= 0
        ? mpsToMph(raw.speedMps)
        : 0;
    const clampedInitialMph =
      initialDopplerMph <= maxPlausibleSpeedMph ? initialDopplerMph : 0;
    const isMoving = clampedInitialMph >= MOVING_START_THRESHOLD_MPH;
    const validHeading =
      isMoving && raw.heading !== null && Number.isFinite(raw.heading)
        ? ((raw.heading % 360) + 360) % 360
        : null;

    return {
      isValidFix: true,
      acceptedForDistance: true,
      isOutageGap: false,
      validatedSpeedMph: Number(clampedInitialMph.toFixed(2)),
      segmentDeltaMiles: 0,
      movingDeltaSeconds: 0,
      nextIsMoving: isMoving,
      derivedHeading: validHeading,
      credibleAltitudeFeet,
    };
  }

  // 4. Chronological order & duplicate timestamp rejection
  const dtMs = raw.timestamp - previous.timestamp;
  if (dtMs <= 0) {
    return {
      isValidFix: false,
      acceptedForDistance: false,
      isOutageGap: false,
      validatedSpeedMph: 0,
      segmentDeltaMiles: 0,
      movingDeltaSeconds: 0,
      nextIsMoving: wasMoving,
      derivedHeading: previous.heading,
      credibleAltitudeFeet,
      rejectionReason: 'non_chronological_or_duplicate_timestamp',
    };
  }

  const dtSeconds = dtMs / 1000;

  // 5. GPS Outage / Gap detection (> 15 seconds between fixes)
  // Do not connect outages with a straight line or accumulate false distance/speed across an outage.
  if (dtMs > OUTAGE_GAP_THRESHOLD_MS) {
    const postGapDopplerMph =
      raw.speedMps !== null && Number.isFinite(raw.speedMps) && raw.speedMps >= 0
        ? mpsToMph(raw.speedMps)
        : 0;
    const safeSpeed =
      postGapDopplerMph <= maxPlausibleSpeedMph ? postGapDopplerMph : 0;
    return {
      isValidFix: true,
      acceptedForDistance: true,
      isOutageGap: true,
      validatedSpeedMph: Number(safeSpeed.toFixed(2)),
      segmentDeltaMiles: 0,
      movingDeltaSeconds: 0,
      nextIsMoving: safeSpeed >= MOVING_START_THRESHOLD_MPH,
      derivedHeading:
        safeSpeed >= MOVING_START_THRESHOLD_MPH &&
        raw.heading !== null &&
        Number.isFinite(raw.heading)
          ? raw.heading
          : null,
      credibleAltitudeFeet,
    };
  }

  // 6. Compute coordinate displacement and implied speed
  const distMeters = calculateHaversineMeters(
    previous.lat,
    previous.lng,
    raw.lat,
    raw.lng
  );
  const distMiles = distMeters / 1609.344;
  const impliedCoordinateSpeedMph = (distMiles / dtSeconds) * 3600;

  // 7. Reject impossible teleportation / speed spikes
  if (impliedCoordinateSpeedMph > maxPlausibleSpeedMph) {
    return {
      isValidFix: false,
      acceptedForDistance: false,
      isOutageGap: false,
      validatedSpeedMph: 0,
      segmentDeltaMiles: 0,
      movingDeltaSeconds: 0,
      nextIsMoving: wasMoving,
      derivedHeading: previous.heading,
      credibleAltitudeFeet,
      rejectionReason: 'implausible_speed_spike',
    };
  }

  // Check acceleration plausibility if time step is short
  const prevSpeedMph = previous.validatedSpeedMph ?? 0;
  const accelMphPerSec = (impliedCoordinateSpeedMph - prevSpeedMph) / dtSeconds;
  if (dtSeconds <= 5 && accelMphPerSec > maxPlausibleAccelMphPerSec && impliedCoordinateSpeedMph > 18) {
    return {
      isValidFix: false,
      acceptedForDistance: false,
      isOutageGap: false,
      validatedSpeedMph: 0,
      segmentDeltaMiles: 0,
      movingDeltaSeconds: 0,
      nextIsMoving: wasMoving,
      derivedHeading: previous.heading,
      credibleAltitudeFeet,
      rejectionReason: 'implausible_acceleration_spike',
    };
  }

  // 8. Stationary noise & jitter gate
  // Random GPS wander within the horizontal accuracy circle must not accumulate distance.
  const combinedAccuracy = (accuracy + (previous.accuracy ?? accuracy)) / 2;
  const minMovementMeters = Math.max(2.5, combinedAccuracy * 0.45);
  const hasDopplerSpeed =
    raw.speedMps !== null && Number.isFinite(raw.speedMps) && raw.speedMps >= 0;
  const dopplerMph = hasDopplerSpeed ? mpsToMph(raw.speedMps!) : null;

  // If Doppler explicitly reports stationary (< 0.8 mph) or displacement is tiny jitter
  const isStationaryJitter =
    (dopplerMph !== null && dopplerMph < 0.8 && distMeters < Math.max(4.0, combinedAccuracy * 0.8)) ||
    (distMeters < minMovementMeters && (dopplerMph === null || dopplerMph < MOVING_START_THRESHOLD_MPH));

  if (isStationaryJitter) {
    return {
      isValidFix: true,
      acceptedForDistance: false,
      isOutageGap: false,
      validatedSpeedMph: 0,
      segmentDeltaMiles: 0,
      movingDeltaSeconds: 0,
      nextIsMoving: false,
      derivedHeading: null,
      credibleAltitudeFeet,
      rejectionReason: 'stationary_gps_jitter',
    };
  }

  // 9. Determine validated speed:
  // Prefer sensor Doppler speed when present, plausible, and consistent with coordinate displacement,
  // while ensuring segment peak speed is never less than the accepted segment's implied speed.
  let validatedSpeedMph = impliedCoordinateSpeedMph;
  if (
    dopplerMph !== null &&
    dopplerMph <= maxPlausibleSpeedMph &&
    Math.abs(dopplerMph - impliedCoordinateSpeedMph) <= (source === 'car_test' ? 18 : 12)
  ) {
    validatedSpeedMph = Math.max(dopplerMph, impliedCoordinateSpeedMph);
  }

  // 10. Apply hysteresis for moving state
  const nextIsMoving = wasMoving
    ? validatedSpeedMph >= MOVING_STOP_THRESHOLD_MPH
    : validatedSpeedMph >= MOVING_START_THRESHOLD_MPH;

  if (!nextIsMoving) {
    return {
      isValidFix: true,
      acceptedForDistance: false,
      isOutageGap: false,
      validatedSpeedMph: 0,
      segmentDeltaMiles: 0,
      movingDeltaSeconds: 0,
      nextIsMoving: false,
      derivedHeading: null,
      credibleAltitudeFeet,
      rejectionReason: 'below_moving_threshold',
    };
  }

  // 11. Validated moving segment
  const derivedHeading =
    raw.heading !== null && Number.isFinite(raw.heading)
      ? Math.round(((raw.heading % 360) + 360) % 360)
      : distMeters >= 2.0
      ? Math.round(calculateBearingDegrees(previous.lat, previous.lng, raw.lat, raw.lng))
      : previous.heading;

  // If transitioning from stationary after a multi-second silent gap where implied speed across the full
  // gap is much lower than current Doppler speed, only count the actual moving portion of the interval.
  const effectiveMovingDeltaSeconds =
    !wasMoving &&
    dtSeconds > 2 &&
    dopplerMph !== null &&
    dopplerMph > impliedCoordinateSpeedMph * 1.8 &&
    validatedSpeedMph > 0
      ? Math.min(dtSeconds, Math.max(1, Math.round((distMiles / validatedSpeedMph) * 3600)))
      : dtSeconds;

  return {
    isValidFix: true,
    acceptedForDistance: true,
    isOutageGap: false,
    validatedSpeedMph: Number(validatedSpeedMph.toFixed(2)),
    segmentDeltaMiles: distMiles,
    movingDeltaSeconds: effectiveMovingDeltaSeconds,
    nextIsMoving: true,
    derivedHeading,
    credibleAltitudeFeet,
  };
}

/**
 * Pure reducer that ingests a RawGpsFix into an ActiveRideSession and returns the updated session.
 */
export function ingestFixIntoSession(
  session: ActiveRideSession,
  rawFix: RawGpsFix
): { session: ActiveRideSession; lastValidation: FixValidationResult } {
  const nextQuality: GpsQualitySummary = {
    ...session.quality,
    totalRawFixes: session.quality.totalRawFixes + 1,
  };

  if (rawFix.accuracy !== null && Number.isFinite(rawFix.accuracy)) {
    const prevAvg = session.quality.averageAccuracyMeters;
    const prevCount = session.quality.totalRawFixes;
    nextQuality.averageAccuracyMeters =
      prevAvg === null
        ? Number(rawFix.accuracy.toFixed(1))
        : Number(((prevAvg * prevCount + rawFix.accuracy) / (prevCount + 1)).toFixed(1));
  }

  // If session is paused, do not accumulate distance, moving time, or route segments
  if (session.status === 'paused') {
    const pausedValidation: FixValidationResult = {
      isValidFix: true,
      acceptedForDistance: false,
      isOutageGap: false,
      validatedSpeedMph: 0,
      segmentDeltaMiles: 0,
      movingDeltaSeconds: 0,
      nextIsMoving: false,
      derivedHeading: null,
      credibleAltitudeFeet:
        rawFix.altitude !== null && Number.isFinite(rawFix.altitude)
          ? Math.round(rawFix.altitude * METERS_TO_FEET)
          : null,
      rejectionReason: 'session_paused',
    };
    return {
      session: {
        ...session,
        lastUpdatedAtMs: rawFix.timestamp,
        quality: nextQuality,
      },
      lastValidation: pausedValidation,
    };
  }

  const validation = validateBicycleGpsFix(
    rawFix,
    session.lastValidatedPoint,
    session.isCurrentlyMoving,
    session.source
  );

  if (validation.rejectionReason === 'low_gps_accuracy') {
    nextQuality.rejectedLowAccuracyCount += 1;
  } else if (
    validation.rejectionReason === 'implausible_speed_spike' ||
    validation.rejectionReason === 'implausible_acceleration_spike'
  ) {
    nextQuality.rejectedSpikeCount += 1;
  }

  if (!validation.isValidFix) {
    return {
      session: {
        ...session,
        quality: nextQuality,
      },
      lastValidation: validation,
    };
  }

  let nextSegmentIndex = session.currentSegmentIndex;
  if (validation.isOutageGap && session.points.length > 0) {
    nextSegmentIndex += 1;
    nextQuality.outageGapCount += 1;
  }

  if (!validation.acceptedForDistance) {
    // When stationary with a valid fix, advance the anchor timestamp (keeping lat/lng anchored to prevent drift walk)
    // so that when the bicycle starts moving again, dtSeconds only counts the actual movement interval, not stationary time.
    const shouldAdvanceStationaryTimestamp =
      session.lastValidatedPoint !== null &&
      (validation.rejectionReason === 'stationary_gps_jitter' ||
        validation.rejectionReason === 'below_moving_threshold');

    const updatedAnchorPoint: GpsPoint | null = shouldAdvanceStationaryTimestamp
      ? {
          ...session.lastValidatedPoint!,
          timestamp: rawFix.timestamp,
          validatedSpeedMph: 0,
          heading: null,
        }
      : session.lastValidatedPoint;

    return {
      session: {
        ...session,
        lastUpdatedAtMs: rawFix.timestamp,
        isCurrentlyMoving: validation.nextIsMoving,
        lastValidatedPoint: updatedAnchorPoint,
        quality: nextQuality,
      },
      lastValidation: validation,
    };
  }

  nextQuality.acceptedFixes += 1;

  const auditedPoint: GpsPoint = {
    ...rawFix,
    heading: validation.derivedHeading,
    validatedSpeedMph: validation.validatedSpeedMph,
    acceptedForDistance: true,
    segmentIndex: nextSegmentIndex,
  };

  const nextDistanceMiles = session.distanceMiles + validation.segmentDeltaMiles;
  const nextMovingSeconds = session.movingTimeSeconds + validation.movingDeltaSeconds;
  const nextMaxSpeedMph = Math.max(
    session.maxValidatedSpeedMph,
    validation.validatedSpeedMph
  );

  return {
    session: {
      ...session,
      lastUpdatedAtMs: rawFix.timestamp,
      distanceMiles: nextDistanceMiles,
      movingTimeSeconds: nextMovingSeconds,
      maxValidatedSpeedMph: nextMaxSpeedMph,
      currentSegmentIndex: nextSegmentIndex,
      isCurrentlyMoving: validation.nextIsMoving,
      lastValidatedPoint: auditedPoint,
      points: [...session.points, auditedPoint],
      quality: nextQuality,
    },
    lastValidation: validation,
  };
}

/**
 * Pauses an active ride session and increments segment index so resuming starts a new polyline segment.
 */
export function pauseRideSession(
  session: ActiveRideSession,
  nowMs = Date.now()
): ActiveRideSession {
  if (session.status === 'paused') return session;
  return {
    ...session,
    status: 'paused',
    pausedAtMs: nowMs,
    lastUpdatedAtMs: nowMs,
    isCurrentlyMoving: false,
  };
}

/**
 * Resumes a paused ride session, accounting for paused duration and starting a fresh segment index
 * so movement while paused never draws a straight line across the map.
 */
export function resumeRideSession(
  session: ActiveRideSession,
  nowMs = Date.now()
): ActiveRideSession {
  if (session.status !== 'paused') return session;
  const pauseDelta =
    session.pausedAtMs !== null && nowMs > session.pausedAtMs
      ? nowMs - session.pausedAtMs
      : 0;
  return {
    ...session,
    status: 'recording',
    pausedAtMs: null,
    totalPausedMs: session.totalPausedMs + pauseDelta,
    lastUpdatedAtMs: nowMs,
    currentSegmentIndex:
      session.points.length > 0
        ? session.currentSegmentIndex + 1
        : session.currentSegmentIndex,
    lastValidatedPoint: null, // Reset previous point reference so resume doesn't bridge across pause
    isCurrentlyMoving: false,
  };
}

/**
 * Finalizes an ActiveRideSession into a Completed SavedRide without inventing distance or averages.
 */
export function finalizeRideSession(
  session: ActiveRideSession,
  endedAtMs = Date.now(),
  customTitle?: string
): SavedRide {
  const effectiveEndMs = Math.max(endedAtMs, session.lastUpdatedAtMs, session.startedAtMs);
  const elapsedSeconds = calculateSessionElapsedSeconds(
    session.startedAtMs,
    effectiveEndMs,
    session.totalPausedMs,
    session.pausedAtMs
  );
  const movingSeconds = Math.min(
    elapsedSeconds,
    Math.round(session.movingTimeSeconds)
  );
  const exactDistanceMiles = Number(session.distanceMiles.toFixed(4));
  const { avgOverallSpeedMph, avgMovingSpeedMph } = calculateAverageSpeeds(
    exactDistanceMiles,
    elapsedSeconds,
    movingSeconds
  );

  // Compute max credible altitude from validated points, or null if none had credible altitude
  let maxAltitudeFeet: number | null = null;
  for (const pt of session.points) {
    if (pt.altitude !== null && Number.isFinite(pt.altitude)) {
      const ft = Math.round(pt.altitude * METERS_TO_FEET);
      if (maxAltitudeFeet === null || ft > maxAltitudeFeet) {
        maxAltitudeFeet = ft;
      }
    }
  }

  const riderName = RIDER_PROFILES[session.riderId]?.name ?? 'Rider';
  const dateStr = new Date(session.startedAtMs).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
  const defaultTitle =
    session.source === 'simulation'
      ? `[Demo Simulation] ${riderName} Bicycle Ride (${dateStr})`
      : session.source === 'car_test'
      ? `[Car Test · Camry] ${riderName} GPS Test (${dateStr})`
      : `${riderName}’s Bicycle Ride — ${dateStr}`;

  return {
    id: session.sessionId,
    riderId: session.riderId,
    source: session.source,
    title: customTitle ?? defaultTitle,
    startedAt: new Date(session.startedAtMs).toISOString(),
    endedAt: new Date(effectiveEndMs).toISOString(),
    elapsedSeconds,
    movingSeconds,
    distanceMiles: exactDistanceMiles,
    avgOverallSpeedMph,
    avgMovingSpeedMph,
    maxValidatedSpeedMph: Number(session.maxValidatedSpeedMph.toFixed(1)),
    maxAltitudeFeet,
    points: session.points,
    quality: session.quality,
  };
}

/**
 * Groups flat validated GpsPoint[] into disconnected polyline segments (<trkseg>) by segmentIndex.
 */
export function groupPointsIntoSegments(points: GpsPoint[]): GpsPoint[][] {
  if (points.length === 0) return [];
  const map = new Map<number, GpsPoint[]>();
  for (const pt of points) {
    const idx = pt.segmentIndex ?? 0;
    const list = map.get(idx);
    if (list) {
      list.push(pt);
    } else {
      map.set(idx, [pt]);
    }
  }
  return Array.from(map.values()).filter((seg) => seg.length > 0);
}

/**
 * Formats elapsed seconds into HH:MM:SS tabular string.
 */
export function formatElapsedTime(totalSeconds: number): string {
  const safeSecs = Math.max(
    0,
    Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0)
  );
  const hours = Math.floor(safeSecs / 3600);
  const minutes = Math.floor((safeSecs % 3600) / 60);
  const seconds = safeSecs % 60;
  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
  ].join(':');
}

/**
 * Generates standard GPX 1.1 XML string preserving multiple segments (<trkseg>), valid timestamps,
 * rider attribution, and data provenance (live vs simulation).
 */
export function exportRideToGpx(ride: SavedRide): string {
  const escapeXml = (str: string) =>
    str.replace(/[<>&'"]/g, (ch) => {
      switch (ch) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case "'": return '&apos;';
        case '"': return '&quot;';
        default: return ch;
      }
    });

  const segments = groupPointsIntoSegments(ride.points);
  const trksegsXml =
    segments.length === 0
      ? '    <trkseg></trkseg>'
      : segments
          .map((seg) => {
            const ptsXml = seg
              .map((pt) => {
                const eleTag =
                  pt.altitude !== null && Number.isFinite(pt.altitude)
                    ? `<ele>${pt.altitude.toFixed(1)}</ele>`
                    : '';
                const timeTag = `<time>${new Date(pt.timestamp).toISOString()}</time>`;
                return `      <trkpt lat="${pt.lat.toFixed(6)}" lon="${pt.lng.toFixed(6)}">${eleTag}${timeTag}</trkpt>`;
              })
              .join('\n');
            return `    <trkseg>\n${ptsXml}\n    </trkseg>`;
          })
          .join('\n');

  const riderName = RIDER_PROFILES[ride.riderId]?.name ?? ride.riderId;

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Family Bicycle Cockpit (${escapeXml(riderName)})" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(ride.title)}</name>
    <desc>Rider: ${escapeXml(riderName)} | Source: ${ride.source} | Distance: ${ride.distanceMiles.toFixed(2)} mi</desc>
    <time>${ride.startedAt}</time>
  </metadata>
  <trk>
    <name>${escapeXml(ride.title)}</name>
    <type>${ride.source === 'simulation' ? 'simulation' : ride.source === 'car_test' ? 'car_test' : 'cycling'}</type>
${trksegsXml}
  </trk>
</gpx>`;
}

/**
 * Computes aggregate family / rider statistics strictly from real ('live') bicycle rides.
 * Both 'car_test' (Camry road tests) and 'simulation' sessions are strictly excluded from bicycle totals.
 */
export function calculateRiderRealTotals(
  rides: SavedRide[],
  riderFilter: RiderId | 'all' = 'all'
): {
  completedRideCount: number;
  totalDistanceMiles: number;
  totalMovingSeconds: number;
  simulationRideCount: number;
  carTestRideCount: number;
} {
  let completedRideCount = 0;
  let totalDistanceMiles = 0;
  let totalMovingSeconds = 0;
  let simulationRideCount = 0;
  let carTestRideCount = 0;

  for (const r of rides) {
    if (riderFilter !== 'all' && r.riderId !== riderFilter) continue;
    if (r.source === 'simulation') {
      simulationRideCount += 1;
      continue;
    }
    if (r.source === 'car_test') {
      carTestRideCount += 1;
      continue;
    }
    completedRideCount += 1;
    totalDistanceMiles += Math.max(0, r.distanceMiles);
    totalMovingSeconds += Math.max(0, r.movingSeconds);
  }

  return {
    completedRideCount,
    totalDistanceMiles: Number(totalDistanceMiles.toFixed(2)),
    totalMovingSeconds,
    simulationRideCount,
    carTestRideCount,
  };
}
