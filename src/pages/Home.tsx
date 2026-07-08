import { useState, useEffect, useCallback, useRef } from 'react';
import { Headphones, Minimize2 } from 'lucide-react';
import RainLotus from '@/components/RainLotus';
import ControlPanel from '@/components/ControlPanel';
import MusicSearch from '@/components/MusicSearch';
import { useAudioAnalyzer } from '@/hooks/useAudioAnalyzer';
import { useLyrics } from '@/hooks/useLyrics';
import { fetchLyrics, type MetingSong } from '@/services/musicApi';

export default function Home() {
  const {
    audioState,
    initAudio,
    initAudioFromUrl,
    play,
    pause,
    seek,
    setVolume,
    setRainVolume,
    toggleRain,
    setRainDensity,
    cleanup,
  } = useAudioAnalyzer();

  const {
    lyrics,
    currentLine,
    hasLyrics,
    loadLyrics,
    loadLyricsFromText,
    updateCurrentLyric,
  } = useLyrics();

  const [hasAudio, setHasAudio] = useState(false);
  const [showMusicSearch, setShowMusicSearch] = useState(false);
  const [currentSong, setCurrentSong] = useState<MetingSong | null>(null);
  const [density, setDensity] = useState<'light' | 'medium' | 'heavy'>('medium');

  // Sync rain density with visual density
  useEffect(() => {
    setRainDensity(density);
  }, [density, setRainDensity]);
  const [immersive, setImmersive] = useState(false);
  const [rainEnabled, setRainEnabled] = useState(true);
  const [rainVolume, setRainVolumeState] = useState(0.3);
  const wasPlayingRef = useRef(false);
  const rafRef = useRef<number>(0);

  // Update lyrics position based on audio time
  useEffect(() => {
    if (audioState.isPlaying) {
      const update = () => {
        updateCurrentLyric(audioState.currentTime);
        rafRef.current = requestAnimationFrame(update);
      };
      rafRef.current = requestAnimationFrame(update);
    } else {
      cancelAnimationFrame(rafRef.current);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [audioState.isPlaying, audioState.currentTime, updateCurrentLyric]);

  const handleAudioFile = useCallback(async (file: File) => {
    await initAudio(file);
    setHasAudio(true);
    setCurrentSong(null);
    play();
  }, [initAudio, play]);

  const handleLyricsFile = useCallback((file: File) => {
    loadLyrics(file);
  }, [loadLyrics]);

  const handleRainToggle = useCallback((enabled: boolean) => {
    setRainEnabled(enabled);
    toggleRain(enabled);
  }, [toggleRain]);

  const handleRainVolumeChange = useCallback((volume: number) => {
    setRainVolumeState(volume);
    setRainVolume(volume);
  }, [setRainVolume]);

  const handleDensityChange = useCallback((newDensity: 'light' | 'medium' | 'heavy') => {
    setDensity(newDensity);
  }, []);

  // Handle online song selection from Meting API
  const handleSelectOnlineSong = useCallback(async (song: MetingSong) => {
    setShowMusicSearch(false);
    setCurrentSong(song);

    // Step 1: Initialize audio (with 5s timeout to prevent hanging)
    try {
      await initAudioFromUrl(song.url);
    } catch (err) {
      console.warn('[Home] Audio init error:', err);
    }
    setHasAudio(true);

    // Step 2: Play (may fail if audio not loaded yet, that's ok)
    try {
      play();
    } catch {
      /* ignore play errors */
    }

    // Step 3: Fetch and load lyrics (directly as LRC text)
    try {
      const lrcText = await fetchLyrics(song.lrc);
      if (lrcText && lrcText.trim()) {
        console.log('[Home] Loaded lyrics, length:', lrcText.length);
        loadLyricsFromText(lrcText);
      } else {
        console.log('[Home] No lyrics available');
        loadLyricsFromText('');
      }
    } catch (err) {
      console.warn('[Home] Lyric fetch error:', err);
      loadLyricsFromText('');
    }
  }, [initAudioFromUrl, play, loadLyricsFromText]);

  // Auto exit immersive mode when song ends
  useEffect(() => {
    if (wasPlayingRef.current && !audioState.isPlaying) {
      // Song ended if currentTime was reset to near 0 or reached end
      const nearEnd = audioState.duration > 0 && audioState.currentTime >= audioState.duration - 0.5;
      const nearStart = audioState.currentTime < 0.5;
      if (nearEnd || nearStart) {
        setImmersive(false);
      }
    }
    wasPlayingRef.current = audioState.isPlaying;
  }, [audioState.isPlaying, audioState.currentTime, audioState.duration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#050a14]">
      {/* P5.js Canvas Layer */}
      <RainLotus
        audioState={audioState}
        lyrics={lyrics}
        density={density}
      />

      {/* Top info bar */}
      {!immersive && (
      <div className="fixed top-0 left-0 right-0 z-30 pointer-events-none">
        <div className="flex items-start justify-between p-4">
          {/* Title */}
          <div className="pointer-events-auto">
            <h1 className="text-sm font-medium text-slate-300/80 tracking-wider">
              雨滴荷叶
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              音乐可视化
            </p>
          </div>

          {/* Current lyrics display */}
          {hasAudio && hasLyrics && currentLine && (
            <div className="text-center flex-1 mx-8">
              <div className="inline-block">
                <p className="lyrics-text text-lg text-teal-100/90 leading-relaxed animate-fade-in-up">
                  {currentLine.text}
                </p>
              </div>
            </div>
          )}

          {/* Right side controls */}
          <div className="flex items-center gap-3">
            {/* Current song info */}
            {currentSong && (
              <div className="flex items-center gap-2 pointer-events-auto">
                {currentSong.pic && (
                  <img
                    src={currentSong.pic}
                    alt={currentSong.album}
                    className="w-8 h-8 rounded-lg object-cover opacity-80"
                    crossOrigin="anonymous"
                  />
                )}
                <div className="text-right">
                  <p className="text-xs text-slate-300 truncate max-w-[120px]">{currentSong.name}</p>
                  <p className="text-[10px] text-slate-500 truncate max-w-[120px]">{currentSong.artist}</p>
                </div>
              </div>
            )}

            {/* Choose Song Button */}
            <button
              onClick={() => setShowMusicSearch(true)}
              className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-300 hover:bg-teal-500/20 hover:text-teal-200 transition-all text-xs"
            >
              <Headphones className="w-3.5 h-3.5" />
              在线选歌
            </button>

            {/* Play status */}
            {hasAudio && (
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className={`w-1.5 h-1.5 rounded-full ${audioState.isPlaying ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`} />
                {audioState.isPlaying ? '播放中' : '已暂停'}
              </span>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Music Search Modal */}
      <MusicSearch
        isVisible={showMusicSearch}
        onClose={() => setShowMusicSearch(false)}
        onSelectSong={handleSelectOnlineSong}
      />

      {/* Control Panel */}
      {!immersive && (
      <ControlPanel
        audioState={{
          isPlaying: audioState.isPlaying,
          currentTime: audioState.currentTime,
          duration: audioState.duration,
          volume: audioState.volume,
          overallEnergy: audioState.overallEnergy,
        }}
        hasLyrics={hasLyrics}
        hasAudio={hasAudio}
        density={density}
        onAudioFile={handleAudioFile}
        onLyricsFile={handleLyricsFile}
        onPlay={play}
        onPause={pause}
        onSeek={seek}
        onVolumeChange={setVolume}
        onDensityChange={handleDensityChange}
        onToggleImmersive={() => setImmersive(true)}
        rainEnabled={rainEnabled}
        rainVolume={rainVolume}
        onRainToggle={handleRainToggle}
        onRainVolumeChange={handleRainVolumeChange}
      />
      )}

      {/* Immersive exit button */}
      {immersive && hasAudio && (
        <button
          onClick={() => setImmersive(false)}
          className="fixed bottom-4 right-4 z-50 p-2 rounded-full bg-black/30 text-slate-300 hover:bg-black/50 hover:text-white transition-all opacity-40 hover:opacity-100"
          title="退出沉浸式"
        >
          <Minimize2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
