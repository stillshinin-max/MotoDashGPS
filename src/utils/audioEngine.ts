/**
 * Audio Engine for Bicycle Cockpit
 * Provides:
 * 1. Web Audio API synthesized cadence beats (100% offline, zero external downloads)
 * 2. Realistic dual-resonance bicycle bell chime for mile milestones
 * 3. User custom MP3/audio track IndexedDB storage
 * 4. Lock-screen & Bluetooth remote control via navigator.mediaSession
 */

export interface TrackItem {
  id: string;
  title: string;
  artist: string;
  bpm?: number;
  durationSeconds: number;
  type: 'synth' | 'local';
  blob?: Blob;
  category?: 'cadence' | 'custom';
}

export const BUILTIN_TRACKS: TrackItem[] = [
  {
    id: 'track-cadence-cruiser',
    title: 'Cadence Cruiser',
    artist: 'Family Bike Beats',
    bpm: 90,
    durationSeconds: 180,
    type: 'synth',
    category: 'cadence',
  },
  {
    id: 'track-trail-velocity',
    title: 'Trail Velocity',
    artist: 'Pacer Rhythm',
    bpm: 115,
    durationSeconds: 210,
    type: 'synth',
    category: 'cadence',
  },
  {
    id: 'track-sprint-sunset',
    title: 'Sunset Sprint Synth',
    artist: 'Velo Groove',
    bpm: 128,
    durationSeconds: 195,
    type: 'synth',
    category: 'cadence',
  },
  {
    id: 'track-park-stroll',
    title: 'Sunday Park Stroll',
    artist: 'Chill Cadence',
    bpm: 80,
    durationSeconds: 240,
    type: 'synth',
    category: 'cadence',
  },
];

class AudioEngine {
  private ctx: AudioContext | null = null;
  private currentTrack: TrackItem | null = null;
  private isPlaying = false;
  private volume = 0.8;
  private gainNode: GainNode | null = null;
  private timerId: number | null = null;
  private step = 0;
  private localAudioElement: HTMLAudioElement | null = null;
  private currentTime = 0;
  private onTimeUpdateCallback: ((time: number, duration: number) => void) | null = null;
  private onStateChangeCallback: ((isPlaying: boolean, track: TrackItem | null) => void) | null = null;

  private getAudioContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (!this.gainNode) {
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.gainNode.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
    if (this.localAudioElement) {
      this.localAudioElement.volume = this.volume;
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setTimeUpdateCallback(cb: (time: number, duration: number) => void) {
    this.onTimeUpdateCallback = cb;
  }

  public setStateChangeCallback(cb: (isPlaying: boolean, track: TrackItem | null) => void) {
    this.onStateChangeCallback = cb;
  }

  /**
   * Dual-harmonic metallic bicycle bell chime ("Ding-Ding!")
   */
  public playBicycleBell(doubleDing = true) {
    try {
      const ctx = this.getAudioContext();
      const strike = (delayMs: number) => {
        setTimeout(() => {
          if (!this.ctx) return;
          const now = this.ctx.currentTime;
          const freqs = [2048, 3072, 4096];
          freqs.forEach((freq, idx) => {
            const osc = this.ctx!.createOscillator();
            const gain = this.ctx!.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);

            const initialGain = (0.28 / (idx + 1)) * this.volume;
            gain.gain.setValueAtTime(initialGain, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + (idx === 0 ? 0.9 : 0.6));

            osc.connect(gain);
            gain.connect(this.ctx!.destination);

            osc.start(now);
            osc.stop(now + 1.0);
          });
        }, delayMs);
      };

      strike(0);
      if (doubleDing) {
        strike(140);
      }
    } catch {
      // Audio context might be restricted before user gesture
    }
  }

  /**
   * Synthesize rhythmic cadence riding beats with bass drum, snare, hi-hats, bassline and melodic arpeggio
   */
  private scheduleSynthBeat() {
    if (!this.isPlaying || !this.currentTrack || this.currentTrack.type !== 'synth') {
      return;
    }

    const ctx = this.getAudioContext();
    const bpm = this.currentTrack.bpm ?? 100;
    const sixteenthSec = 60 / bpm / 4;
    const now = ctx.currentTime;

    const barStep = this.step % 16;
    const chordIndex = Math.floor((this.step / 16) % 4);

    // Chords progression (Em, C, G, D) in Hz
    const chords = [
      [164.81, 196.00, 246.94, 329.63], // Em
      [130.81, 164.81, 196.00, 261.63], // C
      [196.00, 246.94, 293.66, 392.00], // G
      [146.83, 185.00, 220.00, 293.66], // D
    ];
    const currentChord = chords[chordIndex];

    // 1. Kick Drum on beats 0, 4, 8, 12
    if (barStep === 0 || barStep === 4 || barStep === 8 || barStep === 12) {
      const kickOsc = ctx.createOscillator();
      const kickGain = ctx.createGain();
      kickOsc.frequency.setValueAtTime(140, now);
      kickOsc.frequency.exponentialRampToValueAtTime(38, now + 0.12);
      kickGain.gain.setValueAtTime(0.7 * this.volume, now);
      kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      kickOsc.connect(kickGain);
      if (this.gainNode) kickGain.connect(this.gainNode);
      kickOsc.start(now);
      kickOsc.stop(now + 0.2);
    }

    // 2. Snare / Clap on beats 4, 12
    if (barStep === 4 || barStep === 12) {
      const snareOsc = ctx.createOscillator();
      const snareGain = ctx.createGain();
      snareOsc.type = 'triangle';
      snareOsc.frequency.setValueAtTime(220, now);
      snareGain.gain.setValueAtTime(0.3 * this.volume, now);
      snareGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      snareOsc.connect(snareGain);
      if (this.gainNode) snareGain.connect(this.gainNode);
      snareOsc.start(now);
      snareOsc.stop(now + 0.15);
    }

    // 3. Hi-Hat on every other 16th
    if (barStep % 2 === 0) {
      const hatOsc = ctx.createOscillator();
      const hatGain = ctx.createGain();
      hatOsc.type = 'sine';
      hatOsc.frequency.setValueAtTime(8000 + (barStep % 4 === 2 ? 1500 : 0), now);
      hatGain.gain.setValueAtTime((barStep % 4 === 2 ? 0.15 : 0.08) * this.volume, now);
      hatGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
      hatOsc.connect(hatGain);
      if (this.gainNode) hatGain.connect(this.gainNode);
      hatOsc.start(now);
      hatOsc.stop(now + 0.05);
    }

    // 4. Bassline (Syncopated)
    if (barStep === 0 || barStep === 3 || barStep === 6 || barStep === 10 || barStep === 14) {
      const bassOsc = ctx.createOscillator();
      const bassGain = ctx.createGain();
      bassOsc.type = 'sawtooth';
      const rootFreq = currentChord[0] / 2;
      bassOsc.frequency.setValueAtTime(rootFreq, now);
      bassGain.gain.setValueAtTime(0.35 * this.volume, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + sixteenthSec * 1.5);
      bassOsc.connect(bassGain);
      if (this.gainNode) bassGain.connect(this.gainNode);
      bassOsc.start(now);
      bassOsc.stop(now + sixteenthSec * 1.6);
    }

    // 5. Melodic Cadence Arpeggio
    const arpFreq = currentChord[barStep % currentChord.length];
    const arpOsc = ctx.createOscillator();
    const arpGain = ctx.createGain();
    arpOsc.type = 'sine';
    arpOsc.frequency.setValueAtTime(arpFreq, now);
    arpGain.gain.setValueAtTime(0.18 * this.volume, now);
    arpGain.gain.exponentialRampToValueAtTime(0.0001, now + sixteenthSec * 1.2);
    arpOsc.connect(arpGain);
    if (this.gainNode) arpGain.connect(this.gainNode);
    arpOsc.start(now);
    arpOsc.stop(now + sixteenthSec * 1.3);

    this.step++;
    this.currentTime += sixteenthSec;
    if (this.currentTime >= (this.currentTrack.durationSeconds || 180)) {
      this.currentTime = 0; // loop
      this.step = 0;
    }

    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(this.currentTime, this.currentTrack.durationSeconds || 180);
    }

    this.timerId = window.setTimeout(() => {
      this.scheduleSynthBeat();
    }, sixteenthSec * 1000);
  }

  public playTrack(track: TrackItem) {
    this.stop();
    this.currentTrack = track;
    this.isPlaying = true;
    this.currentTime = 0;
    this.step = 0;

    this.updateMediaSession(track);

    if (track.type === 'synth') {
      this.getAudioContext();
      this.scheduleSynthBeat();
    } else if (track.type === 'local' && track.blob) {
      const url = URL.createObjectURL(track.blob);
      const audio = new Audio(url);
      audio.volume = this.volume;
      audio.ontimeupdate = () => {
        this.currentTime = audio.currentTime;
        if (this.onTimeUpdateCallback) {
          this.onTimeUpdateCallback(audio.currentTime, audio.duration || track.durationSeconds || 0);
        }
      };
      audio.onended = () => {
        this.isPlaying = false;
        if (this.onStateChangeCallback) {
          this.onStateChangeCallback(false, this.currentTrack);
        }
      };
      audio.play().catch(() => {
        // play interrupted
      });
      this.localAudioElement = audio;
    }

    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(true, this.currentTrack);
    }
  }

  public resume() {
    if (!this.currentTrack) {
      this.playTrack(BUILTIN_TRACKS[0]);
      return;
    }
    this.isPlaying = true;
    if (this.currentTrack.type === 'synth') {
      this.getAudioContext();
      this.scheduleSynthBeat();
    } else if (this.localAudioElement) {
      this.localAudioElement.play().catch(() => {});
    }
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(true, this.currentTrack);
    }
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'playing';
    }
  }

  public pause() {
    this.isPlaying = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (this.localAudioElement) {
      this.localAudioElement.pause();
    }
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(false, this.currentTrack);
    }
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'paused';
    }
  }

  public stop() {
    this.isPlaying = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (this.localAudioElement) {
      this.localAudioElement.pause();
      this.localAudioElement.src = '';
      this.localAudioElement = null;
    }
    this.currentTime = 0;
    this.step = 0;
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(false, this.currentTrack);
    }
  }

  public getCurrentTrack(): TrackItem | null {
    return this.currentTrack;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getCurrentTime(): number {
    return this.currentTime;
  }

  /**
   * System Lock-Screen & Bluetooth Headset controls
   */
  private updateMediaSession(track: TrackItem) {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: 'Bicycle Cockpit Ride Mix',
        artwork: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      });
      navigator.mediaSession.playbackState = 'playing';

      navigator.mediaSession.setActionHandler('play', () => this.resume());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('seekbackward', () => {
        this.currentTime = Math.max(0, this.currentTime - 10);
      });
      navigator.mediaSession.setActionHandler('seekforward', () => {
        this.currentTime += 10;
      });
    } catch {
      // mediaSession error handled gracefully
    }
  }
}

export const bikeAudioEngine = new AudioEngine();

// ================= IndexedDB Storage for User's Custom Audio Tracks =================
const MUSIC_DB_NAME = 'family_bike_music_db';
const MUSIC_STORE_NAME = 'custom_tracks';

function openMusicDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(MUSIC_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(MUSIC_STORE_NAME)) {
        db.createObjectStore(MUSIC_STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveCustomAudioTrack(file: File): Promise<TrackItem> {
  const db = await openMusicDb();
  const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const title = file.name.replace(/\.[^/.]+$/, '');
  const track: TrackItem = {
    id,
    title,
    artist: 'My Bike Playlist',
    durationSeconds: 180,
    type: 'local',
    blob: file,
    category: 'custom',
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(MUSIC_STORE_NAME, 'readwrite');
    const store = tx.objectStore(MUSIC_STORE_NAME);
    const itemToStore = {
      id: track.id,
      title: track.title,
      artist: track.artist,
      durationSeconds: track.durationSeconds,
      blob: file,
    };
    const req = store.put(itemToStore);
    req.onsuccess = () => resolve(track);
    req.onerror = () => reject(req.error);
  });
}

export async function loadCustomAudioTracks(): Promise<TrackItem[]> {
  try {
    const db = await openMusicDb();
    return new Promise((resolve) => {
      const tx = db.transaction(MUSIC_STORE_NAME, 'readonly');
      const store = tx.objectStore(MUSIC_STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const results = (req.result || []).map((item) => ({
          id: item.id,
          title: item.title,
          artist: item.artist,
          durationSeconds: item.durationSeconds || 180,
          type: 'local' as const,
          blob: item.blob as Blob,
          category: 'custom' as const,
        }));
        resolve(results);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function deleteCustomAudioTrack(id: string): Promise<void> {
  try {
    const db = await openMusicDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(MUSIC_STORE_NAME, 'readwrite');
      const store = tx.objectStore(MUSIC_STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // ignore
  }
}
