import React, { useState, useEffect, useCallback, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Undo2, Redo2, Trash2, Grid3X3, LogOut, Sparkles, TriangleAlert, Cloud, Save, FolderOpen, User as UserIcon, LogIn, Loader2, Edit2, WifiOff, CloudOff, X, Check, AlertCircle, Settings, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Film, Compass } from 'lucide-react';
import { Tools } from './components/Tools';
import { Palette } from './components/Palette';
import { Canvas } from './components/Canvas';
import { FramesTimeline } from './components/FramesTimeline';
import { Button } from './components/Button';
import { WelcomeScreen, ProjectConfig } from './components/WelcomeScreen';
import { WebLandingPage } from './components/WebLandingPage';
import { DownloadOverlay } from './components/DownloadOverlay';
import { NeuroSpriteModal } from './components/NeuroSpriteModal';
import { SettingsModal } from './components/SettingsModal';
import { ExportModal } from './components/ExportModal';
import { CommunityGalleryModal } from './components/CommunityGalleryModal';
import { AuthModal } from './components/AuthModal';
import { SimpleNovaLogo } from './components/SimpleNovaLogo';
import { SteamIcon } from './components/SteamIcon';
import { GithubIcon } from './components/GithubIcon';
import { XIcon } from './components/XIcon';
import { ToolType, GridState, HistoryState, Project, HotkeyConfig, ProjectType, ExtendedUser } from './types';
import { INITIAL_COLOR, DEFAULT_HOTKEYS } from './constants';
import { Language, getTranslation } from './src/l10n';
import { auth, db, googleProvider, githubProvider, signInWithPopup, signInWithCustomToken, signOut, onAuthStateChanged, User, collection, doc, setDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy, Timestamp, handleFirestoreError, OperationType, getDoc, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from './src/lib/firebase';
import { signInWithCredential, GoogleAuthProvider } from 'firebase/auth';

interface SteamSessionUser {
  uid: string;
  displayName: string;
  photoURL: string | null;
  email: string | null;
  steamId: string;
  provider: 'steam';
}

interface GitHubSessionUser {
  uid: string;
  displayName: string;
  photoURL: string | null;
  email: string | null;
  githubId: string;
  provider: 'github';
}

interface XSessionUser {
  uid: string;
  displayName: string;
  photoURL: string | null;
  email: string | null;
  xId: string;
  provider: 'x';
}

// Error Boundary Component
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900 border-2 border-rose-500 rounded-2xl p-8 shadow-[0_0_50px_rgba(225,29,72,0.3)] text-center">
            <TriangleAlert className="w-16 h-16 text-rose-500 mx-auto mb-6 animate-pulse" />
            <h1 className="text-2xl font-pixel text-white mb-4">КРИТИЧЕСКАЯ ОШИБКА</h1>
            <p className="text-rose-200/60 font-mono text-sm mb-6 leading-relaxed">
              Система обнаружила аномалию в коде. Пожалуйста, перезагрузите терминал.
            </p>
            <pre className="bg-black/50 p-4 rounded-lg text-rose-400 text-xs font-mono mb-6 overflow-auto text-left max-h-40">
              {this.state.error?.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold font-mono transition-all shadow-[0_0_20px_rgba(225,29,72,0.4)]"
            >
              ПЕРЕЗАГРУЗИТЬ
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const createGrid = (width: number, height: number, bgColor: string | null): GridState => {
  return Array(height).fill(null).map(() => Array(width).fill(bgColor));
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [steamSessionUser, setSteamSessionUser] = useState<SteamSessionUser | null>(null);
  const [githubSessionUser, setGithubSessionUser] = useState<GitHubSessionUser | null>(null);
  const [xSessionUser, setXSessionUser] = useState<XSessionUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSteamLoggingIn, setIsSteamLoggingIn] = useState(false);
  const [isGithubLoggingIn, setIsGithubLoggingIn] = useState(false);
  const [isXLoggingIn, setIsXLoggingIn] = useState(false);
  const activeUser: ExtendedUser | null = user || (steamSessionUser as unknown as ExtendedUser | null) || (githubSessionUser as unknown as ExtendedUser | null) || (xSessionUser as unknown as ExtendedUser | null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isProjectsModalOpen, setIsProjectsModalOpen] = useState(false);
  const [isProjectsLoading, setIsProjectsLoading] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const [savedProjects, setSavedProjects] = useState<Project[]>([]);
  const [currentProjectName, setCurrentProjectName] = useState("Новый проект");
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  const [projectStarted, setProjectStarted] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 }); // Initialize 0, set on start
  const [isDownloading, setIsDownloading] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isNeuroModalOpen, setIsNeuroModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCommunityGalleryOpen, setIsCommunityGalleryOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalProvider, setAuthModalProvider] = useState<'steam' | null>(null);
  const isElectronDesktop = typeof window !== 'undefined' && Boolean(window.electron);
  const [surfaceMode, setSurfaceMode] = useState<'landing' | 'app'>(() => {
    if (typeof window === 'undefined') return 'app';
    if (Boolean(window.electron)) return 'app';
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    if (path === '/app' || path.startsWith('/app/') || params.get('mode') === 'app' || params.get('app') === '1') {
      return 'app';
    }
    return 'landing';
  });
  const [showGrid, setShowGrid] = useState(true);
  const [hotkeys, setHotkeys] = useState<HotkeyConfig>(DEFAULT_HOTKEYS);
  
  const [language, setLanguage] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('novablast_lang');
      return (saved === 'en' || saved === 'ru') ? saved : 'ru';
    } catch {
      return 'ru';
    }
  });

  const [showGridDefault, setShowGridDefault] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('novablast_grid_default');
      return saved !== 'false';
    } catch {
      return true;
    }
  });

  const [ambientSupernova, setAmbientSupernova] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('novablast_ambient_supernova');
      return saved !== 'false';
    } catch {
      return true;
    }
  });

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    try {
      localStorage.setItem('novablast_lang', lang);
    } catch (e) {}
  };

  const handleShowGridDefaultChange = (val: boolean) => {
    setShowGridDefault(val);
    try {
      localStorage.setItem('novablast_grid_default', String(val));
    } catch (e) {}
  };

  const handleAmbientSupernovaChange = (val: boolean) => {
    setAmbientSupernova(val);
    try {
      localStorage.setItem('novablast_ambient_supernova', String(val));
    } catch (e) {}
  };
  
  const [activeTool, setActiveTool] = useState<ToolType>(ToolType.PEN);
  const [activeColor, setActiveColor] = useState<string>(INITIAL_COLOR);
  const [customColors, setCustomColors] = useState<string[]>([]);
  const [brushSize, setBrushSize] = useState<number>(1);
  const [gradientColors, setGradientColors] = useState<string[]>(['#ff0055', '#00ffaa']);
  
  const handleAddCustomColor = (newColor: string) => {
    const norm = newColor.toLowerCase();
    setCustomColors(prev => {
      if (prev.map(c => c.toLowerCase()).includes(norm)) return prev;
      return [...prev, norm];
    });
  };

  const handleClearCustomColors = () => {
    setCustomColors([]);
  };
  
  const [isResizingBrush, setIsResizingBrush] = useState(false);
  const [resizeStartX, setResizeStartX] = useState<number | null>(null);
  const [initialBrushSize, setInitialBrushSize] = useState<number>(1);


  
  // History Management
  const [history, setHistory] = useState<HistoryState>({
    past: [],
    present: [], // Will be initialized in handleStartProject
    future: []
  });

  // Animation & Multi-Frame State
  const [projectType, setProjectType] = useState<ProjectType>('static');
  const [fps, setFps] = useState<number>(8);
  const [frames, setFrames] = useState<GridState[]>([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [onionSkin, setOnionSkin] = useState<boolean>(false);
  const [hoveredFrameIndex, setHoveredFrameIndex] = useState<number | null>(null);
  const [clipboardFrame, setClipboardFrame] = useState<GridState | null>(null);

  // Animation Playback Loop using requestAnimationFrame
  useEffect(() => {
    if (!isPlaying || frames.length <= 1) return;

    let animFrameId: number;
    let lastTime = performance.now();
    const interval = 1000 / (fps || 8);

    const loop = (currentTime: number) => {
      const delta = currentTime - lastTime;
      if (delta >= interval) {
        lastTime = currentTime - (delta % interval);
        setCurrentFrameIndex(prev => {
          const nextIndex = (prev + 1) % frames.length;
          // Update active history present to match the playing frame
          setHistory({
            past: [],
            present: frames[nextIndex],
            future: []
          });
          return nextIndex;
        });
      }
      animFrameId = requestAnimationFrame(loop);
    };

    animFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameId);
  }, [isPlaying, frames, fps]);

  // Discord Rich Presence effect
  useEffect(() => {
    if (window.electron?.setDiscordActivity) {
      if (!projectStarted) {
        window.electron.setDiscordActivity({
          details: 'В главном меню',
          state: activeUser ? `Выбирает проект (${activeUser.displayName})` : 'Выбирает проект',
          largeImageKey: 'icon'
        });
      } else {
        const toolName = 
          activeTool === ToolType.PEN ? 'Кисть' :
          activeTool === ToolType.ERASER ? 'Ластик' :
          activeTool === ToolType.FILL ? 'Заливка' :
          activeTool === ToolType.PICKER ? 'Пипетка' :
          activeTool === ToolType.GRADIENT ? 'Градиент' : 'Рисует';
          
        window.electron.setDiscordActivity({
          details: `Рисует: ${currentProjectName}`,
          state: `Инструмент: ${toolName}`,
          largeImageKey: 'icon'
        });
      }
    }
  }, [projectStarted, currentProjectName, activeTool, activeUser]);

  useEffect(() => {
    if (isElectronDesktop) return;
    const handlePopState = () => {
      const path = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      if (path === '/app' || path.startsWith('/app/') || params.get('mode') === 'app' || params.get('app') === '1') {
        setSurfaceMode('app');
      } else {
        setProjectStarted(false);
        setSurfaceMode('landing');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isElectronDesktop]);

  const enterWebApp = useCallback(() => {
    setSurfaceMode('app');
    if (!isElectronDesktop && window.location.pathname !== '/app') {
      try {
        window.history.pushState({ surfaceMode: 'app' }, '', '/app');
      } catch {}
    }
    window.scrollTo(0, 0);
  }, [isElectronDesktop]);

  const backToLanding = useCallback(() => {
    setProjectStarted(false);
    setSurfaceMode('landing');
    if (!isElectronDesktop && window.location.pathname !== '/') {
      try {
        window.history.pushState({ surfaceMode: 'landing' }, '', '/');
      } catch {}
    }
    window.scrollTo(0, 0);
  }, [isElectronDesktop]);

  const handleChangeLandingLanguage = useCallback((nextLang: Language) => {
    setLanguage(nextLang);
    try {
      localStorage.setItem('novablast_lang', nextLang);
    } catch {}
  }, []);

  const handleStartProject = (config: ProjectConfig) => {
    setSurfaceMode('app');
    if (!isElectronDesktop && window.location.pathname !== '/app') {
      try {
        window.history.pushState({ surfaceMode: 'app' }, '', '/app');
      } catch {}
    }
    const newGrid = createGrid(config.width, config.height, config.bgColor);
    setCanvasSize({ width: config.width, height: config.height });
    setHistory({
      past: [],
      present: newGrid,
      future: []
    });
    setProjectType(config.projectType || 'static');
    setFps(config.fps || 8);
    setFrames([newGrid]);
    setCurrentFrameIndex(0);
    setIsPlaying(false);
    setOnionSkin(false);
    setCurrentProjectName(config.name);
    setShowGrid(showGridDefault);
    setProjectStarted(true);
    setIsProjectsModalOpen(false); // Ensure modal is closed
  };

  const handleImportFromCommunity = (imported: {
    name: string;
    width: number;
    height: number;
    grid: GridState;
    frames: GridState[];
    projectType: ProjectType;
    fps: number;
  }) => {
    setCanvasSize({ width: imported.width, height: imported.height });
    const mainGrid = imported.grid || (imported.frames && imported.frames[0]) || createGrid(imported.width, imported.height, null);
    const allFrames = imported.frames && imported.frames.length > 0 ? imported.frames : [mainGrid];
    
    setHistory({
      past: [],
      present: mainGrid,
      future: []
    });
    setProjectType(imported.projectType || 'static');
    setFps(imported.fps || 8);
    setFrames(allFrames);
    setCurrentFrameIndex(0);
    setIsPlaying(false);
    setOnionSkin(false);
    setCurrentProjectName(imported.name);
    setCurrentProjectId(null); // Fresh imported copy
    setShowGrid(showGridDefault);
    setProjectStarted(true);
    setIsCommunityGalleryOpen(false);
  };

  const handleExitProject = () => {
    setIsPlaying(false);
    setProjectStarted(false);
    setCurrentProjectId(null);
    setCurrentProjectName("Новый проект");
  }

  // Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Listen for Electron auth callback
  useEffect(() => {
    if (window.electron?.onAuthReceived) {
      window.electron.onAuthReceived(async (authData: any) => {
        setIsLoggingIn(true);
        try {
          const credential = GoogleAuthProvider.credential(authData.idToken, authData.accessToken || undefined);
          await signInWithCredential(auth, credential);
          toast.success('Успешный вход через браузер!', {
            description: 'Вы вошли в систему под своей учетной записью.'
          });
        } catch (err: any) {
          console.error("Failed to sign in with received credential:", err);
          toast.error('Ошибка входа через браузер', {
            description: err.message || 'Не удалось завершить авторизацию'
          });
        } finally {
          setIsLoggingIn(false);
        }
      });
    }
  }, []);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
  
    try {
      if (window.electron) {
        // Electron mode - trigger external web browser Google login
        if (window.electron.googleLogin) {
          await window.electron.googleLogin();
          toast.info(language === 'en' ? 'Signing in via external browser...' : 'Вход через внешний браузер...', {
            description: language === 'en'
              ? 'A tab opened in your default browser. Complete authorization there.'
              : 'В вашем основном браузере открылась вкладка для входа. Завершите авторизацию там.',
            duration: 12000
          });
        }
      } else {
        // Standard Web mode
        await signInWithPopup(auth, googleProvider);
        toast.success(language === 'en' ? 'Successfully logged in!' : 'Успешный вход!');
      }
    } catch (error: any) {
      const isExpectedBrowserBlock = 
        error?.code === 'auth/popup-blocked' || 
        error?.code === 'auth/popup-closed-by-user' || 
        error?.code === 'auth/cancelled-popup-request';

      if (!isExpectedBrowserBlock) {
        console.error("Login failed:", error);
      } else {
        console.warn("Login popup notice:", error?.code);
      }
      
      let errorMessage = language === 'en' ? 'Sign in failed' : 'Не удалось завершить вход';
      let description = error?.message || '';

      if (error?.code === 'auth/popup-blocked') {
        errorMessage = language === 'en' ? 'Popup window blocked' : 'Всплывающее окно заблокировано';
        description = language === 'en' 
          ? 'Browser or iframe blocked the Google login popup. Please allow popups, open the app in a new tab, or use the Email/Nickname login.'
          : 'Браузер заблокировал всплывающее окно Google. Разрешите всплывающие окна в браузере, откройте приложение в новой вкладке или используйте вход по Почте/Нику.';
      } else if (error?.code === 'auth/popup-closed-by-user') {
        errorMessage = language === 'en' ? 'Login cancelled' : 'Вход отменен';
        description = language === 'en' 
          ? 'The authorization window was closed.'
          : 'Окно авторизации было закрыто до завершения входа.';
      } else if (error?.code === 'auth/network-request-failed') {
        errorMessage = language === 'en' ? 'Network error connecting to Google' : 'Сбой сети при входе через Google';
        description = language === 'en'
          ? 'Could not reach Firebase/Google Auth servers. Check your internet/VPN or disable strict AdBlock/privacy shields on this site.'
          : 'Браузер не смог подключиться к серверам Google/Firebase Auth. Проверьте интернет/VPN или отключите блокировщик рекламы/защиту от отслеживания для этого сайта.';
      } else if (error?.code === 'auth/unauthorized-domain') {
        errorMessage = language === 'en' ? 'Domain not authorized in Firebase' : 'Домен не добавлен в Firebase';
        description = language === 'en'
          ? `Add "${window.location.hostname}" (without https://) in Firebase Console → Authentication → Settings → Authorized domains.`
          : `Добавьте "${window.location.hostname}" (без https:// и слэша) в Firebase Console → Authentication → Settings → Authorized domains.`;
      } else if (error?.message?.includes('not secure')) {
        errorMessage = language === 'en' ? 'Browser notice' : 'Google блокирует вход';
        description = language === 'en' 
          ? 'Try opening the app in a dedicated browser tab or wait a few minutes.'
          : 'Попробуйте открыть приложение в отдельной вкладке браузера.';
      }

      toast.error(errorMessage, {
        description: description,
        duration: 9000
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const steamPollIntervalRef = useRef<number | null>(null);
  const steamPopupWatcherRef = useRef<number | null>(null);
  const activeSteamAuthWindowRef = useRef<Window | null>(null);
  const activeSteamLoginIdRef = useRef<string | null>(null);
  const completedSteamLoginsRef = useRef<Set<string>>(new Set());

  const stopSteamPolling = useCallback(() => {
    if (steamPollIntervalRef.current !== null) {
      window.clearInterval(steamPollIntervalRef.current);
      steamPollIntervalRef.current = null;
    }
    if (steamPopupWatcherRef.current !== null) {
      window.clearInterval(steamPopupWatcherRef.current);
      steamPopupWatcherRef.current = null;
    }
    if (activeSteamAuthWindowRef.current && !activeSteamAuthWindowRef.current.closed) {
      try {
        activeSteamAuthWindowRef.current.close();
      } catch {}
    }
    activeSteamAuthWindowRef.current = null;
    activeSteamLoginIdRef.current = null;
  }, []);

  const handleCancelSteamLogin = useCallback((reason?: string, notify: boolean = true) => {
    const currentLoginId = activeSteamLoginIdRef.current;
    if (currentLoginId) {
      completedSteamLoginsRef.current.add(currentLoginId);
    }
    stopSteamPolling();
    setIsSteamLoggingIn(false);
    toast.dismiss('steam-login-pending');

    if (notify) {
      toast.info(language === 'en' ? 'Steam sign-in cancelled' : 'Вход через Steam отменён', {
        id: 'steam-login-cancelled',
        description: reason || (language === 'en' ? 'The authorization window was closed.' : 'Окно авторизации было закрыто.'),
        duration: 4500,
      });
    }
  }, [language, stopSteamPolling]);

  const githubPollIntervalRef = useRef<number | null>(null);
  const githubPopupWatcherRef = useRef<number | null>(null);
  const activeGithubAuthWindowRef = useRef<Window | null>(null);
  const activeGithubLoginIdRef = useRef<string | null>(null);
  const completedGithubLoginsRef = useRef<Set<string>>(new Set());

  const stopGithubPolling = useCallback(() => {
    if (githubPollIntervalRef.current !== null) {
      window.clearInterval(githubPollIntervalRef.current);
      githubPollIntervalRef.current = null;
    }
    if (githubPopupWatcherRef.current !== null) {
      window.clearInterval(githubPopupWatcherRef.current);
      githubPopupWatcherRef.current = null;
    }
    if (activeGithubAuthWindowRef.current && !activeGithubAuthWindowRef.current.closed) {
      try {
        activeGithubAuthWindowRef.current.close();
      } catch {}
    }
    activeGithubAuthWindowRef.current = null;
    activeGithubLoginIdRef.current = null;
  }, []);

  const handleCancelGithubLogin = useCallback((reason?: string, notify: boolean = true) => {
    const currentLoginId = activeGithubLoginIdRef.current;
    if (currentLoginId) {
      completedGithubLoginsRef.current.add(currentLoginId);
    }
    stopGithubPolling();
    setIsGithubLoggingIn(false);
    toast.dismiss('github-login-pending');

    if (notify) {
      toast.info(language === 'en' ? 'GitHub sign-in cancelled' : 'Вход через GitHub отменён', {
        id: 'github-login-cancelled',
        description: reason || (language === 'en' ? 'The authorization window was closed.' : 'Окно авторизации было закрыто.'),
        duration: 4500,
      });
    }
  }, [language, stopGithubPolling]);

  const xPollIntervalRef = useRef<number | null>(null);
  const xPopupWatcherRef = useRef<number | null>(null);
  const activeXAuthWindowRef = useRef<Window | null>(null);
  const activeXLoginIdRef = useRef<string | null>(null);
  const completedXLoginsRef = useRef<Set<string>>(new Set());

  const stopXPolling = useCallback(() => {
    if (xPollIntervalRef.current !== null) {
      window.clearInterval(xPollIntervalRef.current);
      xPollIntervalRef.current = null;
    }
    if (xPopupWatcherRef.current !== null) {
      window.clearInterval(xPopupWatcherRef.current);
      xPopupWatcherRef.current = null;
    }
    if (activeXAuthWindowRef.current && !activeXAuthWindowRef.current.closed) {
      try {
        activeXAuthWindowRef.current.close();
      } catch {}
    }
    activeXAuthWindowRef.current = null;
    activeXLoginIdRef.current = null;
  }, []);

  const handleCancelXLogin = useCallback((reason?: string, notify: boolean = true) => {
    const currentLoginId = activeXLoginIdRef.current;
    if (currentLoginId) {
      completedXLoginsRef.current.add(currentLoginId);
    }
    stopXPolling();
    setIsXLoggingIn(false);
    toast.dismiss('x-login-pending');

    if (notify) {
      toast.info(language === 'en' ? 'X sign-in cancelled' : 'Вход через X отменён', {
        id: 'x-login-cancelled',
        description: reason || (language === 'en' ? 'The authorization window was closed.' : 'Окно авторизации было закрыто.'),
        duration: 4500,
      });
    }
  }, [language, stopXPolling]);

  useEffect(() => {
    return () => {
      stopSteamPolling();
      stopGithubPolling();
      stopXPolling();
    };
  }, [stopSteamPolling, stopGithubPolling, stopXPolling]);

  const completeSteamAuth = useCallback(async (
    customToken: string | null,
    steamProfile: { steamId: string; personaName: string; avatarUrl: string; profileUrl?: string },
    sessionToken?: string | null,
    silent = false
  ) => {
    stopSteamPolling();
    setIsSteamLoggingIn(false);

    if (sessionToken) {
      try {
        localStorage.setItem('novablast_steam_token', sessionToken);
      } catch {}
    }

    if (customToken) {
      const cred = await signInWithCustomToken(auth, customToken);
      await updateProfile(cred.user, {
        displayName: steamProfile.personaName,
        photoURL: steamProfile.avatarUrl || null,
      });
      try {
        await setDoc(
          doc(db, 'users', cred.user.uid),
          {
            uid: cred.user.uid,
            nickname: steamProfile.personaName,
            steamId: steamProfile.steamId,
            photoURL: steamProfile.avatarUrl || '',
            provider: 'steam',
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (fsErr) {
        console.warn('Could not sync Steam profile document:', fsErr);
      }
      setSteamSessionUser(null);
      await cred.user.reload().catch(() => {});
      setUser(auth.currentUser ? ({ ...auth.currentUser, displayName: steamProfile.personaName, photoURL: steamProfile.avatarUrl || null, uid: cred.user.uid } as User) : cred.user);
    } else {
      setSteamSessionUser({
        uid: `steam_${steamProfile.steamId}`,
        displayName: steamProfile.personaName,
        photoURL: steamProfile.avatarUrl || null,
        email: null,
        steamId: steamProfile.steamId,
        provider: 'steam',
      });
    }

    if (!silent) {
      toast.dismiss('steam-login-pending');
      toast.success(
        language === 'en'
          ? `Welcome, ${steamProfile.personaName}!`
          : `Добро пожаловать, ${steamProfile.personaName}!`,
        {
          description:
            language === 'en'
              ? 'Successfully signed in with Steam.'
              : 'Вы успешно вошли через учетную запись Steam.',
        }
      );
    }
  }, [language, stopSteamPolling]);

  const completeGithubAuth = useCallback(async (
    customToken: string | null,
    githubProfile: { githubId: string; login: string; name: string; avatarUrl: string; profileUrl?: string; email?: string },
    sessionToken?: string | null,
    silent = false
  ) => {
    stopGithubPolling();
    setIsGithubLoggingIn(false);
    toast.dismiss('github-login-pending');
    toast.dismiss('github-login-cancelled');

    if (sessionToken) {
      try {
        localStorage.setItem('novablast_github_token', sessionToken);
      } catch {}
    }

    if (customToken) {
      const cred = await signInWithCustomToken(auth, customToken);
      await updateProfile(cred.user, {
        displayName: githubProfile.name || githubProfile.login,
        photoURL: githubProfile.avatarUrl || null,
      });
      try {
        await setDoc(
          doc(db, 'users', cred.user.uid),
          {
            uid: cred.user.uid,
            nickname: githubProfile.name || githubProfile.login,
            githubId: githubProfile.githubId,
            photoURL: githubProfile.avatarUrl || '',
            provider: 'github',
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (fsErr) {
        console.warn('Could not sync GitHub profile document:', fsErr);
      }
      setGithubSessionUser(null);
      await cred.user.reload().catch(() => {});
      setUser(auth.currentUser ? ({ ...auth.currentUser, displayName: githubProfile.name || githubProfile.login, photoURL: githubProfile.avatarUrl || null, uid: cred.user.uid } as User) : cred.user);
    } else {
      setGithubSessionUser({
        uid: `github_${githubProfile.githubId}`,
        displayName: githubProfile.name || githubProfile.login,
        photoURL: githubProfile.avatarUrl || null,
        email: githubProfile.email || null,
        githubId: githubProfile.githubId,
        provider: 'github',
      });
    }

    if (!silent) {
      toast.success(
        language === 'en'
          ? `Welcome, ${githubProfile.name || githubProfile.login}!`
          : `Добро пожаловать, ${githubProfile.name || githubProfile.login}!`,
        {
          description:
            language === 'en'
              ? 'Successfully signed in with GitHub.'
              : 'Вы успешно вошли через GitHub.',
          duration: 4000,
        }
      );
    }
  }, [language, stopGithubPolling]);

  const completeXAuth = useCallback(async (
    customToken: string | null,
    xProfile: { xId: string; username: string; name: string; avatarUrl: string; profileUrl?: string },
    sessionToken?: string | null,
    silent = false
  ) => {
    stopXPolling();
    setIsXLoggingIn(false);
    toast.dismiss('x-login-pending');
    toast.dismiss('x-login-cancelled');

    if (sessionToken) {
      try {
        localStorage.setItem('novablast_x_token', sessionToken);
      } catch {}
    }

    if (customToken) {
      const cred = await signInWithCustomToken(auth, customToken);
      await updateProfile(cred.user, {
        displayName: xProfile.name || xProfile.username,
        photoURL: xProfile.avatarUrl || null,
      });
      try {
        await setDoc(
          doc(db, 'users', cred.user.uid),
          {
            uid: cred.user.uid,
            nickname: xProfile.name || xProfile.username,
            xId: xProfile.xId,
            photoURL: xProfile.avatarUrl || '',
            provider: 'x',
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (fsErr) {
        console.warn('Could not sync X profile document:', fsErr);
      }
      setXSessionUser(null);
      await cred.user.reload().catch(() => {});
      setUser(auth.currentUser ? ({ ...auth.currentUser, displayName: xProfile.name || xProfile.username, photoURL: xProfile.avatarUrl || null, uid: cred.user.uid } as User) : cred.user);
    } else {
      setXSessionUser({
        uid: `x_${xProfile.xId}`,
        displayName: xProfile.name || xProfile.username,
        photoURL: xProfile.avatarUrl || null,
        email: null,
        xId: xProfile.xId,
        provider: 'x',
      });
    }

    if (!silent) {
      toast.success(
        language === 'en'
          ? `Welcome, ${xProfile.name || xProfile.username}!`
          : `Добро пожаловать, ${xProfile.name || xProfile.username}!`,
        {
          description:
            language === 'en'
              ? 'Successfully signed in with X.'
              : 'Вы успешно вошли через X.',
          duration: 4000,
        }
      );
    }
  }, [language, stopXPolling]);

  // Restore verified Steam server session on startup (works via Bearer token even if 3P cookies are blocked)
  useEffect(() => {
    if (!isAuthReady || user) return;

    let cancelled = false;
    const restoreSteamSession = async () => {
      try {
        let savedToken: string | null = null;
        try {
          savedToken = localStorage.getItem('novablast_steam_token');
        } catch {}

        const headers: Record<string, string> = {};
        if (savedToken) {
          headers.Authorization = `Bearer ${savedToken}`;
        }

        const resp = await fetch('/api/auth/steam/session', {
          credentials: 'include',
          headers,
          cache: 'no-store',
        });
        if (!resp.ok) return;
        const data = await resp.json();
        if (!cancelled && data?.authenticated && data?.steamProfile) {
          await completeSteamAuth(
            data.customToken || null,
            data.steamProfile,
            data.sessionToken || savedToken,
            true
          );
        } else if (!cancelled && savedToken && data?.authenticated === false) {
          try {
            localStorage.removeItem('novablast_steam_token');
          } catch {}
        }
      } catch {
        // Backend session endpoint unavailable or offline
      }
    };

    restoreSteamSession();
    return () => {
      cancelled = true;
    };
  }, [isAuthReady, user, completeSteamAuth]);

  // Fast-path listeners (postMessage + BroadcastChannel) alongside server polling
  useEffect(() => {
    const processAuthPayload = async (payload: any) => {
      if (!payload || typeof payload !== 'object') return;
      const loginKey = payload.loginId || `msg_${payload.steamProfile?.steamId || ''}`;

      if (payload.type === 'STEAM_AUTH_SUCCESS' && payload.steamProfile) {
        if (loginKey && completedSteamLoginsRef.current.has(loginKey)) return;
        if (loginKey) completedSteamLoginsRef.current.add(loginKey);

        try {
          await completeSteamAuth(
            payload.customToken || null,
            payload.steamProfile,
            payload.sessionToken || null,
            false
          );
        } catch (err: any) {
          console.error('Steam Firebase sign-in error:', err);
          setIsSteamLoggingIn(false);
          toast.error(language === 'en' ? 'Steam sign-in failed' : 'Ошибка входа через Steam', {
            description: err?.message || '',
          });
        }
      } else if (payload.type === 'STEAM_AUTH_ERROR') {
        if (loginKey && completedSteamLoginsRef.current.has(loginKey)) return;
        if (loginKey) completedSteamLoginsRef.current.add(loginKey);

        handleCancelSteamLogin(
          payload.error || (language === 'en' ? 'Steam authorization was cancelled.' : 'Авторизация Steam была отменена.')
        );
      } else if (payload.type === 'GITHUB_AUTH_SUCCESS' && payload.githubProfile) {
        if (loginKey && completedGithubLoginsRef.current.has(loginKey)) return;
        if (loginKey) completedGithubLoginsRef.current.add(loginKey);

        try {
          await completeGithubAuth(
            payload.customToken || null,
            payload.githubProfile,
            payload.sessionToken || null,
            false
          );
        } catch (err: any) {
          console.error('GitHub sign-in error:', err);
          setIsGithubLoggingIn(false);
          toast.error(language === 'en' ? 'GitHub sign-in failed' : 'Ошибка входа через GitHub', {
            description: err?.message || '',
          });
        }
      } else if (payload.type === 'GITHUB_AUTH_ERROR') {
        if (loginKey && completedGithubLoginsRef.current.has(loginKey)) return;
        if (loginKey) completedGithubLoginsRef.current.add(loginKey);

        handleCancelGithubLogin(
          payload.error || (language === 'en' ? 'GitHub authorization was cancelled.' : 'Авторизация GitHub была отменена.')
        );
      } else if (payload.type === 'X_AUTH_SUCCESS' && payload.xProfile) {
        if (loginKey && completedXLoginsRef.current.has(loginKey)) return;
        if (loginKey) completedXLoginsRef.current.add(loginKey);

        try {
          await completeXAuth(
            payload.customToken || null,
            payload.xProfile,
            payload.sessionToken || null,
            false
          );
        } catch (err: any) {
          console.error('X sign-in error:', err);
          setIsXLoggingIn(false);
          toast.error(language === 'en' ? 'X sign-in failed' : 'Ошибка входа через X', {
            description: err?.message || '',
          });
        }
      } else if (payload.type === 'X_AUTH_ERROR') {
        if (loginKey && completedXLoginsRef.current.has(loginKey)) return;
        if (loginKey) completedXLoginsRef.current.add(loginKey);

        handleCancelXLogin(
          payload.error || (language === 'en' ? 'X authorization was cancelled.' : 'Авторизация X была отменена.')
        );
      }
    };

    const handlePopupMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (
        origin &&
        origin !== window.location.origin &&
        !origin.endsWith('.vercel.app') &&
        !origin.endsWith('.run.app') &&
        !origin.includes('localhost') &&
        !origin.includes('127.0.0.1')
      ) {
        return;
      }
      processAuthPayload(event.data);
    };

    const handleStorageBridge = (event: StorageEvent) => {
      if (!event.key || !event.newValue) return;
      if (event.key === 'novablast_oauth_bridge' || event.key.startsWith('novablast_oauth_bridge_')) {
        try {
          const payload = JSON.parse(event.newValue);
          processAuthPayload(payload);
        } catch {}
      }
    };

    let bcSteam: BroadcastChannel | null = null;
    let bcGithub: BroadcastChannel | null = null;
    let bcX: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bcSteam = new BroadcastChannel('novablast_steam_auth');
        bcSteam.onmessage = (ev) => processAuthPayload(ev.data);
        bcGithub = new BroadcastChannel('novablast_github_auth');
        bcGithub.onmessage = (ev) => processAuthPayload(ev.data);
        bcX = new BroadcastChannel('novablast_x_auth');
        bcX.onmessage = (ev) => processAuthPayload(ev.data);
      }
    } catch {}

    window.addEventListener('message', handlePopupMessage);
    window.addEventListener('storage', handleStorageBridge);
    return () => {
      window.removeEventListener('message', handlePopupMessage);
      window.removeEventListener('storage', handleStorageBridge);
      try {
        bcSteam?.close();
        bcGithub?.close();
        bcX?.close();
      } catch {}
    };
  }, [completeSteamAuth, completeGithubAuth, completeXAuth, handleCancelSteamLogin, handleCancelGithubLogin, handleCancelXLogin, language, stopSteamPolling, stopGithubPolling, stopXPolling]);

  const handleSteamLogin = () => {
    if (isLoggingIn) return;

    // If Steam login is already in progress and clicked again, cancel it cleanly
    if (isSteamLoggingIn) {
      handleCancelSteamLogin(
        language === 'en' ? 'Authorization cancelled.' : 'Авторизация отменена.'
      );
      return;
    }

    // Cancel any previous pending state so user can cleanly start fresh
    stopSteamPolling();
    setIsSteamLoggingIn(true);
    toast.dismiss('steam-login-cancelled');

    // 1. Build Steam OpenID 2.0 URL SYNCHRONOUSLY inside click handler so cross-origin iframe popup blockers never block window.open
    const loginId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

    activeSteamLoginIdRef.current = loginId;

    const baseUrl = window.location.origin;
    const callbackUrl = `${baseUrl}/auth/steam/callback/${loginId}`;

    const openIdParams = new URLSearchParams({
      'openid.ns': 'http://specs.openid.net/auth/2.0',
      'openid.mode': 'checkid_setup',
      'openid.return_to': callbackUrl,
      'openid.realm': baseUrl,
      'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
      'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
    });

    const steamAuthUrl = `https://steamcommunity.com/openid/login?${openIdParams.toString()}`;

    const authWindow = window.open(
      steamAuthUrl,
      'steam_openid_popup',
      'width=860,height=720,menubar=no,toolbar=no,location=yes,status=no'
    );

    activeSteamAuthWindowRef.current = authWindow;

    // 2. Watcher: Detect when user manually closes the popup window without completing auth
    if (authWindow) {
      let closedTicks = 0;
      steamPopupWatcherRef.current = window.setInterval(() => {
        try {
          if (authWindow.closed) {
            closedTicks++;
            // Wait 2 ticks (~600ms) to ensure any completed message or redirect finishes processing
            if (closedTicks >= 2) {
              if (steamPopupWatcherRef.current !== null) {
                window.clearInterval(steamPopupWatcherRef.current);
                steamPopupWatcherRef.current = null;
              }
              if (!completedSteamLoginsRef.current.has(loginId)) {
                handleCancelSteamLogin(
                  language === 'en'
                    ? 'The authorization window was closed.'
                    : 'Окно авторизации было закрыто.'
                );
              } else {
                stopSteamPolling();
                setIsSteamLoggingIn(false);
              }
            }
          } else {
            closedTicks = 0;
          }
        } catch {
          // WindowProxy cross-origin security prevents errors on .closed
        }
      }, 300);
    }

    // Register loginId on backend asynchronously (non-blocking)
    fetch(`/api/auth/steam/url?origin=${encodeURIComponent(baseUrl)}&loginId=${encodeURIComponent(loginId)}`, {
      cache: 'no-store',
    }).catch(() => {});

    // 3. Start server-side polling by loginId (immune to COOP window.opener=null & partitioned cookies)
    const startedAt = Date.now();
    const MAX_POLL_DURATION_MS = 90 * 1000; // 90 seconds timeout

    steamPollIntervalRef.current = window.setInterval(async () => {
      if (Date.now() - startedAt > MAX_POLL_DURATION_MS) {
        handleCancelSteamLogin(
          language === 'en'
            ? 'Steam sign-in timed out. Please try again.'
            : 'Время ожидания входа через Steam истекло. Попробуйте снова.'
        );
        return;
      }

      try {
        try {
          const bridgeRaw = localStorage.getItem(`novablast_oauth_bridge_${loginId}`);
          if (bridgeRaw) {
            localStorage.removeItem(`novablast_oauth_bridge_${loginId}`);
            localStorage.removeItem('novablast_oauth_bridge');
            const bridge = JSON.parse(bridgeRaw);
            if (bridge?.type === 'STEAM_AUTH_SUCCESS' && bridge?.steamProfile) {
              if (!completedSteamLoginsRef.current.has(loginId)) {
                completedSteamLoginsRef.current.add(loginId);
                await completeSteamAuth(bridge.customToken || null, bridge.steamProfile, bridge.sessionToken || null, false);
              }
              return;
            }
            if (bridge?.type === 'STEAM_AUTH_ERROR') {
              if (!completedSteamLoginsRef.current.has(loginId)) {
                completedSteamLoginsRef.current.add(loginId);
                handleCancelSteamLogin(bridge.error);
              }
              return;
            }
          }
        } catch {}

        const resp = await fetch(`/api/auth/steam/poll/${encodeURIComponent(loginId)}`, {
          cache: 'no-store',
          credentials: 'include',
        });
        if (!resp.ok) return;
        const data = await resp.json();

        if (data?.status === 'authenticated' && data?.steamProfile) {
          if (completedSteamLoginsRef.current.has(loginId)) return;
          completedSteamLoginsRef.current.add(loginId);

          await completeSteamAuth(
            data.customToken || null,
            data.steamProfile,
            data.sessionToken || null,
            false
          );
        } else if (data?.status === 'error') {
          if (completedSteamLoginsRef.current.has(loginId)) return;
          completedSteamLoginsRef.current.add(loginId);

          handleCancelSteamLogin(
            data.error || (language === 'en' ? 'Steam authorization was cancelled.' : 'Авторизация Steam была отменена.')
          );
        }
      } catch {
        // Ignore transient network errors while polling
      }
    }, 1200);

    // 4. Provide clear status & clickable fallback link in case browser blocked popups globally
    if (!authWindow && !window.electron) {
      toast.info(
        language === 'en' ? 'Open Steam Sign-In' : 'Откройте страницу входа Steam',
        {
          id: 'steam-login-pending',
          duration: 30000,
          description: (
            <div className="mt-2 flex flex-col gap-2">
              <span>
                {language === 'en'
                  ? 'Your browser blocked the popup window. Click the button below to sign in via Steam in a new tab:'
                  : 'Браузер заблокировал всплывающее окно. Нажмите кнопку ниже, чтобы войти через Steam в новой вкладке:'}
              </span>
              <a
                href={steamAuthUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#1b2838] hover:bg-[#2a475e] text-[#66c0f4] hover:text-white font-bold text-xs border border-[#66c0f4]/40 transition-colors no-underline"
              >
                <SteamIcon className="w-4 h-4" />
                <span>{language === 'en' ? 'Open Steam Login ↗' : 'Открыть вход Steam ↗'}</span>
              </a>
            </div>
          ),
        }
      );
    } else {
      toast.info(
        language === 'en' ? 'Waiting for Steam authorization...' : 'Ожидание входа в окне Steam...',
        {
          id: 'steam-login-pending',
          duration: 15000,
          description:
            language === 'en'
              ? 'Sign in on the Steam page that opened. NovaBlast will connect automatically.'
              : 'Подтвердите вход в открывшемся окне Steam — редактор подключит аккаунт автоматически.',
        }
      );
    }
  };

  const handleSteamChallengeVerify = async (steamId: string, challengeCode: string, challengeToken?: string): Promise<boolean> => {
    try {
      setIsSteamLoggingIn(true);
      const resp = await fetch('/api/auth/steam/verify-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steamId, challengeCode, challengeToken }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.authenticated || !data.steamProfile) {
        throw new Error(data.error || (language === 'en' ? 'Ownership verification failed' : 'Не удалось подтвердить владение аккаунтом'));
      }
      await completeSteamAuth(
        data.customToken || null,
        data.steamProfile,
        data.sessionToken || null,
        false
      );
      setIsAuthModalOpen(false);
      return true;
    } catch (err: any) {
      toast.error(err.message || (language === 'en' ? 'Steam verification failed' : 'Ошибка проверки профиля Steam'));
      throw err;
    } finally {
      setIsSteamLoggingIn(false);
    }
  };

  const handleSteamManualCallback = async (url: string): Promise<boolean> => {
    try {
      setIsSteamLoggingIn(true);
      const resp = await fetch('/api/auth/steam/manual-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.authenticated || !data.steamProfile) {
        throw new Error(data.error || (language === 'en' ? 'Steam OpenID validation failed' : 'Не удалось проверить ответ Steam'));
      }
      await completeSteamAuth(
        data.customToken || null,
        data.steamProfile,
        data.sessionToken || null,
        false
      );
      setIsAuthModalOpen(false);
      return true;
    } catch (err: any) {
      toast.error(err.message || (language === 'en' ? 'Steam verification failed' : 'Ошибка проверки авторизации Steam'));
      throw err;
    } finally {
      setIsSteamLoggingIn(false);
    }
  };

  const handleSteamQrComplete = async (data: any) => {
    if (!data?.steamProfile) return;
    await completeSteamAuth(
      data.customToken || null,
      data.steamProfile,
      data.sessionToken || null,
      false
    );
    setIsAuthModalOpen(false);
  };

  const handleGithubLogin = async () => {
    if (isLoggingIn || isSteamLoggingIn) return;

    if (isGithubLoggingIn) {
      handleCancelGithubLogin(
        language === 'en' ? 'Authorization cancelled.' : 'Авторизация отменена.'
      );
      return;
    }

    stopGithubPolling();
    setIsGithubLoggingIn(true);
    toast.dismiss('github-login-cancelled');

    // Go directly to backend GitHub OAuth 2.0 flow
    const loginId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

    activeGithubLoginIdRef.current = loginId;
    const baseUrl = window.location.origin;

    try {
      const urlResp = await fetch(`/api/auth/github/url?origin=${encodeURIComponent(baseUrl)}&loginId=${encodeURIComponent(loginId)}`, {
        cache: 'no-store',
      });
      const urlData = await urlResp.json();

      if (!urlData?.configured || !urlData?.url) {
        // Fallback: try Firebase Auth GitHub provider directly if enabled in Firebase Console
        try {
          await signInWithPopup(auth, githubProvider);
          setIsGithubLoggingIn(false);
          toast.success(language === 'en' ? 'Successfully signed in with GitHub!' : 'Вы успешно вошли через GitHub!');
          return;
        } catch (fbErr: any) {
          setIsGithubLoggingIn(false);
          if (fbErr?.code === 'auth/popup-closed-by-user' || fbErr?.code === 'auth/cancelled-popup-request') {
            return;
          }
          toast.error(
            language === 'en' ? 'GitHub sign-in setup' : 'Настройка входа через GitHub',
            {
              duration: 12000,
              description: (
                <div className="flex flex-col gap-2 mt-1">
                  <span>
                    {language === 'en'
                      ? `Enable GitHub in Firebase Console (Authentication → Sign-in method) OR add GITHUB_CLIENT_ID & GITHUB_CLIENT_SECRET in environment variables with callback: ${baseUrl}/auth/github/callback`
                      : `Включите GitHub в Firebase Console (Authentication → Sign-in method → GitHub), либо добавьте GITHUB_CLIENT_ID и GITHUB_CLIENT_SECRET в переменные окружения Vercel с callback URL: ${baseUrl}/auth/github/callback`}
                  </span>
                  <a
                    href="https://console.firebase.google.com/project/gen-lang-client-0487154255/authentication/providers"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-400 hover:text-indigo-300 underline font-mono"
                  >
                    {language === 'en' ? 'Open Firebase Console ↗' : 'Открыть Firebase Console ↗'}
                  </a>
                </div>
              ),
            }
          );
          return;
        }
      }

      const authWindow = window.open(
        urlData.url,
        'github_oauth_popup',
        'width=640,height=760,menubar=no,toolbar=no,location=yes,status=no'
      );

      activeGithubAuthWindowRef.current = authWindow;

      if (authWindow) {
        let closedTicks = 0;
        githubPopupWatcherRef.current = window.setInterval(() => {
          try {
            if (authWindow.closed) {
              closedTicks++;
              if (closedTicks >= 2) {
                if (githubPopupWatcherRef.current !== null) {
                  window.clearInterval(githubPopupWatcherRef.current);
                  githubPopupWatcherRef.current = null;
                }
                if (!completedGithubLoginsRef.current.has(loginId)) {
                  handleCancelGithubLogin(
                    language === 'en'
                      ? 'The authorization window was closed.'
                      : 'Окно авторизации было закрыто.'
                  );
                } else {
                  stopGithubPolling();
                  setIsGithubLoggingIn(false);
                }
              }
            } else {
              closedTicks = 0;
            }
          } catch {}
        }, 300);
      }

      const startedAt = Date.now();
      const MAX_POLL_DURATION_MS = 90 * 1000;

      githubPollIntervalRef.current = window.setInterval(async () => {
        if (Date.now() - startedAt > MAX_POLL_DURATION_MS) {
          handleCancelGithubLogin(
            language === 'en'
              ? 'GitHub sign-in timed out. Please try again.'
              : 'Время ожидания входа через GitHub истекло. Попробуйте снова.'
          );
          return;
        }

        try {
          try {
            const bridgeRaw = localStorage.getItem(`novablast_oauth_bridge_${loginId}`);
            if (bridgeRaw) {
              localStorage.removeItem(`novablast_oauth_bridge_${loginId}`);
              localStorage.removeItem('novablast_oauth_bridge');
              const bridge = JSON.parse(bridgeRaw);
              if (bridge?.type === 'GITHUB_AUTH_SUCCESS' && bridge?.githubProfile) {
                if (!completedGithubLoginsRef.current.has(loginId)) {
                  completedGithubLoginsRef.current.add(loginId);
                  await completeGithubAuth(bridge.customToken || null, bridge.githubProfile, bridge.sessionToken || null, false);
                }
                return;
              }
              if (bridge?.type === 'GITHUB_AUTH_ERROR') {
                if (!completedGithubLoginsRef.current.has(loginId)) {
                  completedGithubLoginsRef.current.add(loginId);
                  handleCancelGithubLogin(bridge.error);
                }
                return;
              }
            }
          } catch {}

          const resp = await fetch(`/api/auth/github/poll/${encodeURIComponent(loginId)}`, {
            cache: 'no-store',
            credentials: 'include',
          });
          if (!resp.ok) return;
          const data = await resp.json();

          if (data?.status === 'authenticated' && data?.githubProfile) {
            if (completedGithubLoginsRef.current.has(loginId)) return;
            completedGithubLoginsRef.current.add(loginId);

            await completeGithubAuth(
              data.customToken || null,
              data.githubProfile,
              data.sessionToken || null,
              false
            );
          } else if (data?.status === 'error') {
            if (completedGithubLoginsRef.current.has(loginId)) return;
            completedGithubLoginsRef.current.add(loginId);

            handleCancelGithubLogin(
              data.error || (language === 'en' ? 'GitHub authorization was cancelled.' : 'Авторизация GitHub была отменена.')
            );
          }
        } catch {}
      }, 1200);

      toast.info(
        language === 'en' ? 'Waiting for GitHub authorization...' : 'Ожидание входа в окне GitHub...',
        {
          id: 'github-login-pending',
          duration: 15000,
          description:
            language === 'en'
              ? 'Complete sign-in in the GitHub window that opened.'
              : 'Подтвердите вход в открывшемся окне GitHub.',
        }
      );
    } catch (err: any) {
      console.error('[GitHub Auth] Failed to start backend OAuth:', err);
      setIsGithubLoggingIn(false);
      toast.error(language === 'en' ? 'Could not open GitHub login' : 'Не удалось открыть вход GitHub');
    }
  };

  const handleXLogin = async () => {
    if (isLoggingIn || isSteamLoggingIn || isGithubLoggingIn) return;

    if (isXLoggingIn) {
      handleCancelXLogin(
        language === 'en' ? 'Authorization cancelled.' : 'Авторизация отменена.'
      );
      return;
    }

    stopXPolling();
    setIsXLoggingIn(true);
    toast.dismiss('x-login-cancelled');

    const loginId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

    activeXLoginIdRef.current = loginId;
    const baseUrl = window.location.origin;

    try {
      const urlResp = await fetch(`/api/auth/x/url?origin=${encodeURIComponent(baseUrl)}&loginId=${encodeURIComponent(loginId)}`, {
        cache: 'no-store',
      });
      const urlData = await urlResp.json();

      if (!urlData?.configured || !urlData?.url) {
        setIsXLoggingIn(false);
        toast.error(
          language === 'en' ? 'X sign-in setup' : 'Настройка входа через X',
          {
            duration: 12000,
            description: (
              <div className="flex flex-col gap-2 mt-1">
                <span>
                  {language === 'en'
                    ? `To enable X sign-in, set X_CLIENT_ID and X_CLIENT_SECRET environment variables in Vercel with callback URL: ${baseUrl}/auth/x/callback`
                    : `Чтобы включить вход через X (Twitter), укажите X_CLIENT_ID и X_CLIENT_SECRET в переменных окружения Vercel и добавьте callback URL: ${baseUrl}/auth/x/callback`}
                </span>
              </div>
            ),
          }
        );
        return;
      }

      const authWindow = window.open(
        urlData.url,
        'x_oauth_popup',
        'width=640,height=760,menubar=no,toolbar=no,location=yes,status=no'
      );

      activeXAuthWindowRef.current = authWindow;

      if (authWindow) {
        let closedTicks = 0;
        xPopupWatcherRef.current = window.setInterval(() => {
          try {
            if (authWindow.closed) {
              closedTicks++;
              if (closedTicks >= 2) {
                if (xPopupWatcherRef.current !== null) {
                  window.clearInterval(xPopupWatcherRef.current);
                  xPopupWatcherRef.current = null;
                }
                if (!completedXLoginsRef.current.has(loginId)) {
                  handleCancelXLogin(
                    language === 'en'
                      ? 'The authorization window was closed.'
                      : 'Окно авторизации было закрыто.'
                  );
                } else {
                  stopXPolling();
                  setIsXLoggingIn(false);
                }
              }
            } else {
              closedTicks = 0;
            }
          } catch {}
        }, 300);
      }

      const startedAt = Date.now();
      const MAX_POLL_DURATION_MS = 90 * 1000;

      xPollIntervalRef.current = window.setInterval(async () => {
        if (Date.now() - startedAt > MAX_POLL_DURATION_MS) {
          handleCancelXLogin(
            language === 'en'
              ? 'X sign-in timed out. Please try again.'
              : 'Время ожидания входа через X истекло. Попробуйте снова.'
          );
          return;
        }

        try {
          try {
            const bridgeRaw = localStorage.getItem(`novablast_oauth_bridge_${loginId}`);
            if (bridgeRaw) {
              localStorage.removeItem(`novablast_oauth_bridge_${loginId}`);
              localStorage.removeItem('novablast_oauth_bridge');
              const bridge = JSON.parse(bridgeRaw);
              if (bridge?.type === 'X_AUTH_SUCCESS' && bridge?.xProfile) {
                if (!completedXLoginsRef.current.has(loginId)) {
                  completedXLoginsRef.current.add(loginId);
                  await completeXAuth(bridge.customToken || null, bridge.xProfile, bridge.sessionToken || null, false);
                }
                return;
              }
              if (bridge?.type === 'X_AUTH_ERROR') {
                if (!completedXLoginsRef.current.has(loginId)) {
                  completedXLoginsRef.current.add(loginId);
                  handleCancelXLogin(bridge.error);
                }
                return;
              }
            }
          } catch {}

          const resp = await fetch(`/api/auth/x/poll/${encodeURIComponent(loginId)}`, {
            cache: 'no-store',
            credentials: 'include',
          });
          if (!resp.ok) return;
          const data = await resp.json();

          if (data?.status === 'authenticated' && data?.xProfile) {
            if (completedXLoginsRef.current.has(loginId)) return;
            completedXLoginsRef.current.add(loginId);

            await completeXAuth(
              data.customToken || null,
              data.xProfile,
              data.sessionToken || null,
              false
            );
          } else if (data?.status === 'error') {
            if (completedXLoginsRef.current.has(loginId)) return;
            completedXLoginsRef.current.add(loginId);

            handleCancelXLogin(
              data.error || (language === 'en' ? 'X authorization was cancelled.' : 'Авторизация X была отменена.')
            );
          }
        } catch {}
      }, 1200);

      toast.info(
        language === 'en' ? 'Waiting for X authorization...' : 'Ожидание входа в окне X...',
        {
          id: 'x-login-pending',
          duration: 15000,
          description:
            language === 'en'
              ? 'Complete sign-in in the X window that opened.'
              : 'Подтвердите вход в открывшемся окне X.',
        }
      );
    } catch (err: any) {
      console.error('[X Auth] Failed to start backend OAuth:', err);
      setIsXLoggingIn(false);
      toast.error(language === 'en' ? 'Could not open X login' : 'Не удалось открыть вход X');
    }
  };

  const handleLogout = async () => {
    try {
      handleCancelSteamLogin(undefined, false);
      handleCancelGithubLogin(undefined, false);
      handleCancelXLogin(undefined, false);
      await signOut(auth);
      setSteamSessionUser(null);
      setGithubSessionUser(null);
      setXSessionUser(null);
      try {
        localStorage.removeItem('novablast_steam_token');
        localStorage.removeItem('novablast_github_token');
        localStorage.removeItem('novablast_x_token');
      } catch {}
      await fetch('/api/auth/steam/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
      setProjectStarted(false);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Silent user project pre-fetcher to keep savedProjects updated without opening modals
  const fetchUserProjectsSilent = useCallback(async () => {
    if (!user && steamSessionUser) {
      try {
        const storageKey = `novablast_projects_${steamSessionUser.uid}`;
        const raw = localStorage.getItem(storageKey);
        const list: Project[] = raw ? JSON.parse(raw) : [];
        list.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
        setSavedProjects(list);
      } catch (err) {
        console.error('Failed to read local Steam projects:', err);
      }
      return;
    }

    if (!user) {
      setSavedProjects([]);
      return;
    }

    if (!navigator.onLine) return;

    try {
      let querySnapshot;
      try {
        const q = query(
          collection(db, 'projects'),
          where('userId', '==', user.uid),
          orderBy('updatedAt', 'desc')
        );
        querySnapshot = await getDocs(q);
      } catch (queryErr: any) {
        const fallbackQ = query(
          collection(db, 'projects'),
          where('userId', '==', user.uid)
        );
        querySnapshot = await getDocs(fallbackQ);
      }

      const projects: Project[] = [];
      querySnapshot.forEach((docSnap) => {
        projects.push({ id: docSnap.id, ...docSnap.data() } as Project);
      });

      projects.sort((a, b) => {
        const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : (a.updatedAt?.seconds ? a.updatedAt.seconds * 1000 : 0);
        const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : (b.updatedAt?.seconds ? b.updatedAt.seconds * 1000 : 0);
        return timeB - timeA;
      });

      setSavedProjects(projects);
    } catch (err) {
      console.error('Silent fetch user projects failed:', err);
    }
  }, [user, steamSessionUser]);

  // Auto pre-fetch user projects whenever authenticated user changes
  useEffect(() => {
    if (activeUser) {
      fetchUserProjectsSilent();
      setIsAuthModalOpen(false);
    } else {
      setSavedProjects([]);
    }
  }, [activeUser?.uid, fetchUserProjectsSilent]);

  const handleOpenGallery = () => {
    fetchUserProjectsSilent();
    setIsCommunityGalleryOpen(true);
  };

  const currentActiveProject = React.useMemo<Project | null>(() => {
    if (!projectStarted || !activeUser) return null;
    return {
      id: currentProjectId || 'current_canvas',
      name: currentProjectName || 'Текущий холст',
      grid: JSON.stringify(history.present),
      width: canvasSize.width,
      height: canvasSize.height,
      userId: activeUser.uid,
      ownerName: activeUser.displayName || 'Unknown',
      projectType: projectType,
      fps: fps,
      frames: projectType === 'animated'
        ? frames.map((f, i) => i === currentFrameIndex ? JSON.stringify(history.present) : JSON.stringify(f))
        : [JSON.stringify(history.present)],
      updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }
    };
  }, [projectStarted, activeUser, currentProjectId, currentProjectName, history.present, canvasSize, projectType, fps, frames, currentFrameIndex]);

  // Firebase Firestore (with automatic local profile fallback for Steam sessions without FIREBASE_SERVICE_ACCOUNT)
  const saveProject = async () => {
    if (!user && !steamSessionUser) {
      console.warn("Cannot save: User not logged in");
      return;
    }

    if (!user && steamSessionUser) {
      setIsSaving(true);
      setSaveSuccess(false);
      try {
        let targetProjectId = currentProjectId;
        if (!targetProjectId) {
          const safeName = currentProjectName
            .toLowerCase()
            .replace(/[^a-z0-9а-яё\s]/gi, '')
            .replace(/\s+/g, '-');
          const shortId = Math.random().toString(36).substring(2, 7);
          targetProjectId = `${safeName || 'art'}-${shortId}`;
        }

        const canvas = document.createElement('canvas');
        canvas.width = canvasSize.width;
        canvas.height = canvasSize.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          history.present.forEach((row, y) => {
            row.forEach((color, x) => {
              if (color) {
                ctx.fillStyle = color;
                ctx.fillRect(x, y, 1, 1);
              }
            });
          });
        }
        const previewImage = canvas.toDataURL('image/png');
        const storageKey = `novablast_projects_${steamSessionUser.uid}`;
        const existingRaw = localStorage.getItem(storageKey);
        const existingList: Project[] = existingRaw ? JSON.parse(existingRaw) : [];

        const newRecord: Project = {
          id: targetProjectId,
          name: currentProjectName,
          grid: JSON.stringify(history.present),
          width: canvasSize.width,
          height: canvasSize.height,
          userId: steamSessionUser.uid,
          ownerName: steamSessionUser.displayName,
          ownerEmail: 'steam',
          previewImage,
          updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
          projectType,
          fps,
          customColors,
          frames:
            projectType === 'animated'
              ? frames.map((f, i) => (i === currentFrameIndex ? JSON.stringify(history.present) : JSON.stringify(f)))
              : [JSON.stringify(history.present)],
        };

        const updatedList = [
          newRecord,
          ...existingList.filter((p) => p.id !== targetProjectId),
        ];
        localStorage.setItem(storageKey, JSON.stringify(updatedList));
        setCurrentProjectId(targetProjectId);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        toast.success(getTranslation(language, 'steamCloudNoticeTitle'), {
          description: getTranslation(language, 'steamCloudNoticeDesc'),
          duration: 5000,
        });
      } catch (err: any) {
        console.error('Local Steam save error:', err);
        toast.error(language === 'en' ? 'Failed to save project' : 'Не удалось сохранить проект', {
          description: err?.message || '',
        });
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (!navigator.onLine) {
      toast.error('Ошибка сохранения', {
        description: 'Нет подключения к интернету. Проект сохранен в памяти браузера.',
        icon: <WifiOff className="w-5 h-5" />,
      });
      return;
    }

    // Limit max size for cloud saving to prevent 1MB Firestore document limit error
    const MAX_PIXELS = 256 * 256;
    if (canvasSize.width * canvasSize.height > MAX_PIXELS) {
      toast.error('Ошибка сохранения', {
        description: 'Холст слишком большой для сохранения в облако (максимум 256x256). Вы можете только скачать его как PNG.',
        icon: <TriangleAlert className="w-5 h-5 text-yellow-500" />,
      });
      return;
    }

    console.log("Saving project...", { currentProjectName, currentProjectId });
    setIsSaving(true);
    setSaveSuccess(false);
    
    // Генерируем читабельный ID, если это новый проект
    let targetProjectId = currentProjectId;
    if (!targetProjectId) {
      const safeName = currentProjectName
        .toLowerCase()
        .replace(/[^a-z0-9а-яё\s]/gi, '')
        .replace(/\s+/g, '-');
      const shortId = Math.random().toString(36).substring(2, 7);
      targetProjectId = `${safeName}-${shortId}`;
    }

    try {
      // Generate Preview Image as PNG data URL
      const canvas = document.createElement('canvas');
      canvas.width = canvasSize.width;
      canvas.height = canvasSize.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        history.present.forEach((row, y) => {
          row.forEach((color, x) => {
            if (color) {
              ctx.fillStyle = color;
              ctx.fillRect(x, y, 1, 1);
            }
          });
        });
      }
      const previewImage = canvas.toDataURL('image/png');

      const projectData: Project = {
        name: currentProjectName,
        grid: JSON.stringify(history.present),
        width: canvasSize.width,
        height: canvasSize.height,
        userId: user.uid,
        ownerName: user.displayName || 'Unknown',
        ownerEmail: user.email || 'Unknown',
        previewImage: previewImage,
        updatedAt: Timestamp.now(),
        projectType: projectType,
        fps: fps,
        customColors: customColors,
        frames: projectType === 'animated' 
          ? frames.map((f, i) => i === currentFrameIndex ? JSON.stringify(history.present) : JSON.stringify(f))
          : [JSON.stringify(history.present)]
      };

      console.log("Firestore Path:", `projects/${targetProjectId}`);
      await setDoc(doc(db, 'projects', targetProjectId), projectData);
      setCurrentProjectId(targetProjectId);
      setSaveSuccess(true);
      console.log("Project saved successfully!");
      fetchUserProjectsSilent();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Save project failed:", error);
      toast.error('Не удалось сохранить проект', {
        description: 'Проверьте соединение или права доступа'
      });
      try {
        handleFirestoreError(error, OperationType.WRITE, `projects/${targetProjectId}`);
      } catch (finalErr: any) {
        setError(finalErr);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const loadProjects = async () => {
    if (!user && steamSessionUser) {
      setError(null);
      setIsProjectsModalOpen(true);
      setIsProjectsLoading(true);
      try {
        const storageKey = `novablast_projects_${steamSessionUser.uid}`;
        const raw = localStorage.getItem(storageKey);
        const list: Project[] = raw ? JSON.parse(raw) : [];
        list.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
        setSavedProjects(list);
      } catch (err) {
        console.error('Failed to read local Steam projects:', err);
        setSavedProjects([]);
      } finally {
        setIsProjectsLoading(false);
      }
      return;
    }

    if (!user) {
      console.warn("Cannot load projects: User not logged in");
      return;
    }

    if (!navigator.onLine) {
      toast.error('Не удалось загрузить проекты', {
        description: 'Нет подключения к интернету.',
        icon: <WifiOff className="w-5 h-5" />,
      });
      return;
    }

    setError(null);
    setIsProjectsModalOpen(true);
    setIsProjectsLoading(true);
    console.log("Loading projects for user:", user.uid);
    try {
      let querySnapshot;
      try {
        const q = query(
          collection(db, 'projects'),
          where('userId', '==', user.uid),
          orderBy('updatedAt', 'desc')
        );
        querySnapshot = await getDocs(q);
      } catch (queryErr: any) {
        // Fallback to simple where query if composite index or orderBy is pending
        console.warn("Retrying query without orderBy clause...", queryErr);
        const fallbackQ = query(
          collection(db, 'projects'),
          where('userId', '==', user.uid)
        );
        querySnapshot = await getDocs(fallbackQ);
      }

      console.log("Query snapshot size:", querySnapshot.size);
      const projects: Project[] = [];
      querySnapshot.forEach((doc) => {
        projects.push({ id: doc.id, ...doc.data() } as Project);
      });

      // Sort client-side by updatedAt descending
      projects.sort((a, b) => {
        const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : (a.updatedAt?.seconds ? a.updatedAt.seconds * 1000 : 0);
        const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : (b.updatedAt?.seconds ? b.updatedAt.seconds * 1000 : 0);
        return timeB - timeA;
      });

      console.log("Loaded projects:", projects.length);
      setSavedProjects(projects);
    } catch (err: any) {
      console.error("Load projects failed:", err);
      if (err.message?.includes('index') || err.code === 'failed-precondition') {
        console.error("Firestore Index Required. Please check the console for the link to create it.");
      }
      toast.error('Не удалось загрузить проекты', {
        description: err.message?.includes('backend') || err.message?.includes('offline')
          ? 'Облачное хранилище временно недоступно. Проверьте соединение с интернетом.'
          : (err.message || 'Ошибка соединения с базой данных')
      });
      try {
        handleFirestoreError(err, OperationType.LIST, 'projects');
      } catch (finalErr: any) {
        setError(finalErr);
      }
    } finally {
      setIsProjectsLoading(false);
    }
  };

  const openProject = (project: Project) => {
    if (renamingProjectId) return; // Don't open while renaming
    const grid = JSON.parse(project.grid) as GridState;
    setCanvasSize({ width: project.width, height: project.height });
    
    const loadedProjectType = project.projectType || 'static';
    const loadedFps = project.fps || 8;
    let loadedFrames: GridState[] = [];
    if (project.frames && project.frames.length > 0) {
      loadedFrames = project.frames.map(f => JSON.parse(f) as GridState);
    } else {
      loadedFrames = [grid];
    }

    setProjectType(loadedProjectType);
    setFps(loadedFps);
    setFrames(loadedFrames);
    setCurrentFrameIndex(0);
    setIsPlaying(false);
    setOnionSkin(false);
    setCustomColors(project.customColors && Array.isArray(project.customColors) ? project.customColors : []);

    setHistory({
      past: [],
      present: loadedFrames[0] || grid,
      future: []
    });
    setCurrentProjectId(project.id || null);
    setCurrentProjectName(project.name);
    setProjectStarted(true);
    setIsProjectsModalOpen(false);
  };

  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if ((!user && !steamSessionUser) || isDeletingProject) return;
    
    setIsDeletingProject(projectId);
    try {
      if (!user && steamSessionUser) {
        const storageKey = `novablast_projects_${steamSessionUser.uid}`;
        const raw = localStorage.getItem(storageKey);
        const list: Project[] = raw ? JSON.parse(raw) : [];
        const filtered = list.filter(p => p.id !== projectId);
        localStorage.setItem(storageKey, JSON.stringify(filtered));
        setSavedProjects(filtered);
      } else if (user) {
        await deleteDoc(doc(db, 'projects', projectId));
        setSavedProjects(prev => prev.filter(p => p.id !== projectId));
      }
      if (currentProjectId === projectId) {
        setCurrentProjectId(null);
      }
      setConfirmDeleteId(null);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.DELETE, `projects/${projectId}`);
      } catch (finalErr: any) {
        setError(finalErr);
      }
    } finally {
      setIsDeletingProject(null);
    }
  };

  const requestDelete = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(projectId);
    setRenamingProjectId(null);
  };

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(null);
  };

  const startRenaming = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingProjectId(project.id || null);
    setRenamingName(project.name);
  };

  const handleRenameProject = async (projectId: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!user && !steamSessionUser) || !renamingName.trim()) {
      setRenamingProjectId(null);
      return;
    }

    try {
      const trimmed = renamingName.trim();
      if (!user && steamSessionUser) {
        const storageKey = `novablast_projects_${steamSessionUser.uid}`;
        const raw = localStorage.getItem(storageKey);
        const list: Project[] = raw ? JSON.parse(raw) : [];
        const updated = list.map(p =>
          p.id === projectId
            ? { ...p, name: trimmed, updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } }
            : p
        );
        localStorage.setItem(storageKey, JSON.stringify(updated));
        setSavedProjects(updated);
      } else if (user) {
        await updateDoc(doc(db, 'projects', projectId), {
          name: trimmed,
          updatedAt: Timestamp.now()
        });
        setSavedProjects(prev => prev.map(p => p.id === projectId ? { ...p, name: trimmed } : p));
      }
      if (currentProjectId === projectId) {
        setCurrentProjectName(trimmed);
      }
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.UPDATE, `projects/${projectId}`);
      } catch (finalErr: any) {
        setError(finalErr);
      }
    } finally {
      setRenamingProjectId(null);
    }
  };

  // Update grid wrapper to handle history & sync current frame
  const setGrid = useCallback((newGrid: GridState) => {
    setHistory(curr => {
      const newPast = [...curr.past, curr.present];
      return {
        past: newPast,
        present: newGrid,
        future: []
      };
    });
    setFrames(currFrames => {
      if (currFrames.length === 0) return [newGrid];
      return currFrames.map((f, i) => i === currentFrameIndex ? newGrid : f);
    });
  }, [currentFrameIndex]);

  // Frame Management Handlers
  const handleSelectFrame = (index: number) => {
    if (index < 0 || index >= frames.length) return;
    // Save current active grid into frames before switching
    setFrames(curr => curr.map((f, i) => i === currentFrameIndex ? history.present : f));
    setCurrentFrameIndex(index);
    setHistory({
      past: [],
      present: frames[index],
      future: []
    });
  };

  const handleAddFrame = () => {
    const blank = createGrid(canvasSize.width, canvasSize.height, null);
    // Persist current frame first
    const updated = frames.map((f, i) => i === currentFrameIndex ? history.present : f);
    const newFrames = [...updated, blank];
    const newIndex = newFrames.length - 1;
    setFrames(newFrames);
    setCurrentFrameIndex(newIndex);
    setHistory({
      past: [],
      present: blank,
      future: []
    });
  };

  const handleDuplicateFrame = (index: number) => {
    const source = index === currentFrameIndex ? history.present : frames[index];
    const cloned = source.map(row => [...row]);
    const updated = frames.map((f, i) => i === currentFrameIndex ? history.present : f);
    const newFrames = [
      ...updated.slice(0, index + 1),
      cloned,
      ...updated.slice(index + 1)
    ];
    const newIndex = index + 1;
    setFrames(newFrames);
    setCurrentFrameIndex(newIndex);
    setHistory({
      past: [],
      present: cloned,
      future: []
    });
  };

  const handleDeleteFrame = (index: number) => {
    if (frames.length <= 1) {
      toast.info(
        language === 'en'
          ? 'Animation must have at least one frame'
          : 'Анимация должна содержать хотя бы один кадр'
      );
      return;
    }
    const updated = frames.map((f, i) => i === currentFrameIndex ? history.present : f);
    const newFrames = updated.filter((_, i) => i !== index);
    let nextIndex = currentFrameIndex;
    if (index === currentFrameIndex) {
      nextIndex = Math.min(currentFrameIndex, newFrames.length - 1);
    } else if (index < currentFrameIndex) {
      nextIndex = currentFrameIndex - 1;
    }
    setFrames(newFrames);
    setCurrentFrameIndex(nextIndex);
    setHistory({
      past: [],
      present: newFrames[nextIndex],
      future: []
    });
    toast.success(
      language === 'en'
        ? `Frame #${index + 1} deleted`
        : `Кадр #${index + 1} удален`
    );
  };

  const handleCopyFrame = (targetIndex?: number) => {
    if (projectType !== 'animated' || frames.length === 0) return;
    const idx = (targetIndex !== undefined && targetIndex !== null)
      ? targetIndex
      : (hoveredFrameIndex !== null ? hoveredFrameIndex : currentFrameIndex);

    if (idx < 0 || idx >= frames.length) return;
    const source = idx === currentFrameIndex ? history.present : frames[idx];
    const cloned = source.map(row => [...row]);
    setClipboardFrame(cloned);
    toast.success(
      language === 'en'
        ? `Frame #${idx + 1} copied to buffer`
        : `Кадр #${idx + 1} скопирован в буфер`
    );
  };

  const handlePasteFrame = () => {
    if (projectType !== 'animated') return;
    if (!clipboardFrame) {
      toast.info(
        language === 'en'
          ? 'Frame clipboard is empty. Hover over a frame and press Ctrl+C'
          : 'Буфер кадров пуст. Наведитесь на кадр и нажмите Ctrl+C'
      );
      return;
    }
    const cloned = clipboardFrame.map(row => [...row]);
    // Save current active grid into frames
    const updated = frames.map((f, i) => i === currentFrameIndex ? history.present : f);
    
    // Insert after current frame index (over/next to current frame)
    const insertIndex = currentFrameIndex + 1;
    const newFrames = [
      ...updated.slice(0, insertIndex),
      cloned,
      ...updated.slice(insertIndex)
    ];
    setFrames(newFrames);
    setCurrentFrameIndex(insertIndex);
    setHistory({
      past: [],
      present: cloned,
      future: []
    });
    toast.success(
      language === 'en'
        ? `Pasted frame at position #${insertIndex + 1}`
        : `Кадр вставлен на позицию #${insertIndex + 1}`
    );
  };

  const handleTogglePlay = () => {
    setIsPlaying(prev => !prev);
  };



  const handleUndo = () => {
    setHistory(curr => {
      if (curr.past.length === 0) return curr;
      const previous = curr.past[curr.past.length - 1];
      const newPast = curr.past.slice(0, -1);
      return {
        past: newPast,
        present: previous,
        future: [curr.present, ...curr.future]
      };
    });
  };

  const handleRedo = () => {
    setHistory(curr => {
      if (curr.future.length === 0) return curr;
      const next = curr.future[0];
      const newFuture = curr.future.slice(1);
      return {
        past: [...curr.past, curr.present],
        present: next,
        future: newFuture
      };
    });
  };

  const handleClear = () => {
    setIsClearModalOpen(true);
  };

  const confirmClear = () => {
    setGrid(createGrid(canvasSize.width, canvasSize.height, null));
    setIsClearModalOpen(false);
  };

  const handleDownload = () => {
    // Sync current active grid into frames state if animation
    if (projectType === 'animated') {
      setFrames(prev => prev.map((f, i) => i === currentFrameIndex ? history.present : f));
    }
    setIsExportModalOpen(true);
  };

  // Reset project ID when user changes to prevent cross-account saving
  useEffect(() => {
    setCurrentProjectId(null);
  }, [activeUser?.uid]);

  // Load hotkeys (from Firestore for users, localStorage for guests)
  useEffect(() => {
    // Reset to defaults first to avoid leaking settings between users/sessions
    setHotkeys(DEFAULT_HOTKEYS);

    if (user) {
      const loadHotkeys = async () => {
        try {
          const hotkeysDoc = await getDoc(doc(db, 'users', user.uid, 'settings', 'hotkeys'));
          if (hotkeysDoc.exists()) {
            const data = hotkeysDoc.data() as HotkeyConfig;
            const merged = { ...DEFAULT_HOTKEYS, ...data };
            setHotkeys(merged);
            try {
              localStorage.setItem(`novablast_hotkeys_${user.uid}`, JSON.stringify(merged));
            } catch (e) {}
          }
        } catch (error: any) {
          console.warn("Could not load cloud hotkeys (offline/unavailable), falling back to local cache:", error?.message || error);
          const saved = localStorage.getItem(`novablast_hotkeys_${user.uid}`) || localStorage.getItem('pixel_punk_hotkeys');
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              setHotkeys({ ...DEFAULT_HOTKEYS, ...parsed });
            } catch (e) {
              console.warn("Error parsing local cached hotkeys:", e);
            }
          }
        }
      };
      loadHotkeys();
    } else if (steamSessionUser) {
      const saved = localStorage.getItem(`novablast_hotkeys_${steamSessionUser.uid}`) || localStorage.getItem('pixel_punk_hotkeys');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setHotkeys({ ...DEFAULT_HOTKEYS, ...parsed });
        } catch (e) {
          console.warn("Error parsing local Steam hotkeys:", e);
        }
      }
    } else {
      const saved = localStorage.getItem('pixel_punk_hotkeys');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setHotkeys({ ...DEFAULT_HOTKEYS, ...parsed });
        } catch (e) {
          console.warn("Error parsing local hotkeys:", e);
        }
      }
    }
  }, [user, steamSessionUser]);

  const saveHotkeys = async (newHotkeys: HotkeyConfig, forceLang?: Language) => {
    const activeLang = forceLang || language;
    setHotkeys(newHotkeys);
    
    // Always persist to local cache first
    try {
      if (activeUser) {
        localStorage.setItem(`novablast_hotkeys_${activeUser.uid}`, JSON.stringify(newHotkeys));
      } else {
        localStorage.setItem('pixel_punk_hotkeys', JSON.stringify(newHotkeys));
      }
    } catch (e) {}

    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'settings', 'hotkeys'), newHotkeys);
        toast.success(getTranslation(activeLang, 'savedSuccess'));
      } catch (error: any) {
        console.warn("Failed to sync hotkeys to Firestore:", error?.message || error);
        toast.success(getTranslation(activeLang, 'savedLocalSuccess'));
      }
    } else {
      toast.success(getTranslation(activeLang, 'savedLocalSuccess'));
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!projectStarted) return;
      if (isNeuroModalOpen || isSettingsOpen) return;
      
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        return;
      }
      
      let key = e.key.toLowerCase();
      // Layout-independent translation for letters/digits:
      if (e.code && e.code.startsWith('Key')) {
        key = e.code.slice(3).toLowerCase();
      } else if (e.code && e.code.startsWith('Digit')) {
        key = e.code.slice(5);
      }
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const alt = e.altKey;

      const matches = (hotkey: any) => {
        return hotkey.key === key && 
               !!hotkey.ctrl === ctrl && 
               !!hotkey.shift === shift && 
               !!hotkey.alt === alt;
      };

      // Special check: Space key for play/pause animation - intercepts space before any button focus can trigger clicks
      if (e.code === 'Space' || e.key === ' ' || (hotkeys.playAnimation && matches(hotkeys.playAnimation))) {
        e.preventDefault();
        // Blur active element if it's a button so pressing space never triggers button clicks
        if (activeElement && activeElement instanceof HTMLElement && activeElement !== document.body) {
          activeElement.blur();
        }
        if (projectType === 'animated') {
          setIsPlaying(prev => !prev);
        }
        return;
      }

      // Check Ctrl+C / Cmd+C for copying frame in animation mode
      if (ctrl && !shift && !alt && (key === 'c' || e.code === 'KeyC')) {
        if (projectType === 'animated') {
          e.preventDefault();
          handleCopyFrame(hoveredFrameIndex !== null ? hoveredFrameIndex : currentFrameIndex);
          return;
        }
      }

      // Check Ctrl+V / Cmd+V for pasting frame in animation mode
      if (ctrl && !shift && !alt && (key === 'v' || e.code === 'KeyV')) {
        if (projectType === 'animated') {
          e.preventDefault();
          handlePasteFrame();
          return;
        }
      }

      if (matches(hotkeys.undo)) { e.preventDefault(); handleUndo(); }
      else if (matches(hotkeys.redo)) { e.preventDefault(); handleRedo(); }
      else if (matches(hotkeys.pen)) setActiveTool(ToolType.PEN);
      else if (matches(hotkeys.eraser)) setActiveTool(ToolType.ERASER);
      else if (matches(hotkeys.line)) setActiveTool(ToolType.LINE);
      else if (matches(hotkeys.ruler)) setActiveTool(ToolType.RULER);
      else if (matches(hotkeys.mirror)) setActiveTool(ToolType.MIRROR);
      else if (matches(hotkeys.fill)) setActiveTool(ToolType.FILL);
      else if (matches(hotkeys.picker)) setActiveTool(ToolType.PICKER);
      else if (matches(hotkeys.gradient)) setActiveTool(ToolType.GRADIENT);
      else if (matches(hotkeys.toggleGrid)) setShowGrid(prev => !prev);
      else if (matches(hotkeys.brushResize)) {
        if (!isResizingBrush) {
          setIsResizingBrush(true);
          setInitialBrushSize(brushSize);
          setResizeStartX(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => { window.removeEventListener('keydown', handleKeyDown); };
  }, [history, projectStarted, brushSize, isResizingBrush, isNeuroModalOpen, isSettingsOpen, hotkeys, projectType, hoveredFrameIndex, clipboardFrame, frames, currentFrameIndex, language]);
  if (error) throw error;

  if (!isAuthReady) {
    return (
      <div className="fixed inset-0 bg-[#0f172a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-fuchsia-500 animate-spin" />
          <div className="font-pixel text-white text-xl animate-pulse">ЗАГРУЗКА СИСТЕМЫ...</div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Toaster position="top-center" richColors />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        hotkeys={hotkeys}
        onSaveHotkeys={saveHotkeys}
        language={language}
        onLanguageChange={handleLanguageChange}
        showGridDefault={showGridDefault}
        onShowGridDefaultChange={handleShowGridDefaultChange}
        ambientSupernova={ambientSupernova}
        onAmbientSupernovaChange={handleAmbientSupernovaChange}
      />
      <CommunityGalleryModal
        isOpen={isCommunityGalleryOpen}
        onClose={() => setIsCommunityGalleryOpen(false)}
        user={activeUser}
        savedProjects={savedProjects}
        currentActiveProject={currentActiveProject}
        language={language}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
      />
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setAuthModalProvider(null);
        }}
        onGoogleLogin={handleLogin}
        onGithubLogin={handleGithubLogin}
        onXLogin={handleXLogin}
        onSteamLogin={handleSteamLogin}
        onSteamChallengeVerify={handleSteamChallengeVerify}
        onSteamManualCallback={handleSteamManualCallback}
        onSteamQrComplete={handleSteamQrComplete}
        isLoggingIn={isLoggingIn}
        isSteamLoggingIn={isSteamLoggingIn}
        isGithubLoggingIn={isGithubLoggingIn}
        isXLoggingIn={isXLoggingIn}
        onCancelSteamLogin={handleCancelSteamLogin}
        onCancelGithubLogin={handleCancelGithubLogin}
        onCancelXLogin={handleCancelXLogin}
        language={language}
        initialProvider={authModalProvider}
      />
      {!projectStarted ? (
        surfaceMode === 'landing' && !isElectronDesktop ? (
          <WebLandingPage
            onEnterWebApp={enterWebApp}
            onStartPreset={handleStartProject}
            onOpenGallery={handleOpenGallery}
            user={activeUser}
            language={language}
            onChangeLanguage={handleChangeLandingLanguage}
          />
        ) : (
          <WelcomeScreen 
            onStart={handleStartProject} 
            onLogin={() => {
              setAuthModalProvider(null);
              setIsAuthModalOpen(true);
            }} 
            onSteamLogin={() => {
              setAuthModalProvider('steam');
              setIsAuthModalOpen(true);
            }}
            onGithubLogin={handleGithubLogin}
            onXLogin={handleXLogin}
            onLoadProjects={loadProjects}
            onOpenGallery={handleOpenGallery}
            user={activeUser}
            isLoggingIn={isLoggingIn}
            isSteamLoggingIn={isSteamLoggingIn}
            isGithubLoggingIn={isGithubLoggingIn}
            isXLoggingIn={isXLoggingIn}
            onCancelSteamLogin={handleCancelSteamLogin}
            onCancelGithubLogin={handleCancelGithubLogin}
            onCancelXLogin={handleCancelXLogin}
            onOpenSettings={() => setIsSettingsOpen(true)}
            language={language}
            ambientSupernova={ambientSupernova}
            onLogout={handleLogout}
            onBackToLanding={!isElectronDesktop ? backToLanding : undefined}
          />
        )
      ) : (
        <div className="h-screen max-h-screen w-screen max-w-full flex flex-col justify-between p-2 sm:p-3 relative overflow-hidden bg-slate-950 select-none">
          
          {isDownloading && <DownloadOverlay />}

          {isResizingBrush && (
          <div 
            className="fixed inset-0 z-[200] cursor-ew-resize flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onMouseMove={(e) => {
              if (resizeStartX === null) {
                setResizeStartX(e.clientX);
              } else {
                const delta = e.clientX - resizeStartX;
                const newSize = Math.max(1, Math.min(10, initialBrushSize + Math.floor(delta / 15)));
                setBrushSize(newSize);
              }
            }}
            onClick={() => {
              setIsResizingBrush(false);
              setResizeStartX(null);
            }}
          >
            <div className="bg-slate-900 p-8 rounded-2xl border border-white/10 shadow-2xl flex flex-col items-center pointer-events-none">
              <span className="text-slate-300 font-bold mb-6 uppercase tracking-wider text-sm">Размер кисти</span>
              <div className="text-7xl font-pixel text-fuchsia-400 mb-6 drop-shadow-[0_0_15px_rgba(192,38,211,0.5)]">{brushSize}</div>
              <div className="flex items-center justify-center h-16 w-16 mb-4 bg-slate-800 rounded-lg border border-slate-700">
                <div 
                  className="bg-white rounded-sm transition-all duration-75" 
                  style={{ width: Math.max(4, brushSize * 4), height: Math.max(4, brushSize * 4) }}
                />
              </div>
              <span className="text-slate-500 text-xs">Кликните для подтверждения</span>
            </div>
          </div>
        )}

        <NeuroSpriteModal
          isOpen={isNeuroModalOpen}
          onClose={() => setIsNeuroModalOpen(false)}
          currentGrid={history.present}
          width={canvasSize.width}
          height={canvasSize.height}
          onApply={(newGrid) => setGrid(newGrid)}
        />

        {/* Animation & Image Export Modal */}
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          frames={projectType === 'animated' ? (frames.map((f, i) => i === currentFrameIndex ? history.present : f)) : [history.present]}
          currentFrameIndex={currentFrameIndex}
          width={canvasSize.width}
          height={canvasSize.height}
          projectType={projectType}
          defaultFps={fps}
          projectName={currentProjectName}
          language={language}
        />

        {/* Clear Confirmation Modal */}
        {isClearModalOpen && (
          <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-[#0a0a0a] border-2 border-rose-600 rounded-xl p-8 max-w-sm w-full shadow-[0_0_50px_rgba(225,29,72,0.4)] relative overflow-hidden group">
                   {/* Danger Stripes */}
                   <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#e11d48_10px,#e11d48_20px)] pointer-events-none"></div>
                   
                   {/* Scanning line effect */}
                   <div className="absolute inset-0 bg-gradient-to-b from-transparent via-rose-900/20 to-transparent animate-scanline pointer-events-none"></div>

                   <div className="relative z-10 flex flex-col items-center text-center space-y-6">
                       <div className="relative">
                           <div className="absolute inset-0 bg-rose-500 blur-xl opacity-20 animate-pulse"></div>
                           <div className="w-20 h-20 bg-rose-950/50 rounded-full flex items-center justify-center border-2 border-rose-500 shadow-[0_0_15px_rgba(225,29,72,0.5)]">
                               <TriangleAlert className="w-10 h-10 text-rose-500 animate-[pulse_1s_ease-in-out_infinite]" />
                           </div>
                       </div>

                       <div className="space-y-2">
                           <h3 className="text-2xl font-bold text-white font-pixel text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-red-600 select-none">
                               ПРОТОКОЛ<br/>ОЧИСТКИ
                           </h3>
                           <p className="text-rose-200/60 font-mono text-xs leading-relaxed uppercase tracking-widest">
                               Внимание: Данная операция необратима. Текущий слой данных будет уничтожен.
                           </p>
                       </div>

                       <div className="grid grid-cols-2 gap-3 w-full pt-2">
                           <button
                              onClick={() => setIsClearModalOpen(false)}
                              className="py-3 px-4 bg-slate-900 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg font-bold font-mono text-sm transition-all uppercase focus:outline-none"
                           >
                              Отмена
                           </button>
                           <button
                              onClick={confirmClear}
                              className="py-3 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold font-mono text-sm shadow-[0_0_20px_rgba(225,29,72,0.4)] hover:shadow-[0_0_30px_rgba(225,29,72,0.6)] border border-rose-400 transition-all uppercase animate-pulse focus:outline-none"
                           >
                              Стереть
                           </button>
                       </div>
                   </div>
              </div>
          </div>
        )}

        {/* Header */}
        <header className="w-full flex-shrink-0 flex items-center justify-between mb-2 relative z-[100] bg-slate-900/70 backdrop-blur-md px-3 sm:px-4 py-2 rounded-2xl border border-white/10 shadow-lg">
          <div className="flex items-center gap-3">
            <SimpleNovaLogo>
              {projectStarted && (
                <div className="flex items-center gap-1.5 group/name mt-0.5">
                  <div className="relative flex items-center">
                    <input 
                      value={currentProjectName}
                      onChange={(e) => setCurrentProjectName(e.target.value)}
                      className="
                        bg-transparent text-xs font-mono 
                        text-slate-400 hover:text-white focus:text-fuchsia-400 
                        outline-none border-b border-transparent focus:border-fuchsia-500/50
                        px-1 py-0.5 w-28 sm:w-44 transition-all
                      "
                      placeholder="Название проекта..."
                    />
                    <Edit2 size={10} className="absolute -right-3 text-slate-600 group-hover/name:text-fuchsia-500 transition-colors pointer-events-none" />
                  </div>
                </div>
              )}
            </SimpleNovaLogo>
          </div>

          <div className="flex gap-2 sm:gap-2.5 items-center">
             {activeUser ? (
               <div className="flex items-center gap-2 bg-slate-800/60 p-1 pr-2.5 rounded-full border border-white/5">
                 {activeUser.photoURL ? (
                   <img src={activeUser.photoURL} alt={activeUser.displayName || ''} className="w-7 h-7 rounded-full border border-white/10" referrerPolicy="no-referrer" />
                 ) : (
                   <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center"><UserIcon size={14} /></div>
                 )}
                 <span className="text-xs font-mono text-slate-300 hidden sm:inline-flex items-center gap-1.5">
                   <span>{activeUser.displayName}</span>
                 </span>
                 <button onClick={handleLogout} className="ml-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"><LogOut size={13} /></button>
               </div>
             ) : (
               <button 
                 onClick={() => setIsAuthModalOpen(true)}
                 className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs transition-all cursor-pointer shadow-md shadow-indigo-600/30"
               >
                 <LogIn size={14} />
                 <span>{language === 'en' ? 'Log In' : 'Войти'}</span>
               </button>
             )}

             {activeUser && (
               <div className="flex gap-1.5">
                 <button
                   onClick={loadProjects}
                   className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-white/5 transition-all cursor-pointer"
                   title="Открыть проект"
                 >
                   <FolderOpen size={16} />
                 </button>
                 <button
                   onClick={saveProject}
                   disabled={isSaving}
                   className={`p-1.5 rounded-xl border transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer ${
                     saveSuccess 
                       ? 'bg-green-500/20 border-green-500/50 text-green-400' 
                       : 'bg-slate-800 hover:bg-slate-700 text-fuchsia-400 border-fuchsia-500/20'
                   }`}
                   title="Сохранить в облако"
                 >
                   {isSaving ? (
                     <Loader2 size={16} className="animate-spin" />
                   ) : saveSuccess ? (
                     <Save size={16} />
                   ) : (
                     <Cloud size={16} />
                   )}
                   {saveSuccess && <span className="text-[10px] font-bold uppercase hidden lg:inline">Сохранено!</span>}
                 </button>
               </div>
             )}

             <Button variant="secondary" onClick={handleExitProject} icon={<LogOut size={14} />} label="Меню" className="py-1 px-2.5 text-xs" />
             
             <button
               onClick={() => setIsNeuroModalOpen(true)}
               className="
                 relative group overflow-hidden
                 px-3 py-1.5 rounded-xl font-bold text-xs text-white
                 bg-slate-800 hover:bg-slate-700
                 border border-fuchsia-500/30 hover:border-fuchsia-500/80
                 shadow-[0_0_10px_rgba(192,38,211,0.2)]
                 hover:shadow-[0_0_20px_rgba(192,38,211,0.5)]
                 transition-all duration-300
                 flex items-center gap-1.5 cursor-pointer
               "
             >
               <Sparkles size={14} className="text-fuchsia-400 group-hover:animate-pulse" />
               <span className="hidden sm:inline">Нейро-спрайт</span>
             </button>

             {/* Divine Download Button */}
             <button 
               onClick={handleDownload}
               disabled={isDownloading}
               className="
                 relative group overflow-hidden
                 px-4 py-1.5 rounded-xl font-bold text-xs text-white
                 bg-gradient-to-r from-indigo-600 via-fuchsia-500 to-indigo-600
                 bg-[length:200%_auto] animate-[gradient_6s_ease-in-out_infinite]
                 shadow-[0_0_15px_rgba(192,38,211,0.4)]
                 border border-white/20
                 hover:shadow-[0_0_25px_rgba(192,38,211,0.7)]
                 hover:scale-105 active:scale-95
                 transition-all duration-300
                 cursor-pointer
                 focus:outline-none
               "
             >
               <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
               <span className="relative flex items-center gap-1.5 drop-shadow-md">
                 <Sparkles size={14} className="animate-pulse" />
                 Скачать
               </span>
             </button>
          </div>
        </header>

        {/* Main Workspace - Full flex row with zero scrolling */}
        <main className="flex-1 min-h-0 w-full flex flex-row items-stretch justify-between gap-2.5 sm:gap-3.5 relative overflow-hidden">
          
          {/* Left Column: Tools & Actions */}
          <div className="flex-shrink-0 flex flex-col gap-2 justify-start items-center overflow-y-auto max-h-full py-0.5 scrollbar-none">
            <Tools 
              activeTool={activeTool} 
              setTool={setActiveTool} 
              brushSize={brushSize} 
              setBrushSize={setBrushSize} 
              language={language}
            />
            
            <div className="bg-slate-900/90 border border-white/10 p-1.5 rounded-2xl shadow-xl flex flex-col gap-1 items-center">
              <Button variant="ghost" onClick={handleUndo} disabled={history.past.length === 0} title="Отменить (Ctrl+Z)" className="p-2 cursor-pointer">
                <Undo2 size={18} />
              </Button>
              <Button variant="ghost" onClick={handleRedo} disabled={history.future.length === 0} title="Повторить (Ctrl+Shift+Z)" className="p-2 cursor-pointer">
                <Redo2 size={18} />
              </Button>
              <div className="w-full h-[1px] bg-white/10 my-0.5" />
              <Button 
                variant="ghost" 
                onClick={() => setShowGrid(!showGrid)} 
                className={`p-2 cursor-pointer ${!showGrid ? "text-fuchsia-400 bg-fuchsia-400/10" : "text-slate-400"}`}
                title="Скрыть сетку (H)"
              >
                <Grid3X3 size={18} />
              </Button>
              <div className="w-full h-[1px] bg-white/10 my-0.5" />
              <Button variant="ghost" onClick={handleClear} className="p-2 text-rose-400 hover:text-rose-200 hover:bg-rose-900/20 cursor-pointer" title="Очистить">
                <Trash2 size={18} />
              </Button>
            </div>
          </div>

          {/* Center Column: Canvas Area (Expands to available space) */}
          <div className="flex-1 min-h-0 min-w-0 flex items-center justify-center relative overflow-hidden h-full">
            <Canvas 
              grid={history.present} 
              setGrid={setGrid} 
              activeTool={activeTool}
              activeColor={activeColor}
              setActiveColor={setActiveColor}
              width={canvasSize.width}
              height={canvasSize.height}
              brushSize={brushSize}
              gradientColors={gradientColors}
              showGrid={showGrid}
              language={language}
              onionSkinGrid={
                onionSkin && projectType === 'animated' && currentFrameIndex > 0
                  ? frames[currentFrameIndex - 1]
                  : null
              }
            />
          </div>

          {/* Right Column: Palette & Gradient tools */}
          <div className="flex-shrink-0 w-56 sm:w-60 flex flex-col gap-2.5 overflow-y-auto max-h-full py-0.5 pr-0.5 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            <Palette 
              activeColor={activeColor} 
              setColor={setActiveColor} 
              customColors={customColors}
              onAddCustomColor={handleAddCustomColor}
              onClearCustomColors={handleClearCustomColors}
              language={language}
            />
            
            {activeTool === ToolType.GRADIENT && (
              <div className="bg-slate-900/90 border border-white/10 p-3 rounded-2xl shadow-xl flex flex-col gap-2">
                <p className="font-bold text-slate-300 text-xs">Цвета градиента</p>
                <div className="flex flex-col gap-2.5">
                  {/* Gradient Preview Bar */}
                  <div 
                    className="h-5 rounded-md w-full border border-slate-600"
                    style={{ 
                      backgroundImage: gradientColors.includes('transparent') 
                        ? `linear-gradient(to right, ${gradientColors.map(c => c === 'transparent' ? 'rgba(0,0,0,0)' : c).join(', ')}), url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjNDc1NTY5Ii8+CjxyZWN0IHg9IjQiIHk9IjQiIHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiM0NzU1NjkiLz4KPHJlY3QgeD0iNCIgd2lkdGg9IjQiIGhlaWdodD0iNCIgZmlsbD0iIzMzNDE1NSIvPgo8cmVjdCB5PSI0IiB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMzM0MTU1Ii8+Cjwvc3ZnPg==')` 
                        : `linear-gradient(to right, ${gradientColors.map(c => c === 'transparent' ? 'rgba(0,0,0,0)' : c).join(', ')})`
                    }}
                  />
                  
                  {/* Color Stops */}
                  <div className="flex flex-wrap gap-2 items-start">
                    {gradientColors.map((color, idx) => (
                      <div key={idx} className="flex flex-col items-center gap-0.5">
                        <div className="relative group flex items-center">
                          <div className="w-7 h-7 rounded overflow-hidden border border-slate-600 relative bg-slate-800">
                             <input
                                type="color"
                                value={color === 'transparent' ? '#000000' : color}
                                onChange={(e) => {
                                  const newColors = [...gradientColors];
                                  newColors[idx] = e.target.value;
                                  setGradientColors(newColors);
                                }}
                                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                                disabled={color === 'transparent'}
                              />
                              <div 
                                className="w-full h-full"
                                style={{ backgroundColor: color === 'transparent' ? 'transparent' : color }}
                              />
                              {color === 'transparent' && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                  <div className="w-full h-[2px] bg-red-500 rotate-45"></div>
                                </div>
                              )}
                          </div>
                          {gradientColors.length > 2 && (
                            <button 
                              onClick={() => {
                                const newColors = [...gradientColors];
                                newColors.splice(idx, 1);
                                setGradientColors(newColors);
                              }}
                              className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center text-[9px] opacity-0 group-hover:opacity-100 z-10 cursor-pointer"
                              title="Удалить цвет"
                            >
                              ×
                            </button>
                          )}
                        </div>
                        <button 
                          onClick={() => {
                            const newColors = [...gradientColors];
                            newColors[idx] = color === 'transparent' ? '#ffffff' : 'transparent';
                            setGradientColors(newColors);
                          }}
                          className="text-[8px] uppercase tracking-wider text-slate-400 hover:text-white cursor-pointer"
                        >
                          {color === 'transparent' ? 'Цвет' : 'Прозр.'}
                        </button>
                      </div>
                    ))}
                    
                    {gradientColors.length < 5 && (
                      <button 
                        onClick={() => setGradientColors([...gradientColors, '#ffffff'])}
                        className="w-7 h-7 rounded border border-dashed border-slate-500 flex items-center justify-center text-slate-400 hover:text-white hover:border-white transition-colors cursor-pointer text-xs"
                        title="Добавить цвет"
                      >
                        +
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Frames Timeline for Animated Projects - Fixed at bottom without pushing page */}
        {projectType === 'animated' && (
          <div className="w-full flex-shrink-0 mt-2">
            <FramesTimeline
              frames={frames}
              currentFrameIndex={currentFrameIndex}
              onSelectFrame={handleSelectFrame}
              onAddFrame={handleAddFrame}
              onDuplicateFrame={handleDuplicateFrame}
              onDeleteFrame={handleDeleteFrame}
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              fps={fps}
              onChangeFps={setFps}
              onionSkin={onionSkin}
              onToggleOnionSkin={() => setOnionSkin(prev => !prev)}
              width={canvasSize.width}
              height={canvasSize.height}
              language={language}
              onHoverFrame={setHoveredFrameIndex}
              onExport={handleDownload}
            />
          </div>
        )}
      </div>
      )}

      {/* Projects Modal - Always accessible if open */}
      {isProjectsModalOpen && (
        <div className="fixed inset-0 z-[250] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FolderOpen className="text-fuchsia-400" />
                <h2 className="text-xl font-pixel text-white">СОХРАНЕННЫЕ ПРОЕКТЫ</h2>
              </div>
              <button onClick={() => setIsProjectsModalOpen(false)} className="text-slate-400 hover:text-white">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {error ? (
                <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
                  <TriangleAlert className="w-12 h-12 text-rose-500 animate-pulse" />
                  <div className="text-rose-400 font-pixel text-sm uppercase">Ошибка загрузки</div>
                  <p className="text-slate-500 font-mono text-[10px] max-w-xs">
                    {error.message.includes('index') 
                      ? "Требуется создание индекса в базе данных. Пожалуйста, проверьте консоль браузера (F12) для получения ссылки."
                      : error.message}
                  </p>
                  <button 
                    onClick={() => { setError(null); loadProjects(); }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold text-xs transition-all border border-white/5"
                  >
                    ПОВТОРИТЬ ПОПЫТКУ
                  </button>
                </div>
              ) : isProjectsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="w-8 h-8 text-fuchsia-500 animate-spin" />
                  <div className="text-slate-500 font-mono text-xs uppercase tracking-widest">Загрузка проектов...</div>
                </div>
              ) : savedProjects.length === 0 ? (
                <div className="py-20 text-center text-slate-500 font-mono text-sm">
                  НЕТ СОХРАНЕННЫХ ПРОЕКТОВ
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {savedProjects.map((project) => (
                    <div
                      key={project.id}
                      onClick={() => openProject(project)}
                      className="bg-slate-800/50 border border-white/5 p-4 rounded-xl hover:border-fuchsia-500/50 hover:bg-slate-800 transition-all text-left group relative cursor-pointer"
                    >
                      {confirmDeleteId === project.id ? (
                        <div className="flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
                          <div className="text-xs font-bold text-rose-400 uppercase">Удалить проект?</div>
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => handleDeleteProject(project.id!, e)}
                              disabled={isDeletingProject === project.id}
                              className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold rounded flex items-center justify-center gap-2"
                            >
                              {isDeletingProject === project.id ? <Loader2 size={10} className="animate-spin" /> : "ДА, УДАЛИТЬ"}
                            </button>
                            <button
                              onClick={cancelDelete}
                              className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] font-bold rounded"
                            >
                              ОТМЕНА
                            </button>
                          </div>
                        </div>
                      ) : renamingProjectId === project.id ? (
                        <form 
                          onSubmit={(e) => handleRenameProject(project.id!, e)}
                          className="flex flex-col gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            autoFocus
                            value={renamingName}
                            onChange={(e) => setRenamingName(e.target.value)}
                            className="bg-slate-900 border border-fuchsia-500 rounded px-2 py-1 text-white text-sm font-bold w-full outline-none"
                            onBlur={() => handleRenameProject(project.id!)}
                          />
                          <div className="text-[10px] text-slate-500 font-mono uppercase">Нажмите Enter для сохранения</div>
                        </form>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 mb-1 pr-16">
                            <span className="font-bold text-white group-hover:text-fuchsia-400 transition-colors truncate">{project.name}</span>
                            {project.projectType === 'animated' && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30 shrink-0">
                                <Film size={10} />
                                {project.frames?.length || 1} кадр.
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono uppercase">
                            {project.width}x{project.height} • {new Date(project.updatedAt.toDate()).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </div>
                          
                          <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => startRenaming(project, e)}
                              className="p-1.5 bg-slate-700 hover:bg-fuchsia-600 text-slate-300 hover:text-white rounded transition-colors"
                              title="Переименовать"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={(e) => requestDelete(project.id!, e)}
                              disabled={isDeletingProject === project.id}
                              className="p-1.5 bg-slate-700 hover:bg-rose-600 text-slate-300 hover:text-white rounded transition-colors disabled:opacity-50"
                              title="Удалить"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
};

export default App;