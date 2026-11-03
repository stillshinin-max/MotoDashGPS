import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Volume1,
  Music,
  Bell,
  Upload,
  Trash2,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  X,
  Disc3,
  Sliders,
  Headphones,
  Radio,
} from 'lucide-react';
import {
  bikeAudioEngine,
  BUILTIN_TRACKS,
  loadCustomAudioTracks,
  saveCustomAudioTrack,
  deleteCustomAudioTrack,
  type TrackItem,
} from '../utils/audioEngine';

interface CockpitMusicPlayerProps {
  isDark: boolean;
  unit: 'mph' | 'kmh';
  milestoneChimeEnabled: boolean;
  onToggleMilestoneChime: (enabled: boolean) => void;
}

export const CockpitMusicPlayer: React.FC<CockpitMusicPlayerProps> = ({
  isDark,
  unit,
  milestoneChimeEnabled,
  onToggleMilestoneChime,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTrack, setCurrentTrack] = useState<TrackItem | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(180);
  const [volume, setVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'cadence' | 'custom' | 'streaming' | 'settings'>('cadence');
  const [customTracks, setCustomTracks] = useState<TrackItem[]>([]);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);
  const [showSpotifyEmbed, setShowSpotifyEmbed] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Combine built-in cadence tracks + user custom tracks
  const allTracks = [...BUILTIN_TRACKS, ...customTracks];

  // Initialize and bind audio engine callbacks
  useEffect(() => {
    bikeAudioEngine.setStateChangeCallback((playing, track) => {
      setIsPlaying(playing);
      setCurrentTrack(track);
    });

    bikeAudioEngine.setTimeUpdateCallback((time, dur) => {
      setCurrentTime(time);
      if (dur > 0) setDuration(dur);
    });

    // Load custom tracks from IndexedDB
    loadCustomAudioTracks().then((tracks) => {
      setCustomTracks(tracks);
    });

    // Set initial track if none
    if (!bikeAudioEngine.getCurrentTrack() && BUILTIN_TRACKS.length > 0) {
      setCurrentTrack(BUILTIN_TRACKS[0]);
    }
  }, []);

  const handlePlayPause = () => {
    if (isPlaying) {
      bikeAudioEngine.pause();
    } else {
      if (!currentTrack && allTracks.length > 0) {
        bikeAudioEngine.playTrack(allTracks[0]);
      } else {
        bikeAudioEngine.resume();
      }
    }
  };

  const handleSelectTrack = (track: TrackItem) => {
    bikeAudioEngine.playTrack(track);
  };

  const handleNext = () => {
    if (allTracks.length === 0) return;
    const currentIndex = allTracks.findIndex((t) => t.id === currentTrack?.id);
    const nextIndex = (currentIndex + 1) % allTracks.length;
    bikeAudioEngine.playTrack(allTracks[nextIndex]);
  };

  const handlePrevious = () => {
    if (allTracks.length === 0) return;
    const currentIndex = allTracks.findIndex((t) => t.id === currentTrack?.id);
    const prevIndex = (currentIndex - 1 + allTracks.length) % allTracks.length;
    bikeAudioEngine.playTrack(allTracks[prevIndex]);
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    setIsMuted(newVol === 0);
    bikeAudioEngine.setVolume(newVol);
  };

  const handleToggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      bikeAudioEngine.setVolume(volume > 0 ? volume : 0.8);
    } else {
      setIsMuted(true);
      bikeAudioEngine.setVolume(0);
    }
  };

  const handleRingBikeBell = () => {
    bikeAudioEngine.playBicycleBell(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const file = files[0];
      setUploadFeedback(`Loading ${file.name}...`);
      const newTrack = await saveCustomAudioTrack(file);
      const updated = await loadCustomAudioTracks();
      setCustomTracks(updated);
      setUploadFeedback(`Added "${newTrack.title}" to bike playlist!`);
      bikeAudioEngine.playTrack(newTrack);
    } catch {
      setUploadFeedback('Could not save audio file to local storage.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setUploadFeedback(null), 3500);
    }
  };

  const handleDeleteCustomTrack = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentTrack?.id === id) {
      bikeAudioEngine.stop();
    }
    await deleteCustomAudioTrack(id);
    const updated = await loadCustomAudioTracks();
    setCustomTracks(updated);
  };

  const formatSec = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <>
      {/* Floating Mini Music Bar or Minimized Floating Button */}
      {isMinimized ? (
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className={`fixed bottom-4 right-4 z-40 p-2.5 sm:p-3 rounded-full shadow-lg border transition-all flex items-center gap-2 cursor-pointer ${
            isPlaying
              ? 'bg-sky-600 hover:bg-sky-500 text-white border-sky-400 ring-2 ring-sky-400/50 animate-pulse'
              : 'bg-white dark:bg-[#101726] text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Open Cockpit Music Player"
          aria-label="Open Cockpit Music Player"
        >
          <Disc3 className={`w-5 h-5 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
          <span className="text-xs font-bold pr-1 hidden sm:inline">
            {isPlaying ? currentTrack?.title ?? 'Playing' : 'Bike Music'}
          </span>
        </button>
      ) : (
        <div
          role="region"
          aria-label="Cockpit Music Player Bar"
          className="fixed bottom-0 left-0 right-0 z-40 px-3 py-2 sm:px-6 sm:py-2.5 bg-white/95 dark:bg-[#0B101B]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-2xl transition-all"
        >
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2 sm:gap-4">
            {/* Left: Track Information & Album/Disc indicator */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1 sm:flex-initial">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className={`p-2 rounded-xl shrink-0 cursor-pointer ${
                  isPlaying ? 'bg-sky-500/20 text-sky-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}
                title="Open Music Library"
              >
                <Disc3 className={`w-5 h-5 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '3.5s' }} />
              </button>

              <div className="min-w-0 cursor-pointer" onClick={() => setIsModalOpen(true)}>
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[130px] sm:max-w-[200px]">
                  {currentTrack?.title ?? 'No Track Selected'}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[130px] sm:max-w-[200px]">
                  {currentTrack?.artist ?? 'Bicycle Cockpit Audio'}
                  {currentTrack?.bpm ? ` · ${currentTrack.bpm} BPM` : ''}
                </div>
              </div>
            </div>

            {/* Center: Large Glove-Friendly Cockpit Audio Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={handlePrevious}
                className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition cursor-pointer"
                aria-label="Previous Track"
                title="Previous Track"
              >
                <SkipBack className="w-4 h-4 fill-current" />
              </button>

              <button
                type="button"
                onClick={handlePlayPause}
                className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shadow-md active:scale-95 transition cursor-pointer ${
                  isPlaying
                    ? 'bg-sky-600 hover:bg-sky-500 text-white'
                    : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-sky-600 dark:hover:bg-sky-500'
                }`}
                aria-label={isPlaying ? 'Pause Music' : 'Play Music'}
                title={isPlaying ? 'Pause Music' : 'Play Music'}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition cursor-pointer"
                aria-label="Next Track"
                title="Next Track"
              >
                <SkipForward className="w-4 h-4 fill-current" />
              </button>

              <span className="hidden md:inline font-mono-tabular text-xs text-slate-500 ml-2">
                {formatSec(currentTime)} / {formatSec(duration)}
              </span>
            </div>

            {/* Right: Volume, Bike Bell Ding, Playlist, and Minimize */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              {/* Bike Bell Quick Chime Button */}
              <button
                type="button"
                onClick={handleRingBikeBell}
                className="min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 active:scale-95 transition flex items-center gap-1 cursor-pointer"
                title="Ring Bicycle Bell Chime"
              >
                <Bell className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Bell</span>
              </button>

              {/* Volume Slider & Mute Toggle */}
              <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-red-500" />
                  ) : volume < 0.5 ? (
                    <Volume1 className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-16 h-1.5 accent-sky-600 rounded-lg cursor-pointer"
                  aria-label="Volume slider"
                />
              </div>

              {/* Open Full Music Modal */}
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center gap-1 cursor-pointer"
                title="Tracks & Audio Sources"
              >
                <Music className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tracks</span>
              </button>

              {/* Minimize Bar */}
              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                title="Minimize Music Bar"
                aria-label="Minimize Music Bar"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Cockpit Music Center Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cockpit Music Center"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm"
        >
          <div className="w-full max-w-xl max-h-[85vh] flex flex-col rounded-2xl bg-white dark:bg-[#101726] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-500/15 text-sky-500">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Cockpit Audio &amp; Music
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Offline riding beats, custom MP3s, and streaming apps
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                aria-label="Close Music Center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-3">
              <button
                type="button"
                onClick={() => setActiveTab('cadence')}
                className={`px-3 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'cadence'
                    ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Cadence Beats ({BUILTIN_TRACKS.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('custom')}
                className={`px-3 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'custom'
                    ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                My Audio Files ({customTracks.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('streaming')}
                className={`px-3 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'streaming'
                    ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Streaming Apps
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`px-3 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'settings'
                    ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Settings
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* TAB 1: Built-in Cadence Beats */}
              {activeTab === 'cadence' && (
                <div className="space-y-2.5">
                  <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/50 text-xs text-sky-900 dark:text-sky-300">
                    <p className="font-semibold">100% Offline Synthesized Beats</p>
                    <p className="mt-0.5 text-sky-700 dark:text-sky-400">
                      Zero data usage and zero battery-draining downloads. Tailored BPM tempos designed to match natural bicycle pedaling cadences.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    {BUILTIN_TRACKS.map((track) => {
                      const isCurrent = currentTrack?.id === track.id;
                      return (
                        <div
                          key={track.id}
                          onClick={() => handleSelectTrack(track)}
                          className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer ${
                            isCurrent
                              ? 'bg-sky-500/15 border-sky-500/40 text-slate-900 dark:text-white'
                              : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                                isCurrent && isPlaying
                                  ? 'bg-sky-600 text-white'
                                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {isCurrent && isPlaying ? (
                                <Pause className="w-4 h-4 fill-current" />
                              ) : (
                                <Play className="w-4 h-4 fill-current ml-0.5" />
                              )}
                            </button>
                            <div>
                              <div className="text-sm font-bold">{track.title}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {track.artist} ·{' '}
                                <span className="font-semibold text-sky-600 dark:text-sky-400">
                                  {track.bpm} BPM
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="text-xs font-mono-tabular text-slate-500">
                            {formatSec(track.durationSeconds)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: User Custom Audio Tracks */}
              {activeTab === 'custom' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      Save Your Favorite MP3s Offline
                    </p>
                    <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                      Upload audio files from your phone. They are stored securely in your browser&apos;s IndexedDB and play without needing internet connection.
                    </p>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="bike-audio-upload"
                  />

                  <label
                    htmlFor="bike-audio-upload"
                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-sky-500 dark:hover:border-sky-500 rounded-2xl transition cursor-pointer bg-slate-50/50 dark:bg-slate-900/30"
                  >
                    <Upload className="w-8 h-8 text-sky-500 mb-2" />
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      Choose Audio File (MP3, M4A, WAV)
                    </span>
                    <span className="text-xs text-slate-500 mt-1">
                      Stored locally on device
                    </span>
                  </label>

                  {uploadFeedback && (
                    <div className="p-2.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-xs text-sky-700 dark:text-sky-300 font-semibold">
                      {uploadFeedback}
                    </div>
                  )}

                  {customTracks.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500">
                      No custom tracks uploaded yet. Add audio files from your phone to ride with your favorite songs.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {customTracks.map((track) => {
                        const isCurrent = currentTrack?.id === track.id;
                        return (
                          <div
                            key={track.id}
                            onClick={() => handleSelectTrack(track)}
                            className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer ${
                              isCurrent
                                ? 'bg-sky-500/15 border-sky-500/40 text-slate-900 dark:text-white'
                                : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <button
                                type="button"
                                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                                  isCurrent && isPlaying
                                    ? 'bg-sky-600 text-white'
                                    : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {isCurrent && isPlaying ? (
                                  <Pause className="w-4 h-4 fill-current" />
                                ) : (
                                  <Play className="w-4 h-4 fill-current ml-0.5" />
                                )}
                              </button>
                              <div className="min-w-0">
                                <div className="text-sm font-bold truncate">
                                  {track.title}
                                </div>
                                <div className="text-xs text-slate-500 truncate">
                                  Local Storage Track
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => handleDeleteCustomTrack(track.id, e)}
                              className="p-2 rounded-lg text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                              title="Delete from device storage"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Streaming Apps (Spotify, Apple Music, YouTube Music) */}
              {activeTab === 'streaming' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      Ride with Background Streaming Apps
                    </p>
                    <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                      Launch your music streaming app on your phone. It continues playing in the background while this cockpit records GPS speed, distance, and map navigation.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <a
                      href="https://open.spotify.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition text-center cursor-pointer"
                    >
                      <Radio className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      <span>Open Spotify</span>
                      <span className="text-[10px] font-normal opacity-80 flex items-center gap-0.5">
                        Launch app <ExternalLink className="w-3 h-3" />
                      </span>
                    </a>

                    <a
                      href="https://music.apple.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-800 dark:text-rose-300 font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition text-center cursor-pointer"
                    >
                      <Radio className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                      <span>Apple Music</span>
                      <span className="text-[10px] font-normal opacity-80 flex items-center gap-0.5">
                        Launch app <ExternalLink className="w-3 h-3" />
                      </span>
                    </a>

                    <a
                      href="https://music.youtube.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-800 dark:text-red-300 font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition text-center cursor-pointer"
                    >
                      <Radio className="w-5 h-5 text-red-600 dark:text-red-400" />
                      <span>YouTube Music</span>
                      <span className="text-[10px] font-normal opacity-80 flex items-center gap-0.5">
                        Launch app <ExternalLink className="w-3 h-3" />
                      </span>
                    </a>
                  </div>

                  {/* Optional Spotify Mini Player Embed */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowSpotifyEmbed((prev) => !prev)}
                      className="w-full py-2 px-3 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-between cursor-pointer"
                    >
                      <span>{showSpotifyEmbed ? 'Hide' : 'Show'} Embedded Spotify Cycling Playlist</span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${showSpotifyEmbed ? 'rotate-180' : ''}`} />
                    </button>

                    {showSpotifyEmbed && (
                      <div className="mt-2.5 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
                        <iframe
                          title="Spotify Cycling Playlist"
                          src="https://open.spotify.com/embed/playlist/37i9dQZF1DXdLEN7aqioXM?utm_source=generator&theme=0"
                          width="100%"
                          height="152"
                          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                          loading="lazy"
                          className="w-full rounded-xl"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: Ride Audio Settings & Bicycle Bell */}
              {activeTab === 'settings' && (
                <div className="space-y-3.5">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          Milestone Bicycle Bell Chime
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Rings a realistic dual-tone bike bell chime on every completed {unit === 'kmh' ? 'kilometer' : 'mile'}.
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onToggleMilestoneChime(!milestoneChimeEnabled)}
                        className={`min-h-[32px] px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                          milestoneChimeEnabled
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {milestoneChimeEnabled ? 'Active' : 'Muted'}
                      </button>
                    </div>

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        Test Bell Strike:
                      </span>
                      <button
                        type="button"
                        onClick={handleRingBikeBell}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Bell className="w-3.5 h-3.5" />
                        <span>Strike Bell (&ldquo;Ding Ding!&rdquo;)</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Bluetooth Headset &amp; Helmet Remote Support
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      This app integrates with the browser&apos;s Web Media Session API. When you ride with Bluetooth earbuds (e.g. Shokz bone-conduction headphones or AirPods) or a handlebar remote, clicking the physical play/pause and skip buttons directly controls cockpit audio without looking at your screen.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePlayPause}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-600 text-white hover:bg-sky-500 active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Play</span>
                    </>
                  )}
                </button>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate max-w-[180px]">
                  {currentTrack?.title ?? 'Ready'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
