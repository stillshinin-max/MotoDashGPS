import type { RawGpsFix } from './telemetry';

export interface SimRoutePreset {
  id: string;
  name: string;
  region: string;
  description: string;
  waypoints: Array<{
    lat: number;
    lng: number;
    targetSpeedMph: number;
    altitudeMeters: number;
  }>;
}

/**
 * Demonstration bicycle route presets used ONLY when the user explicitly selects
 * the "Demo Simulator" mode for indoor testing. Never mixed into real ride records.
 */
export const SIM_ROUTE_PRESETS: SimRoutePreset[] = [
  {
    id: 'park-loop-1mi',
    name: 'Neighborhood Park Path (12 MPH)',
    region: 'Demo Bicycle Loop',
    description: 'Steady neighborhood bicycle path cruise between 10 and 15 MPH.',
    waypoints: [
      { lat: 37.4220, lng: -122.0840, targetSpeedMph: 10.5, altitudeMeters: 18 },
      { lat: 37.4235, lng: -122.0840, targetSpeedMph: 12.2, altitudeMeters: 19 },
      { lat: 37.4250, lng: -122.0840, targetSpeedMph: 13.8, altitudeMeters: 21 },
      { lat: 37.4265, lng: -122.0840, targetSpeedMph: 14.5, altitudeMeters: 22 },
      { lat: 37.4280, lng: -122.0840, targetSpeedMph: 12.8, altitudeMeters: 20 },
      { lat: 37.4295, lng: -122.0840, targetSpeedMph: 11.4, altitudeMeters: 19 },
      { lat: 37.4310, lng: -122.0840, targetSpeedMph: 13.0, altitudeMeters: 18 },
      { lat: 37.4325, lng: -122.0840, targetSpeedMph: 14.2, altitudeMeters: 17 },
      { lat: 37.4340, lng: -122.0840, targetSpeedMph: 11.8, altitudeMeters: 18 },
      { lat: 37.4365, lng: -122.0840, targetSpeedMph: 10.2, altitudeMeters: 18 },
    ],
  },
  {
    id: 'greenway-trail',
    name: 'Riverside Greenway Trail (14 MPH)',
    region: 'Demo Bicycle Trail',
    description: 'Smooth multi-use family bicycle trail with gentle elevation changes.',
    waypoints: [
      { lat: 37.4220, lng: -122.0840, targetSpeedMph: 11.0, altitudeMeters: 15 },
      { lat: 37.4232, lng: -122.0825, targetSpeedMph: 13.5, altitudeMeters: 17 },
      { lat: 37.4245, lng: -122.0810, targetSpeedMph: 15.2, altitudeMeters: 20 },
      { lat: 37.4258, lng: -122.0795, targetSpeedMph: 16.0, altitudeMeters: 24 },
      { lat: 37.4270, lng: -122.0780, targetSpeedMph: 14.4, altitudeMeters: 26 },
      { lat: 37.4283, lng: -122.0765, targetSpeedMph: 12.6, altitudeMeters: 23 },
      { lat: 37.4296, lng: -122.0750, targetSpeedMph: 13.9, altitudeMeters: 19 },
    ],
  },
];

/**
 * Generates a physically consistent simulated bicycle GPS fix along a preset route.
 * Uses 25 sub-steps per waypoint segment so 1-second ticks move ~5–6 meters (~11–14 MPH),
 * matching the simulated Doppler speed without triggering teleportation spike rejection.
 */
export function getInterpolatedRoutePoint(
  preset: SimRoutePreset,
  stepIndex: number,
  nowMs = Date.now(),
  stepsPerSegment = 42
): RawGpsFix {
  const waypoints = preset.waypoints;
  const totalSegments = waypoints.length - 1;
  const totalSteps = totalSegments * stepsPerSegment;
  const cyclePos = stepIndex % (totalSteps * 2);
  const effectiveStep =
    cyclePos <= totalSteps ? cyclePos : totalSteps * 2 - cyclePos;

  const segIdx = Math.min(
    totalSegments - 1,
    Math.floor(effectiveStep / stepsPerSegment)
  );
  const t = (effectiveStep % stepsPerSegment) / stepsPerSegment;

  const start = waypoints[segIdx];
  const end = waypoints[segIdx + 1];

  const lat = start.lat + (end.lat - start.lat) * t;
  const lng = start.lng + (end.lng - start.lng) * t;
  const altitude =
    start.altitudeMeters + (end.altitudeMeters - start.altitudeMeters) * t;
  const speedMph =
    start.targetSpeedMph + (end.targetSpeedMph - start.targetSpeedMph) * t;

  return {
    lat,
    lng,
    altitude,
    altitudeAccuracy: 6,
    speedMps: speedMph / 2.23693629,
    heading: null,
    accuracy: 5,
    timestamp: nowMs,
  };
}
