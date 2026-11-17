import React from 'react';
import { Pencil, Eraser, PaintBucket, Pipette, Blend, Minus, Ruler, FlipHorizontal } from 'lucide-react';
import { ToolType } from '../types';
import { Language, getTranslation } from '../src/l10n';

interface ToolsProps {
  activeTool: ToolType;
  setTool: (t: ToolType) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
  language?: Language;
}

export const Tools: React.FC<ToolsProps> = ({ 
  activeTool, 
  setTool, 
  brushSize, 
  setBrushSize,
  language = 'ru'
}) => {
  const tools = [
    { type: ToolType.PEN, icon: <Pencil size={18} />, labelKey: 'pen' as const, key: 'B' },
    { type: ToolType.ERASER, icon: <Eraser size={18} />, labelKey: 'eraser' as const, key: 'E' },
    { type: ToolType.MIRROR, icon: <FlipHorizontal size={18} />, labelKey: 'mirror' as const, key: 'X' },
    { type: ToolType.LINE, icon: <Minus size={18} className="-rotate-45" />, labelKey: 'line' as const, key: 'L' },
    { type: ToolType.FILL, icon: <PaintBucket size={18} />, labelKey: 'fill' as const, key: 'F' },
    { type: ToolType.PICKER, icon: <Pipette size={18} />, labelKey: 'picker' as const, key: 'P' },
    { type: ToolType.GRADIENT, icon: <Blend size={18} />, labelKey: 'gradient' as const, key: 'G' },
    { type: ToolType.RULER, icon: <Ruler size={18} />, labelKey: 'ruler' as const, key: 'M' },
  ];

  const preventFocus = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
  };

  return (
    <div className="flex flex-col gap-2 p-2 bg-slate-900/90 border border-white/10 rounded-2xl shadow-xl ring-1 ring-white/5 items-center w-full md:w-auto">
      {/* 2 columns on desktop from the top, flex row wrapped on mobile */}
      <div className="grid grid-cols-4 sm:grid-cols-8 md:grid-cols-2 gap-1.5 w-full">
        {tools.map((tool) => {
          const label = getTranslation(language, tool.labelKey);
          const isActive = activeTool === tool.type;
          return (
            <button
              key={tool.type}
              type="button"
              onClick={() => setTool(tool.type)}
              onMouseDown={preventFocus}
              className={`
                p-2 rounded-xl transition-all duration-200 relative group focus:outline-none cursor-pointer flex items-center justify-center
                ${isActive 
                  ? 'bg-indigo-600 text-white shadow-lg ring-2 ring-indigo-400 scale-102' 
                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-white border border-white/5'}
              `}
              title={`${label} (${tool.key})`}
            >
              {tool.icon}
              <span className="absolute left-full ml-2 px-2 py-1 bg-slate-950 text-xs text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none md:block hidden shadow-xl border border-white/10">
                {label} <span className="text-indigo-300 font-mono font-bold">[{tool.key}]</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="w-full h-[1px] bg-white/10 my-0.5" />
      
      {/* Brush Size Controller */}
      <div className="flex flex-col items-center gap-1 group relative py-0.5 w-full" title={`${getTranslation(language, 'brushSizeLabel')} ${brushSize}px`}>
        <div className="flex items-center justify-center w-8 h-7 rounded-lg bg-slate-800 text-slate-300 font-pixel text-[11px] font-bold border border-white/10 shadow-inner">
          {brushSize}
        </div>
        <div className="flex flex-row md:flex-row gap-1">
          <button 
            type="button"
            onClick={() => setBrushSize(Math.max(1, brushSize - 1))}
            onMouseDown={preventFocus}
            className="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 hover:text-white rounded-lg text-xs transition-colors cursor-pointer border border-white/5 font-bold"
            title="Уменьшить кисть"
          >-</button>
          <button 
            type="button"
            onClick={() => setBrushSize(Math.min(10, brushSize + 1))}
            onMouseDown={preventFocus}
            className="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 hover:text-white rounded-lg text-xs transition-colors cursor-pointer border border-white/5 font-bold"
            title="Увеличить кисть"
          >+</button>
        </div>
        <span className="absolute left-full ml-2 px-2 py-1 bg-slate-950 text-xs text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none md:block hidden shadow-xl border border-white/10">
          {getTranslation(language, 'brushSizeLabel')} {brushSize}px
        </span>
      </div>
    </div>
  );
};
