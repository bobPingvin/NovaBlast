import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Keyboard, Save, RotateCcw, AlertCircle, Languages, LayoutGrid, Check, Settings2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './Button';
import { HotkeyConfig, Hotkey } from '../types';
import { DEFAULT_HOTKEYS } from '../constants';
import { Language, translations, getTranslation } from '../src/l10n';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  hotkeys: HotkeyConfig;
  onSaveHotkeys: (newHotkeys: HotkeyConfig, forceLang?: Language) => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  showGridDefault: boolean;
  onShowGridDefaultChange: (val: boolean) => void;
  ambientSupernova: boolean;
  onAmbientSupernovaChange: (val: boolean) => void;
}

type TabType = 'hotkeys' | 'language' | 'canvas';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  hotkeys,
  onSaveHotkeys,
  language,
  onLanguageChange,
  showGridDefault,
  onShowGridDefaultChange,
  ambientSupernova,
  onAmbientSupernovaChange,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('hotkeys');
  const [tempHotkeys, setTempHotkeys] = useState<HotkeyConfig>(hotkeys);
  const [tempLanguage, setTempLanguage] = useState<Language>(language);
  const [tempShowGridDefault, setTempShowGridDefault] = useState<boolean>(showGridDefault);
  const [tempAmbientSupernova, setTempAmbientSupernova] = useState<boolean>(ambientSupernova);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setTempHotkeys(hotkeys);
      setTempLanguage(language);
      setTempShowGridDefault(showGridDefault);
      setTempAmbientSupernova(ambientSupernova);
    }
  }, [isOpen, hotkeys, language, showGridDefault, ambientSupernova]);

  // Layout neutral code translator
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!editingKey) return;
    e.preventDefault();

    // Check layout-independent codes first to extract english equivalents
    let key = e.key.toLowerCase();
    if (e.code && e.code.startsWith('Key')) {
      key = e.code.slice(3).toLowerCase(); // KeyB -> b
    } else if (e.code && e.code.startsWith('Digit')) {
      key = e.code.slice(5); // Digit1 -> 1
    }

    // Ignore modifier keys on their own
    if (['control', 'shift', 'alt', 'meta'].includes(key)) return;

    const newHotkey: Hotkey = {
      key,
      ctrl: e.ctrlKey || e.metaKey,
      shift: e.shiftKey,
      alt: e.altKey,
      label: tempHotkeys[editingKey as keyof HotkeyConfig].label,
    };

    // Check for duplicates
    const isDuplicate = Object.entries(tempHotkeys).some(([id, hotkey]) => {
      if (id === editingKey) return false;
      return (
        hotkey.key === newHotkey.key &&
        !!hotkey.ctrl === !!newHotkey.ctrl &&
        !!hotkey.shift === !!newHotkey.shift &&
        !!hotkey.alt === !!newHotkey.alt
      );
    });

    if (isDuplicate) {
      toast.error(getTranslation(tempLanguage, 'duplicateHotkeyError'), {
        icon: <AlertCircle className="text-rose-500" size={18} />,
        description: getTranslation(tempLanguage, 'duplicateHotkeyDesc'),
      });
      setEditingKey(null);
      return;
    }

    setTempHotkeys((prev) => ({
      ...prev,
      [editingKey]: newHotkey,
    }));
    setEditingKey(null);
  };

  useEffect(() => {
    if (editingKey) {
      window.addEventListener('keydown', handleKeyDown);
    } else {
      window.removeEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingKey, tempHotkeys, tempLanguage]);

  const formatHotkey = (hotkey: Hotkey) => {
    const parts = [];
    if (hotkey.ctrl) parts.push('Ctrl');
    if (hotkey.shift) parts.push('Shift');
    if (hotkey.alt) parts.push('Alt');
    const keyDisplay = hotkey.key === ' ' ? 'Space' : hotkey.key.toUpperCase();
    parts.push(keyDisplay);
    return parts.join(' + ');
  };

  const handleReset = () => {
    setTempHotkeys(DEFAULT_HOTKEYS);
    toast.success(getTranslation(tempLanguage, 'resetButton'));
  };

  // Safe mapping helper for translated hotkey labels
  const getHotkeyLabel = (id: string, defLabel: string) => {
    if (tempLanguage === 'en') {
      const enMap: Record<string, string> = {
        undo: 'Undo Action',
        redo: 'Redo Action',
        pen: 'Pen/Brush Tool',
        eraser: 'Eraser Tool',
        fill: 'Bucket Fill Tool',
        picker: 'Color Picker Tool',
        gradient: 'Gradient Paint Tool',
        line: 'Line Tool',
        ruler: 'Ruler / Measure Tool',
        mirror: 'Mirror / Symmetry Tool',
        toggleGrid: 'Hide or Show Grid',
        brushResize: 'Hold to Resize Brush',
        playAnimation: 'Play / Pause Animation',
      };
      return enMap[id] || defLabel;
    }
    return defLabel;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="bg-slate-900 border border-indigo-500/10 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[580px] max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-lg">
                  <Settings2 className="text-fuchsia-400" size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white tracking-wide">
                    {getTranslation(tempLanguage, 'settingsTitle')}
                  </h2>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Split Middle Area (Sidebar + Content) */}
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
              {/* Left Sidebar Tabs */}
              <div className="flex md:flex-col bg-slate-950/60 p-2 md:p-4 gap-1.5 md:w-[270px] shrink-0 overflow-x-auto md:overflow-y-auto border-b md:border-b-0 md:border-r border-slate-800/60 min-h-0 select-none scrollbar-none">
                <button
                  onClick={() => { setActiveTab('hotkeys'); setEditingKey(null); }}
                  className={`flex items-center gap-2.5 px-4 py-3 text-xs font-pixel rounded-xl transition-all cursor-pointer whitespace-nowrap md:whitespace-normal md:w-full ${
                    activeTab === 'hotkeys'
                      ? 'bg-fuchsia-600/15 text-fuchsia-300 border border-fuchsia-500/20 shadow-inner'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <Keyboard size={15} className="shrink-0" />
                  {getTranslation(tempLanguage, 'tabHotkeys')}
                </button>
                <button
                  onClick={() => { setActiveTab('language'); setEditingKey(null); }}
                  className={`flex items-center gap-2.5 px-4 py-3 text-xs font-pixel rounded-xl transition-all cursor-pointer whitespace-nowrap md:whitespace-normal md:w-full ${
                    activeTab === 'language'
                      ? 'bg-fuchsia-600/15 text-fuchsia-300 border border-fuchsia-500/20 shadow-inner'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <Languages size={15} className="shrink-0" />
                  {getTranslation(tempLanguage, 'tabLanguage')}
                </button>
                <button
                  onClick={() => { setActiveTab('canvas'); setEditingKey(null); }}
                  className={`flex items-center gap-2.5 px-4 py-3 text-xs font-pixel rounded-xl transition-all cursor-pointer whitespace-nowrap md:whitespace-normal md:w-full ${
                    activeTab === 'canvas'
                      ? 'bg-fuchsia-600/15 text-fuchsia-300 border border-fuchsia-500/20 shadow-inner'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <LayoutGrid size={15} className="shrink-0" />
                  {getTranslation(tempLanguage, 'tabCanvas')}
                </button>
              </div>

              {/* Right Content Area */}
              <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-4 bg-slate-900/40 customs-scrollbar">
                
                {/* TAB 1: HOTKEYS */}
                {activeTab === 'hotkeys' && (
                  <div className="space-y-4">
                    <p className="text-slate-400 text-xs font-mono mb-4 flex items-center gap-2 bg-[#060a13]/60 p-3 rounded-lg border border-white/5">
                      <span className="text-indigo-400 font-bold">ℹ</span>
                      {getTranslation(tempLanguage, 'hotkeyTip')}
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-3">
                      {Object.entries(tempHotkeys).map(([id, hotkey]) => (
                        <div
                          key={id}
                          className="flex items-center justify-between p-3.5 bg-slate-800/40 rounded-xl border border-white/5 hover:border-indigo-500/10 transition-colors"
                        >
                          <span className="text-slate-200 text-sm font-semibold">
                            {getHotkeyLabel(id, hotkey.label)}
                          </span>
                          <button
                            onClick={() => setEditingKey(id)}
                            className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-all min-w-[110px] text-center cursor-pointer ${
                              editingKey === id
                                ? 'bg-fuchsia-600 text-white ring-4 ring-fuchsia-500/20 animate-pulse'
                                : 'bg-slate-755 text-fuchsia-300 hover:bg-slate-700 hover:text-white border border-white/5 shadow-sm'
                            }`}
                          >
                            {editingKey === id ? '...' : formatHotkey(hotkey)}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 2: LANGUAGE */}
                {activeTab === 'language' && (
                  <div className="space-y-4 py-2">
                    <p className="text-slate-300 text-sm font-semibold pl-2">
                      {getTranslation(tempLanguage, 'langSelectLabel')}
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* RU Button */}
                      <button
                        onClick={() => setTempLanguage('ru')}
                        className={`flex items-center justify-between p-5 rounded-2xl border text-left transition-all cursor-pointer ${
                          tempLanguage === 'ru'
                            ? 'bg-fuchsia-500/10 border-fuchsia-500 shadow-[0_0_15px_rgba(236,72,153,0.15)] text-white'
                            : 'bg-slate-800/30 border-white/5 text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl select-none">🇷🇺</span>
                          <div>
                            <div className="font-bold text-sm">Русский</div>
                            <div className="text-xs text-slate-500">Интерфейс на русском</div>
                          </div>
                        </div>
                        {tempLanguage === 'ru' && (
                          <div className="p-1 bg-fuchsia-500/20 border border-fuchsia-500/40 rounded-full text-fuchsia-400">
                            <Check size={14} strokeWidth={3} />
                          </div>
                        )}
                      </button>

                      {/* EN Button */}
                      <button
                        onClick={() => setTempLanguage('en')}
                        className={`flex items-center justify-between p-5 rounded-2xl border text-left transition-all cursor-pointer ${
                          tempLanguage === 'en'
                            ? 'bg-fuchsia-500/10 border-fuchsia-500 shadow-[0_0_15px_rgba(236,72,153,0.15)] text-white'
                            : 'bg-slate-800/30 border-white/5 text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl select-none">🇺🇸</span>
                          <div>
                            <div className="font-bold text-sm">English</div>
                            <div className="text-xs text-slate-500">English interface language</div>
                          </div>
                        </div>
                        {tempLanguage === 'en' && (
                          <div className="p-1 bg-fuchsia-500/20 border border-fuchsia-500/40 rounded-full text-fuchsia-400">
                            <Check size={14} strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 3: CANVAS & CUSTOM HELPERS */}
                {activeTab === 'canvas' && (
                  <div className="space-y-4 py-2">
                    <div className="p-4 bg-slate-800/30 rounded-2xl border border-white/5 space-y-4">
                      
                      {/* Startup Grid Toggle */}
                      <div className="flex items-center justify-between gap-4 py-1">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-white flex items-center gap-2">
                            <LayoutGrid size={16} className="text-indigo-400" />
                            {getTranslation(tempLanguage, 'showGridDefault')}
                          </div>
                          <div className="text-xs text-slate-500 font-mono">
                            {tempLanguage === 'ru' ? 'Сетка облегчает прорисовку мелких деталей' : 'The guide grid aids precise details rendering'}
                          </div>
                        </div>
                        <button
                          onClick={() => setTempShowGridDefault(!tempShowGridDefault)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                            tempShowGridDefault
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                          }`}
                        >
                          {tempShowGridDefault ? getTranslation(tempLanguage, 'enabled') : getTranslation(tempLanguage, 'disabled')}
                        </button>
                      </div>

                      <div className="h-[1px] bg-slate-800/60" />

                      {/* Animated Supernovae Toggle */}
                      <div className="flex items-center justify-between gap-4 py-1">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-white flex items-center gap-2">
                            <Sparkles size={16} className="text-fuchsia-400" />
                            {getTranslation(tempLanguage, 'helperBGMTitle')}
                          </div>
                          <div className="text-xs text-slate-500 font-mono">
                            {tempLanguage === 'ru' ? 'Анимирует взрывы звезд на фоне приветствия' : 'Soft star expansion shaders floating in main menu'}
                          </div>
                        </div>
                        <button
                          onClick={() => setTempAmbientSupernova(!tempAmbientSupernova)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                            tempAmbientSupernova
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                          }`}
                        >
                          {tempAmbientSupernova ? getTranslation(tempLanguage, 'enabled') : getTranslation(tempLanguage, 'disabled')}
                        </button>
                      </div>

                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between gap-4">
              {activeTab === 'hotkeys' ? (
                <Button
                  variant="ghost"
                  onClick={handleReset}
                  className="text-slate-400 hover:text-white hover:bg-white/5 gap-2 text-xs font-pixel cursor-pointer"
                >
                  <RotateCcw size={14} />
                  {getTranslation(tempLanguage, 'resetButton')}
                </Button>
              ) : <div />}
              
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={onClose}
                  className="text-slate-300 hover:bg-white/5 text-xs font-pixel cursor-pointer"
                >
                  {getTranslation(tempLanguage, 'cancelButton')}
                </Button>
                <Button
                  onClick={() => {
                    onSaveHotkeys(tempHotkeys, tempLanguage);
                    onLanguageChange(tempLanguage);
                    onShowGridDefaultChange(tempShowGridDefault);
                    onAmbientSupernovaChange(tempAmbientSupernova);
                    onClose();
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2 px-5 text-xs font-pixel cursor-pointer"
                >
                  <Save size={14} />
                  {getTranslation(tempLanguage, 'saveButton')}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
