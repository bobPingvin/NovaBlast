import React, { useRef, useEffect } from 'react';
import { PALETTE_PRESETS } from '../constants';
import { History, Trash2, Plus } from 'lucide-react';
import { Language, getTranslation } from '../src/l10n';

interface PaletteProps {
  activeColor: string;
  setColor: (c: string) => void;
  customColors?: string[];
  onAddCustomColor?: (c: string) => void;
  onClearCustomColors?: () => void;
  language?: Language;
}

export const Palette: React.FC<PaletteProps> = ({ 
  activeColor, 
  setColor,
  customColors = [],
  onAddCustomColor,
  onClearCustomColors,
  language = 'ru'
}) => {
  const colorInputRef = useRef<HTMLInputElement>(null);

  // Native 'change' event fires ONLY when the user closes/commits the color picker dialog,
  // whereas React 'onChange' (DOM 'input') fires continuously on every mouse drag inside the picker.
  useEffect(() => {
    const input = colorInputRef.current;
    if (!input) return;

    const handleCommit = (e: Event) => {
      const finalColor = (e.target as HTMLInputElement).value.toLowerCase();
      if (onAddCustomColor) {
        onAddCustomColor(finalColor);
      }
    };

    input.addEventListener('change', handleCommit);
    return () => {
      input.removeEventListener('change', handleCommit);
    };
  }, [onAddCustomColor]);

  // Live preview while dragging
  const handleColorInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const liveColor = e.target.value.toLowerCase();
    setColor(liveColor);
  };

  const handleManualAddCurrent = () => {
    if (onAddCustomColor && activeColor) {
      onAddCustomColor(activeColor.toLowerCase());
    }
  };

  return (
    <div className="flex flex-col gap-2.5 p-3 bg-slate-900/90 border border-white/10 rounded-2xl shadow-xl w-full md:w-56 ring-1 ring-white/5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Палитра</h3>
        <div className="relative group flex items-center gap-1.5">
           <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold">{activeColor}</span>
           <div className="w-7 h-7 rounded-lg border-2 border-white/80 shadow-sm overflow-hidden cursor-pointer hover:scale-110 transition-transform relative">
             <input 
               ref={colorInputRef}
               type="color" 
               value={activeColor}
               onChange={handleColorInput}
               className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
               title={getTranslation(language, 'customColor')}
             />
             <div 
                className="w-full h-full"
                style={{ backgroundColor: activeColor }}
             />
           </div>
        </div>
      </div>
      
      {/* Scrollable Palette Colors Container */}
      <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[320px] p-1.5 -m-1.5 pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        <div className="grid grid-cols-8 md:grid-cols-4 gap-2 p-0.5">
          {PALETTE_PRESETS.map((color) => {
            const isSelected = activeColor.toLowerCase() === color.toLowerCase();
            return (
              <button
                key={color}
                type="button"
                onClick={() => setColor(color)}
                className={`
                  w-full aspect-square rounded-md transition-all duration-150 cursor-pointer
                  border relative
                  ${isSelected 
                    ? 'border-white scale-105 shadow-md ring-2 ring-indigo-400 ring-offset-1 ring-offset-slate-900 z-10' 
                    : 'border-white/15 hover:border-white hover:scale-110 hover:shadow-lg hover:ring-2 hover:ring-white/60 hover:z-20'}
                `}
                style={{ backgroundColor: color }}
                title={color}
              />
            );
          })}
        </div>

        {/* Project Custom Colors Section */}
        {customColors && customColors.length > 0 && (
          <div className="flex flex-col gap-1.5 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <History size={10} className="text-indigo-400" />
                {getTranslation(language, 'customColorsTitle')} ({customColors.length})
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleManualAddCurrent}
                  className="text-slate-400 hover:text-indigo-300 transition-colors p-0.5 cursor-pointer"
                  title="Добавить текущий цвет"
                >
                  <Plus size={12} />
                </button>
                {onClearCustomColors && (
                  <button
                    type="button"
                    onClick={onClearCustomColors}
                    className="text-slate-500 hover:text-rose-400 transition-colors p-0.5 cursor-pointer"
                    title={getTranslation(language, 'clearCustomColors')}
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-8 md:grid-cols-4 gap-2 p-0.5">
              {customColors.map((color, idx) => {
                const isSelected = activeColor.toLowerCase() === color.toLowerCase();
                return (
                  <button
                    key={`${color}-${idx}`}
                    type="button"
                    onClick={() => setColor(color)}
                    className={`
                      w-full aspect-square rounded-md transition-all duration-150 cursor-pointer
                      border relative
                      ${isSelected 
                        ? 'border-white scale-105 shadow-md ring-2 ring-fuchsia-400 ring-offset-1 ring-offset-slate-900 z-10' 
                        : 'border-white/20 hover:border-white hover:scale-110 hover:shadow-lg hover:ring-2 hover:ring-white/60 hover:z-20'}
                    `}
                    style={{ backgroundColor: color }}
                    title={`Свой цвет: ${color}`}
                  >
                    {isSelected && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-1.5 h-1.5 bg-white rounded-full shadow-sm"></div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
