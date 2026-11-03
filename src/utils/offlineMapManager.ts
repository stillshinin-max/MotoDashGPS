/**
 * Offline Maps & Tile Prerenderer for Family Bike GPS
 * 
 * Manages downloading and caching slippy map tiles for:
 * 1. Bike Trails (CyclOSM)
 * 2. Standard Streets (OpenStreetMap)
 * 3. Dark Navigation (OpenStreetMap with night filter)
 * 4. Satellite Aerial (Esri World Imagery)
 * 
 * Works 100% offline using standard browser Cache Storage ('family-bike-map-tiles-v1')
 * shared with the Service Worker.
 */

import type { MapLayerStyle } from './storage';

export const OFFLINE_MAP_CACHE_NAME = 'family-bike-map-tiles-v1';
export const OFFLINE_REGIONS_KEY = 'family_bike_offline_regions_v1';
export const SIMULATED_OFFLINE_KEY = 'family_bike_simulated_offline';

export interface OfflineRegionRecord {
  id: string;
  name: string;
  createdAt: string;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
  minZoom: number;
  maxZoom: number;
  layerStyles: MapLayerStyle[];
  totalTiles: number;
  approximateBytes: number;
}

export interface OfflineDownloadProgress {
  status: 'idle' | 'counting' | 'downloading' | 'completed' | 'cancelled' | 'error';
  totalTiles: number;
  completedTiles: number;
  cachedTilesSkipped: number;
  failedTiles: number;
  currentLayer: string;
  currentZoom: number;
  percent: number;
  bytesDownloaded: number;
  speedTilesPerSec: number;
  error?: string;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface TileCoordinate {
  x: number;
  y: number;
  z: number;
  layer: MapLayerStyle;
  url: string;
}

/**
 * Slippy map tile conversions (Web Mercator projection EPSG:3857)
 */
export function lon2tile(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

export function lat2tile(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
      Math.pow(2, zoom)
  );
}

export function tile2lon(x: number, zoom: number): number {
  return (x / Math.pow(2, zoom)) * 360 - 180;
}

export function tile2lat(y: number, zoom: number): number {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, zoom);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

/**
 * Calculates a bounding box around a center lat/lng coordinate given radius in kilometers
 */
export function calculateBoundingBox(
  lat: number,
  lng: number,
  radiusKm: number
): BoundingBox {
  // Approximate conversion: 1 deg lat ~ 110.574 km
  const latDelta = radiusKm / 110.574;
  // Longitude delta depends on latitude
  const lngDelta = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));

  return {
    minLat: Math.max(-85, lat - latDelta),
    maxLat: Math.min(85, lat + latDelta),
    minLng: Math.max(-180, lng - lngDelta),
    maxLng: Math.min(180, lng + lngDelta),
  };
}

/**
 * Generates the tile URL for a given coordinate and layer style
 */
export function getTileUrlForLayer(
  layer: MapLayerStyle,
  x: number,
  y: number,
  z: number
): string {
  switch (layer) {
    case 'cycle': {
      const subdomains = ['a', 'b', 'c'];
      const s = subdomains[Math.abs(x + y) % subdomains.length];
      return `https://${s}.tile-cyclosm.openstreetmap.fr/cyclosm/${z}/${x}/${y}.png`;
    }
    case 'satellite':
      return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
    case 'streets':
    case 'dark':
    default:
      // Dark navigation uses the exact same vector/raster tiles as OpenStreetMap standard,
      // inverted with CSS shaders on the canvas.
      return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  }
}

/**
 * Calculates all tile coordinates for a bounding box across zoom levels and requested layers
 */
export function calculateTileList(
  bbox: BoundingBox,
  minZoom: number,
  maxZoom: number,
  layers: MapLayerStyle[]
): TileCoordinate[] {
  const tiles: TileCoordinate[] = [];
  const uniqueKeys = new Set<string>();

  // Deduplicate layer urls (e.g. 'streets' and 'dark' share the same OSM tiles)
  const distinctLayers: MapLayerStyle[] = [];
  let osmIncluded = false;
  for (const lyr of layers) {
    if (lyr === 'streets' || lyr === 'dark') {
      if (!osmIncluded) {
        distinctLayers.push('streets');
        osmIncluded = true;
      }
    } else {
      distinctLayers.push(lyr);
    }
  }

  for (let z = minZoom; z <= maxZoom; z++) {
    const minX = Math.max(0, lon2tile(bbox.minLng, z));
    const maxX = Math.min(Math.pow(2, z) - 1, lon2tile(bbox.maxLng, z));
    const minY = Math.max(0, lat2tile(bbox.maxLat, z));
    const maxY = Math.min(Math.pow(2, z) - 1, lat2tile(bbox.minLat, z));

    for (let x = Math.min(minX, maxX); x <= Math.max(minX, maxX); x++) {
      for (let y = Math.min(minY, maxY); y <= Math.max(minY, maxY); y++) {
        for (const lyr of distinctLayers) {
          const url = getTileUrlForLayer(lyr, x, y, z);
          if (!uniqueKeys.has(url)) {
            uniqueKeys.add(url);
            tiles.push({ x, y, z, layer: lyr, url });
          }
        }
      }
    }
  }

  return tiles;
}

/**
 * Downloads and caches a region of map tiles with concurrency control and progress tracking
 */
export async function downloadOfflineArea(
  name: string,
  centerLat: number,
  centerLng: number,
  radiusKm: number,
  minZoom: number,
  maxZoom: number,
  layers: MapLayerStyle[],
  onProgress: (progress: OfflineDownloadProgress) => void,
  abortSignal?: AbortSignal
): Promise<OfflineRegionRecord> {
  const bbox = calculateBoundingBox(centerLat, centerLng, radiusKm);
  const tileList = calculateTileList(bbox, minZoom, maxZoom, layers);

  const totalTiles = tileList.length;
  let completedTiles = 0;
  let cachedTilesSkipped = 0;
  let failedTiles = 0;
  let bytesDownloaded = 0;
  const startTime = Date.now();

  onProgress({
    status: 'downloading',
    totalTiles,
    completedTiles: 0,
    cachedTilesSkipped: 0,
    failedTiles: 0,
    currentLayer: layers[0] || 'streets',
    currentZoom: minZoom,
    percent: 0,
    bytesDownloaded: 0,
    speedTilesPerSec: 0,
  });

  const cache = await caches.open(OFFLINE_MAP_CACHE_NAME);

  // Concurrency limit: 5 parallel requests to avoid browser resource limits and server throttle
  const CONCURRENCY = 5;
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < tileList.length) {
      if (abortSignal?.aborted) {
        throw new Error('Download cancelled by user');
      }

      const index = currentIndex++;
      const item = tileList[index];

      try {
        // First check if already cached
        const existing = await cache.match(item.url);
        if (existing) {
          cachedTilesSkipped++;
          completedTiles++;
        } else {
          // Fetch from network
          const response = await fetch(item.url, {
            signal: abortSignal,
            mode: 'cors',
            headers: {
              Accept: 'image/webp,image/png,image/*,*/*',
            },
          });

          if (response.ok || response.type === 'opaque') {
            const clone = response.clone();
            const blob = await response.blob();
            bytesDownloaded += blob.size;
            await cache.put(item.url, clone);
            completedTiles++;
          } else {
            failedTiles++;
          }
        }
      } catch (err: unknown) {
        if (abortSignal?.aborted) {
          throw err;
        }
        failedTiles++;
      }

      // Update progress every few items or on complete
      if (completedTiles % 4 === 0 || completedTiles === totalTiles) {
        const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
        const speed = Math.round(completedTiles / elapsedSec);
        const pct = Math.round((completedTiles / totalTiles) * 100);

        onProgress({
          status: completedTiles === totalTiles ? 'completed' : 'downloading',
          totalTiles,
          completedTiles,
          cachedTilesSkipped,
          failedTiles,
          currentLayer: item.layer,
          currentZoom: item.z,
          percent: Math.min(100, pct),
          bytesDownloaded,
          speedTilesPerSec: speed,
        });
      }

      // Brief throttle pause between fetches (12ms)
      await new Promise((r) => setTimeout(r, 12));
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, tileList.length) }, () =>
    worker()
  );

  try {
    await Promise.all(workers);
  } catch (err: unknown) {
    if (abortSignal?.aborted) {
      onProgress({
        status: 'cancelled',
        totalTiles,
        completedTiles,
        cachedTilesSkipped,
        failedTiles,
        currentLayer: 'cancelled',
        currentZoom: minZoom,
        percent: Math.round((completedTiles / totalTiles) * 100),
        bytesDownloaded,
        speedTilesPerSec: 0,
      });
      throw err;
    }
    throw err;
  }

  const record: OfflineRegionRecord = {
    id: `region_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || `Ride Area (${centerLat.toFixed(3)}°, ${centerLng.toFixed(3)}°)`,
    createdAt: new Date().toISOString(),
    centerLat,
    centerLng,
    radiusKm,
    minZoom,
    maxZoom,
    layerStyles: layers,
    totalTiles: completedTiles,
    approximateBytes: bytesDownloaded > 0 ? bytesDownloaded : completedTiles * 18500, // ~18.5 KB avg per tile
  };

  saveOfflineRegionRecord(record);

  onProgress({
    status: 'completed',
    totalTiles,
    completedTiles,
    cachedTilesSkipped,
    failedTiles,
    currentLayer: 'all',
    currentZoom: maxZoom,
    percent: 100,
    bytesDownloaded: record.approximateBytes,
    speedTilesPerSec: 0,
  });

  return record;
}

/**
 * Retrieves all saved offline regions from local storage
 */
export function getSavedOfflineRegions(): OfflineRegionRecord[] {
  try {
    const raw = localStorage.getItem(OFFLINE_REGIONS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * Saves a new offline region record
 */
export function saveOfflineRegionRecord(record: OfflineRegionRecord): void {
  try {
    const existing = getSavedOfflineRegions();
    const updated = [record, ...existing.filter((r) => r.id !== record.id)];
    localStorage.setItem(OFFLINE_REGIONS_KEY, JSON.stringify(updated));
  } catch {
    // LocalStorage full fallback
  }
}

/**
 * Deletes a saved offline region
 */
export function deleteOfflineRegion(id: string): void {
  try {
    const existing = getSavedOfflineRegions();
    const updated = existing.filter((r) => r.id !== id);
    localStorage.setItem(OFFLINE_REGIONS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore
  }
}

/**
 * Purges the entire offline tile cache from browser storage
 */
export async function clearAllOfflineTileCache(): Promise<void> {
  if (typeof caches !== 'undefined') {
    await caches.delete(OFFLINE_MAP_CACHE_NAME);
  }
  try {
    localStorage.removeItem(OFFLINE_REGIONS_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Calculates current offline cache storage stats
 */
export async function getOfflineCacheStats(): Promise<{
  totalEntries: number;
  estimatedBytes: number;
}> {
  if (typeof caches === 'undefined') {
    return { totalEntries: 0, estimatedBytes: 0 };
  }

  try {
    const cache = await caches.open(OFFLINE_MAP_CACHE_NAME);
    const keys = await cache.keys();
    const totalEntries = keys.length;
    // Estimate ~18.5 KB per cached map tile
    const estimatedBytes = totalEntries * 18500;
    return { totalEntries, estimatedBytes };
  } catch {
    return { totalEntries: 0, estimatedBytes: 0 };
  }
}

/**
 * Checks if a specific tile is already stored in the cache
 */
export async function isTileCached(url: string): Promise<boolean> {
  if (typeof caches === 'undefined') return false;
  try {
    const cache = await caches.open(OFFLINE_MAP_CACHE_NAME);
    const match = await cache.match(url);
    return !!match;
  } catch {
    return false;
  }
}

/**
 * Returns a local blob URL for a cached tile if available
 */
export async function getCachedTileBlobUrl(url: string): Promise<string | null> {
  if (typeof caches === 'undefined') return null;
  try {
    const cache = await caches.open(OFFLINE_MAP_CACHE_NAME);
    const match = await cache.match(url);
    if (match) {
      const blob = await match.blob();
      return URL.createObjectURL(blob);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Simulated Offline Mode: allows testing "No Signal / Airplane Mode" directly in browser
 */
export function getSimulatedOfflineMode(): boolean {
  try {
    return localStorage.getItem(SIMULATED_OFFLINE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setSimulatedOfflineMode(enabled: boolean): void {
  try {
    localStorage.setItem(SIMULATED_OFFLINE_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore
  }
}

/**
 * Generates an SVG data URL fallback tile when a tile is missing offline
 * (ensures clean dark/light topographic grid instead of broken image icon)
 */
export function createOfflineFallbackTileSvg(zoom: number, isDark: boolean): string {
  const bg = isDark ? '#0b1120' : '#f1f5f9';
  const gridLine = isDark ? '#1e293b' : '#e2e8f0';
  const textColor = isDark ? '#64748b' : '#94a3b8';
  const bikeColor = isDark ? '#38bdf8' : '#0284c7';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
    <rect width="256" height="256" fill="${bg}"/>
    <path d="M0 64h256M0 128h256M0 192h256M64 0v256M128 0v256M192 0v256" stroke="${gridLine}" stroke-width="1" stroke-dasharray="2,2"/>
    <rect x="0.5" y="0.5" width="255" height="255" fill="none" stroke="${gridLine}" stroke-width="1"/>
    <g transform="translate(128, 116)" opacity="0.35">
      <circle cx="-16" cy="6" r="10" fill="none" stroke="${bikeColor}" stroke-width="2.5"/>
      <circle cx="16" cy="6" r="10" fill="none" stroke="${bikeColor}" stroke-width="2.5"/>
      <path d="M-16 6 L-2 6 L8 -6 L-8 -6 Z" fill="none" stroke="${bikeColor}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M8 -6 L16 6" fill="none" stroke="${bikeColor}" stroke-width="2.5"/>
      <path d="M-8 -6 L-10 -14 L-4 -14" fill="none" stroke="${bikeColor}" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M8 -6 L10 -14 L4 -14" fill="none" stroke="${bikeColor}" stroke-width="2.5" stroke-linecap="round"/>
    </g>
    <text x="128" y="156" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="600" fill="${textColor}" text-anchor="middle" letter-spacing="0.5">OFFLINE MAP ZONE</text>
    <text x="128" y="172" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="9" fill="${textColor}" text-anchor="middle" opacity="0.8">Zoom Level ${zoom}</text>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
