import { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, Upload, Music, FileText, Volume2, VolumeX, Maximize2, CloudRain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface ControlPanelProps {
  audioState: {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    overallEnergy: number;
  };
  hasLyrics: boolean;
  hasAudio: boolean;
  density: 'light' | 'medium' | 'heavy';
  immersive: boolean;
  onAudioFile: (file: File) => void;
  onLyricsFile: (file: File) => void;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onDensityChange: (density: 'light' | 'medium' | 'heavy') => void;
  onToggleImmersive: () => void;
  rainEnabled: boolean;
  rainVolume: number;
  onRainToggle: (enabled: boolean) => void;
  onRainVolumeChange: (volume: number) => void;
}

export default function ControlPanel({
  audioState,
  hasLyrics,
  hasAudio,
  density,
  immersive,
  onAudioFile,
  onLyricsFile,
  onPlay,
  onPause,
  onSeek,
  onVolumeChange,
  onDensityChange,
  onToggleImmersive,
  rainEnabled,
  rainVolume,
  onRainToggle,
  onRainVolumeChange,
}: ControlPanelProps) {
  const audioInputRef = useRef<HTMLInputElement>(null);
  const lyricsInputRef = useRef<HTMLInputElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Unified seek handler for mouse / touch
  const handleSeekFromClientX = useCallback((clientX: number) => {
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(x * audioState.duration);
  }, [audioState.duration, onSeek]);

  // Global drag listeners for progress bar
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => handleSeekFromClientX(e.clientX);
    const handleMouseUp = () => setIsDragging(false);

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleSeekFromClientX(e.touches[0].clientX);
      }
    };
    const handleTouchEnd = () => setIsDragging(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleSeekFromClientX]);

  const formatTime = (t: number) => {
    if (!isFinite(t)) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progress = audioState.duration > 0 ? (audioState.currentTime / audioState.duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* Progress bar */}
      {hasAudio && (
        <div
          ref={progressRef}
          className="h-3 bg-white/5 cursor-pointer group relative touch-none"
          onMouseDown={(e) => {
            setIsDragging(true);
            handleSeekFromClientX(e.clientX);
          }}
          onTouchStart={(e) => {
            setIsDragging(true);
            if (e.touches.length > 0) {
              handleSeekFromClientX(e.touches[0].clientX);
            }
          }}
        >
          <div
            className="h-full bg-teal-400/70 relative"
            style={{ width: `${progress}%`, transitionDuration: isDragging ? '0ms' : '100ms' }}
          >
            <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-teal-300 rounded-full transition-opacity shadow-lg shadow-teal-400/50 ${isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
          </div>
        </div>
      )}



      {/* Control bar */}
      <div className="glass-panel border-t border-white/5 pb-safe">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex flex-wrap items-center gap-2 sm:gap-4">
          {/* Audio file upload / Play controls */}
          <div className="flex items-center gap-2">
            {!hasAudio ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => audioInputRef.current?.click()}
                className="text-teal-300 hover:text-teal-200 hover:bg-teal-500/10 gap-2 h-10 px-3"
              >
                <Upload className="w-5 h-5" />
                <span className="text-sm hidden sm:inline">上传音乐</span>
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={audioState.isPlaying ? onPause : onPlay}
                  className="text-teal-300 hover:text-teal-200 hover:bg-teal-500/10 w-11 h-11"
                >
                  {audioState.isPlaying ? (
                    <Pause className="w-6 h-6" />
                  ) : (
                    <Play className="w-6 h-6 ml-0.5" />
                  )}
                </Button>

                {/* Time display */}
                <div className="text-xs sm:text-sm text-slate-400 font-mono min-w-[72px] sm:min-w-[88px]">
                  {formatTime(audioState.currentTime)} / {formatTime(audioState.duration)}
                </div>
              </>
            )}

            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onAudioFile(file);
              }}
              className="hidden"
            />
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-white/10 hidden sm:block" />

          {/* Lyrics upload */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => lyricsInputRef.current?.click()}
              className={`gap-2 h-10 px-3 ${hasLyrics ? 'text-teal-300 hover:text-teal-200' : 'text-slate-400 hover:text-slate-300'}`}
            >
              <FileText className="w-5 h-5" />
              <span className="text-sm hidden sm:inline">{hasLyrics ? '已导入歌词' : '导入歌词'}</span>
            </Button>
            <input
              ref={lyricsInputRef}
              type="file"
              accept=".lrc,.txt"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onLyricsFile(file);
              }}
              className="hidden"
            />
          </div>

          <div className="flex-1" />

          {/* Right-side controls: density, volume, rain, immersive */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
            {/* Rain density control */}
            {hasAudio && (
              <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
                {(['light', 'medium', 'heavy'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => onDensityChange(d)}
                    className={`px-2 sm:px-3 py-1.5 rounded text-xs sm:text-sm transition-colors min-w-[36px] sm:min-w-[44px] ${
                      density === d
                        ? 'bg-teal-500/30 text-teal-200'
                        : 'text-slate-400 hover:text-slate-300 hover:bg-white/5'
                    }`}
                    title={d === 'light' ? '小雨' : d === 'medium' ? '中雨' : '大雨'}
                  >
                    {d === 'light' ? '小' : d === 'medium' ? '中' : '大'}
                  </button>
                ))}
              </div>
            )}

            {/* Volume */}
            {hasAudio && (
              <div className="flex items-center gap-2 w-28 sm:w-32">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onVolumeChange(audioState.volume > 0 ? 0 : 0.7)}
                  className="text-slate-400 hover:text-slate-300 w-10 h-10"
                >
                  {audioState.volume === 0 ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </Button>
                <Slider
                  value={[audioState.volume * 100]}
                  max={100}
                  step={1}
                  onValueChange={([v]) => onVolumeChange(v / 100)}
                  className="w-16 sm:w-20"
                />
              </div>
            )}

            {/* Rain sound control */}
            {hasAudio && (
              <div className="flex items-center gap-2 w-28 sm:w-36">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRainToggle(!rainEnabled)}
                  className={`w-10 h-10 ${rainEnabled ? 'text-teal-400 hover:text-teal-300' : 'text-slate-400 hover:text-slate-300'}`}
                >
                  <CloudRain className="w-5 h-5" />
                </Button>
                <Slider
                  value={[rainEnabled ? rainVolume * 100 : 0]}
                  max={100}
                  step={1}
                  onValueChange={([v]) => {
                    onRainVolumeChange(v / 100);
                    if (!rainEnabled && v > 0) onRainToggle(true);
                  }}
                  className="w-16 sm:w-20"
                />
              </div>
            )}

            {/* Energy indicator - hidden on small screens */}
            {audioState.isPlaying && (
              <div className="hidden sm:flex items-center gap-2">
                <div className="flex gap-0.5 items-end h-5">
                  {Array.from({ length: 8 }).map((_, i) => {
                    const h = Math.min(20, Math.max(3, audioState.overallEnergy * 20 * (0.5 + Math.sin(Date.now() * 0.005 + i) * 0.5)));
                    return (
                      <div
                        key={i}
                        className="w-1 bg-teal-400/60 rounded-full transition-all duration-75"
                        style={{ height: `${h}px` }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Immersive toggle */}
            {hasAudio && (
              <button
                onClick={onToggleImmersive}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  immersive
                    ? 'bg-teal-500/30 text-teal-200'
                    : 'text-slate-400 hover:text-slate-300 hover:bg-white/5'
                }`}
                title="沉浸式"
              >
                <Maximize2 className="w-4 h-4" />
                <span className="hidden sm:inline">沉浸</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Instructions overlay - shown when no audio */}
      {!hasAudio && (
        <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
          <div className="text-center pointer-events-auto">
            <div className="glass-panel rounded-2xl px-10 py-8 max-w-md mx-4">
              <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-teal-500/10 flex items-center justify-center">
                <Music className="w-8 h-8 text-teal-400" />
              </div>
              <h2 className="text-xl font-semibold text-slate-100 mb-2">雨音 · RainTune</h2>
              <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                上传音乐文件开始体验。雨滴会随音乐节奏落下，<br />
                击中荷叶时激起涟漪与歌词。
              </p>
              <div className="flex flex-col gap-3 text-xs text-slate-500">
                <div className="flex items-center gap-2 justify-center">
                  <Upload className="w-3.5 h-3.5" />
                  <span>支持 MP3, WAV, OGG 等格式</span>
                </div>
                <div className="flex items-center gap-2 justify-center">
                  <FileText className="w-3.5 h-3.5" />
                  <span>可导入 LRC 歌词文件（可选）</span>
                </div>
              </div>
              <Button
                onClick={() => audioInputRef.current?.click()}
                className="mt-6 bg-teal-600 hover:bg-teal-500 text-white gap-2"
              >
                <Upload className="w-4 h-4" />
                选择音乐文件
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
