/**
 * Offline-Resilient Leaflet TileLayer
 * 
 * Intercepts tile requests to:
 * 1. Serve cached tiles directly from Cache Storage ('family-bike-map-tiles-v1')
 *    with zero network latency and 100% offline reliability.
 * 2. Handle simulated offline mode & actual offline loss of signal.
 * 3. Gracefully render a high-contrast bicycle contour fallback tile
 *    instead of a broken image icon if a tile outside the pre-cached region is requested offline.
 */

import L from 'leaflet';
import {
  OFFLINE_MAP_CACHE_NAME,
  createOfflineFallbackTileSvg,
  getSimulatedOfflineMode,
} from './offlineMapManager';

export interface OfflineTileLayerOptions extends L.TileLayerOptions {
  isDarkTheme?: boolean;
}

export class OfflineResilientTileLayer extends L.TileLayer {
  private isDarkTheme: boolean;

  constructor(urlTemplate: string, options: OfflineTileLayerOptions = {}) {
    super(urlTemplate, options);
    this.isDarkTheme = options.isDarkTheme ?? true;
  }

  public setDarkTheme(isDark: boolean): void {
    this.isDarkTheme = isDark;
  }

  public createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const tile = document.createElement('img');
    tile.alt = '';
    tile.setAttribute('role', 'presentation');

    const url = this.getTileUrl(coords);
    const isSimulatedOffline = getSimulatedOfflineMode();
    const isActuallyOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const isOffline = isSimulatedOffline || isActuallyOffline;

    // Check Cache Storage first
    if (typeof caches !== 'undefined') {
      caches
        .open(OFFLINE_MAP_CACHE_NAME)
        .then((cache) => {
          cache
            .match(url)
            .then((cachedResponse) => {
              if (cachedResponse) {
                cachedResponse
                  .blob()
                  .then((blob) => {
                    const blobUrl = URL.createObjectURL(blob);
                    tile.onload = () => {
                      done(undefined, tile);
                    };
                    tile.onerror = () => {
                      URL.revokeObjectURL(blobUrl);
                      this.handleFallback(tile, coords.z, done);
                    };
                    tile.src = blobUrl;
                  })
                  .catch(() => {
                    if (isOffline) {
                      this.handleFallback(tile, coords.z, done);
                    } else {
                      this.loadStandard(tile, url, coords.z, done);
                    }
                  });
              } else {
                // Not found in cache
                if (isOffline) {
                  this.handleFallback(tile, coords.z, done);
                } else {
                  this.loadStandard(tile, url, coords.z, done);
                }
              }
            })
            .catch(() => {
              if (isOffline) {
                this.handleFallback(tile, coords.z, done);
              } else {
                this.loadStandard(tile, url, coords.z, done);
              }
            });
        })
        .catch(() => {
          if (isOffline) {
            this.handleFallback(tile, coords.z, done);
          } else {
            this.loadStandard(tile, url, coords.z, done);
          }
        });
    } else {
      if (isOffline) {
        this.handleFallback(tile, coords.z, done);
      } else {
        this.loadStandard(tile, url, coords.z, done);
      }
    }

    return tile;
  }

  private loadStandard(
    tile: HTMLImageElement,
    url: string,
    zoom: number,
    done: L.DoneCallback
  ): void {
    tile.onload = () => {
      done(undefined, tile);
    };
    tile.onerror = () => {
      this.handleFallback(tile, zoom, done);
    };
    tile.src = url;
  }

  private handleFallback(
    tile: HTMLImageElement,
    zoom: number,
    done: L.DoneCallback
  ): void {
    tile.src = createOfflineFallbackTileSvg(zoom, this.isDarkTheme);
    tile.onload = () => done(undefined, tile);
    tile.onerror = () => done(undefined, tile);
  }
}
