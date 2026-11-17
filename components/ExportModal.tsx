import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Download, 
  X, 
  Film, 
  Layers, 
  Archive, 
  Image as ImageIcon, 
  Play, 
  Pause, 
  Sparkles, 
  Loader2, 
  Sliders, 
  Grid3X3,
  CheckCircle2
} from 'lucide-react';
import { GridState, ProjectType } from '../types';
import { Language, getTranslation } from '../src/l10n';
import { 
  renderGridToCanvas, 
  generateGifBlob, 
  generateSpriteSheetCanvas, 
  generateFramesZip, 
  triggerDownload 
} from '../src/utils/exportAnimation';
import { toast } from 'sonner';

export type ExportFormat = 'gif' | 'spritesheet' | 'zip' | 'png';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  frames: GridState[];
  currentFrameIndex: number;
  width: number;
  height: number;
  projectType: ProjectType;
  defaultFps: number;
  projectName: string;
  language?: Language;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  frames,
  currentFrameIndex,
  width,
  height,
  projectType,
  defaultFps,
  projectName,
  language = 'ru'
}) => {
  const isAnimated = projectType === 'animated' && frames.length > 1;
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(isAnimated ? 'gif' : 'png');
  const [scale, setScale] = useState<number>(() => {
    // Pick sensible default scale depending on canvas dimension
    const maxDim = Math.max(width, height);
    if (maxDim <= 16) return 16;
    if (maxDim <= 32) return 8;
    if (maxDim <= 64) return 4;
    return 2;
  });
  
  const [fps, setFps] = useState<number>(defaultFps || 8);
  const [transparentBg, setTransparentBg] = useState<boolean>(true);
  const [spriteLayout, setSpriteLayout] = useState<'horizontal' | 'vertical' | 'grid'>('horizontal');
  const [spriteColumns, setSpriteColumns] = useState<number>(Math.min(frames.length, 4));
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Live preview animation in modal
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [previewFrameIdx, setPreviewFrameIdx] = useState<number>(currentFrameIndex);
  const [isPlayingPreview, setIsPlayingPreview] = useState<boolean>(true);

  // Set default format when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedFormat(projectType === 'animated' && frames.length > 1 ? 'gif' : 'png');
      setFps(defaultFps || 8);
      setPreviewFrameIdx(currentFrameIndex);
      setIsPlayingPreview(true);
    }
  }, [isOpen, projectType, frames.length, defaultFps, currentFrameIndex]);

  // Live preview loop
  useEffect(() => {
    if (!isOpen || !isAnimated || !isPlayingPreview) return;

    const intervalTime = Math.max(20, Math.round(1000 / (fps || 8)));
    const interval = setInterval(() => {
      setPreviewFrameIdx(prev => (prev + 1) % frames.length);
    }, intervalTime);

    return () => clearInterval(interval);
  }, [isOpen, isAnimated, isPlayingPreview, fps, frames.length]);

  // Render preview frame to canvas
  useEffect(() => {
    if (!isOpen) return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const activeGrid = (isAnimated && frames[previewFrameIdx]) ? frames[previewFrameIdx] : (frames[currentFrameIndex] || frames[0]);
    if (!activeGrid) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!transparentBg) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const cellW = canvas.width / width;
    const cellH = canvas.height / height;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const color = activeGrid[y]?.[x];
        if (color && color !== 'transparent') {
          ctx.fillStyle = color;
          ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
        }
      }
    }
  }, [isOpen, previewFrameIdx, isAnimated, frames, currentFrameIndex, width, height, transparentBg]);

  const outputWidth = width * scale;
  const outputHeight = height * scale;

  const handleExport = async () => {
    if (isGenerating) return;
    setIsGenerating(true);

    const safeName = (projectName || 'pixel-art')
      .toLowerCase()
      .replace(/[^a-z0-9а-яё\s_-]/gi, '')
      .replace(/\s+/g, '-');

    try {
      if (selectedFormat === 'gif') {
        const blob = await generateGifBlob({
          frames: frames.length > 0 ? frames : [frames[0]],
          width,
          height,
          fps,
          scale,
          transparent: transparentBg,
          backgroundColor: '#0f172a'
        });
        triggerDownload(blob, `${safeName}-${scale}x-${fps}fps.gif`);
      } else if (selectedFormat === 'spritesheet') {
        const sheetCanvas = generateSpriteSheetCanvas({
          frames,
          width,
          height,
          scale,
          layout: spriteLayout,
          columns: spriteColumns,
          backgroundColor: transparentBg ? undefined : '#0f172a'
        });
        triggerDownload(sheetCanvas.toDataURL('image/png'), `${safeName}-spritesheet-${scale}x.png`);
      } else if (selectedFormat === 'zip') {
        const zipBlob = await generateFramesZip(frames, width, height, scale, safeName);
        triggerDownload(zipBlob, `${safeName}-frames-${scale}x.zip`);
      } else if (selectedFormat === 'png') {
        const targetGrid = isAnimated ? frames[previewFrameIdx] : (frames[currentFrameIndex] || frames[0]);
        const singleCanvas = renderGridToCanvas(targetGrid, width, height, scale, transparentBg ? null : '#0f172a');
        triggerDownload(singleCanvas.toDataURL('image/png'), `${safeName}-frame${previewFrameIdx + 1}-${scale}x.png`);
      }

      toast.success(getTranslation(language, 'exportSuccessToast'));
      setTimeout(() => {
        setIsGenerating(false);
        onClose();
      }, 500);
    } catch (err: any) {
      console.error("Export error:", err);
      toast.error('Ошибка экспорта файла', {
        description: err.message || 'Не удалось сгенерировать изображение'
      });
      setIsGenerating(false);
    }
  };

  const scaleOptions = [1, 2, 4, 8, 16, 24, 32];
  const fpsPresets = [4, 8, 12, 16, 24, 30, 60];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="bg-slate-900 border border-indigo-500/20 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh] ring-1 ring-white/10"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-slate-950/60 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 border border-fuchsia-500/30 rounded-xl text-fuchsia-400">
                  <Download size={20} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    {getTranslation(language, 'exportTitle')}
                    {isAnimated && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30">
                        {frames.length} {getTranslation(language, 'framesTitle').toLowerCase()}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {getTranslation(language, 'exportSubtitle')}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-5 min-h-0 scrollbar-thin scrollbar-thumb-slate-700">
              
              {/* Left Column: Interactive Live Preview */}
              <div className="md:col-span-5 flex flex-col gap-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Предпросмотр</div>
                
                {/* Checkerboard Preview Stage */}
                <div className="relative aspect-square w-full rounded-xl overflow-hidden border border-white/10 bg-slate-950 shadow-inner flex items-center justify-center p-4">
                  {/* Transparent Checkerboard */}
                  {transparentBg && (
                    <div 
                      className="absolute inset-0 opacity-25 pointer-events-none"
                      style={{
                        backgroundImage: `url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScyJyBoZWlnaHQ9JzInIHZpZXdCb3g9JzAgMCAyIDInPjxyZWN0IHdpZHRoPScyJyBoZWlnaHQ9JzInIGZpbGw9JyMwZjE3MmEnLz48cmVjdCB3aWR0aD0nMScgaGVpZ2h0PScxJyBmaWxsPScjMWUyOTNiJy8+PHJlY3QgeD0nMScgeT0nMScgd2lkdGg9JzEnIGhlaWdodD0nMScgZmlsbD0nIzFlMjkzYicvPjwvc3ZnPg==")`,
                        backgroundSize: '16px 16px',
                      }}
                    />
                  )}

                  <canvas
                    ref={previewCanvasRef}
                    width={200}
                    height={200}
                    className="relative z-10 max-w-full max-h-full object-contain shadow-md rounded"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>

                {/* Animation Controls for Animated Artworks */}
                {isAnimated && (
                  <div className="flex items-center justify-between bg-slate-950/60 border border-white/5 p-2 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setIsPlayingPreview(!isPlayingPreview)}
                      className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      {isPlayingPreview ? <Pause size={12} /> : <Play size={12} />}
                      <span>{isPlayingPreview ? 'Пауза' : 'Пуск'}</span>
                    </button>

                    <span className="text-xs font-mono text-slate-300">
                      Кадр: <strong className="text-fuchsia-400">{previewFrameIdx + 1}</strong> / {frames.length}
                    </span>
                  </div>
                )}

                {/* Output Dimension Card */}
                <div className="bg-slate-950/40 border border-white/5 p-3 rounded-xl flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">Размер файла:</span>
                  <span className="text-emerald-400 font-bold">
                    {outputWidth} × {outputHeight} px
                  </span>
                </div>
              </div>

              {/* Right Column: Export Settings & Formats */}
              <div className="md:col-span-7 flex flex-col gap-4">
                
                {/* 1. Format Selection */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    {getTranslation(language, 'exportFormat')}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {isAnimated && (
                      <button
                        type="button"
                        onClick={() => setSelectedFormat('gif')}
                        className={`p-2.5 rounded-xl border flex flex-col gap-1 text-left transition-all cursor-pointer ${
                          selectedFormat === 'gif'
                            ? 'bg-fuchsia-500/20 border-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/10'
                            : 'bg-slate-950/50 border-white/10 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <Film size={15} className={selectedFormat === 'gif' ? 'text-fuchsia-400' : 'text-slate-400'} />
                          <span className="text-xs font-bold">GIF Анимация</span>
                        </div>
                        <span className="text-[10px] text-slate-400 leading-tight">Зацикленная анимация (.gif)</span>
                      </button>
                    )}

                    {isAnimated && (
                      <button
                        type="button"
                        onClick={() => setSelectedFormat('spritesheet')}
                        className={`p-2.5 rounded-xl border flex flex-col gap-1 text-left transition-all cursor-pointer ${
                          selectedFormat === 'spritesheet'
                            ? 'bg-indigo-500/20 border-indigo-500 text-white shadow-lg shadow-indigo-500/10'
                            : 'bg-slate-950/50 border-white/10 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <Layers size={15} className={selectedFormat === 'spritesheet' ? 'text-indigo-400' : 'text-slate-400'} />
                          <span className="text-xs font-bold">Спрайт-лист</span>
                        </div>
                        <span className="text-[10px] text-slate-400 leading-tight">Все кадры в одном PNG (.png)</span>
                      </button>
                    )}

                    {isAnimated && (
                      <button
                        type="button"
                        onClick={() => setSelectedFormat('zip')}
                        className={`p-2.5 rounded-xl border flex flex-col gap-1 text-left transition-all cursor-pointer ${
                          selectedFormat === 'zip'
                            ? 'bg-cyan-500/20 border-cyan-500 text-white shadow-lg shadow-cyan-500/10'
                            : 'bg-slate-950/50 border-white/10 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <Archive size={15} className={selectedFormat === 'zip' ? 'text-cyan-400' : 'text-slate-400'} />
                          <span className="text-xs font-bold">Архив кадров</span>
                        </div>
                        <span className="text-[10px] text-slate-400 leading-tight">ZIP с набором файлов PNG</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setSelectedFormat('png')}
                      className={`p-2.5 rounded-xl border flex flex-col gap-1 text-left transition-all cursor-pointer ${
                        selectedFormat === 'png'
                          ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                          : 'bg-slate-950/50 border-white/10 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      } ${!isAnimated ? 'col-span-2' : ''}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <ImageIcon size={15} className={selectedFormat === 'png' ? 'text-emerald-400' : 'text-slate-400'} />
                        <span className="text-xs font-bold">Одиночный PNG</span>
                      </div>
                      <span className="text-[10px] text-slate-400 leading-tight">
                        {isAnimated ? 'Текущий выбранный кадр' : 'Высокое качество без потерь'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* 2. Pixel Scale Selector */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300">
                      {getTranslation(language, 'exportScale')}
                    </label>
                    <span className="text-xs font-mono text-cyan-400 font-bold">
                      {scale}x ({outputWidth}×{outputHeight} px)
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {scaleOptions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setScale(s)}
                        className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer ${
                          scale === s
                            ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 scale-105'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-white/5'
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {getTranslation(language, 'exportScaleTip')}
                  </p>
                </div>

                {/* 3. GIF Specific Controls (FPS) */}
                {selectedFormat === 'gif' && (
                  <div className="flex flex-col gap-2 bg-slate-950/40 p-3 rounded-xl border border-white/5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Sliders size={13} className="text-fuchsia-400" />
                        {getTranslation(language, 'exportFps')}
                      </label>
                      <span className="text-xs font-mono font-bold text-fuchsia-400">{fps} FPS</span>
                    </div>

                    <input
                      type="range"
                      min="1"
                      max="30"
                      value={fps}
                      onChange={(e) => setFps(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-fuchsia-500"
                    />

                    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                      {fpsPresets.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setFps(preset)}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold cursor-pointer ${
                            fps === preset
                              ? 'bg-fuchsia-500/30 text-fuchsia-300 border border-fuchsia-500/50'
                              : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {preset} fps
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Sprite Sheet Specific Controls (Layout) */}
                {selectedFormat === 'spritesheet' && (
                  <div className="flex flex-col gap-2.5 bg-slate-950/40 p-3 rounded-xl border border-white/5">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Grid3X3 size={13} className="text-indigo-400" />
                      {getTranslation(language, 'exportLayout')}
                    </label>

                    <div className="grid grid-cols-3 gap-1.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setSpriteLayout('horizontal')}
                        className={`p-1.5 rounded-lg border text-center font-medium cursor-pointer ${
                          spriteLayout === 'horizontal'
                            ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                            : 'bg-slate-800 border-white/5 text-slate-400'
                        }`}
                      >
                        Лента →
                      </button>
                      <button
                        type="button"
                        onClick={() => setSpriteLayout('vertical')}
                        className={`p-1.5 rounded-lg border text-center font-medium cursor-pointer ${
                          spriteLayout === 'vertical'
                            ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                            : 'bg-slate-800 border-white/5 text-slate-400'
                        }`}
                      >
                        Лента ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => setSpriteLayout('grid')}
                        className={`p-1.5 rounded-lg border text-center font-medium cursor-pointer ${
                          spriteLayout === 'grid'
                            ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                            : 'bg-slate-800 border-white/5 text-slate-400'
                        }`}
                      >
                        Сетка
                      </button>
                    </div>

                    {spriteLayout === 'grid' && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-slate-400">{getTranslation(language, 'exportColumns')}</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="1"
                            max={Math.max(1, frames.length)}
                            value={spriteColumns}
                            onChange={(e) => setSpriteColumns(Number(e.target.value))}
                            className="w-24 h-1.5 bg-slate-800 rounded appearance-none accent-indigo-500"
                          />
                          <span className="text-xs font-mono font-bold text-indigo-300">{spriteColumns}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 5. Background Options */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-white/5">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-300">
                      {getTranslation(language, 'exportTransparentBg')}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Сохранить альфа-канал без фонового цвета
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTransparentBg(!transparentBg)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ${
                      transparentBg ? 'bg-indigo-600' : 'bg-slate-700'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                        transparentBg ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-white/10 bg-slate-950/60 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={isGenerating}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-all cursor-pointer"
              >
                {getTranslation(language, 'cancelButton')}
              </button>

              <button
                type="button"
                onClick={handleExport}
                disabled={isGenerating}
                className="
                  relative group overflow-hidden
                  px-6 py-2.5 rounded-xl font-bold text-xs text-white
                  bg-gradient-to-r from-indigo-600 via-fuchsia-500 to-indigo-600
                  bg-[length:200%_auto] animate-[gradient_6s_ease-in-out_infinite]
                  shadow-[0_0_20px_rgba(192,38,211,0.4)]
                  border border-white/20
                  hover:shadow-[0_0_30px_rgba(192,38,211,0.7)]
                  hover:scale-105 active:scale-95
                  disabled:opacity-50 disabled:pointer-events-none
                  transition-all duration-300
                  cursor-pointer flex items-center gap-2
                "
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>{getTranslation(language, 'exportGenerating')}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} className="text-fuchsia-300" />
                    <span>{getTranslation(language, 'exportDownloadBtn')}</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
