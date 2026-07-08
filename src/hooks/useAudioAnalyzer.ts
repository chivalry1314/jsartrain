import { useRef, useCallback, useState } from 'react';
import type { AudioState } from '@/types';

const DEFAULT_AUDIO_STATE: AudioState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.7,
  fftData: [...new Uint8Array(128)],
  bassEnergy: 0,
  midEnergy: 0,
  trebleEnergy: 0,
  overallEnergy: 0,
};

export function useAudioAnalyzer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number>(0);
  const rainGainRef = useRef<GainNode | null>(null);
  const rainFilterRef = useRef<BiquadFilterNode | null>(null);
  const rainSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const windGainRef = useRef<GainNode | null>(null);
  const windFilterRef = useRef<BiquadFilterNode | null>(null);
  const windSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const windLFORef = useRef<OscillatorNode | null>(null);
  const dropSoundsGainRef = useRef<GainNode | null>(null);
  const thunderGainRef = useRef<GainNode | null>(null);
  const thunderFilterRef = useRef<BiquadFilterNode | null>(null);
  const rainIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const thunderIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rainEnabledRef = useRef(true);
  const rainVolumeRef = useRef(0.3);
  const rainDensityRef = useRef<'light' | 'medium' | 'heavy'>('medium');
  const eventHandlersRef = useRef<{
    onPlay: () => void;
    onPause: () => void;
    onEnded: () => void;
    onTimeUpdate: () => void;
    onLoadedMeta: () => void;
    onError: () => void;
    onCanPlay: () => void;
  } | null>(null);

  // Promise resolvers for async readiness
  const canPlayResolverRef = useRef<(() => void) | null>(null);

  const [audioState, setAudioState] = useState<AudioState>(DEFAULT_AUDIO_STATE);
  const fftDataRef = useRef(new Uint8Array(128));

  const stopAnalysis = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const startAnalysis = useCallback(() => {
    if (rafRef.current) return;

    const tick = () => {
      if (!analyserRef.current || !audioRef.current) return;

      const analyser = analyserRef.current;
      const dataArray = fftDataRef.current;
      analyser.getByteFrequencyData(dataArray);

      const bassEnd = Math.floor(dataArray.length * 0.1);
      const midEnd = Math.floor(dataArray.length * 0.5);

      let bassSum = 0, midSum = 0, trebleSum = 0, totalSum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const val = dataArray[i];
        totalSum += val;
        if (i < bassEnd) bassSum += val;
        else if (i < midEnd) midSum += val;
        else trebleSum += val;
      }

      const bassEnergy = bassSum / bassEnd / 255;
      const midEnergy = midSum / (midEnd - bassEnd) / 255;
      const trebleEnergy = trebleSum / (dataArray.length - midEnd) / 255;
      const overallEnergy = totalSum / dataArray.length / 255;

      setAudioState(prev => ({
        ...prev,
        currentTime: audioRef.current?.currentTime || 0,
        fftData: [...dataArray],
        bassEnergy,
        midEnergy,
        trebleEnergy,
        overallEnergy,
      }));

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const teardownAudio = useCallback(() => {
    stopAnalysis();

    const audio = audioRef.current;
    const handlers = eventHandlersRef.current;

    if (audio && handlers) {
      audio.pause();
      audio.removeEventListener('play', handlers.onPlay);
      audio.removeEventListener('pause', handlers.onPause);
      audio.removeEventListener('ended', handlers.onEnded);
      audio.removeEventListener('timeupdate', handlers.onTimeUpdate);
      audio.removeEventListener('loadedmetadata', handlers.onLoadedMeta);
      audio.removeEventListener('error', handlers.onError);
      audio.removeEventListener('canplay', handlers.onCanPlay);
    }

    if (sourceRef.current) {
      try { sourceRef.current.disconnect(); } catch { /* ignore */ }
      sourceRef.current = null;
    }

    if (analyserRef.current) {
      try { analyserRef.current.disconnect(); } catch { /* ignore */ }
      analyserRef.current = null;
    }

    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch { /* ignore */ }
      audioContextRef.current = null;
    }

    audioRef.current = null;
    eventHandlersRef.current = null;
    canPlayResolverRef.current = null;
    rainGainRef.current = null;
    rainFilterRef.current = null;
    rainSourceRef.current = null;
    windGainRef.current = null;
    windFilterRef.current = null;
    windSourceRef.current = null;
    windLFORef.current = null;
    dropSoundsGainRef.current = null;
    thunderGainRef.current = null;
    thunderFilterRef.current = null;
    if (rainIntervalRef.current) { clearInterval(rainIntervalRef.current); rainIntervalRef.current = null; }
    if (thunderIntervalRef.current) { clearInterval(thunderIntervalRef.current); thunderIntervalRef.current = null; }
  }, [stopAnalysis]);

  const setupNewAudio = useCallback((audio: HTMLAudioElement): Promise<void> => {
    // Clean up previous audio
    teardownAudio();

    // Create fresh AudioContext
    const ctx = new AudioContext();
    audioContextRef.current = ctx;

    // Create analyser
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    analyserRef.current = analyser;

    // Create source and connect
    const source = ctx.createMediaElementSource(audio);
    sourceRef.current = source;
    source.connect(analyser);
    analyser.connect(ctx.destination);

    fftDataRef.current = new Uint8Array(analyser.frequencyBinCount);

    // Create a promise that resolves when audio is ready to play
    const canPlayPromise = new Promise<void>((resolve) => {
      canPlayResolverRef.current = resolve;
    });

    // Create event handlers
    const onPlay = () => {
      setAudioState(prev => ({ ...prev, isPlaying: true }));
      startAnalysis();
      syncRainWithPlayback(true);
    };

    const onPause = () => {
      setAudioState(prev => ({ ...prev, isPlaying: false }));
      stopAnalysis();
      syncRainWithPlayback(false);
    };

    const onEnded = () => {
      setAudioState(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
      stopAnalysis();
      syncRainWithPlayback(false);
    };

    const onTimeUpdate = () => {
      if (audio.duration && audio.duration !== Infinity) {
        setAudioState(prev => ({
          ...prev,
          currentTime: audio.currentTime,
          duration: audio.duration,
        }));
      } else {
        setAudioState(prev => ({
          ...prev,
          currentTime: audio.currentTime,
        }));
      }
    };

    const onLoadedMeta = () => {
      if (audio.duration && audio.duration !== Infinity) {
        setAudioState(prev => ({ ...prev, duration: audio.duration }));
      }
    };

    const onError = () => {
      console.error('[Audio] Load error:', audio.error?.message || audio.error);
      setAudioState(prev => ({ ...prev, isPlaying: false }));
      stopAnalysis();
      // Resolve anyway to unblock the promise
      if (canPlayResolverRef.current) {
        canPlayResolverRef.current();
        canPlayResolverRef.current = null;
      }
    };

    const onCanPlay = () => {
      // Resume AudioContext if suspended
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      // Resolve the readiness promise
      if (canPlayResolverRef.current) {
        canPlayResolverRef.current();
        canPlayResolverRef.current = null;
      }
    };

    eventHandlersRef.current = { onPlay, onPause, onEnded, onTimeUpdate, onLoadedMeta, onError, onCanPlay };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMeta);
    audio.addEventListener('error', onError);
    audio.addEventListener('canplay', onCanPlay);

    audioRef.current = audio;

    // Create ambient rain sound (white noise through lowpass filter)
    createRainSound(ctx);

    return canPlayPromise;
  }, [teardownAudio, startAnalysis, stopAnalysis, syncRainWithPlayback]);

  // Sync ambient rain volume with music playback state
  const syncRainWithPlayback = useCallback((playing: boolean) => {
    const ctx = audioContextRef.current;
    if (!ctx) return;
    const enabled = rainEnabledRef.current;
    const volume = rainVolumeRef.current;
    const target = playing && enabled ? volume : 0;
    const windTarget = playing && enabled ? volume * rainDensityToWindVolume(rainDensityRef.current) : 0;
    const fadeTime = playing ? 0.3 : 0.03; // fast stop, smooth start

    if (rainGainRef.current) {
      rainGainRef.current.gain.cancelScheduledValues(ctx.currentTime);
      rainGainRef.current.gain.setTargetAtTime(target, ctx.currentTime, fadeTime);
    }
    if (windGainRef.current) {
      windGainRef.current.gain.cancelScheduledValues(ctx.currentTime);
      windGainRef.current.gain.setTargetAtTime(windTarget, ctx.currentTime, fadeTime);
    }
    if (dropSoundsGainRef.current) {
      dropSoundsGainRef.current.gain.cancelScheduledValues(ctx.currentTime);
      dropSoundsGainRef.current.gain.setTargetAtTime(target, ctx.currentTime, fadeTime);
    }
  }, []);

  // Start procedural rain intervals (drop sounds & thunder)
  const startRainIntervals = useCallback((ctx: AudioContext) => {
    if (rainIntervalRef.current) clearInterval(rainIntervalRef.current);
    if (thunderIntervalRef.current) clearInterval(thunderIntervalRef.current);

    rainIntervalRef.current = setInterval(() => {
      if (!rainEnabledRef.current) return;
      const density = rainDensityRef.current;
      const chance = density === 'light' ? 0.15 : density === 'medium' ? 0.35 : 0.6;
      const count = density === 'light' ? 1 : density === 'medium' ? 2 : 3;
      for (let i = 0; i < count; i++) {
        if (Math.random() < chance) triggerDropSound(ctx);
      }
    }, 150);

    thunderIntervalRef.current = setInterval(() => {
      if (!rainEnabledRef.current) return;
      const density = rainDensityRef.current;
      const chance = density === 'light' ? 0.05 : density === 'medium' ? 0.12 : 0.25;
      if (Math.random() < chance) triggerThunder(ctx);
    }, 8000);
  }, []);

  // Create looping rain white noise
  const createRainSound = useCallback((ctx: AudioContext) => {
    if (rainGainRef.current) return;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(ctx.destination);
    rainGainRef.current = gain;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = rainDensityToFrequency(rainDensityRef.current);
    filter.Q.value = 0;
    filter.connect(gain);
    rainFilterRef.current = filter;

    const buffer = createPinkNoiseBuffer(ctx, 2);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(filter);
    source.start();
    rainSourceRef.current = source;

    // Wind layer
    const windGain = ctx.createGain();
    windGain.gain.value = rainEnabledRef.current ? rainDensityToWindVolume(rainDensityRef.current) * rainVolumeRef.current : 0;
    windGain.connect(ctx.destination);
    windGainRef.current = windGain;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = rainDensityToWindFreq(rainDensityRef.current);
    windFilter.Q.value = 0.7;
    windFilter.connect(windGain);
    windFilterRef.current = windFilter;

    const windBuffer = createPinkNoiseBuffer(ctx, 3);
    const windSource = ctx.createBufferSource();
    windSource.buffer = windBuffer;
    windSource.loop = true;
    windSource.connect(windFilter);
    windSource.start();
    windSourceRef.current = windSource;

    // Wind LFO (slow swell)
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.12 + Math.random() * 0.1;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.04;
    lfo.connect(lfoGain);
    lfoGain.connect(windGain.gain);
    lfo.start();
    windLFORef.current = lfo;

    // Drop sounds layer
    const dropGain = ctx.createGain();
    dropGain.gain.value = 0;
    dropGain.connect(ctx.destination);
    dropSoundsGainRef.current = dropGain;

    // Thunder layer
    const thunderGain = ctx.createGain();
    thunderGain.gain.value = 0;
    thunderGain.connect(ctx.destination);
    thunderGainRef.current = thunderGain;

    const thunderFilter = ctx.createBiquadFilter();
    thunderFilter.type = 'lowpass';
    thunderFilter.frequency.value = 220;
    thunderFilter.connect(thunderGain);
    thunderFilterRef.current = thunderFilter;

    startRainIntervals(ctx);
  }, [startRainIntervals]);

  // Trigger a single raindrop hitting the ground
  const triggerDropSound = useCallback((ctx: AudioContext) => {
    if (!dropSoundsGainRef.current) return;
    const duration = 0.04 + Math.random() * 0.08;
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600 + Math.random() * 1200;

    const gain = ctx.createGain();
    gain.gain.value = (0.1 + Math.random() * 0.15) * rainVolumeRef.current;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(dropSoundsGainRef.current);
    source.start();
  }, []);

  // Trigger a thunder rumble
  const triggerThunder = useCallback((ctx: AudioContext) => {
    if (!thunderGainRef.current || !thunderFilterRef.current) return;
    const duration = 1.5 + Math.random() * 2.5;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(thunderFilterRef.current);

    const now = ctx.currentTime;
    thunderGainRef.current.gain.cancelScheduledValues(now);
    thunderGainRef.current.gain.setValueAtTime(0, now);
    thunderGainRef.current.gain.linearRampToValueAtTime(0.6 * rainVolumeRef.current, now + 0.1);
    thunderGainRef.current.gain.exponentialRampToValueAtTime(0.01, now + duration);

    source.start(now);
    source.stop(now + duration);
  }, []);

  // Map rain density to filter frequency (timbre)
  const rainDensityToFrequency = (density: 'light' | 'medium' | 'heavy') => {
    switch (density) {
      case 'light': return 450;
      case 'heavy': return 1600;
      default: return 900;
    }
  };

  const rainDensityToWindVolume = (density: 'light' | 'medium' | 'heavy') => {
    switch (density) {
      case 'light': return 0.15;
      case 'heavy': return 0.45;
      default: return 0.28;
    }
  };

  const rainDensityToWindFreq = (density: 'light' | 'medium' | 'heavy') => {
    switch (density) {
      case 'light': return 250;
      case 'heavy': return 550;
      default: return 380;
    }
  };

  // Create a more natural pink-noise rain buffer
  const createPinkNoiseBuffer = (ctx: AudioContext, lengthSeconds: number) => {
    const bufferSize = ctx.sampleRate * lengthSeconds;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    return buffer;
  };

  // Adjust ambient rain volume
  const setRainVolume = useCallback((volume: number) => {
    rainVolumeRef.current = volume;
    const isPlaying = audioRef.current ? !audioRef.current.paused : false;
    syncRainWithPlayback(isPlaying);
  }, [syncRainWithPlayback]);

  // Toggle ambient rain on/off
  const toggleRain = useCallback((enabled: boolean) => {
    rainEnabledRef.current = enabled;
    const isPlaying = audioRef.current ? !audioRef.current.paused : false;
    syncRainWithPlayback(isPlaying);
  }, [syncRainWithPlayback]);

  // Change rain density (affects both sound timbre and future rain generation)
  const setRainDensity = useCallback((density: 'light' | 'medium' | 'heavy') => {
    rainDensityRef.current = density;
    const ctx = audioContextRef.current;
    if (!ctx) return;
    if (rainFilterRef.current) {
      rainFilterRef.current.frequency.setTargetAtTime(rainDensityToFrequency(density), ctx.currentTime, 0.3);
    }
    if (windFilterRef.current) {
      windFilterRef.current.frequency.setTargetAtTime(rainDensityToWindFreq(density), ctx.currentTime, 0.3);
    }
    const isPlaying = audioRef.current ? !audioRef.current.paused : false;
    syncRainWithPlayback(isPlaying);
  }, [syncRainWithPlayback]);

  // Initialize from a File (local upload)
  const initAudio = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.volume = audioState.volume;
    return setupNewAudio(audio);
  }, [audioState.volume, setupNewAudio]);

  // Initialize from a URL (online song)
  // Returns a promise that resolves when audio is ready (with timeout)
  const initAudioFromUrl = useCallback((url: string): Promise<void> => {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.volume = audioState.volume;
    audio.preload = 'auto';

    // Setup Web Audio API first
    const readyPromise = setupNewAudio(audio);

    // Set src and start loading
    audio.src = url;
    audio.load();

    // Race with 5-second timeout to prevent hanging forever
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        console.warn('[Audio] canplay timeout - proceeding anyway');
        resolve();
      }, 5000);
    });

    return Promise.race([readyPromise, timeoutPromise]);
  }, [audioState.volume, setupNewAudio]);

  // Play
  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Resume AudioContext if suspended (browser autoplay policy)
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }

    audio.play().catch(err => {
      console.warn('[Audio] Play failed:', err.message);
    });
  }, []);

  // Pause
  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  // Seek
  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  }, []);

  // Set volume
  const setVolume = useCallback((volume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
    setAudioState(prev => ({ ...prev, volume }));
  }, []);

  // Full cleanup (for unmount)
  const cleanup = useCallback(() => {
    teardownAudio();
    setAudioState(DEFAULT_AUDIO_STATE);
  }, [teardownAudio]);

  return {
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
    audioRef,
  };
}
