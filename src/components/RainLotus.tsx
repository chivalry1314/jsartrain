import { useEffect, useRef, useCallback } from 'react';
import p5 from 'p5';
import type { LyricLine } from '@/types';

interface RainLotusProps {
  audioState: {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    bassEnergy: number;
    midEnergy: number;
    trebleEnergy: number;
    overallEnergy: number;
    fftData: number[];
  };
  lyrics: LyricLine[];
  density?: 'light' | 'medium' | 'heavy';
}

// ---- Entities ----

// A column of falling characters (one lyric line = one column)
interface RainColumn {
  text: string;        // full lyric line text
  chars: string[];     // individual characters
  x: number;           // fixed horizontal position
  headY: number;       // head of the column (brightest char)
  speed: number;       // pixels per frame
  color: [number,number,number];
  active: boolean;     // currently falling
  done: boolean;       // all chars have fallen and disappeared
  charPositions: { y: number; alpha: number }[]; // each char's position
  startTime: number;   // when this column should start
  rippleSpawned: boolean;
}

interface Ripple {
  x: number; y: number; r: number; maxR: number; opacity: number;
  born: number; lw: number;
}

interface Splash {
  x: number; y: number; vx: number; vy: number; life: number; maxLife: number;
  size: number; color: [number,number,number];
}

interface AmbientRaindrop {
  x: number;
  y: number;
  speed: number;
  length: number;
  opacity: number;
  width: number;
  tilt: number;
  rippleChance: number;
}

export default function RainLotus({ audioState, lyrics, density = 'medium' }: RainLotusProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const p5Ref = useRef<p5 | null>(null);
  const stateRef = useRef(audioState);
  const lyricsRef = useRef(lyrics);
  const densityRef = useRef(density);

  useEffect(() => { stateRef.current = audioState; }, [audioState]);
  useEffect(() => { lyricsRef.current = lyrics; }, [lyrics]);
  useEffect(() => { densityRef.current = density; }, [density]);

  const sketch = useCallback((p: p5) => {
    let W = 0, H = 0, waterY = 0;
    const columns: RainColumn[] = [];
    const raindrops: AmbientRaindrop[] = [];
    const ripples: Ripple[] = [];
    const splashes: Splash[] = [];
    let beatFlash = 0, lastBeat = 0;
    let lastLyricsKey = '';
    const triggeredLines = new Set<string>();
    let lastCurrentTime = 0;

    // Column colors - muted palette like the video
    const COLUMN_COLORS: [number,number,number][] = [
      [200, 220, 240], // white-blue
      [180, 210, 230], // light blue
      [220, 200, 180], // warm white
      [160, 200, 220], // cyan
      [200, 190, 220], // lavender
      [220, 220, 200], // cream
      [180, 220, 200], // teal
      [200, 180, 200], // pinkish
    ];

    p.setup = () => {
      W = containerRef.current?.clientWidth || p.windowWidth;
      H = containerRef.current?.clientHeight || p.windowHeight;
      waterY = H * 0.78;
      const canvas = p.createCanvas(W, H);
      canvas.parent(containerRef.current!);
      p.textAlign(p.CENTER, p.CENTER);
      p.textFont('Noto Serif SC, serif');
      p.frameRate(60);
    };

    // ---- Add rain columns for a lyric line based on density ----
    const DENSITY_MAP = {
      light: 1,
      medium: 3,
      heavy: 6,
    };

    const MAX_ACTIVE_MAP = {
      light: 12,
      medium: 24,
      heavy: 42,
    };

    const addColumnsForLine = (line: LyricLine) => {
      const chars = line.text.split('');
      // Remove empty/punctuation chars
      const cleanChars = chars.filter(c => c.trim() && !'.,!?;:，。！？、；：'.includes(c));
      if (cleanChars.length === 0) return;

      const currentDensity = densityRef.current;
      const count = DENSITY_MAP[currentDensity];
      const maxActive = MAX_ACTIVE_MAP[currentDensity];

      // Limit active columns to keep the scene readable
      const activeCount = columns.filter(c => c.active && !c.done).length;
      if (activeCount >= maxActive) {
        // Remove oldest done column to make room
        const firstDone = columns.findIndex(c => c.done);
        if (firstDone >= 0) columns.splice(firstDone, 1);
        else return; // too many active, skip
      }

      // Keep rain in the central 60% of the screen (20% ~ 80% width)
      const margin = W * 0.2;
      const usableWidth = W * 0.6;

      for (let k = 0; k < count; k++) {
        const baseX = margin + (usableWidth / (count + 1)) * (k + 1);
        const colX = baseX + p.random(-40, 40);
        const color = COLUMN_COLORS[columns.length % COLUMN_COLORS.length];
        const speed = p.random(1.2, 2.8);

        columns.push({
          text: line.text,
          chars: cleanChars,
          x: colX,
          headY: -p.random(50, 250) - k * 25, // slight vertical stagger
          speed,
          color,
          active: true,
          done: false,
          charPositions: [],
          startTime: line.time,
          rippleSpawned: false,
        });
      }
    };

    // Reset everything when lyrics change
    const resetColumns = () => {
      columns.length = 0;
      raindrops.length = 0;
      ripples.length = 0;
      splashes.length = 0;
      triggeredLines.clear();
    };

    // ---- Spawn ripple at bottom ----
    const spawnRipple = (x: number, y: number) => {
      if (ripples.length >= 20) return;
      ripples.push({
        x, y, r: 1, maxR: p.random(25, 45),
        opacity: p.random(120, 180),
        born: p.millis(), lw: 1.5,
      });
    };

    // ---- Spawn splash particles ----
    const spawnSplash = (x: number, y: number, col: [number,number,number]) => {
      for (let i = 0; i < 8; i++) {
        const angle = p.random(p.PI * 0.7, p.PI * 2.3);
        const spd = p.random(1.5, 4.5);
        splashes.push({
          x, y,
          vx: p.cos(angle) * spd,
          vy: p.sin(angle) * spd - 3,
          life: 1,
          maxLife: p.random(20, 40),
          size: p.random(1.5, 3.5),
          color: col,
        });
      }
    };

    // =================== MAIN DRAW ===================
    p.draw = () => {
      const t = p.millis() / 1000;
      const state = stateRef.current;
      const currentLyrics = lyricsRef.current;

      // ===== DARK BACKGROUND =====
      p.background(12, 16, 22);

      // Subtle gradient overlay
      const bgGrad = p.drawingContext.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, 'rgba(25, 30, 40, 0.4)');
      bgGrad.addColorStop(0.5, 'rgba(15, 20, 30, 0.2)');
      bgGrad.addColorStop(1, 'rgba(8, 12, 18, 0.6)');
      p.drawingContext.fillStyle = bgGrad;
      p.noStroke();
      p.rect(0, 0, W, H);

      // Water surface line
      p.stroke(30, 50, 60, 40);
      p.strokeWeight(1);
      p.line(0, waterY, W, waterY);

      // Subtle water shimmer
      const sh = p.sin(t * 1.5) * 0.5 + 0.5;
      p.stroke(40, 70, 85, 15 + sh * 10);
      for (let x = 0; x < W; x += 40) {
        const sy = waterY + p.sin(x * 0.012 + t * 0.8) * 2;
        p.line(x, sy, x + 12, sy);
      }

      // ===== DETECT SONG RESTART / SEEK BACK =====
      // When currentTime jumps backward (e.g. song ended and replayed), reset lyric rain
      if (state.currentTime < lastCurrentTime - 1) {
        resetColumns();
      }
      lastCurrentTime = state.currentTime;

      // ===== DETECT LYRIC CHANGE =====
      const lyricsKey = currentLyrics.map(l => l.time + ':' + l.text.substring(0, 5)).join('|');
      if (lyricsKey !== lastLyricsKey) {
        lastLyricsKey = lyricsKey;
        resetColumns();
      }

      // ===== SPAWN COLUMNS FOR CURRENT/UPCOMING LYRICS =====
      if (state.isPlaying && currentLyrics.length > 0) {
        for (const line of currentLyrics) {
          const key = line.time + '|' + line.text;
          if (triggeredLines.has(key)) continue;

          // Start falling 2s before the lyric time, keep window for seek/jump
          const timeUntil = line.time - state.currentTime;
          if (timeUntil <= 2.0 && timeUntil > -8.0) {
            triggeredLines.add(key);
            addColumnsForLine(line);
          }
        }
      }

      // Clean up old done columns
      for (let i = columns.length - 1; i >= 0; i--) {
        if (columns[i].done) columns.splice(i, 1);
      }

      // ===== AMBIENT RAIN (when no lyrics / instrumental parts) =====
      const density = densityRef.current;
      const rainParams = {
        light: { base: 35, speedMin: 8, speedMax: 13, lenMin: 12, lenMax: 22, widthMin: 0.5, widthMax: 1.0, tilt: 0, rippleChance: 0.6 },
        medium: { base: 90, speedMin: 10, speedMax: 16, lenMin: 8, lenMax: 16, widthMin: 0.8, widthMax: 1.6, tilt: 0.03, rippleChance: 0.85 },
        heavy: { base: 170, speedMin: 14, speedMax: 22, lenMin: 5, lenMax: 12, widthMin: 1.3, widthMax: 2.6, tilt: 0.08, rippleChance: 1.0 },
      }[density];

      if (state.isPlaying && currentLyrics.length === 0) {
        const energyBoost = 1 + state.overallEnergy * 0.5 + state.bassEnergy * 0.3;
        const targetCount = Math.floor(rainParams.base * energyBoost);

        if (raindrops.length < targetCount) {
          const missing = targetCount - raindrops.length;
          const toSpawn = Math.min(missing, Math.max(1, Math.floor(missing / 12)));
          for (let i = 0; i < toSpawn; i++) {
            const startX = p.random(W * 0.15, W * 0.85);
            raindrops.push({
              x: startX,
              y: p.random(-H, -20),
              speed: p.random(rainParams.speedMin, rainParams.speedMax) * (1 + state.bassEnergy * 0.25),
              length: p.random(rainParams.lenMin, rainParams.lenMax),
              opacity: p.random(0.25, 0.75),
              width: p.random(rainParams.widthMin, rainParams.widthMax),
              tilt: rainParams.tilt,
              rippleChance: rainParams.rippleChance,
            });
          }
        }
      }

      // Update & draw ambient raindrops
      for (let i = raindrops.length - 1; i >= 0; i--) {
        const drop = raindrops[i];
        drop.y += drop.speed;
        drop.x += drop.speed * drop.tilt;

        // Draw rain streak with slight tilt for heavy rain
        p.stroke(170, 200, 220, drop.opacity * 180);
        p.strokeWeight(drop.width);
        p.line(drop.x, drop.y, drop.x - drop.length * drop.tilt * 4, drop.y + drop.length);

        // Hit water surface
        if (drop.y >= waterY) {
          if (Math.random() < drop.rippleChance) {
            spawnRipple(drop.x, waterY);
          }
          raindrops.splice(i, 1);
        } else if (drop.y > H + 50 || drop.x < -20 || drop.x > W + 20) {
          raindrops.splice(i, 1);
        }
      }

      // ===== BEAT FLASH =====
      if (state.bassEnergy > 0.55 && t - lastBeat > 0.3) {
        lastBeat = t;
        beatFlash = state.bassEnergy;
      }
      if (beatFlash > 0.01) {
        p.fill(40, 80, 100, beatFlash * 12);
        p.noStroke();
        p.rect(0, 0, W, H);
        beatFlash *= 0.92;
      }

      // ===== UPDATE & DRAW COLUMNS =====
      for (const col of columns) {
        if (!col.active || col.done) continue;

        // Update head position
        col.headY += col.speed;

        // Add new char positions at head
        const charSpacing = 18; // vertical spacing between chars
        const expectedChars = Math.floor((col.headY + 200) / charSpacing);
        
        // Ensure we have enough char positions
        while (col.charPositions.length < expectedChars && col.charPositions.length < col.chars.length * 3) {
          col.charPositions.push({
            y: col.headY - col.charPositions.length * charSpacing,
            alpha: 1.0,
          });
        }

        // Update all char positions (they follow the head)
        for (let i = 0; i < col.charPositions.length; i++) {
          col.charPositions[i].y = col.headY - i * charSpacing;
          // Fade out chars that are behind
          const distFromHead = i * charSpacing;
          if (distFromHead < 60) {
            col.charPositions[i].alpha = distFromHead / 60; // bright at head
          } else if (distFromHead > 150) {
            col.charPositions[i].alpha = Math.max(0, 1 - (distFromHead - 150) / 200);
          } else {
            col.charPositions[i].alpha = 1.0;
          }
        }

        // Check if head hit water
        if (col.headY >= waterY && !col.rippleSpawned) {
          col.rippleSpawned = true;
          spawnRipple(col.x, waterY);
          spawnSplash(col.x, waterY, col.color);
        }

        // Check if entire column has passed
        if (col.charPositions.length > 0) {
          const lastChar = col.charPositions[col.charPositions.length - 1];
          if (lastChar.y > waterY + 50) {
            col.done = true;
            col.active = false;
          }
        }

        // ---- DRAW THE COLUMN ----
        const [cr, cg, cb] = col.color;

        for (let i = col.charPositions.length - 1; i >= 0; i--) {
          const cp = col.charPositions[i];
          if (cp.y < -30 || cp.y > waterY + 20) continue;

          const char = col.chars[i % col.chars.length];
          const alpha = cp.alpha;

          if (alpha < 0.02) continue;

          p.push();
          p.translate(col.x, cp.y);

          if (i === 0) {
            // HEAD CHAR - brightest with glow
            p.drawingContext.shadowColor = `rgba(${cr},${cg},${cb},0.8)`;
            p.drawingContext.shadowBlur = 20;
            p.fill(cr + 30, cg + 30, cb + 30, 255 * alpha);
            p.noStroke();
            p.textSize(16);
            p.textStyle(p.BOLD);
            p.text(char, 0, 0);
            p.textStyle(p.NORMAL);
            p.drawingContext.shadowBlur = 0;
          } else if (i < 4) {
            // NEAR HEAD - bright
            p.fill(cr, cg, cb, 200 * alpha);
            p.noStroke();
            p.textSize(14);
            p.text(char, 0, 0);
          } else {
            // TAIL - fading trail
            p.fill(cr * 0.7, cg * 0.7, cb * 0.7, 100 * alpha);
            p.noStroke();
            p.textSize(13);
            p.text(char, 0, 0);
          }

          p.pop();
        }

        // Draw a subtle vertical line connecting the column
        if (col.charPositions.length > 2) {
          const head = col.charPositions[0];
          const tailIdx = Math.min(col.charPositions.length - 1, 15);
          const tail = col.charPositions[tailIdx];
          if (head.y < waterY && tail.y > -50) {
            p.stroke(cr * 0.5, cg * 0.5, cb * 0.5, 15);
            p.strokeWeight(0.5);
            p.line(col.x, Math.max(head.y - 10, -10), col.x, Math.min(tail.y + 10, waterY));
          }
        }
      }

      // ===== UPDATE & DRAW RIPPLES =====
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        const age = (p.millis() - r.born) / 1000;
        r.r += 1.0 + state.overallEnergy;
        if (age > 2.5) { ripples.splice(i, 1); continue; }

        p.push();
        for (let ri = 0; ri < 2; ri++) {
          const rd = ri * 0.15;
          const ra = age - rd;
          if (ra < 0) continue;
          const prog = ra / 1.0;
          const rr = r.r + prog * r.maxR;
          const ro = r.opacity * (1 - prog) * (1 - ri * 0.3);
          if (ro <= 0) continue;
          p.noFill();
          p.stroke(160, 190, 210, ro);
          p.strokeWeight(r.lw * (1 - prog * 0.5));
          p.ellipse(r.x, r.y, rr * 2, rr * 0.4);
        }
        p.pop();
      }

      // ===== UPDATE & DRAW SPLASHES =====
      for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.1;
        s.life -= 1 / s.maxLife;
        if (s.life <= 0) { splashes.splice(i, 1); continue; }

        const [sr, sg, sb] = s.color;
        p.fill(sr, sg, sb, 200 * s.life);
        p.noStroke();
        p.ellipse(s.x, s.y, s.size * s.life * 2, s.size * s.life * 2);
      }

      // ===== AMBIENT GLOW =====
      if (state.isPlaying) {
        const glow = p.drawingContext.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.5);
        glow.addColorStop(0, `rgba(20, 60, 80, ${state.overallEnergy * 0.04})`);
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        p.drawingContext.fillStyle = glow;
        p.noStroke();
        p.rect(0, 0, W, H);
      }
    };

    p.windowResized = () => {
      W = containerRef.current?.clientWidth || p.windowWidth;
      H = containerRef.current?.clientHeight || p.windowHeight;
      p.resizeCanvas(W, H);
      waterY = H * 0.78;
    };
  }, []);

  useEffect(() => {
    if (containerRef.current && !p5Ref.current) {
      p5Ref.current = new p5(sketch);
    }
    return () => {
      if (p5Ref.current) { p5Ref.current.remove(); p5Ref.current = null; }
    };
  }, [sketch]);

  return <div ref={containerRef} className="absolute inset-0 z-[1]" />;
}
