# Family Bike GPS — Bicycle Cockpit & Ride Logger

A local-first, landscape-optimized bicycle GPS speedometer, live route map, and personal ride-recording application built for **Azlan** and **Talha**.

## Key Features

- **Live Bike GPS Mode by Default**: Uses the browser `navigator.geolocation.watchPosition` high-accuracy sensor with explicit permission and signal-readiness checks before starting a ride.
- **Car Test (Camry) Mode**: Allows testing real live GPS speed, map tracking, and ride logging in a car (up to 95 MPH) without adding those test miles to Azlan's or Talha's bicycle mileage totals. Saved rides can also be reclassified between **Bicycle Ride** and **Car Test (Camry)** inside the Ride Log.
- **Separate Rider Logs for Azlan & Talha**:
  - **Azlan (Child View)**: Focused speedometer (`MPH` or `KM/H`), elapsed time, moving time, trip distance, average speed, and Azlan's cumulative real bicycle miles.
  - **Talha (Detailed View)**: Adds moving average speed, maximum validated speed, GPS altitude (when credible), compass heading, and GPS accuracy diagnostics.
- **Validated Bicycle Telemetry**:
  - Rejects poor-accuracy fixes (`> 35m`), stale/non-monotonic timestamps, stationary GPS drift (`< 1.8 MPH` / within accuracy envelope), and implausible speed spikes (`> 48 MPH` or `> 6.5 m/s²` acceleration).
  - Stationary fixes advance the reference timestamp without drifting coordinates so stopping at intersections never inflates moving time when pedaling resumes.
  - Splits route polylines into separate `<trkseg>` segments across pauses or GPS signal outages (`> 15s`) so gaps are never bridged by false straight lines.
- **Durable Local Persistence & Crash Recovery**:
  - Incremental checkpoints are written to **IndexedDB** (`family_bicycle_cockpit_db`) with a `localStorage` fallback during active rides.
  - If the browser reloads or closes mid-ride, an **Unfinished Ride Found** banner offers **Resume Ride**, **Finish & Save Ride**, or **Discard**.
  - `Stop & Save` verifies durable storage before clearing the active session checkpoint, preventing ride loss if storage is unavailable.
- **Zero Cloud or AI Dependencies**: Works without any AI API keys, accounts, or paid map subscriptions. Exports standard **GPX 1.1** tracks and validated **JSON** backups.

## Local Development & Verification

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run automated telemetry & persistence unit tests**:
   ```bash
   npm test
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in Chrome or on an Android phone on the same network.

4. **Build for production / Android PWA**:
   ```bash
   npm run build
   ```
   To install on Azlan's or Talha's Android phone, open the hosted HTTPS URL in Chrome for Android and tap **Install Cockpit** (or **Add to Home screen**).
