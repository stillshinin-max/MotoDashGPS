import type { ActiveRideSession, RiderId, SavedRide } from './telemetry';

const DB_NAME = 'family_bicycle_cockpit_db';
const DB_VERSION = 1;
const STORE_ACTIVE = 'active_session';
const STORE_RIDES = 'completed_rides';
const ACTIVE_KEY = 'current_active_ride';

const LS_ACTIVE_FALLBACK = 'family_bike_active_session_v2';
const LS_RIDES_FALLBACK = 'family_bike_completed_rides_v2';
const LS_PREFS_KEY = 'family_bike_preferences_v2';

export type MapLayerStyle = 'streets' | 'satellite' | 'cycle' | 'dark';
export type CockpitLayoutMode = 'split' | 'full_map' | 'gauges_only';

export interface CockpitPreferences {
  activeRiderId: RiderId;
  unit: 'mph' | 'kmh';
  isDark: boolean;
  mapLayerStyle?: MapLayerStyle;
  layoutMode?: CockpitLayoutMode;
  milestoneChimeEnabled?: boolean;
  is3DView?: boolean;
  headingUp?: boolean;
  pitchDegrees?: number;
  isImmersive?: boolean;
  themePreference?: 'auto' | 'dark' | 'light';
}

const DEFAULT_PREFS: CockpitPreferences = {
  activeRiderId: 'talha',
  unit: 'mph',
  isDark: true,
  themePreference: 'dark',
  mapLayerStyle: 'streets',
  layoutMode: 'split',
  milestoneChimeEnabled: true,
  is3DView: false,
  headingUp: true,
  pitchDegrees: 52,
  isImmersive: false,
};

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_ACTIVE)) {
          db.createObjectStore(STORE_ACTIVE);
        }
        if (!db.objectStoreNames.contains(STORE_RIDES)) {
          db.createObjectStore(STORE_RIDES, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Validates whether an arbitrary parsed object is a structurally sound SavedRide.
 */
export function isValidSavedRide(obj: unknown): obj is SavedRide {
  if (!obj || typeof obj !== 'object') return false;
  const r = obj as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    r.id.length > 0 &&
    (r.riderId === 'azlan' || r.riderId === 'talha' || r.riderId === 'eshal' || r.riderId === 'guest') &&
    (r.source === 'live' || r.source === 'car_test' || r.source === 'simulation') &&
    typeof r.title === 'string' &&
    typeof r.startedAt === 'string' &&
    typeof r.endedAt === 'string' &&
    typeof r.elapsedSeconds === 'number' &&
    Number.isFinite(r.elapsedSeconds) &&
    r.elapsedSeconds >= 0 &&
    typeof r.movingSeconds === 'number' &&
    Number.isFinite(r.movingSeconds) &&
    r.movingSeconds >= 0 &&
    typeof r.distanceMiles === 'number' &&
    Number.isFinite(r.distanceMiles) &&
    r.distanceMiles >= 0 &&
    typeof r.avgOverallSpeedMph === 'number' &&
    typeof r.avgMovingSpeedMph === 'number' &&
    typeof r.maxValidatedSpeedMph === 'number' &&
    Array.isArray(r.points)
  );
}

/**
 * Validates whether an arbitrary parsed object is a structurally sound ActiveRideSession.
 */
export function isValidActiveSession(obj: unknown): obj is ActiveRideSession {
  if (!obj || typeof obj !== 'object') return false;
  const s = obj as Record<string, unknown>;
  return (
    typeof s.sessionId === 'string' &&
    s.sessionId.length > 0 &&
    (s.riderId === 'azlan' || s.riderId === 'talha') &&
    (s.source === 'live' || s.source === 'car_test' || s.source === 'simulation') &&
    (s.status === 'recording' || s.status === 'paused') &&
    typeof s.startedAtMs === 'number' &&
    Number.isFinite(s.startedAtMs) &&
    typeof s.distanceMiles === 'number' &&
    Number.isFinite(s.distanceMiles) &&
    Array.isArray(s.points)
  );
}

/**
 * Persists an active session checkpoint to IndexedDB and localStorage fallback.
 * Returns { ok: true } or { ok: false, error: string } if quota is exceeded.
 */
export async function saveActiveSessionCheckpoint(
  session: ActiveRideSession
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_ACTIVE_FALLBACK, JSON.stringify(session));
    }
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Storage quota warning: ${err.message}`
          : 'Storage quota exceeded while checkpointing ride.',
    };
  }

  const db = await openDatabase();
  if (!db) return { ok: true };

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_ACTIVE, 'readwrite');
      const store = tx.objectStore(STORE_ACTIVE);
      store.put(session, ACTIVE_KEY);
      tx.oncomplete = () => resolve({ ok: true });
      tx.onerror = () =>
        resolve({
          ok: false,
          error: tx.error?.message ?? 'IndexedDB write failed during checkpoint.',
        });
    } catch (err) {
      resolve({
        ok: false,
        error: err instanceof Error ? err.message : 'IndexedDB checkpoint error.',
      });
    }
  });
}

/**
 * Loads any interrupted ActiveRideSession from IndexedDB or localStorage fallback.
 * Safely handles corrupt JSON without throwing.
 */
export async function loadActiveSessionCheckpoint(): Promise<ActiveRideSession | null> {
  const db = await openDatabase();
  if (db) {
    const idbResult = await new Promise<unknown>((resolve) => {
      try {
        const tx = db.transaction(STORE_ACTIVE, 'readonly');
        const req = tx.objectStore(STORE_ACTIVE).get(ACTIVE_KEY);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    if (isValidActiveSession(idbResult)) {
      return idbResult;
    }
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LS_ACTIVE_FALLBACK);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return isValidActiveSession(parsed) ? parsed : null;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Clears the active session checkpoint only when a ride is finalized or explicitly discarded.
 */
export async function clearActiveSessionCheckpoint(): Promise<void> {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LS_ACTIVE_FALLBACK);
    }
  } catch {
    // ignore
  }

  const db = await openDatabase();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_ACTIVE, 'readwrite');
      tx.objectStore(STORE_ACTIVE).delete(ACTIVE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

let forceSimulatedSaveFailure = false;

/**
 * Test helper to simulate storage quota/write failure during automated tests.
 */
export function setSimulatedStorageFailureForTests(fail: boolean): void {
  forceSimulatedSaveFailure = fail;
}

/**
 * Saves a completed ride, deduplicating by ride.id so unexpected reloads never create duplicate rides.
 * Only reports ok: true if durable persistence succeeded without error.
 */
export async function saveCompletedRideToStorage(
  ride: SavedRide
): Promise<{ ok: boolean; rides: SavedRide[]; error?: string }> {
  const existing = await loadCompletedRidesFromStorage();
  if (forceSimulatedSaveFailure) {
    return {
      ok: false,
      rides: existing,
      error: 'Simulated storage quota failure — active ride checkpoint preserved.',
    };
  }

  const deduplicated = [ride, ...existing.filter((r) => r.id !== ride.id)];

  let lsSaved = false;
  let idbSaved = false;
  let storageError: string | undefined;

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_RIDES_FALLBACK, JSON.stringify(deduplicated));
      lsSaved = true;
    }
  } catch (err) {
    storageError =
      err instanceof Error
        ? `Storage quota warning: ${err.message}`
        : 'Storage quota exceeded saving completed ride.';
  }

  const db = await openDatabase();
  if (db) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_RIDES, 'readwrite');
        tx.objectStore(STORE_RIDES).put(ride);
        tx.oncomplete = () => {
          idbSaved = true;
          resolve();
        };
        tx.onerror = () => {
          storageError = tx.error?.message ?? 'IndexedDB write error';
          resolve();
        };
      } catch (err) {
        storageError = err instanceof Error ? err.message : 'IndexedDB exception';
        resolve();
      }
    });
  }

  const durableSuccess = (lsSaved || idbSaved) && !storageError;
  if (!durableSuccess) {
    return {
      ok: false,
      rides: existing,
      error:
        storageError ??
        'Durable storage unavailable — completed ride could not be saved.',
    };
  }

  return { ok: true, rides: deduplicated };
}

/**
 * Loads all completed rides sorted newest-first, safely filtering out any corrupt records.
 * Starts empty (no fake demonstration rides mixed into real history).
 */
export async function loadCompletedRidesFromStorage(): Promise<SavedRide[]> {
  const db = await openDatabase();
  if (db) {
    const idbRides = await new Promise<unknown[]>((resolve) => {
      try {
        const tx = db.transaction(STORE_RIDES, 'readonly');
        const req = tx.objectStore(STORE_RIDES).getAll();
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
    const validIdb = idbRides.filter(isValidSavedRide);
    if (validIdb.length > 0) {
      return validIdb.sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );
    }
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LS_RIDES_FALLBACK);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(isValidSavedRide)
        .sort(
          (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
        );
    }
  } catch {
    return [];
  }
  return [];
}

/**
 * Reassigns the rider profile on a completed ride (e.g., if Talha rode with Azlan's profile selected).
 */
export async function reassignCompletedRideRider(
  rideId: string,
  newRiderId: RiderId
): Promise<SavedRide[]> {
  const rides = await loadCompletedRidesFromStorage();
  const updated = rides.map((r) =>
    r.id === rideId ? { ...r, riderId: newRiderId } : r
  );

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_RIDES_FALLBACK, JSON.stringify(updated));
    }
  } catch {
    // ignore
  }

  const target = updated.find((r) => r.id === rideId);
  const db = await openDatabase();
  if (db && target) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_RIDES, 'readwrite');
        tx.objectStore(STORE_RIDES).put(target);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  return updated;
}

/**
 * Reclassifies a saved ride between 'live' (Real Bicycle Ride) and 'car_test' (Camry GPS Test)
 * so accidental car test drives can be excluded from Azlan's or Talha's bicycle mileage totals.
 */
export async function reassignCompletedRideSource(
  rideId: string,
  newSource: 'live' | 'car_test'
): Promise<SavedRide[]> {
  const rides = await loadCompletedRidesFromStorage();
  const updated = rides.map((r) =>
    r.id === rideId ? { ...r, source: newSource } : r
  );

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_RIDES_FALLBACK, JSON.stringify(updated));
    }
  } catch {
    // ignore
  }

  const target = updated.find((r) => r.id === rideId);
  const db = await openDatabase();
  if (db && target) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_RIDES, 'readwrite');
        tx.objectStore(STORE_RIDES).put(target);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  return updated;
}

/**
 * Deletes a completed ride by ID.
 */
export async function deleteCompletedRideFromStorage(
  rideId: string
): Promise<SavedRide[]> {
  const rides = await loadCompletedRidesFromStorage();
  const remaining = rides.filter((r) => r.id !== rideId);

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_RIDES_FALLBACK, JSON.stringify(remaining));
    }
  } catch {
    // ignore
  }

  const db = await openDatabase();
  if (db) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_RIDES, 'readwrite');
        tx.objectStore(STORE_RIDES).delete(rideId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  return remaining;
}

/**
 * Validates and parses a JSON backup file (either a single SavedRide, an array of SavedRides, or a backup bundle).
 */
export function parseAndValidateBackupJson(rawJson: string): {
  ok: boolean;
  rides: SavedRide[];
  error?: string;
} {
  try {
    const parsed = JSON.parse(rawJson);
    let candidates: unknown[] = [];

    if (Array.isArray(parsed)) {
      candidates = parsed;
    } else if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      if (Array.isArray(obj.rides)) {
        candidates = obj.rides;
      } else if (isValidSavedRide(obj)) {
        candidates = [obj];
      }
    }

    const validRides = candidates.filter(isValidSavedRide);
    if (validRides.length === 0) {
      return {
        ok: false,
        rides: [],
        error: 'No valid bicycle ride records found in the provided JSON file.',
      };
    }

    return { ok: true, rides: validRides };
  } catch {
    return {
      ok: false,
      rides: [],
      error: 'Invalid or corrupt JSON file format.',
    };
  }
}

export function loadPreferences(): CockpitPreferences {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LS_PREFS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          (parsed.activeRiderId === 'azlan' || parsed.activeRiderId === 'talha') &&
          (parsed.unit === 'mph' || parsed.unit === 'kmh') &&
          typeof parsed.isDark === 'boolean'
        ) {
          const mapLayerStyle: MapLayerStyle =
            parsed.mapLayerStyle === 'satellite' ||
            parsed.mapLayerStyle === 'cycle' ||
            parsed.mapLayerStyle === 'dark' ||
            parsed.mapLayerStyle === 'streets'
              ? parsed.mapLayerStyle
              : 'streets';
          const layoutMode: CockpitLayoutMode =
            parsed.layoutMode === 'full_map' ||
            parsed.layoutMode === 'gauges_only' ||
            parsed.layoutMode === 'split'
              ? parsed.layoutMode
              : 'split';
          return {
            ...DEFAULT_PREFS,
            ...parsed,
            mapLayerStyle,
            layoutMode,
            milestoneChimeEnabled:
              typeof parsed.milestoneChimeEnabled === 'boolean'
                ? parsed.milestoneChimeEnabled
                : true,
          };
        }
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_PREFS;
}

export function savePreferences(prefs: CockpitPreferences): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_PREFS_KEY, JSON.stringify(prefs));
    }
  } catch {
    // ignore
  }
}
