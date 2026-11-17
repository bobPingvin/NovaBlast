import React, { useState } from 'react';
import { Sparkles, X, Loader2 } from 'lucide-react';
import { generatePixelArt } from '../services/aiService';
import { GridState } from '../types';

interface NeuroSpriteModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentGrid: GridState;
  width: number;
  height: number;
  onApply: (newGrid: GridState) => void;
}

export const NeuroSpriteModal: React.FC<NeuroSpriteModalProps> = ({
  isOpen,
  onClose,
  currentGrid,
  width,
  height,
  onApply
}) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    
    try {
      const newGrid = await generatePixelArt(prompt, currentGrid, width, height);
      onApply(newGrid);
      setPrompt('');
      onClose();
    } catch (err: any) {
      console.error("AI Generation Error:", err);
      if (err instanceof SyntaxError && err.message.includes('JSON')) {
        setError("Холст слишком большой для генерации (превышен лимит ответа AI). Попробуйте уменьшить размер холста (рекомендуется до 32x32).");
      } else {
        setError(err.message || "Произошла ошибка при генерации");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-fuchsia-500/30 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-[0_0_40px_rgba(192,38,211,0.15)] relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
          disabled={isGenerating}
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-fuchsia-600/20 rounded-lg flex items-center justify-center border border-fuchsia-500/50">
            <Sparkles className="text-fuchsia-400" size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white font-pixel">Нейро-спрайт</h2>
            <p className="text-slate-400 text-xs mt-1">AI-генерация и улучшение</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Что нарисовать или изменить?
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Например: Нарисуй киберпанк-шлем с неоновым градиентом или добавь красивое свечение..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500 transition-all resize-none h-24"
              disabled={isGenerating}
            />
          </div>

          {error && (
            <div className="text-rose-400 text-sm bg-rose-950/30 p-3 rounded-lg border border-rose-900/50">
              {error}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="w-full py-3 px-4 bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white rounded-lg font-bold text-sm shadow-[0_0_15px_rgba(192,38,211,0.3)] hover:shadow-[0_0_25px_rgba(192,38,211,0.5)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Генерация...
              </>
            ) : (
              <>
                <Sparkles size={18} />
                Сгенерировать
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
