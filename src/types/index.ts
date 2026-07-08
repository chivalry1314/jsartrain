export interface LyricLine {
  time: number;
  text: string;
  words: LyricWord[];
}

export interface LyricWord {
  time: number;
  text: string;
  duration: number;
}

export interface Raindrop {
  x: number;
  y: number;
  speed: number;
  length: number;
  opacity: number;
  hasLyric: boolean;
  lyricText: string;
  lyricTime: number;
  targetX: number;
  targetY: number;
  size: number;
}

export interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  opacity: number;
  lineWidth: number;
  lyricText: string;
  lyricOpacity: number;
  lyricScale: number;
  bornTime: number;
  intensity: number;
}

export interface LotusLeaf {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: [number, number, number];
  brightness: number;
}

export interface AudioState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  fftData: number[];
  bassEnergy: number;
  midEnergy: number;
  trebleEnergy: number;
  overallEnergy: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: [number, number, number];
  opacity: number;
}
