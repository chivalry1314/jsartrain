import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Music, Disc3, Clock, X, ListMusic, ChevronRight, AlertCircle, WifiOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { searchSongs, formatDuration, type MetingSong } from '@/services/musicApi';

interface MusicSearchProps {
  onSelectSong: (song: MetingSong) => void;
  isVisible: boolean;
  onClose: () => void;
}

const HOT_KEYWORDS = ['周杰伦', '林俊杰', '夏日', '雨', '温柔', '晴天', '夜曲', '陈奕迅'];

export default function MusicSearch({ onSelectSong, isVisible, onClose }: MusicSearchProps) {
  const [query, setQuery] = useState('');
  const [songs, setSongs] = useState<MetingSong[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus input when visible
  useEffect(() => {
    if (isVisible) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isVisible]);

  // Perform search
  const doSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setSongs([]);
      setHasSearched(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);
    setError(null);

    try {
      const results = await searchSongs(trimmed);
      setSongs(results);
      setError(null);
    } catch (err) {
      console.error('[Search] Failed:', err);
      setSongs([]);
      setError('搜索失败，请检查网络后重试');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle query change (no realtime search)
  const handleQueryChange = (value: string) => {
    setQuery(value);
    setError(null);
    if (!value.trim()) {
      setSongs([]);
      setHasSearched(false);
      setError(null);
    }
  };

  // Handle keyword click
  const handleSelectKeyword = (keyword: string) => {
    setQuery(keyword);
    setError(null);
    doSearch(keyword);
  };

  // Handle explicit search button click
  const handleSearchClick = () => {
    doSearch(query);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 glass-panel rounded-2xl overflow-hidden shadow-2xl border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-teal-400" />
            <h3 className="text-base font-medium text-slate-100">在线选歌</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-slate-200 w-8 h-8">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              ref={searchInputRef}
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="搜索歌曲、歌手..."
              className="pl-10 pr-10 bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500 focus:border-teal-500/50 focus:ring-teal-500/20"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  doSearch(query);
                }
              }}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {query && (
                <button
                  onClick={() => handleQueryChange('')}
                  className="p-1 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={handleSearchClick}
                disabled={isLoading || !query.trim()}
                className="p-1.5 rounded-md bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Hot Keywords */}
        {!hasSearched && !error && (
          <div className="px-5 py-3 border-b border-white/5">
            <p className="text-xs text-slate-500 mb-2">热门搜索</p>
            <div className="flex flex-wrap gap-2">
              {HOT_KEYWORDS.map((kw) => (
                <button
                  key={kw}
                  onClick={() => handleSelectKeyword(kw)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-teal-500/10 text-slate-400 hover:text-teal-300 text-xs transition-all border border-white/5 hover:border-teal-500/20"
                >
                  {kw}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="mx-5 mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-xs text-red-300">{error}</p>
            <button
              onClick={() => doSearch(query)}
              className="ml-auto text-xs text-teal-400 hover:text-teal-300 underline"
            >
              重试
            </button>
          </div>
        )}

        {/* Song List */}
        <ScrollArea className="h-[380px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex items-center gap-2 text-slate-500">
                <Disc3 className="w-5 h-5 animate-spin" />
                <span className="text-sm">搜索中...</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <AlertCircle className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">{error}</p>
              <button
                onClick={() => doSearch(query)}
                className="mt-3 px-4 py-1.5 rounded-lg bg-teal-500/10 text-teal-300 hover:bg-teal-500/20 text-xs transition-all"
              >
                重新搜索
              </button>
            </div>
          ) : hasSearched && songs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Search className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">未找到相关歌曲</p>
            </div>
          ) : !hasSearched ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <ListMusic className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">输入关键词开始搜索</p>
              <p className="text-xs mt-1 text-slate-600">支持歌曲名、歌手名</p>
            </div>
          ) : (
            <div className="py-2">
              <div className="px-5 py-2 text-xs text-slate-500">
                搜索结果：{songs.length} 首
              </div>
              {songs.map((song, index) => (
                <button
                  key={`${song.name}-${song.artist}-${index}`}
                  onClick={() => onSelectSong(song)}
                  className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-white/5 transition-colors group text-left"
                >
                  <span className={`text-xs font-mono w-6 text-center ${
                    index < 3 ? 'text-teal-400 font-bold' : 'text-slate-600'
                  }`}>
                    {index + 1}
                  </span>

                  {song.pic ? (
                    <img
                      src={song.pic}
                      alt={song.album}
                      className="w-10 h-10 rounded-lg object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                      <Music className="w-4 h-4 text-slate-600" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate group-hover:text-teal-300 transition-colors">
                      {song.name}
                    </p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{song.artist}</p>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-slate-600">
                    <Clock className="w-3 h-3" />
                    <span>{formatDuration(song.duration)}</span>
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-teal-400 transition-colors" />
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 text-center">
          <p className="text-xs text-slate-600">
            数据来源：Meting API · 仅供学习交流
          </p>
        </div>
      </div>
    </div>
  );
}
