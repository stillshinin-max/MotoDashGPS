import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  lon2tile,
  lat2tile,
  tile2lon,
  tile2lat,
  calculateBoundingBox,
  calculateTileList,
  getTileUrlForLayer,
  createOfflineFallbackTileSvg,
} from './offlineMapManager';

describe('Offline Map Manager & Tile Math', () => {
  it('converts longitude and latitude to correct slippy tile coordinates', () => {
    // Dallas / Plano TX area: Lat ~33.003, Lng ~-96.672 at Zoom 15
    const z = 15;
    const x = lon2tile(-96.672, z);
    const y = lat2tile(33.003, z);

    assert.equal(typeof x, 'number');
    assert.equal(typeof y, 'number');
    assert.ok(x > 0 && x < Math.pow(2, z), `x was ${x}`);
    assert.ok(y > 0 && y < Math.pow(2, z), `y was ${y}`);

    // Verify reverse tile to lon/lat is close
    const reconstructedLon = tile2lon(x, z);
    const reconstructedLat = tile2lat(y, z);
    assert.ok(Math.abs(reconstructedLon - -96.672) < 0.05);
    assert.ok(Math.abs(reconstructedLat - 33.003) < 0.05);
  });

  it('calculates bounding box from center coordinate and radius in km', () => {
    const centerLat = 33.003;
    const centerLng = -96.672;
    const radiusKm = 3.5;

    const bbox = calculateBoundingBox(centerLat, centerLng, radiusKm);
    assert.ok(bbox.minLat < centerLat);
    assert.ok(bbox.maxLat > centerLat);
    assert.ok(bbox.minLng < centerLng);
    assert.ok(bbox.maxLng > centerLng);

    // Delta should be reasonable (~3.5 km ~ 0.031 degrees lat)
    const latDelta = bbox.maxLat - centerLat;
    assert.ok(latDelta > 0.02 && latDelta < 0.05, `latDelta was ${latDelta}`);
  });

  it('generates tile tasks for requested layers without redundant duplicates', () => {
    const bbox = calculateBoundingBox(33.003, -96.672, 1.0);
    // Request both 'streets' and 'dark' along with 'cycle' and 'satellite'
    const tiles = calculateTileList(bbox, 14, 15, ['streets', 'dark', 'cycle', 'satellite']);

    assert.ok(tiles.length > 0, 'Tiles array should not be empty');

    // Check unique URLs
    const urls = new Set(tiles.map((t) => t.url));
    assert.equal(urls.size, tiles.length, 'Every tile URL should be unique');

    // Because 'dark' and 'streets' share the same OpenStreetMap tiles, they should be deduplicated
    const osmTiles = tiles.filter((t) => t.url.includes('openstreetmap.org'));
    const cyclOsmTiles = tiles.filter((t) => t.url.includes('tile-cyclosm'));
    const esriTiles = tiles.filter((t) => t.url.includes('arcgisonline.com'));

    assert.ok(osmTiles.length > 0, 'OSM tiles present');
    assert.ok(cyclOsmTiles.length > 0, 'CyclOSM tiles present');
    assert.ok(esriTiles.length > 0, 'Esri satellite tiles present');
  });

  it('generates valid URLs for all layer styles', () => {
    const cycleUrl = getTileUrlForLayer('cycle', 10, 20, 5);
    const streetsUrl = getTileUrlForLayer('streets', 10, 20, 5);
    const darkUrl = getTileUrlForLayer('dark', 10, 20, 5);
    const satUrl = getTileUrlForLayer('satellite', 10, 20, 5);

    assert.ok(cycleUrl.includes('cyclosm.openstreetmap.fr'));
    assert.ok(streetsUrl.includes('tile.openstreetmap.org'));
    assert.ok(darkUrl.includes('tile.openstreetmap.org'));
    assert.ok(satUrl.includes('arcgisonline.com'));
  });

  it('generates an SVG fallback tile data URL for missing offline tiles', () => {
    const fallbackSvg = createOfflineFallbackTileSvg(15, true);
    assert.ok(fallbackSvg.startsWith('data:image/svg+xml;charset=utf-8,'));
    assert.ok(fallbackSvg.includes('OFFLINE%20MAP%20ZONE'));
    assert.ok(fallbackSvg.includes('Zoom%20Level%2015'));
  });
});
