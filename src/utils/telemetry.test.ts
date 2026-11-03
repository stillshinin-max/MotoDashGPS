import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAverageSpeeds,
  calculateBearingDegrees,
  calculateHaversineMiles,
  calculateRiderRealTotals,
  calculateSessionElapsedSeconds,
  createInitialRideSession,
  degreesToCardinal,
  evaluateGpsQuality,
  exportRideToGpx,
  finalizeRideSession,
  formatAltitudeDisplay,
  formatDistanceValue,
  formatElapsedTime,
  formatHeadingDisplay,
  formatSpeedValue,
  groupPointsIntoSegments,
  ingestFixIntoSession,
  mpsToMph,
  pauseRideSession,
  resumeRideSession,
  type RawGpsFix,
} from './telemetry';
import {
  clearActiveSessionCheckpoint,
  isValidSavedRide,
  loadActiveSessionCheckpoint,
  loadCompletedRidesFromStorage,
  parseAndValidateBackupJson,
  saveActiveSessionCheckpoint,
  saveCompletedRideToStorage,
  setSimulatedStorageFailureForTests,
} from './storage';

// Case 1: Stationary GPS noise does not accumulate significant false distance
test('Case 1: Stationary GPS noise within accuracy radius does not accumulate false distance', () => {
  let session = createInitialRideSession('azlan', 'live', 1000000);
  const baseLat = 37.4220;
  const baseLng = -122.0840;

  for (let i = 0; i < 30; i++) {
    // Random +/- 1.5 meter wobble with accuracy 10m and speed 0.2 m/s
    const jitterLat = baseLat + (i % 2 === 0 ? 0.00001 : -0.00001);
    const jitterLng = baseLng + (i % 3 === 0 ? 0.00001 : -0.00001);
    const fix: RawGpsFix = {
      lat: jitterLat,
      lng: jitterLng,
      altitude: 20,
      speedMps: 0.15,
      heading: null,
      accuracy: 10,
      timestamp: 1000000 + (i + 1) * 1000,
    };
    session = ingestFixIntoSession(session, fix).session;
  }

  assert.equal(session.distanceMiles, 0);
  assert.equal(session.movingTimeSeconds, 0);
});

// Case 2: A stationary ten-minute test does not create fictitious movement
test('Case 2: Stationary 10-minute (600s) test accumulates 0.00 miles and 0 moving seconds', () => {
  const startMs = 1700000000000;
  let session = createInitialRideSession('talha', 'live', startMs);
  for (let sec = 1; sec <= 600; sec++) {
    const wobble = Math.sin(sec) * 0.000012; // ~1.3m GPS drift
    const fix: RawGpsFix = {
      lat: 37.4220 + wobble,
      lng: -122.0840 - wobble,
      altitude: 25,
      speedMps: 0,
      heading: null,
      accuracy: 12,
      timestamp: startMs + sec * 1000,
    };
    session = ingestFixIntoSession(session, fix).session;
  }
  const completed = finalizeRideSession(session, startMs + 600 * 1000);
  assert.equal(completed.distanceMiles, 0);
  assert.equal(completed.movingSeconds, 0);
  assert.equal(completed.elapsedSeconds, 600);
  assert.equal(completed.avgOverallSpeedMph, 0);
});

// Case 3: A simulated one-mile route produces a mathematically correct distance within fixture tolerance
test('Case 3: Simulated 1.00-mile bicycle route produces mathematically accurate distance within 1% tolerance', () => {
  const startMs = 1700000000000;
  let session = createInitialRideSession('azlan', 'live', startMs);
  // 1 degree of latitude is ~69.093 miles -> 1.000 mile is 0.0144732 degrees latitude
  const totalDeltaLat = 0.0144732;
  const steps = 300; // 300 seconds (5 minutes at 12 MPH = 1.00 mile)

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const fix: RawGpsFix = {
      lat: 37.0 + totalDeltaLat * t,
      lng: -122.0,
      altitude: 30,
      speedMps: 12 / 2.23693629,
      heading: 0,
      accuracy: 5,
      timestamp: startMs + i * 1000,
    };
    session = ingestFixIntoSession(session, fix).session;
  }

  const completed = finalizeRideSession(session, startMs + steps * 1000);
  assert.ok(
    Math.abs(completed.distanceMiles - 1.0) <= 0.01,
    `Expected ~1.00 mi, got ${completed.distanceMiles}`
  );
});

// Case 4: Implausible GPS jumps are rejected and flagged
test('Case 4: Implausible GPS teleportation jumps (> 48 MPH) are rejected and counted in quality summary', () => {
  const startMs = 1700000000000;
  let session = createInitialRideSession('talha', 'live', startMs);

  // Valid initial fix
  session = ingestFixIntoSession(session, {
    lat: 37.4220,
    lng: -122.0840,
    altitude: 20,
    speedMps: 5,
    heading: 90,
    accuracy: 5,
    timestamp: startMs + 1000,
  }).session;

  // 1 second later, GPS teleports 0.5 miles away (~1800 MPH)
  const spikeResult = ingestFixIntoSession(session, {
    lat: 37.4295,
    lng: -122.0840,
    altitude: 20,
    speedMps: 5,
    heading: 90,
    accuracy: 5,
    timestamp: startMs + 2000,
  });

  assert.equal(spikeResult.lastValidation.isValidFix, false);
  assert.equal(spikeResult.lastValidation.rejectionReason, 'implausible_speed_spike');
  assert.equal(spikeResult.session.distanceMiles, 0);
  assert.equal(spikeResult.session.quality.rejectedSpikeCount, 1);
});

// Case 5: Speed values are accurate in MPH and KM/H
test('Case 5: Speed and distance conversions are accurate in MPH and KM/H', () => {
  assert.equal(Math.round(mpsToMph(5.36448)), 12); // 12 mph
  assert.equal(formatSpeedValue(12.0, 'mph'), '12');
  assert.equal(formatSpeedValue(12.0, 'kmh'), '19');
  assert.equal(formatSpeedValue(6.4, 'mph'), '6.4');
  assert.equal(formatDistanceValue(1.5, 'mph'), '1.50');
  assert.equal(formatDistanceValue(1.0, 'kmh'), '1.61');
});

// Case 6 & Case 7: Average overall speed includes stopped time; moving average speed excludes validated stops
test('Case 6 & 7: Average overall speed includes stopped time while moving average excludes stops', () => {
  // 5 miles traveled: 15 minutes moving (900s), 15 minutes stopped at traffic light (900s) -> 1800s elapsed
  const { avgOverallSpeedMph, avgMovingSpeedMph } = calculateAverageSpeeds(
    5.0,
    1800,
    900
  );
  assert.equal(avgOverallSpeedMph, 10.0); // 5 mi / 0.5 hr = 10 mph overall
  assert.equal(avgMovingSpeedMph, 20.0);  // 5 mi / 0.25 hr = 20 mph moving
});

// Case 7b: Stationary stop followed by restart does not overstate moving time
test('Case 7b: Stopping for 7 seconds then resuming movement for 1 second only adds 1s of moving time', () => {
  const startMs = 1700000000000;
  let session = createInitialRideSession('talha', 'live', startMs);

  // t=1s: First fix
  session = ingestFixIntoSession(session, {
    lat: 37.42200,
    lng: -122.08400,
    altitude: 20,
    speedMps: 5.0,
    heading: 0,
    accuracy: 4,
    timestamp: startMs + 1000,
  }).session;

  // t=2s: Moving 1 second north (~5.5m)
  session = ingestFixIntoSession(session, {
    lat: 37.42205,
    lng: -122.08400,
    altitude: 20,
    speedMps: 5.0,
    heading: 0,
    accuracy: 4,
    timestamp: startMs + 2000,
  }).session;
  assert.equal(session.movingTimeSeconds, 1);

  // t=3s..9s (7 seconds stationary at stop sign with tiny GPS jitter)
  for (let sec = 3; sec <= 9; sec++) {
    session = ingestFixIntoSession(session, {
      lat: 37.42205 + (sec % 2 === 0 ? 0.000005 : -0.000005),
      lng: -122.08400,
      altitude: 20,
      speedMps: 0.1,
      heading: null,
      accuracy: 5,
      timestamp: startMs + sec * 1000,
    }).session;
  }
  // Moving time must still be 1s after 7 seconds stationary
  assert.equal(session.movingTimeSeconds, 1);

  // t=10s: Bicycle resumes moving for 1 second (~5.5m north from stop position)
  session = ingestFixIntoSession(session, {
    lat: 37.42210,
    lng: -122.08400,
    altitude: 20,
    speedMps: 5.0,
    heading: 0,
    accuracy: 4,
    timestamp: startMs + 10000,
  }).session;

  // Moving time must be 2 seconds total (1s before stop + 1s after stop), NOT 9 seconds!
  assert.equal(session.movingTimeSeconds, 2);
});

// Case 8: GPS outage does not create false route segments or accumulate distance across the gap
test('Case 8: GPS outage (>15s gap) starts a new segment and does not bridge false distance', () => {
  const startMs = 1700000000000;
  let session = createInitialRideSession('azlan', 'live', startMs);

  // Fix 1
  session = ingestFixIntoSession(session, {
    lat: 37.4220,
    lng: -122.0840,
    altitude: 20,
    speedMps: 5,
    heading: 0,
    accuracy: 5,
    timestamp: startMs + 1000,
  }).session;

  // Fix 2 (normal 1s step)
  session = ingestFixIntoSession(session, {
    lat: 37.42205,
    lng: -122.0840,
    altitude: 20,
    speedMps: 5,
    heading: 0,
    accuracy: 5,
    timestamp: startMs + 2000,
  }).session;

  const distBeforeOutage = session.distanceMiles;

  // Fix 3 arrives 45 seconds later (outage gap) 300 meters away
  const postOutage = ingestFixIntoSession(session, {
    lat: 37.4250,
    lng: -122.0840,
    altitude: 20,
    speedMps: 5,
    heading: 0,
    accuracy: 5,
    timestamp: startMs + 47000,
  });

  assert.equal(postOutage.lastValidation.isOutageGap, true);
  assert.equal(postOutage.session.distanceMiles, distBeforeOutage);
  assert.equal(postOutage.session.currentSegmentIndex, 1);
  assert.equal(postOutage.session.quality.outageGapCount, 1);
  const segments = groupPointsIntoSegments(postOutage.session.points);
  assert.equal(segments.length, 2);
});

// Case 9: Pause and resume do not add phantom distance
test('Case 9: Pausing and resuming starts a new segment and ignores movement while paused', () => {
  const startMs = 1700000000000;
  let session = createInitialRideSession('talha', 'live', startMs);

  session = ingestFixIntoSession(session, {
    lat: 37.4220,
    lng: -122.0840,
    altitude: 20,
    speedMps: 5,
    heading: 0,
    accuracy: 5,
    timestamp: startMs + 1000,
  }).session;

  session = pauseRideSession(session, startMs + 2000);

  // Movement while paused must be ignored
  session = ingestFixIntoSession(session, {
    lat: 37.4250,
    lng: -122.0840,
    altitude: 20,
    speedMps: 6,
    heading: 0,
    accuracy: 5,
    timestamp: startMs + 10000,
  }).session;

  assert.equal(session.distanceMiles, 0);

  // Resume at a new location — must not bridge distance from pre-pause point
  session = resumeRideSession(session, startMs + 20000);
  session = ingestFixIntoSession(session, {
    lat: 37.4280,
    lng: -122.0840,
    altitude: 20,
    speedMps: 5,
    heading: 0,
    accuracy: 5,
    timestamp: startMs + 21000,
  }).session;

  assert.equal(session.distanceMiles, 0);
  assert.equal(session.currentSegmentIndex, 1);
});

// Case 10: Elapsed time survives application suspension or delayed callbacks
test('Case 10: Elapsed time is computed from actual timestamps rather than setInterval counts', () => {
  const startMs = 1700000000000;
  // 10 minutes later, with 2 minutes paused
  const elapsed = calculateSessionElapsedSeconds(
    startMs,
    startMs + 600_000,
    120_000,
    null
  );
  assert.equal(elapsed, 480);
  assert.equal(formatElapsedTime(elapsed), '00:08:00');
});

// Case 11: A zero-distance ride saves as zero distance (no Math.max(0.05, ...))
test('Case 11: A zero-distance ride saves as 0.00 mi without artificial minimum distance', () => {
  const startMs = 1700000000000;
  const session = createInitialRideSession('azlan', 'live', startMs);
  const completed = finalizeRideSession(session, startMs + 15000);
  assert.equal(completed.distanceMiles, 0);
  assert.equal(completed.avgOverallSpeedMph, 0);
  assert.equal(completed.avgMovingSpeedMph, 0);
  assert.equal(completed.maxValidatedSpeedMph, 0);
});

// Case 12: Missing altitude and heading remain unavailable, not invented
test('Case 12: Missing altitude and heading remain null/Unavailable rather than 1680 ft or 48°', () => {
  const startMs = 1700000000000;
  let session = createInitialRideSession('azlan', 'live', startMs);
  session = ingestFixIntoSession(session, {
    lat: 37.4220,
    lng: -122.0840,
    altitude: null,
    speedMps: 0,
    heading: null,
    accuracy: 8,
    timestamp: startMs + 1000,
  }).session;

  const completed = finalizeRideSession(session, startMs + 5000);
  assert.equal(completed.maxAltitudeFeet, null);
  assert.equal(formatAltitudeDisplay(completed.maxAltitudeFeet, 'mph'), 'Unavailable');
  assert.equal(formatHeadingDisplay(null), 'Unavailable');
});

// Case 13 & Case 14: Simulator and Car Test (Camry) sessions cannot contaminate live bicycle records, and rider records are separated
test('Case 13 & 14: Car Test (Camry) allows road speeds up to 95 MPH while excluding miles from Azlan/Talha bicycle totals', () => {
  const startMs = 1700000000000;

  // Verify a 60 MPH Camry step is accepted in 'car_test' mode (1s step moving ~26.82 meters north)
  let carSession = createInitialRideSession('azlan', 'car_test', startMs);
  carSession = ingestFixIntoSession(carSession, {
    lat: 37.42200,
    lng: -122.08400,
    altitude: 20,
    speedMps: 26.8224, // 60 MPH
    heading: 0,
    accuracy: 5,
    timestamp: startMs + 1000,
  }).session;
  const carStep = ingestFixIntoSession(carSession, {
    lat: 37.422241, // ~26.8m north (~60 MPH over 1s)
    lng: -122.08400,
    altitude: 20,
    speedMps: 26.8224,
    heading: 0,
    accuracy: 5,
    timestamp: startMs + 2000,
  });
  assert.equal(carStep.lastValidation.acceptedForDistance, true);
  assert.ok(carStep.lastValidation.validatedSpeedMph >= 58);

  const azlanLive = {
    ...finalizeRideSession(createInitialRideSession('azlan', 'live', startMs), startMs + 600000),
    distanceMiles: 3.25,
    movingSeconds: 500,
  };
  const azlanCarTest = {
    ...finalizeRideSession(carStep.session, startMs + 600000),
    distanceMiles: 14.8,
    movingSeconds: 900,
  };
  const azlanSim = {
    ...finalizeRideSession(createInitialRideSession('azlan', 'simulation', startMs), startMs + 600000),
    distanceMiles: 12.0,
    movingSeconds: 1800,
  };
  const talhaLive = {
    ...finalizeRideSession(createInitialRideSession('talha', 'live', startMs), startMs + 600000),
    distanceMiles: 8.5,
    movingSeconds: 1200,
  };

  assert.ok(azlanCarTest.title.includes('[Car Test · Camry]'));

  const allRides = [azlanLive, azlanCarTest, azlanSim, talhaLive];
  const azlanTotals = calculateRiderRealTotals(allRides, 'azlan');
  const talhaTotals = calculateRiderRealTotals(allRides, 'talha');

  // Azlan's bicycle totals must ONLY include his 3.25 mi bicycle ride — NOT the 14.8 mi Camry test or 12.0 mi simulation
  assert.equal(azlanTotals.completedRideCount, 1);
  assert.equal(azlanTotals.totalDistanceMiles, 3.25);
  assert.equal(azlanTotals.carTestRideCount, 1);
  assert.equal(azlanTotals.simulationRideCount, 1);

  assert.equal(talhaTotals.completedRideCount, 1);
  assert.equal(talhaTotals.totalDistanceMiles, 8.5);
  assert.equal(talhaTotals.carTestRideCount, 0);
  assert.equal(talhaTotals.simulationRideCount, 0);
});

// Case 15, 16, 17, 19 & 20: Storage failure safety, checkpoint recovery cycle, GPX/JSON exports, and corrupt data safety
test('Case 15, 16, 17, 19 & 20: Save failure preserves active checkpoint, recovery cycle works end-to-end, and exports/imports validate', async () => {
  if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, String(v));
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
        clear: () => store.clear(),
      },
      configurable: true,
    });
  }

  const startMs = 1700000000000;
  let session = createInitialRideSession('azlan', 'live', startMs);
  session = ingestFixIntoSession(session, {
    lat: 37.4220,
    lng: -122.0840,
    altitude: 18,
    speedMps: 5,
    heading: 45,
    accuracy: 6,
    timestamp: startMs + 1000,
  }).session;
  session = ingestFixIntoSession(session, {
    lat: 37.4225,
    lng: -122.0840,
    altitude: 19,
    speedMps: 5,
    heading: 0,
    accuracy: 5,
    timestamp: startMs + 11000,
  }).session;

  // Save active checkpoint and verify recovery load (Case 15)
  const checkpointRes = await saveActiveSessionCheckpoint(session);
  assert.equal(checkpointRes.ok, true);
  const recovered = await loadActiveSessionCheckpoint();
  assert.ok(recovered !== null, 'Expected active session checkpoint to be recoverable');
  assert.equal(recovered?.sessionId, session.sessionId);
  assert.equal(recovered?.points.length, 2);

  // Simulate storage failure when attempting to save completed ride (Finding 1)
  const completed = finalizeRideSession(recovered!, startMs + 15000);
  setSimulatedStorageFailureForTests(true);
  const failedSave = await saveCompletedRideToStorage(completed);
  assert.equal(failedSave.ok, false);
  assert.ok(failedSave.error && failedSave.error.length > 0);
  setSimulatedStorageFailureForTests(false);

  // Active checkpoint must still exist because clearActiveSessionCheckpoint was not called on failure
  const stillRecoverable = await loadActiveSessionCheckpoint();
  assert.ok(stillRecoverable !== null);
  assert.equal(stillRecoverable?.sessionId, session.sessionId);

  // Now perform a durable save and clear checkpoint
  const durableSave = await saveCompletedRideToStorage(completed);
  assert.equal(durableSave.ok, true);
  await clearActiveSessionCheckpoint();
  assert.equal(await loadActiveSessionCheckpoint(), null);

  const loadedRides = await loadCompletedRidesFromStorage();
  assert.ok(loadedRides.some((r) => r.id === completed.id));

  assert.equal(isValidSavedRide(completed), true);

  const gpx = exportRideToGpx(completed);
  assert.ok(gpx.includes('Rider: Azlan | Source: live'));
  assert.ok(gpx.includes('<trkseg>'));
  assert.ok(gpx.includes('lat="37.422000" lon="-122.084000"'));

  // Corrupt JSON import safety (Case 19)
  const corruptResult = parseAndValidateBackupJson('{not valid json');
  assert.equal(corruptResult.ok, false);

  const invalidSchemaResult = parseAndValidateBackupJson('[{"id": 123, "distanceMiles": -5}]');
  assert.equal(invalidSchemaResult.ok, false);

  const validBackupResult = parseAndValidateBackupJson(JSON.stringify([completed]));
  assert.equal(validBackupResult.ok, true);
  assert.equal(validBackupResult.rides.length, 1);

  // GPS quality states (Case 20)
  assert.equal(evaluateGpsQuality(null, startMs, false).label, 'Waiting for GPS');
  assert.equal(evaluateGpsQuality(null, startMs, true).label, 'GPS Unavailable');
  assert.ok(
    evaluateGpsQuality(
      {
        lat: 37.4,
        lng: -122.0,
        altitude: null,
        speedMps: 0,
        heading: null,
        accuracy: 65,
        timestamp: startMs,
      },
      startMs,
      false
    ).label.includes('Low GPS Accuracy')
  );
});

