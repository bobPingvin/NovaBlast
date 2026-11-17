import React from 'react';

export const SimpleNovaLogo: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex items-center gap-6">
      <div className="w-14 h-14 relative flex-shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
          <defs>
            <radialGradient id="bhGlowSimple" cx="50%" cy="50%" r="50%">
              <stop offset="30%" stopColor="#000" stopOpacity="1" />
              <stop offset="60%" stopColor="#4c1d95" stopOpacity="0.8" />
              <stop offset="85%" stopColor="#d946ef" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
            </radialGradient>
            
            <linearGradient id="diskGradient1Simple" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d946ef" stopOpacity="1" />
              <stop offset="50%" stopColor="#c026d3" stopOpacity="1" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="1" />
            </linearGradient>
            <linearGradient id="diskGradient2Simple" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity="1" />
              <stop offset="50%" stopColor="#a855f7" stopOpacity="1" />
              <stop offset="100%" stopColor="#f0abfc" stopOpacity="1" />
            </linearGradient>
            <filter id="blurFilterSimple" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" />
            </filter>
          </defs>

          {/* BACK RINGS */}
          <g className="origin-[50px_50px]">
            <path d="M 5 50 A 45 15 0 0 1 95 50" fill="none" stroke="url(#diskGradient1Simple)" strokeWidth="3" filter="url(#blurFilterSimple)" className="transform origin-[50px_50px] -rotate-12 opacity-80" />
          </g>
          <g className="origin-[50px_50px]">
            <path d="M 15 50 A 35 10 0 0 1 85 50" fill="none" stroke="url(#diskGradient2Simple)" strokeWidth="2" filter="url(#blurFilterSimple)" className="transform origin-[50px_50px] rotate-[15deg] opacity-90" />
          </g>

          {/* BLACK HOLE BODY */}
          <circle cx="50" cy="50" r="22" fill="url(#bhGlowSimple)" />
          
          {/* Core void */}
          <circle cx="50" cy="50" r="14" fill="#020005" />

          {/* Event Horizon edge ring */}
          <circle cx="50" cy="50" r="14.5" fill="none" stroke="#f0abfc" strokeWidth="0.8" className="opacity-70" />

          {/* FRONT RINGS */}
          <g className="origin-[50px_50px]">
            <path d="M 95 50 A 45 15 0 0 1 5 50" fill="none" stroke="url(#diskGradient1Simple)" strokeWidth="4" filter="url(#blurFilterSimple)" className="transform origin-[50px_50px] -rotate-12" />
          </g>
          <g className="origin-[50px_50px]">
            <path d="M 85 50 A 35 10 0 0 1 15 50" fill="none" stroke="url(#diskGradient2Simple)" strokeWidth="3" filter="url(#blurFilterSimple)" className="transform origin-[50px_50px] rotate-[15deg] opacity-90" />
          </g>
        </svg>
      </div>
      <div className="flex flex-col hidden sm:flex">
        <h1 className="font-pixel text-lg text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-indigo-400 leading-none mb-1">
          NovaBlast
        </h1>
        <span className="font-mono text-[10px] text-fuchsia-300/50 uppercase tracking-widest leading-none">
          Studio 1.0
        </span>
        {children}
      </div>
    </div>
  );
};
