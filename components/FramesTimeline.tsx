import React, { useRef, useEffect } from 'react';
import { Play, Pause, Plus, Copy, Trash2, ChevronLeft, ChevronRight, Eye, Film, Download } from 'lucide-react';
import { GridState } from '../types';
import { Language, getTranslation } from '../src/l10n';

interface FramesTimelineProps {
  frames: GridState[];
  currentFrameIndex: number;
  onSelectFrame: (index: number) => void;
  onAddFrame: () => void;
  onDuplicateFrame: (index: number) => void;
  onDeleteFrame: (index: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  fps: number;
  onChangeFps: (fps: number) => void;
  onionSkin: boolean;
  onToggleOnionSkin: () => void;
  width: number;
  height: number;
  language: Language;
  onHoverFrame?: (index: number | null) => void;
  onExport?: () => void;
}

export const FramesTimeline: React.FC<FramesTimelineProps> = ({
  frames,
  currentFrameIndex,
  onSelectFrame,
  onAddFrame,
  onDuplicateFrame,
  onDeleteFrame,
  isPlaying,
  onTogglePlay,
  fps,
  onChangeFps,
  onionSkin,
  onToggleOnionSkin,
  width,
  height,
  language,
  onHoverFrame,
  onExport
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the active frame into view
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const activeEl = scrollContainerRef.current.children[currentFrameIndex] as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [currentFrameIndex]);

  // Helper to prevent focus retention on buttons so space bar won't trigger button clicks
  const preventFocus = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
  };

  const preventSpace = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <div className="w-full bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-2xl p-2 sm:p-2.5 shadow-xl flex flex-col gap-1.5 select-none">
      {/* Top Controls Row */}
      <div className="flex items-center justify-between flex-wrap gap-2 px-1">
        {/* Play / Pause & Frame Counter */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTogglePlay}
            onMouseDown={preventFocus}
            onKeyDown={preventSpace}
            className={`px-3 py-1 rounded-xl font-bold font-pixel text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95 ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.5)]'
                : 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white shadow-[0_0_15px_rgba(217,70,239,0.5)]'
            }`}
            title={isPlaying ? getTranslation(language, 'pauseAnimation') : getTranslation(language, 'playAnimation')}
          >
            {isPlaying ? <Pause size={13} className="fill-current" /> : <Play size={13} className="fill-current ml-0.5" />}
            <span>{isPlaying ? (language === 'en' ? 'PAUSE' : 'ПАУЗА') : (language === 'en' ? 'PLAY' : 'ПУСК')}</span>
          </button>

          <div className="flex items-center gap-1 bg-slate-800/80 px-2 py-0.5 rounded-xl border border-white/5 text-xs font-mono text-slate-300">
            <span className="text-fuchsia-400 font-bold font-pixel">{currentFrameIndex + 1}</span>
            <span className="text-slate-500">/</span>
            <span className="text-slate-400 font-pixel">{frames.length}</span>
          </div>

          {/* Quick prev / next buttons */}
          <div className="flex items-center gap-0.5 bg-slate-800/60 p-0.5 rounded-lg border border-white/5">
            <button
              type="button"
              onClick={() => onSelectFrame((currentFrameIndex - 1 + frames.length) % frames.length)}
              onMouseDown={preventFocus}
              onKeyDown={preventSpace}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/5 transition-colors cursor-pointer"
              title="Предыдущий кадр"
            >
              <ChevronLeft size={13} />
            </button>
            <button
              type="button"
              onClick={() => onSelectFrame((currentFrameIndex + 1) % frames.length)}
              onMouseDown={preventFocus}
              onKeyDown={preventSpace}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/5 transition-colors cursor-pointer"
              title="Следующий кадр"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>

        {/* FPS & Onion Skin Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Onion Skin Toggle */}
          <button
            type="button"
            onClick={onToggleOnionSkin}
            onMouseDown={preventFocus}
            onKeyDown={preventSpace}
            className={`px-2 py-0.5 rounded-lg border text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
              onionSkin
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                : 'bg-slate-800/60 border-white/5 text-slate-400 hover:text-slate-200'
            }`}
            title={getTranslation(language, 'onionSkin')}
          >
            <Eye size={12} className={onionSkin ? 'text-cyan-400' : 'text-slate-500'} />
            <span className="text-[11px] hidden sm:inline">{getTranslation(language, 'onionSkin')}</span>
          </button>

          {/* FPS Slider / Input */}
          <div className="flex items-center gap-1.5 bg-slate-800/70 px-2 py-0.5 rounded-xl border border-white/5">
            <Film size={12} className="text-fuchsia-400" />
            <span className="text-[10px] font-mono text-slate-400 uppercase">FPS:</span>
            <input
              type="range"
              min="1"
              max="30"
              value={fps}
              onChange={(e) => onChangeFps(parseInt(e.target.value) || 1)}
              onKeyDown={preventSpace}
              className="w-14 sm:w-18 accent-fuchsia-500 cursor-pointer h-1 bg-slate-700 rounded-lg"
            />
            <span className="text-[11px] font-pixel font-bold text-fuchsia-300 w-5 text-center">{fps}</span>
          </div>

          {/* New Frame Button */}
          <button
            type="button"
            onClick={onAddFrame}
            onMouseDown={preventFocus}
            onKeyDown={preventSpace}
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all cursor-pointer active:scale-95"
            title={getTranslation(language, 'addFrame')}
          >
            <Plus size={13} />
            <span className="hidden sm:inline">{getTranslation(language, 'addFrame')}</span>
          </button>

          {/* Quick Export Button */}
          {onExport && (
            <button
              type="button"
              onClick={onExport}
              onMouseDown={preventFocus}
              onKeyDown={preventSpace}
              className="px-2.5 py-1 bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-fuchsia-600/20 transition-all cursor-pointer active:scale-95 border border-white/10"
              title="Экспорт GIF / Кадров"
            >
              <Download size={13} />
              <span className="hidden md:inline">Экспорт</span>
            </button>
          )}
        </div>
      </div>

      {/* Frame Strip */}
      <div 
        ref={scrollContainerRef}
        className="flex items-center gap-2 overflow-x-auto py-1 px-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent min-h-[64px]"
      >
        {frames.map((frame, idx) => {
          const isActive = idx === currentFrameIndex;
          return (
            <div
              key={idx}
              onClick={() => onSelectFrame(idx)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDeleteFrame(idx);
              }}
              onMouseEnter={() => onHoverFrame?.(idx)}
              onMouseLeave={() => onHoverFrame?.(null)}
              className={`group relative shrink-0 rounded-xl p-1 flex flex-col items-center gap-0.5 cursor-pointer transition-all border-2 ${
                isActive
                  ? 'border-fuchsia-500 bg-fuchsia-950/40 shadow-[0_0_12px_rgba(217,70,239,0.3)] scale-102'
                  : 'border-white/10 bg-slate-800/40 hover:border-white/30 hover:bg-slate-800/80'
              }`}
              title={
                language === 'en'
                  ? `Frame #${idx + 1}\n• Left click: Select\n• Right click: Delete frame\n• Ctrl+C (hover): Copy frame\n• Ctrl+V: Paste frame`
                  : `Кадр #${idx + 1}\n• ЛКМ: Выбрать\n• ПКМ: Удалить кадр\n• Ctrl+C (навести мышь): Копировать кадр\n• Ctrl+V: Вставить кадр`
              }
            >
              {/* Frame thumbnail canvas */}
              <div 
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg bg-slate-950 overflow-hidden relative border border-white/5"
                style={{
                  backgroundImage: `url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScyJyBoZWlnaHQ9JzInIHZpZXdCb3g9JzAgMCAyIDInPjxyZWN0IHdpZHRoPScyJyBoZWlnaHQ9JzInIGZpbGw9JyMwZjE3MmEnLz48cmVjdCB3aWR0aD0nMScgaGVpZ2h0PScxJyBmaWxsPScjMWUyOTNiJy8+PHJlY3QgeD0nMScgeT0nMScgd2lkdGg9JzEnIGhlaWdodD0nMScgZmlsbD0nIzFlMjkzYicvPjwvc3ZnPg==")`,
                  backgroundSize: '8px 8px'
                }}
              >
                <FrameThumbnail frame={frame} width={width} height={height} />
              </div>

              {/* Frame Label & Quick Actions */}
              <div className="flex items-center justify-between w-full px-0.5">
                <span className={`text-[9px] font-pixel ${isActive ? 'text-fuchsia-300 font-bold' : 'text-slate-400'}`}>
                  #{idx + 1}
                </span>

                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicateFrame(idx);
                    }}
                    onMouseDown={preventFocus}
                    onKeyDown={preventSpace}
                    className="p-0.5 text-slate-400 hover:text-indigo-300 transition-colors"
                    title={getTranslation(language, 'duplicateFrame')}
                  >
                    <Copy size={10} />
                  </button>
                  {frames.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteFrame(idx);
                      }}
                      onMouseDown={preventFocus}
                      onKeyDown={preventSpace}
                      className="p-0.5 text-slate-400 hover:text-rose-400 transition-colors"
                      title={language === 'en' ? 'Delete frame (Right-click also deletes)' : 'Удалить кадр (или нажмите ПКМ)'}
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
              </div>

              {/* Indicator Dot for Active Frame */}
              {isActive && (
                <div className="w-1 h-1 rounded-full bg-fuchsia-400 animate-pulse" />
              )}
            </div>
          );
        })}

        {/* Add Frame End Button */}
        <button
          type="button"
          onClick={onAddFrame}
          onMouseDown={preventFocus}
          onKeyDown={preventSpace}
          className="shrink-0 w-14 h-14 rounded-xl border-2 border-dashed border-white/20 hover:border-fuchsia-400/60 bg-slate-800/20 hover:bg-fuchsia-500/10 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-fuchsia-300 transition-all cursor-pointer group"
          title={getTranslation(language, 'addFrame')}
        >
          <Plus size={18} className="group-hover:scale-110 transition-transform" />
          <span className="text-[8px] font-mono uppercase">{language === 'en' ? 'ADD' : '+КАДР'}</span>
        </button>
      </div>
    </div>
  );
};

// Thumbnail renderer using HTML Canvas
const FrameThumbnail: React.FC<{ frame: GridState; width: number; height: number }> = ({ frame, width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const color = frame[y]?.[x];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }, [frame, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="w-full h-full"
      style={{ imageRendering: 'pixelated' }}
    />
  );
};
