// Meting API - Pure Frontend Music Service
const API_BASE = 'https://metingapi.nanorocky.top';

// In-memory cache
const searchCache = new Map<string, { data: MetingSong[]; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export interface MetingSong {
  name: string;
  artist: string;
  album: string;
  url: string;
  pic: string;
  lrc: string;
  source: string;
  duration: number;
}

export interface LyricLine {
  time: number;
  text: string;
}

// Fetch with timeout using Promise.race (universally supported)
async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      controller.abort();
      reject(new Error('Request timeout'));
    }, timeoutMs);
  });

  const fetchPromise = fetch(url, { signal: controller.signal });

  return Promise.race([fetchPromise, timeoutPromise]);
}

// Retry helper
async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < retries) {
        await new Promise((r) => setTimeout(r, 500 * (i + 1)));
      }
    }
  }
  throw lastErr;
}

/**
 * Search songs via Meting API
 */
export async function searchSongs(keyword: string): Promise<MetingSong[]> {
  const trimmed = keyword.trim();
  if (!trimmed) return [];

  // Check cache
  const cached = searchCache.get(trimmed);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  const url = `${API_BASE}/?server=netease&type=search&id=0&keyword=${encodeURIComponent(trimmed)}`;

  const res = await withRetry(() => fetchWithTimeout(url, 8000), 2);

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error('Invalid response');
  }

  searchCache.set(trimmed, { data, ts: Date.now() });
  return data as MetingSong[];
}

/**
 * Fetch LRC lyrics for a song
 */
export async function fetchLyrics(lrcUrl: string): Promise<string> {
  try {
    const res = await fetchWithTimeout(lrcUrl, 8000);
    if (!res.ok) return '';
    return res.text();
  } catch {
    return '';
  }
}

/**
 * Parse LRC format text into structured lyrics
 */
export function parseLRC(lrcText: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const lineRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/g;
  let match;

  while ((match = lineRegex.exec(lrcText)) !== null) {
    const minutes = parseInt(match[1]);
    const seconds = parseInt(match[2]);
    const ms = parseInt(match[3].padEnd(3, '0'));
    const time = minutes * 60 + seconds + ms / 1000;
    const text = match[4].trim();

    if (
      text &&
      !text.startsWith('作词') &&
      !text.startsWith('作曲') &&
      !text.startsWith('编曲') &&
      !text.startsWith('制作人') &&
      !text.startsWith('和声') &&
      !text.startsWith('录音') &&
      !text.startsWith('混音')
    ) {
      lines.push({ time, text });
    }
  }

  lines.sort((a, b) => a.time - b.time);
  return lines;
}

/**
 * Format duration from ms to mm:ss
 */
export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/**
 * Get playlist songs
 */
export async function getPlaylist(playlistId: string): Promise<MetingSong[]> {
  const url = `${API_BASE}/?server=netease&type=playlist&id=${playlistId}`;
  const res = await withRetry(() => fetchWithTimeout(url, 10000), 1);
  if (!res.ok) throw new Error('Failed');
  const data = await res.json();
  return data as MetingSong[];
}
