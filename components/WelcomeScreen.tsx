import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Grid3X3, Plus, Settings, Settings2, Palette, Monitor, LogIn, LogOut, User as UserIcon, Loader2, FolderOpen, WifiOff, X, Send, Gamepad2, MessageSquare, Github, Film, Image as ImageIcon, Compass } from 'lucide-react';
import { User } from '../src/lib/firebase';
import { Language, getTranslation } from '../src/l10n';
import { ProjectType, ExtendedUser } from '../types';

const NovaLogo = () => {
  return (
    <div className="relative w-48 h-48 mx-auto flex items-center justify-center group cursor-default">
      {/* Container that rotates slightly on hover */}
      <div className="w-full h-full relative z-10 transition-transform duration-[1500ms] group-hover:scale-110 group-hover:rotate-[20deg] ease-[cubic-bezier(0.34,1.56,0.64,1)]">
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
          <defs>
            <radialGradient id="bhGlow" cx="50%" cy="50%" r="50%">
              <stop offset="30%" stopColor="#000" stopOpacity="1" />
              <stop offset="60%" stopColor="#4c1d95" stopOpacity="0.8" />
              <stop offset="85%" stopColor="#d946ef" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="bhGlowHover" cx="50%" cy="50%" r="50%">
              <stop offset="20%" stopColor="#000" stopOpacity="1" />
              <stop offset="50%" stopColor="#7e22ce" stopOpacity="0.9" />
              <stop offset="85%" stopColor="#f0abfc" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
            </radialGradient>
            {/* Ambient Background Glow replacing the separate DOM divs */}
            <radialGradient id="ambientGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#d946ef" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#4f46e5" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </radialGradient>
            
            <filter id="blurFilter" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" />
            </filter>
            <filter id="intenseBlur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" />
            </filter>
            
            <linearGradient id="diskGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d946ef" stopOpacity="1" />
              <stop offset="50%" stopColor="#c026d3" stopOpacity="1" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="1" />
            </linearGradient>
            <linearGradient id="diskGradient2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity="1" />
              <stop offset="50%" stopColor="#a855f7" stopOpacity="1" />
              <stop offset="100%" stopColor="#f0abfc" stopOpacity="1" />
            </linearGradient>
          </defs>

          {/* Core Cosmic Glow that breathes and stays completely smooth behind rings */}
          <circle cx="50" cy="50" r="45" fill="url(#ambientGlow)" className="animate-core-pulse origin-[50px_50px] transition-all duration-1000 group-hover:scale-[1.15] group-hover:opacity-80" />

          {/* BACK RINGS (Behind the Black Hole) */}
          <g className="origin-[50px_50px] transition-transform duration-1000 group-hover:rotate-[-6deg] group-hover:scale-105">
            <path d="M 5 50 A 45 15 0 0 1 95 50" fill="none" stroke="url(#diskGradient1)" strokeWidth="3" pathLength="50" strokeDasharray="60 10 20 10" filter="url(#blurFilter)" className="transform origin-[50px_50px] -rotate-12 opacity-80 animate-[plasma-flow_12s_linear_infinite]" />
            <path d="M 5 50 A 45 15 0 0 1 95 50" fill="none" stroke="#fff" strokeWidth="1" pathLength="50" strokeDasharray="15 25 5 55" filter="url(#intenseBlur)" className="transform origin-[50px_50px] -rotate-12 opacity-50 animate-[plasma-flow_8s_linear_infinite]" />
          </g>

          <g className="origin-[50px_50px] transition-transform duration-1000 group-hover:rotate-12 group-hover:scale-110">
            <path d="M 15 50 A 35 10 0 0 1 85 50" fill="none" stroke="url(#diskGradient2)" strokeWidth="2" pathLength="50" strokeDasharray="45 15 30 10" filter="url(#blurFilter)" className="transform origin-[50px_50px] rotate-[15deg] opacity-90 animate-[plasma-flow_10s_linear_infinite]" />
            <path d="M 15 50 A 35 10 0 0 1 85 50" fill="none" stroke="#fff" strokeWidth="0.5" pathLength="50" strokeDasharray="10 40 20 30" filter="url(#intenseBlur)" className="transform origin-[50px_50px] rotate-[15deg] opacity-60 animate-[plasma-flow_6s_linear_infinite]" />
          </g>

          {/* BACKGROUND STARDUST (Orbiting slowly) */}
          <g className="origin-[50px_50px] animate-orbit-slow group-hover:animate-orbit-fast">
             <circle cx="20" cy="50" r="1.5" fill="#d946ef" className="animate-pulse" />
             <circle cx="80" cy="40" r="2" fill="#4f46e5" className="animate-pulse" style={{ animationDelay: '300ms' }} />
             <circle cx="35" cy="15" r="1.5" fill="#f0abfc" className="animate-pulse" style={{ animationDelay: '100ms' }} />
          </g>

          {/* BLACK HOLE BODY */}
          <circle cx="50" cy="50" r="22" fill="url(#bhGlow)" className="animate-core-pulse origin-[50px_50px] transition-opacity duration-1000 group-hover:opacity-0" />
          <circle cx="50" cy="50" r="22" fill="url(#bhGlowHover)" className="animate-core-pulse origin-[50px_50px] opacity-0 transition-opacity duration-1000 group-hover:opacity-100 group-hover:animate-core-pulse-intense" />
          
          {/* Core void */}
          <circle cx="50" cy="50" r="14" fill="#020005" className="origin-[50px_50px] transition-transform duration-700 group-hover:scale-[0.8]" />

          {/* Event Horizon edge ring */}
          <circle cx="50" cy="50" r="14.5" fill="none" stroke="#f0abfc" strokeWidth="0.8" className="opacity-70 blur-[0.5px] origin-[50px_50px] transition-all duration-1000 group-hover:strokeWidth-[2px] group-hover:stroke-fuchsia-100 group-hover:opacity-100" />

          {/* FRONT RINGS (In front of the Black Hole) */}
          <g className="origin-[50px_50px] transition-transform duration-1000 group-hover:rotate-[-6deg] group-hover:scale-105">
            <path d="M 95 50 A 45 15 0 0 1 5 50" fill="none" stroke="url(#diskGradient1)" strokeWidth="4" pathLength="50" strokeDasharray="60 10 20 10" filter="url(#blurFilter)" className="transform origin-[50px_50px] -rotate-12 group-hover:stroke-fuchsia-400 transition-colors duration-1000 animate-[plasma-flow-front_12s_linear_infinite]" />
            <path d="M 95 50 A 45 15 0 0 1 5 50" fill="none" stroke="#fff" strokeWidth="1.5" pathLength="50" strokeDasharray="15 25 5 55" filter="url(#intenseBlur)" className="transform origin-[50px_50px] -rotate-12 animate-[plasma-flow-front_8s_linear_infinite]" />
          </g>

          <g className="origin-[50px_50px] transition-transform duration-1000 group-hover:rotate-12 group-hover:scale-110">
            <path d="M 85 50 A 35 10 0 0 1 15 50" fill="none" stroke="url(#diskGradient2)" strokeWidth="3" pathLength="50" strokeDasharray="45 15 30 10" filter="url(#blurFilter)" className="transform origin-[50px_50px] rotate-[15deg] group-hover:stroke-indigo-300 transition-colors duration-1000 opacity-90 animate-[plasma-flow-front_10s_linear_infinite]" />
            <path d="M 85 50 A 35 10 0 0 1 15 50" fill="none" stroke="#fff" strokeWidth="1" pathLength="50" strokeDasharray="10 40 20 30" filter="url(#intenseBlur)" className="transform origin-[50px_50px] rotate-[15deg] opacity-90 animate-[plasma-flow-front_6s_linear_infinite]" />
          </g>

          {/* FRONT STARDUST */}
          <g className="origin-[50px_50px] animate-orbit-slow group-hover:animate-orbit-fast">
             <circle cx="45" cy="85" r="1.5" fill="#c026d3" className="animate-pulse" style={{ animationDelay: '400ms' }} />
             <circle cx="25" cy="70" r="1.5" fill="#a855f7" className="animate-pulse" style={{ animationDelay: '200ms' }} />
             <circle cx="75" cy="65" r="2" fill="#818cf8" className="animate-pulse" style={{ animationDelay: '700ms' }} />
          </g>

          {/* PARTICLES FALLING IN */}
          <g className="origin-[50px_50px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000">
             <circle cx="30" cy="30" r="1.5" fill="#fff" className="animate-suck-in origin-[50px_50px]" style={{ animationDelay: '0s' }} />
             <circle cx="70" cy="40" r="2" fill="#f0abfc" className="animate-suck-in origin-[50px_50px]" style={{ animationDelay: '0.7s' }} />
             <circle cx="40" cy="70" r="1.5" fill="#818cf8" className="animate-suck-in origin-[50px_50px]" style={{ animationDelay: '1.4s' }} />
             <circle cx="65" cy="65" r="2" fill="#d946ef" className="animate-suck-in origin-[50px_50px]" style={{ animationDelay: '2.1s' }} />
          </g>
        </svg>
      </div>
    </div>
  );
};

export interface ProjectConfig {
  name: string;
  width: number;
  height: number;
  bgColor: string | null;
  projectType: ProjectType;
  fps: number;
}

interface WelcomeScreenProps {
  onStart: (config: ProjectConfig) => void;
  onLogin: () => void;
  onSteamLogin: () => void;
  onGithubLogin: () => void;
  onXLogin: () => void;
  onLoadProjects: () => void;
  onOpenGallery?: () => void;
  user: ExtendedUser | null;
  isLoggingIn: boolean;
  isSteamLoggingIn?: boolean;
  isGithubLoggingIn?: boolean;
  isXLoggingIn?: boolean;
  onCancelSteamLogin?: () => void;
  onCancelGithubLogin?: () => void;
  onCancelXLogin?: () => void;
  onOpenSettings: () => void;
  language: Language;
  ambientSupernova: boolean;
  onLogout: () => void;
  onBackToLanding?: () => void;
}

const PRESET_SIZES = [
  { label: '16x16', w: 16, h: 16 },
  { label: '32x32', w: 32, h: 32 },
  { label: '64x64', w: 64, h: 64 },
];

const SUPERNOVA_COLORS = [
  '232, 121, 249', // fuchsia
  '168, 85, 247', // purple
  '236, 72, 153', // pink
  '56, 187, 248', // sky
  '99, 102, 241', // indigo
];

const RandomSupernovae = () => {
  const [novas, setNovas] = useState<Array<{id: number, left: string, top: string, color: string, delay: string, duration: string, size: string}>>([]);

  useEffect(() => {
    // Generate an initial random state for 15 beautiful soft blooming supernovae
    const generated = Array.from({ length: 15 }).map((_, i) => {
      const colorBase = SUPERNOVA_COLORS[Math.floor(Math.random() * SUPERNOVA_COLORS.length)];
      return {
        id: i,
        left: `${(Math.random() * 100).toFixed(1)}%`,
        top: `${(Math.random() * 100).toFixed(1)}%`,
        color: `radial-gradient(circle, rgba(${colorBase}, 0.6) 0%, rgba(${colorBase}, 0) 70%)`,
        delay: `-${(Math.random() * 20).toFixed(1)}s`,
        duration: `${(12 + Math.random() * 8).toFixed(1)}s`,
        size: `${(30 + Math.random() * 40).toFixed(1)}vmax`
      };
    });
    setNovas(generated);
  }, []);

  return (
    <>
      {novas.map(nova => (
        <div
          key={nova.id}
          className="absolute rounded-full animate-supernova mix-blend-screen pointer-events-none"
          style={{
            left: nova.left,
            top: nova.top,
            width: nova.size,
            height: nova.size,
            background: nova.color,
            animationDelay: nova.delay,
            animationDuration: nova.duration,
            willChange: 'transform, opacity',
          }}
        />
      ))}
    </>
  );
};

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ 
  onStart, 
  onLogin, 
  onSteamLogin,
  onGithubLogin,
  onXLogin,
  onLoadProjects, 
  onOpenGallery,
  user, 
  isLoggingIn,
  isSteamLoggingIn = false,
  isGithubLoggingIn = false,
  isXLoggingIn = false,
  onCancelSteamLogin,
  onCancelGithubLogin,
  onCancelXLogin,
  onOpenSettings,
  language,
  ambientSupernova,
  onLogout,
  onBackToLanding
}) => {
  const [step, setStep] = useState<'welcome' | 'setup'>('welcome');
  const [name, setName] = useState(language === 'en' ? 'New Project' : 'Новый проект');
  const [projectType, setProjectType] = useState<ProjectType>('static');
  const [fps, setFps] = useState<number>(8);
  const [width, setWidth] = useState(32);
  const [height, setHeight] = useState(32);
  const [bgColor, setBgColor] = useState<string | null>(null);
  const [customColor, setCustomColor] = useState('#000000');
  const [isCustomColorMode, setIsCustomColorMode] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isContactsModalOpen, setIsContactsModalOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  useEffect(() => {
    setName(language === 'en' ? 'New Project' : 'Новый проект');
  }, [language]);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handlePresetSize = (w: number, h: number) => {
    setWidth(w);
    setHeight(h);
  };

  const handleStart = () => {
    onStart({
      name: name.trim() || (language === 'en' ? 'New Project' : 'Новый проект'),
      width,
      height,
      bgColor: isCustomColorMode ? customColor : bgColor,
      projectType,
      fps: Math.max(1, Math.min(60, fps || 8))
    });
  };


  const PRESET_COLORS = [
    { label: getTranslation(language, 'transparent'), value: null, class: 'bg-[url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAHElEQVQYV2P8/5+hngEAmIj4////fwYGBgYEBQCrEwQO0+3u8AAAAABJRU5ErkJggg==")]' }, // Checkerboard
    { label: language === 'en' ? 'Red' : 'Красный', value: '#ef4444', class: 'bg-red-500' },
    { label: language === 'en' ? 'Green' : 'Зеленый', value: '#22c55e', class: 'bg-green-500' },
    { label: language === 'en' ? 'Blue' : 'Синий', value: '#3b82f6', class: 'bg-blue-500' },
    { label: language === 'en' ? 'White' : 'Белый', value: '#ffffff', class: 'bg-white' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#0f172a] overflow-x-hidden overflow-y-auto flex flex-col items-center justify-start py-10 md:justify-center p-6">

      {/* Animated breathing background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none mix-blend-screen z-0">
        {/* Base ambient blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-fuchsia-600/40 blur-[130px] rounded-full animate-ambient-breathe" style={{ animationDelay: '-3s' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[70vw] h-[70vw] bg-indigo-600/40 blur-[150px] rounded-full animate-ambient-breathe-slow" style={{ animationDelay: '-7s' }} />
        <div className="absolute top-[30%] left-[40%] w-[50vw] h-[50vw] bg-cyan-600/30 blur-[140px] rounded-full animate-ambient-breathe-delayed" style={{ animationDelay: '-12s' }} />
        
        {/* Dynamic Randomized Supernovae explosions */}
        {ambientSupernova && <RandomSupernovae />}
      </div>
      
      {/* Frosted glass overlay */}
      <div className="fixed inset-0 pointer-events-none backdrop-blur-[60px] bg-slate-900/30 z-0" />

      {onBackToLanding && (
        <div className="fixed top-4 left-4 z-20">
          <button
            type="button"
            onClick={onBackToLanding}
            className="px-3.5 py-2 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 rounded-xl text-xs font-mono transition-colors backdrop-blur-md cursor-pointer"
          >
            {language === 'en' ? '← Website & Download' : '← На сайт и скачивание'}
          </button>
        </div>
      )}

      <div className="max-w-xl w-full text-center space-y-6 animate-in fade-in zoom-in duration-500 relative z-10 mb-16">
        
        <div className="space-y-3">
          <NovaLogo />
          <h1 className="font-pixel text-3xl md:text-5xl text-white leading-tight select-none">
            Nova<br/><span className="text-fuchsia-500">Blast</span>
          </h1>
          <p className="text-slate-400 font-mono text-xs max-w-sm mx-auto">
            {getTranslation(language, 'subtitle')}
          </p>
        </div>

        <div className="flex flex-col gap-4 items-center w-full max-w-xs mx-auto">
          {!isOnline && (
            <div className="w-full p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-xs font-mono animate-pulse">
              <WifiOff size={16} />
              <span>{getTranslation(language, 'noInternet')}</span>
            </div>
          )}
          {!user ? (
            <>
              <button
                onClick={onLogin}
                disabled={isLoggingIn}
                className="group relative px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-pixel text-base rounded-xl shadow-[0_4px_0_rgb(55,48,163)] active:shadow-none active:translate-y-[4px] transition-all w-full disabled:opacity-50 cursor-pointer"
              >
                <span className="flex items-center justify-center gap-2">
                  <LogIn className="w-5 h-5" />
                  {language === 'en' ? 'LOG IN' : 'ВОЙТИ'}
                </span>
              </button>
              

              <button
                onClick={onOpenGallery}
                className="group relative px-6 py-2.5 bg-gradient-to-r from-purple-600/90 to-indigo-600/90 hover:from-purple-500 hover:to-indigo-500 text-white font-pixel text-xs rounded-xl shadow-md transition-all w-full cursor-pointer flex items-center justify-center gap-2"
              >
                <Compass className="w-4 h-4 text-purple-200 group-hover:rotate-45 transition-transform duration-300" />
                <span>{language === 'en' ? 'COMMUNITY GALLERY' : 'ГАЛЕРЕЯ СООБЩЕСТВА'}</span>
              </button>

              <button
                onClick={() => setStep('setup')}
                className="group relative px-6 py-2.5 bg-slate-900/50 hover:bg-slate-800 text-slate-400 font-pixel text-xs rounded-xl border border-white/5 transition-all w-full cursor-pointer"
              >
                {getTranslation(language, 'continueAsGuest')}
              </button>

              <button
                onClick={onOpenSettings}
                className="group relative px-6 py-2.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white font-pixel text-xs rounded-xl border border-white/10 hover:border-white/20 transition-all w-full cursor-pointer flex items-center justify-center gap-2 shadow-md active:scale-95"
              >
                <Settings className="w-4 h-4 text-fuchsia-400 group-hover:rotate-90 transition-transform duration-300" />
                <span>{language === 'en' ? 'SETTINGS' : 'НАСТРОЙКИ'}</span>
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between bg-slate-800/50 p-3 rounded-2xl border border-white/5 w-full mb-2">
                <div className="flex items-center gap-3">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full border border-white/10" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center"><UserIcon size={20} /></div>
                  )}
                  <div className="text-left">
                    <div className="text-[10px] text-slate-500 font-mono uppercase flex items-center gap-1.5">
                      <span>{getTranslation(language, 'loggedInAs')}</span>
                    </div>
                    <div className="text-sm font-bold text-white truncate max-w-[140px]">{user.displayName}</div>
                  </div>
                </div>
                <button 
                  onClick={() => setIsLogoutConfirmOpen(true)}
                  className="p-2.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer active:scale-95"
                  title={language === 'en' ? 'Log Out' : 'Выйти из аккаунта'}
                >
                  <LogOut size={18} />
                </button>
              </div>

              <button
                onClick={() => setStep('setup')}
                className="group relative px-6 py-3 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-pixel text-base rounded-xl shadow-[0_4px_0_rgb(162,28,175)] active:shadow-none active:translate-y-[4px] transition-all w-full cursor-pointer"
              >
                <span className="flex items-center justify-center gap-2">
                  <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                  {getTranslation(language, 'newArtButton')}
                </span>
              </button>

              <button
                onClick={onOpenGallery}
                className="group relative px-6 py-2.5 bg-gradient-to-r from-purple-600/90 to-indigo-600/90 hover:from-purple-500 hover:to-indigo-500 text-white font-pixel text-xs rounded-xl shadow-md transition-all w-full cursor-pointer flex items-center justify-center gap-2"
              >
                <Compass className="w-4 h-4 text-purple-200 group-hover:rotate-45 transition-transform duration-300" />
                <span>{language === 'en' ? 'COMMUNITY GALLERY' : 'ГАЛЕРЕЯ СООБЩЕСТВА'}</span>
              </button>

              <button
                onClick={onLoadProjects}
                className="group relative px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-pixel text-xs rounded-xl border border-white/10 transition-all w-full cursor-pointer"
              >
                <span className="flex items-center justify-center gap-2">
                  <FolderOpen className="w-4 h-4" />
                  {getTranslation(language, 'myProjectsButton')}
                </span>
              </button>

              <button
                onClick={onOpenSettings}
                className="group relative px-6 py-2.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white font-pixel text-xs rounded-xl border border-white/10 hover:border-white/20 transition-all w-full cursor-pointer flex items-center justify-center gap-2 shadow-md active:scale-95"
              >
                <Settings className="w-4 h-4 text-fuchsia-400 group-hover:rotate-90 transition-transform duration-300" />
                <span>{language === 'en' ? 'SETTINGS' : 'НАСТРОЙКИ'}</span>
              </button>
            </>
          )}
        </div>
        
      </div>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 text-center animate-in fade-in duration-700 delay-300 pointer-events-none w-full z-10">
        <div 
          onClick={() => setIsContactsModalOpen(true)}
          className="text-white/40 text-xs font-mono pointer-events-auto inline-block bg-slate-900/50 px-3.5 py-2 rounded-full border border-white/10 backdrop-blur-sm cursor-pointer hover:bg-slate-800/80 hover:text-white/80 transition-all active:scale-95"
        >
          v1.0.0 {getTranslation(language, 'madeBy')} <span className="font-bold text-fuchsia-500/80">bob_pingvin</span>
        </div>
      </div>

      {isContactsModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-[#0f172a]/60 backdrop-blur-xl"
            onClick={() => setIsContactsModalOpen(false)}
          />
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 md:p-12 max-w-4xl w-full shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
            <button 
              onClick={() => setIsContactsModalOpen(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-full transition-all z-20 cursor-pointer"
            >
              <X size={20} />
            </button>
            
            <div className="flex flex-col md:flex-row gap-12 items-center">
              {/* Left side: Image */}
              <div className="w-full md:w-1/2 flex justify-center order-2 md:order-1 relative">
                <div className="absolute inset-0 bg-fuchsia-500/10 blur-3xl rounded-full"></div>
                <img src="/jhin-pointing.png" alt="Jhin Pointing" className="max-w-[280px] md:max-w-full h-auto w-auto max-h-[500px] object-contain drop-shadow-[0_0_35px_rgba(217,70,239,0.3)] relative z-10 hover:scale-105 transition-transform duration-500" onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://placehold.co/400x500/transparent/fuchsia?text=Jhin";
                }} />
              </div>

              {/* Right side: Contacts */}
              <div className="w-full md:w-1/2 space-y-8 order-1 md:order-2">
                <div className="text-center md:text-left space-y-3">
                  <h3 className="text-3xl font-bold text-white tracking-tight">{getTranslation(language, 'contactAuthor')}</h3>
                  <p className="text-slate-400 text-base">
                    {language === 'en' ? 'Here you can locate my contacts :D' : 'Здесь можно найти мои контакты :D'}
                  </p>
                </div>

                <div className="space-y-4">
                  <a 
                    href="https://t.me/ChOTblPE" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 p-4 bg-[#24A1DE]/10 hover:bg-[#24A1DE]/20 text-[#24A1DE] border border-[#24A1DE]/20 rounded-2xl transition-all"
                  >
                    <Send size={24} />
                    <span className="font-semibold text-lg">Telegram</span>
                  </a>
                  
                  <a 
                    href="https://discord.gg/mcSZ2X2B" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 p-4 bg-[#5865F2]/10 hover:bg-[#5865F2]/20 text-[#5865F2] border border-[#5865F2]/20 rounded-2xl transition-all"
                  >
                    <MessageSquare size={24} />
                    <span className="font-semibold text-lg">Discord</span>
                  </a>
                  
                  <a 
                    href="https://steamcommunity.com/id/bobpingvin/" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 p-4 bg-slate-800/60 hover:bg-slate-700/80 text-white border border-white/10 rounded-2xl transition-all"
                  >
                    <Gamepad2 size={24} />
                    <span className="font-semibold text-lg">Steam</span>
                  </a>

                  <a 
                    href="https://github.com/bobPingvin" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 p-4 bg-[#24292e]/10 hover:bg-[#24292e]/20 text-white border border-[#24292e]/20 hover:border-slate-600 rounded-2xl transition-all"
                  >
                    <Github size={24} className="text-white" />
                    <span className="font-semibold text-lg">GitHub</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 'setup' && (
        <div className="fixed inset-0 z-[100] overflow-y-auto">
          <div 
            className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-xl"
            onClick={() => setStep('welcome')}
          />
          <div className="min-h-full flex items-center justify-center p-4 sm:p-6 md:p-7">
            <div className="bg-slate-900 border border-white/10 p-6 sm:p-7 md:p-8 rounded-3xl shadow-2xl max-w-3xl lg:max-w-4xl w-full animate-in zoom-in-95 duration-200 ring-1 ring-white/10 relative z-10 my-auto">
              
              {/* Modal Header */}
              <div className="flex items-center gap-3 border-b border-white/10 pb-3.5 mb-5">
                <Button 
                  variant="ghost" 
                  onClick={() => setStep('welcome')} 
                  className="!px-2.5 !py-1 text-base text-slate-300 hover:text-white hover:bg-white/10 rounded-xl"
                >
                  ←
                </Button>
                <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2.5">
                  <Settings2 className="text-fuchsia-500 w-5 h-5 animate-pulse" />
                  {getTranslation(language, 'newProjParams')}
                </h2>
              </div>

              {/* Main Content: 2-Column Horizontal Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-7">
                
                {/* Left Column: Name & Project Type */}
                <div className="space-y-4">
                  {/* Project Name Section */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      {language === 'en' ? 'Project Name' : 'Название проекта'}
                    </label>
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={language === 'en' ? 'Enter title...' : 'Введите название...'}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 sm:py-3 text-white text-sm focus:border-fuchsia-500 focus:outline-none transition-colors shadow-inner"
                    />
                  </div>

                  {/* Project Type Selection */}
                  <div className="space-y-2.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      {getTranslation(language, 'projectTypeLabel')}
                    </label>
                    
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setProjectType('static')}
                        className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                          projectType === 'static'
                            ? 'border-fuchsia-500 bg-fuchsia-500/15 shadow-[0_0_15px_rgba(217,70,239,0.2)]'
                            : 'border-white/10 bg-slate-950/60 hover:border-white/20 hover:bg-slate-950'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-white font-bold text-xs sm:text-sm">
                          <div className={`p-1.5 rounded-lg ${projectType === 'static' ? 'bg-fuchsia-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                            <ImageIcon size={16} />
                          </div>
                          <span>{getTranslation(language, 'staticProject')}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono leading-tight">
                          {getTranslation(language, 'staticProjectDesc')}
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setProjectType('animated')}
                        className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                          projectType === 'animated'
                            ? 'border-fuchsia-500 bg-fuchsia-500/15 shadow-[0_0_15px_rgba(217,70,239,0.2)]'
                            : 'border-white/10 bg-slate-950/60 hover:border-white/20 hover:bg-slate-950'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-white font-bold text-xs sm:text-sm">
                          <div className={`p-1.5 rounded-lg ${projectType === 'animated' ? 'bg-fuchsia-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                            <Film size={16} />
                          </div>
                          <span>{getTranslation(language, 'animatedProject')}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono leading-tight">
                          {getTranslation(language, 'animatedProjectDesc')}
                        </p>
                      </button>
                    </div>

                    {/* Animated Project FPS Setting */}
                    {projectType === 'animated' && (
                      <div className="p-3 bg-slate-950/90 rounded-2xl border border-fuchsia-500/30 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-300 font-mono uppercase tracking-wider font-bold flex items-center gap-1.5">
                            <Film size={13} className="text-fuchsia-400" />
                            {getTranslation(language, 'fpsLabel')}
                          </span>
                          <span className="text-xs font-pixel text-fuchsia-400 font-bold bg-fuchsia-950/60 px-2.5 py-0.5 rounded-md border border-fuchsia-500/30">
                            {fps} FPS
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5">
                          <input 
                            type="range"
                            min="1"
                            max="30"
                            value={fps}
                            onChange={(e) => setFps(parseInt(e.target.value) || 1)}
                            className="flex-1 accent-fuchsia-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                          />
                          <input 
                            type="number" 
                            min="1"
                            max="60"
                            value={fps}
                            onChange={(e) => setFps(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))}
                            className="w-14 bg-slate-900 border border-white/10 rounded-md px-2 py-1 text-white text-center font-mono text-xs focus:border-fuchsia-500 focus:outline-none"
                          />
                        </div>

                        <div className="flex gap-1.5 justify-end">
                          {[4, 8, 12, 16, 24].map((presetFps) => (
                            <button
                              key={presetFps}
                              type="button"
                              onClick={() => setFps(presetFps)}
                              className={`px-2 py-0.5 text-[11px] font-mono rounded border transition-colors cursor-pointer ${
                                fps === presetFps 
                                  ? 'bg-fuchsia-500/30 border-fuchsia-400 text-white font-bold' 
                                  : 'bg-slate-900/60 border-white/5 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {presetFps}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Canvas Size & Background Color */}
                <div className="space-y-4">
                  {/* Resolution Section */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <Monitor size={15} /> {language === 'en' ? 'Canvas Size (px)' : 'Размер холста (px)'}
                    </label>
                    
                    <div className="grid grid-cols-3 gap-2">
                      {PRESET_SIZES.map(preset => (
                        <button
                          key={preset.label}
                          onClick={() => handlePresetSize(preset.w, preset.h)}
                          className={`
                            py-2 px-3 rounded-xl text-xs font-bold border-2 transition-all cursor-pointer
                            ${width === preset.w && height === preset.h 
                              ? 'border-indigo-500 bg-indigo-500/20 text-white' 
                              : 'border-white/5 text-slate-400 hover:border-white/10 hover:bg-white/5'}
                          `}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-3 bg-slate-950 px-3 py-2.5 rounded-xl border border-white/5 shadow-inner">
                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-mono uppercase">{getTranslation(language, 'width')}:</span>
                        <input 
                          type="number" 
                          value={width}
                          onChange={(e) => setWidth(Math.max(1, parseInt(e.target.value) || 0))}
                          className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1 text-sm text-white focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                      <span className="text-slate-500 font-mono font-bold">×</span>
                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-mono uppercase">{getTranslation(language, 'height')}:</span>
                        <input 
                          type="number" 
                          value={height}
                          onChange={(e) => setHeight(Math.max(1, parseInt(e.target.value) || 0))}
                          className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1 text-sm text-white focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>
                    
                    {width * height > 256 * 256 && (
                      <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-start gap-2 text-yellow-400 text-xs font-mono leading-tight">
                        <span className="text-sm">⚠️</span>
                        <span>
                          <strong>{language === 'en' ? 'Warning:' : 'Внимание:'}</strong> {language === 'en' ? 'Canvas is very large (cloud max 256x256).' : 'Холст слишком большой (макс. 256x256 для облака).'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Background Color Section */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <Palette size={15} /> {getTranslation(language, 'canvasBg')}
                    </label>
                    
                    <div className="grid grid-cols-6 gap-2">
                      {PRESET_COLORS.map((color, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setBgColor(color.value);
                            setIsCustomColorMode(false);
                          }}
                          className={`
                            h-9 rounded-xl border-2 relative overflow-hidden transition-transform hover:scale-105 cursor-pointer
                            ${!isCustomColorMode && bgColor === color.value ? 'border-white shadow-lg scale-105' : 'border-white/10'}
                            ${color.class}
                          `}
                          title={color.label}
                        />
                      ))}
                      
                      <div className="relative group">
                        <button
                          onClick={() => setIsCustomColorMode(true)}
                          className={`
                            w-full h-9 rounded-xl border-2 flex items-center justify-center bg-slate-800 cursor-pointer
                            ${isCustomColorMode ? 'border-white shadow-lg scale-105' : 'border-white/10'}
                          `}
                        >
                          <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: customColor }} />
                        </button>
                        <input 
                          type="color" 
                          value={customColor}
                          onChange={(e) => {
                            setCustomColor(e.target.value);
                            setIsCustomColorMode(true);
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Submit Button */}
              <div className="pt-4 mt-3 border-t border-white/10">
                <button
                  onClick={handleStart}
                  className="w-full py-3.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold rounded-xl shadow-[0_4px_0_rgb(162,28,175)] active:shadow-none active:translate-y-[4px] transition-all text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer"
                >
                  {language === 'en' ? 'Create Project' : 'Создать Проект'}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {isLogoutConfirmOpen && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#0a0a0a] border-2 border-indigo-600 rounded-xl p-8 max-w-sm w-full shadow-[0_0_50px_rgba(79,70,229,0.4)] relative overflow-hidden">
            {/* Ambient Background Flare */}
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,rgba(79,70,229,0.3),transparent)] pointer-events-none"></div>

            <div className="relative z-10 flex flex-col items-center text-center space-y-6">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 animate-pulse"></div>
                <div className="w-20 h-20 bg-indigo-950/50 rounded-full flex items-center justify-center border-2 border-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.5)]">
                  <LogOut className="w-10 h-10 text-indigo-400" />
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-white font-pixel leading-snug">
                  {language === 'en' ? 'LOG OUT' : 'ВЫХОД'}
                </h3>
                <p className="text-slate-400 font-mono text-xs leading-relaxed">
                  {language === 'en' 
                    ? 'Are you sure you want to log out of your cloud account?' 
                    : 'Вы уверены, что хотите выйти из своей учетной записи?'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 w-full pt-2">
                <button
                  onClick={() => setIsLogoutConfirmOpen(false)}
                  className="py-3 px-4 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg font-bold font-mono text-sm transition-all uppercase cursor-pointer"
                >
                  {language === 'en' ? 'Cancel' : 'Отмена'}
                </button>
                <button
                  onClick={() => {
                    setIsLogoutConfirmOpen(false);
                    onLogout();
                  }}
                  className="py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold font-mono text-sm shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:shadow-[0_0_30px_rgba(79,70,229,0.6)] border border-indigo-400 transition-all uppercase cursor-pointer"
                >
                  {language === 'en' ? 'Exit' : 'Выйти'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

