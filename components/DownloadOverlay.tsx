import React, { useEffect, useState } from 'react';
import { Check, Sparkles, Cpu, Zap, FileDigit } from 'lucide-react';

export const DownloadOverlay: React.FC = () => {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<'materializing' | 'complete'>('materializing');
  const [logText, setLogText] = useState<string[]>([]);

  useEffect(() => {
    // Cyberpunk log generator
    const logs = [
      "ИНИЦИАЛИЗАЦИЯ НЕЙРОСВЯЗИ...",
      "ВЫДЕЛЕНИЕ БЛОКОВ ПАМЯТИ...",
      "РАСТЕРИЗАЦИЯ ВЕКТОРОВ...",
      "ИНЪЕКЦИЯ ЦВЕТОВОЙ ПАЛИТРЫ...",
      "ОПТИМИЗАЦИЯ СТРУКТУРЫ PNG...",
      "СЖАТИЕ АРТЕФАКТОВ...",
      "ФИНАЛИЗАЦИЯ ПОТОКА РЕНДЕРА..."
    ];
    
    let logIndex = 0;
    const logInterval = setInterval(() => {
      if (logIndex < logs.length) {
        setLogText(prev => [...prev.slice(-3), logs[logIndex]]);
        logIndex++;
      }
    }, 200);

    // Progress bar animation
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          clearInterval(logInterval);
          setStage('complete');
          return 100;
        }
        // Non-linear progress for realism
        const increment = Math.random() * 5 + 1;
        return Math.min(prev + increment, 100);
      });
    }, 50);

    return () => {
      clearInterval(interval);
      clearInterval(logInterval);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-200 overflow-hidden font-mono">
      
      {/* Dynamic Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Grid scanning down */}
        <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-fuchsia-900/10 to-transparent animate-scanline"></div>
        
        {/* Random floating particles */}
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-fuchsia-500/20 blur-[80px] animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-40 h-40 bg-indigo-500/20 blur-[80px] animate-pulse delay-700"></div>
      </div>

      <div className={`relative max-w-lg w-full mx-4 transition-all duration-300 ${stage === 'materializing' ? 'scale-100' : 'scale-110'}`}>
        
        {/* Main Card */}
        <div className="relative bg-[#0a0a0a] p-1 rounded-sm shadow-[0_0_50px_rgba(168,85,247,0.15)] overflow-hidden">
            
            {/* Border Glow Gradient */}
            <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-fuchsia-500 to-transparent opacity-50 h-[1px] w-full top-0 animate-[shimmer_2s_infinite]`}></div>
            <div className={`absolute inset-0 bg-gradient-to-b from-transparent via-fuchsia-500 to-transparent opacity-50 w-[1px] h-full right-0 animate-[shimmer_2s_infinite_0.5s]`}></div>

            <div className="bg-slate-950 p-8 relative z-10">
                {stage === 'materializing' ? (
                    <div className="flex flex-col items-center space-y-8">
                        {/* Icon Loader */}
                        <div className="relative w-24 h-24 flex items-center justify-center">
                            <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-t-fuchsia-500 border-r-transparent border-b-fuchsia-500 border-l-transparent rounded-full animate-spin"></div>
                            <div className="absolute inset-2 border-2 border-t-transparent border-r-cyan-400 border-b-transparent border-l-cyan-400 rounded-full animate-[spin_1s_linear_infinite_reverse]"></div>
                            <Cpu className="w-10 h-10 text-white animate-pulse" />
                        </div>

                        {/* Text Info */}
                        <div className="w-full space-y-2 text-center">
                            <h2 className="text-3xl font-bold text-white font-pixel tracking-widest glitch-text" data-text="ГЕНЕРАЦИЯ...">
                                ГЕНЕРАЦИЯ...
                            </h2>
                            <div className="h-16 flex flex-col justify-end items-center overflow-hidden">
                                {logText.map((log, i) => (
                                    <p key={i} className="text-[10px] text-cyan-400 font-mono opacity-80 animate-in slide-in-from-bottom-2 fade-in">
                                        {'>'} {log}
                                    </p>
                                ))}
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full space-y-1">
                             <div className="flex justify-between text-xs text-fuchsia-400 font-bold">
                                <span>ПРОГРЕСС</span>
                                <span>{Math.round(progress)}%</span>
                             </div>
                             <div className="h-6 bg-slate-900 border border-slate-700 p-[2px] relative overflow-hidden">
                                <div 
                                    className="h-full bg-gradient-to-r from-fuchsia-600 via-purple-500 to-cyan-500 shadow-[0_0_15px_rgba(192,38,211,0.5)] transition-all duration-75 ease-out relative"
                                    style={{ width: `${progress}%` }}
                                >
                                    <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-white opacity-50 shadow-[0_0_10px_white]"></div>
                                </div>
                                {/* Scanline on bar */}
                                <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)] w-1/2 -skew-x-12 animate-[shimmer_1s_infinite]"></div>
                             </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center space-y-6 animate-in zoom-in-90 duration-300">
                        <div className="relative">
                             <div className="absolute inset-0 bg-green-500 blur-[40px] opacity-40 animate-pulse"></div>
                             <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.5)] border-4 border-green-300 ring-4 ring-green-900/50">
                                <Check className="w-12 h-12 text-white drop-shadow-md" strokeWidth={4} />
                             </div>
                        </div>
                        
                        <div className="text-center space-y-2">
                             <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-200 to-green-400 font-pixel animate-pulse">
                                ГОТОВО
                             </h2>
                             <p className="text-slate-400 text-sm tracking-widest uppercase">
                                Ассет успешно экспортирован
                             </p>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Corner Decos */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-fuchsia-500"></div>
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-fuchsia-500"></div>
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-fuchsia-500"></div>
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-fuchsia-500"></div>
        </div>
      </div>

      <style>{`
        .glitch-text {
            position: relative;
        }
        .glitch-text::before,
        .glitch-text::after {
            content: attr(data-text);
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
        }
        .glitch-text::before {
            left: 2px;
            text-shadow: -1px 0 #ff00c1;
            clip: rect(44px, 450px, 56px, 0);
            animation: glitch-anim 5s infinite linear alternate-reverse;
        }
        .glitch-text::after {
            left: -2px;
            text-shadow: -1px 0 #00fff9;
            clip: rect(44px, 450px, 56px, 0);
            animation: glitch-anim2 5s infinite linear alternate-reverse;
        }
        @keyframes glitch-anim {
            0% { clip: rect(14px, 9999px, 88px, 0); }
            5% { clip: rect(38px, 9999px, 14px, 0); }
            10% { clip: rect(69px, 9999px, 63px, 0); }
            15% { clip: rect(10px, 9999px, 83px, 0); }
            20% { clip: rect(59px, 9999px, 6px, 0); }
            100% { clip: rect(82px, 9999px, 20px, 0); }
        }
        @keyframes glitch-anim2 {
            0% { clip: rect(2px, 9999px, 85px, 0); }
            5% { clip: rect(66px, 9999px, 13px, 0); }
            10% { clip: rect(28px, 9999px, 35px, 0); }
            15% { clip: rect(18px, 9999px, 78px, 0); }
            20% { clip: rect(5px, 9999px, 63px, 0); }
            100% { clip: rect(49px, 9999px, 27px, 0); }
        }
      `}</style>
    </div>
  );
};