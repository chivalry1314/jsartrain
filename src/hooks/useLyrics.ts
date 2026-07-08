import { useState, useCallback, useRef } from 'react';
import type { LyricLine, LyricWord } from '@/types';

export function useLyrics() {
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [currentLine, setCurrentLine] = useState<LyricLine | null>(null);
  const [currentWord, setCurrentWord] = useState<LyricWord | null>(null);
  const [hasLyrics, setHasLyrics] = useState(false);
  const lyricsRef = useRef<LyricLine[]>([]);

  const parseLRC = useCallback((lrcText: string): LyricLine[] => {
    const lines: LyricLine[] = [];
    const lineRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/g;
    let match;

    // Skip metadata lines (contains : but not time-like patterns)
    const skipPatterns = ['ti:', 'ar:', 'al:', 'by:', 'offset', 'hash', 'qq:', 'id:', '☆', '★', '作词', '作曲', '编曲', '制作人', '监制', '统筹', '混音', '和声', '录音', '吉他', '贝斯', '鼓', '键盘', '弦乐', '民乐', '出品', '发行', '版权', 'op:', 'sp:'];

    while ((match = lineRegex.exec(lrcText)) !== null) {
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      const ms = parseInt(match[3].padEnd(3, '0'));
      const time = minutes * 60 + seconds + ms / 1000;
      const text = match[4].trim();

      if (!text) continue;

      // Skip metadata lines
      const lower = text.toLowerCase();
      if (skipPatterns.some(p => lower.includes(p.toLowerCase()))) continue;

      // Skip lines that are just email addresses or usernames
      if (text.includes('@') && text.length > 10) continue;

      // Skip lines that are mostly special characters / ASCII
      const asciiRatio = text.split('').filter(c => c.charCodeAt(0) < 128).length / text.length;
      if (asciiRatio > 0.7 && text.length > 8) continue;

      // Parse individual words with approximate timing
      const chars = text.split('');
      const charDuration = text.length > 0 ? 0.3 / text.length : 0.3;
      const words: LyricWord[] = chars.map((char, i) => ({
        time: time + i * charDuration,
        text: char,
        duration: charDuration,
      }));

      lines.push({ time, text, words });
    }

    lines.sort((a, b) => a.time - b.time);
    return lines;
  }, []);

  const loadLyrics = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        const parsed = parseLRC(text);
        setLyrics(parsed);
        lyricsRef.current = parsed;
        setHasLyrics(parsed.length > 0);
      }
    };
    reader.readAsText(file);
  }, [parseLRC]);

  const loadLyricsFromText = useCallback((text: string) => {
    const parsed = parseLRC(text);
    setLyrics(parsed);
    lyricsRef.current = parsed;
    setHasLyrics(parsed.length > 0);
  }, [parseLRC]);

  const updateCurrentLyric = useCallback((currentTime: number) => {
    const lines = lyricsRef.current;
    if (lines.length === 0) return;

    // Find current line
    let lineIndex = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (currentTime >= lines[i].time) {
        lineIndex = i;
        break;
      }
    }

    if (lineIndex >= 0) {
      const line = lines[lineIndex];
      setCurrentLine(line);

      // Find current word
      const wordIndex = line.words.findIndex(
        (w, i) => {
          const nextW = line.words[i + 1];
          return currentTime >= w.time && (!nextW || currentTime < nextW.time);
        }
      );

      if (wordIndex >= 0) {
        setCurrentWord(line.words[wordIndex]);
      }
    } else {
      setCurrentLine(null);
      setCurrentWord(null);
    }
  }, []);

  const getNextTriggerWord = useCallback((currentTime: number, lookahead = 2.0): LyricWord | null => {
    const lines = lyricsRef.current;
    for (const line of lines) {
      for (const word of line.words) {
        if (word.time > currentTime && word.time <= currentTime + lookahead) {
          return word;
        }
      }
    }
    return null;
  }, []);

  return {
    lyrics,
    currentLine,
    currentWord,
    hasLyrics,
    loadLyrics,
    loadLyricsFromText,
    updateCurrentLyric,
    getNextTriggerWord,
  };
}
