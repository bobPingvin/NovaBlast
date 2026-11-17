import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, X, Eye, EyeOff, ShieldCheck, Copy, Check, ExternalLink, QrCode, RefreshCw, AlertTriangle, ClipboardPaste } from 'lucide-react';
import { SteamIcon } from './SteamIcon';
import { GithubIcon } from './GithubIcon';
import { XIcon } from './XIcon';
import { Language, getTranslation } from '../src/l10n';
import { auth, db, doc, setDoc, getDocs, collection, query, where, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from '../src/lib/firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoogleLogin: () => void;
  onGithubLogin: () => void;
  onXLogin: () => void;
  onSteamLogin: () => void;
  onSteamChallengeVerify?: (steamId: string, challengeCode: string) => Promise<boolean>;
  onSteamManualCallback?: (url: string) => Promise<boolean>;
  onSteamQrComplete?: (data: any) => Promise<void> | void;
  isLoggingIn: boolean;
  isSteamLoggingIn?: boolean;
  isGithubLoggingIn?: boolean;
  isXLoggingIn?: boolean;
  onCancelSteamLogin?: () => void;
  onCancelGithubLogin?: () => void;
  onCancelXLogin?: () => void;
  language: Language;
  initialProvider?: 'steam' | null;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onGoogleLogin,
  onGithubLogin,
  onXLogin,
  onSteamLogin,
  onSteamChallengeVerify,
  onSteamManualCallback,
  onSteamQrComplete,
  isLoggingIn,
  isSteamLoggingIn = false,
  isGithubLoggingIn = false,
  isXLoggingIn = false,
  onCancelSteamLogin,
  onCancelGithubLogin,
  onCancelXLogin,
  language,
  initialProvider = null,
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isSteamMode, setIsSteamMode] = useState(false);
  const [steamMethod, setSteamMethod] = useState<'openid' | 'qr' | 'verify'>('openid');
  const [steamStep, setSteamStep] = useState<'search' | 'challenge'>('search');
  const [steamInput, setSteamInput] = useState('');
  const [isSteamSearching, setIsSteamSearching] = useState(false);
  const [isVerifyingChallenge, setIsVerifyingChallenge] = useState(false);
  const [isCodeCopied, setIsCodeCopied] = useState(false);
  const [steamChallengeCode, setSteamChallengeCode] = useState('');
  const [steamFoundProfile, setSteamFoundProfile] = useState<{
    steamId: string;
    personaName: string;
    avatarUrl: string;
    profileUrl: string;
  } | null>(null);
  const [steamLocalError, setSteamLocalError] = useState('');

  // 403 Google Error Recovery URL State
  const [steamManualUrl, setSteamManualUrl] = useState('');
  const [isSteamManualSubmitting, setIsSteamManualSubmitting] = useState(false);
  const [steamManualError, setSteamManualError] = useState('');

  // Official Steam Mobile QR Code Session State
  const [steamQrData, setSteamQrData] = useState<{
    clientId: string;
    requestId: string;
    challengeUrl: string;
    qrImageUrl: string;
  } | null>(null);
  const [isSteamQrLoading, setIsSteamQrLoading] = useState(false);
  const [steamQrError, setSteamQrError] = useState('');
  const steamQrPollTimerRef = useRef<number | null>(null);

  const stopSteamQrPolling = useCallback(() => {
    if (steamQrPollTimerRef.current !== null) {
      window.clearInterval(steamQrPollTimerRef.current);
      steamQrPollTimerRef.current = null;
    }
  }, []);

  const startSteamQrSession = useCallback(async () => {
    stopSteamQrPolling();
    setIsSteamQrLoading(true);
    setSteamQrError('');
    setSteamQrData(null);

    try {
      const resp = await fetch('/api/auth/steam/qr/begin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await resp.json();
      if (!resp.ok || !data.success || !data.clientId || !data.requestId) {
        throw new Error(data.error || (language === 'en' ? 'Failed to generate Steam QR code' : 'Не удалось сгенерировать QR-код Steam'));
      }

      setSteamQrData({
        clientId: data.clientId,
        requestId: data.requestId,
        challengeUrl: data.challengeUrl,
        qrImageUrl: data.qrImageUrl,
      });

      // Poll Steam QR Auth Status
      const clientId = data.clientId;
      const requestId = data.requestId;
      const pollInterval = Math.max(3000, (data.interval || 4) * 1000);

      steamQrPollTimerRef.current = window.setInterval(async () => {
        try {
          const pollResp = await fetch('/api/auth/steam/qr/poll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId, requestId }),
          });
          if (!pollResp.ok) return;
          const pollData = await pollResp.json();

          if (pollData.authenticated && pollData.steamProfile) {
            stopSteamQrPolling();
            if (onSteamQrComplete) {
              await onSteamQrComplete(pollData);
              onClose();
            } else {
              window.location.reload();
            }
          }
        } catch {
          // Ignore transient poll errors
        }
      }, pollInterval);
    } catch (err: any) {
      setSteamQrError(err.message || (language === 'en' ? 'Failed to start Steam QR' : 'Ошибка запуска QR Steam'));
    } finally {
      setIsSteamQrLoading(false);
    }
  }, [language, onClose, onSteamQrComplete, stopSteamQrPolling]);

  useEffect(() => {
    if (isOpen && isSteamMode && steamMethod === 'qr' && !steamQrData && !isSteamQrLoading) {
      startSteamQrSession();
    }
    if (!isOpen || !isSteamMode || steamMethod !== 'qr') {
      stopSteamQrPolling();
    }
  }, [isOpen, isSteamMode, steamMethod, steamQrData, isSteamQrLoading, startSteamQrSession, stopSteamQrPolling]);

  React.useEffect(() => {
    if (isOpen) {
      if (initialProvider === 'steam') {
        setIsSteamMode(true);
        setSteamMethod('openid');
      }
    } else {
      setIsSteamMode(false);
      setSteamMethod('openid');
      setSteamStep('search');
      setSteamInput('');
      setSteamLocalError('');
      setSteamFoundProfile(null);
      setSteamChallengeCode('');
      setIsCodeCopied(false);
    }
  }, [isOpen, initialProvider]);
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length > 5) score += 20;
    if (pass.length > 8) score += 20;
    if (/[A-Z]/.test(pass)) score += 20;
    if (/[0-9]/.test(pass)) score += 20;
    if (/[^A-Za-z0-9]/.test(pass)) score += 20;
    return score;
  };

  const strength = getPasswordStrength(password);
  let strengthColor = 'bg-rose-500';
  if (strength > 40) strengthColor = 'bg-amber-400';
  if (strength > 70) strengthColor = 'bg-emerald-500';

  const handleRequestChallenge = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!steamInput.trim()) return;
    setSteamLocalError('');
    setIsSteamSearching(true);
    try {
      const res = await fetch('/api/auth/steam/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: steamInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.profile || !data.challengeCode) {
        throw new Error(data.error || (language === 'en' ? 'Steam profile not found' : 'Профиль Steam не найден или скрыт настройками приватности'));
      }
      setSteamFoundProfile(data.profile);
      setSteamChallengeCode(data.challengeCode);
      setSteamStep('challenge');
    } catch (err: any) {
      setSteamLocalError(err.message || (language === 'en' ? 'Failed to find profile' : 'Не удалось найти профиль Steam'));
    } finally {
      setIsSteamSearching(false);
    }
  };

  const handleVerifyChallenge = async () => {
    if (!steamFoundProfile || !steamChallengeCode) return;
    setSteamLocalError('');
    setIsVerifyingChallenge(true);
    try {
      if (onSteamChallengeVerify) {
        await onSteamChallengeVerify(steamFoundProfile.steamId, steamChallengeCode);
        handleClose();
      }
    } catch (err: any) {
      setSteamLocalError(err.message || (language === 'en' ? 'Verification failed' : 'Не удалось подтвердить владение'));
    } finally {
      setIsVerifyingChallenge(false);
    }
  };

  const handleCopyCode = async () => {
    if (!steamChallengeCode) return;
    try {
      await navigator.clipboard.writeText(steamChallengeCode);
      setIsCodeCopied(true);
      setTimeout(() => setIsCodeCopied(false), 2200);
    } catch {
      // Fallback
    }
  };

  const handlePasteClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setSteamManualUrl(text.trim());
          setSteamManualError('');
        }
      }
    } catch {}
  };

  const handleSteamManualSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = steamManualUrl.trim();
    if (!trimmed) {
      setSteamManualError(language === 'en' ? 'Please paste the URL from the 403 window' : 'Пожалуйста, вставьте ссылку из окна с ошибкой 403');
      return;
    }
    setSteamManualError('');
    setIsSteamManualSubmitting(true);
    try {
      if (onSteamManualCallback) {
        await onSteamManualCallback(trimmed);
      } else {
        const resp = await fetch('/api/auth/steam/manual-callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: trimmed }),
        });
        const data = await resp.json();
        if (!resp.ok || !data.authenticated || !data.steamProfile) {
          throw new Error(data.error || (language === 'en' ? 'Steam OpenID validation failed' : 'Не удалось проверить ответ Steam'));
        }
        if (onSteamQrComplete) {
          await onSteamQrComplete(data);
        } else {
          window.location.reload();
        }
      }
      handleClose();
    } catch (err: any) {
      setSteamManualError(err.message || (language === 'en' ? 'Validation failed' : 'Ошибка проверки'));
    } finally {
      setIsSteamManualSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
    setAuthError('');
    setAuthSuccess('');
    setIsSteamMode(false);
    setSteamMethod('openid');
    setSteamStep('search');
    setSteamLocalError('');
    setSteamFoundProfile(null);
    setSteamChallengeCode('');
    setIsCodeCopied(false);
    setSteamManualUrl('');
    setSteamManualError('');
    stopSteamQrPolling();
    if (isSteamLoggingIn && onCancelSteamLogin) onCancelSteamLogin();
    if (isGithubLoggingIn && onCancelGithubLogin) onCancelGithubLogin();
    if (isXLoggingIn && onCancelXLogin) onCancelXLogin();
  };

  const handleResetPassword = async () => {
    if (!email) {
      setAuthError(language === 'en' ? 'Please enter your email to reset password' : 'Пожалуйста, введите почту для сброса пароля');
      return;
    }
    setIsEmailLoading(true);
    setAuthError('');
    setAuthSuccess('');
    try {
      await sendPasswordResetEmail(auth, email);
      setAuthSuccess(language === 'en' ? 'Password reset email sent' : 'Письмо для сброса пароля отправлено');
    } catch (err: any) {
      console.error("Reset error:", err);
      let errorMsg = err.message;
      if (err.code === 'auth/invalid-email') errorMsg = language === 'en' ? 'Invalid email format' : 'Неверный формат почты';
      if (err.code === 'auth/user-not-found') errorMsg = language === 'en' ? 'User not found' : 'Пользователь не найден';
      setAuthError(errorMsg);
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    
    if (authMode === 'register') {
      if (!nickname.trim()) {
        setAuthError(language === 'en' ? 'Nickname required' : 'Ник обязателен');
        return;
      }
      if (password !== repeatPassword) {
        setAuthError(language === 'en' ? 'Passwords do not match' : 'Пароли не совпадают');
        return;
      }
    }
    
    if (password.length < 6) {
      setAuthError(language === 'en' ? 'Password must be at least 6 characters' : 'Пароль должен быть не менее 6 символов');
      return;
    }

    setIsEmailLoading(true);
    try {
      if (authMode === 'login') {
        let loginEmail = email;
        if (!email.includes('@')) {
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('nickname', '==', email));
          let querySnapshot;
          try {
            querySnapshot = await getDocs(q);
          } catch (e: any) {
            throw new Error("Firestore query error on login nickname: " + e.message);
          }
          if (querySnapshot.empty) {
            throw { code: 'auth/user-not-found' };
          }
          loginEmail = querySnapshot.docs[0].data().email;
        }
        await signInWithEmailAndPassword(auth, loginEmail, password);
      } else {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('nickname', '==', nickname.trim()));
        let querySnapshot;
        try {
          querySnapshot = await getDocs(q);
        } catch (e: any) {
          throw new Error("Firestore query error on users collection: " + e.message);
        }
        if (!querySnapshot.empty) {
            setAuthError(language === 'en' ? 'Nickname already taken' : 'Ник уже занят');
            setIsEmailLoading(false);
            return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, {
          displayName: nickname.trim()
        });
        
        try {
          await setDoc(doc(db, 'users', userCredential.user.uid), {
            uid: userCredential.user.uid,
            email: email,
            nickname: nickname.trim(),
            createdAt: new Date().toISOString()
          });
        } catch (e: any) {
          throw new Error("Firestore setDoc error on user creation: " + e.message);
        }
      }
      onClose();
      setEmail('');
      setNickname('');
      setPassword('');
      setRepeatPassword('');
    } catch (err: any) {
      console.error("Auth error:", err);
      let errorMsg = err.message;
      if (err.code === 'auth/invalid-email') errorMsg = language === 'en' ? 'Invalid email format' : 'Неверный формат почты';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') errorMsg = language === 'en' ? 'Invalid email or password' : 'Неверная почта/ник или пароль';
      if (err.code === 'auth/email-already-in-use') errorMsg = language === 'en' ? 'Email already in use' : 'Почта уже используется';
      if (err.code === 'auth/operation-not-allowed') errorMsg = language === 'en' ? 'Email/Password sign-in is disabled in Firebase Console' : 'Вход по email/паролю отключен в консоли Firebase';
      setAuthError(errorMsg);
    } finally {
      setIsEmailLoading(false);
    }
  };

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
      className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div className="bg-[#0a0a0a] border-2 border-indigo-600 rounded-xl p-8 max-w-md w-full shadow-[0_0_50px_rgba(79,70,229,0.4)] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,rgba(79,70,229,0.3),transparent)] pointer-events-none"></div>

        <button 
          onClick={handleClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors cursor-pointer z-20"
        >
          <X size={20} />
        </button>

        <div className="relative z-10 flex flex-col items-center space-y-5">
          <h3 className="text-2xl font-bold text-white font-pixel">
            {authMode === 'login' 
              ? (language === 'en' ? 'LOG IN' : 'ВХОД') 
              : (language === 'en' ? 'REGISTER' : 'РЕГИСТРАЦИЯ')}
          </h3>

          <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={onGoogleLogin}
              disabled={isLoggingIn || isSteamLoggingIn || isGithubLoggingIn || isXLoggingIn}
              className="py-2.5 px-2 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Google"
            >
              {isLoggingIn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>}
              <span>Google</span>
            </button>
            <button
              type="button"
              onClick={onGithubLogin}
              disabled={isLoggingIn || isSteamLoggingIn || isXLoggingIn}
              className="py-2.5 px-2 bg-[#24292e] hover:bg-[#2f363d] text-slate-100 hover:text-white border border-slate-600/50 hover:border-slate-400 rounded-lg font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title={isGithubLoggingIn ? (language === 'en' ? 'Click to cancel GitHub sign-in' : 'Нажмите для отмены входа через GitHub') : 'GitHub'}
            >
              {isGithubLoggingIn ? <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" /> : <GithubIcon className="w-3.5 h-3.5" />}
              <span>{isGithubLoggingIn ? (language === 'en' ? 'Cancel' : 'Отмена') : 'GitHub'}</span>
            </button>
            <button
              type="button"
              onClick={onXLogin}
              disabled={isLoggingIn || isSteamLoggingIn || isGithubLoggingIn}
              className="py-2.5 px-2 bg-black hover:bg-slate-900 text-slate-100 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title={isXLoggingIn ? (language === 'en' ? 'Click to cancel X sign-in' : 'Нажмите для отмены входа через X') : 'X'}
            >
              {isXLoggingIn ? <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" /> : <XIcon className="w-3.5 h-3.5" />}
              <span>{isXLoggingIn ? (language === 'en' ? 'Cancel' : 'Отмена') : 'X'}</span>
            </button>
            <button
              type="button"
              onClick={onSteamLogin}
              disabled={isLoggingIn || isGithubLoggingIn || isXLoggingIn}
              className="py-2.5 px-2 bg-[#171a21] hover:bg-[#1b2838] text-[#66c0f4] hover:text-white border border-[#66c0f4]/40 hover:border-[#66c0f4]/80 rounded-lg font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title={isSteamLoggingIn ? (language === 'en' ? 'Click to cancel Steam sign-in' : 'Нажмите для отмены входа через Steam') : 'Steam'}
            >
              {isSteamLoggingIn ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" /> : <SteamIcon className="w-3.5 h-3.5" />}
              <span>{isSteamLoggingIn ? (language === 'en' ? 'Cancel' : 'Отмена') : 'Steam'}</span>
            </button>
          </div>

          {/* Steam Authentication Panel */}
          {isSteamMode && (
            <div className="w-full bg-[#0d141e] border-2 border-[#66c0f4]/50 rounded-xl p-4 flex flex-col gap-3 shadow-[0_0_30px_rgba(102,192,244,0.15)] animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2 text-[#66c0f4]">
                  <SteamIcon className="w-4 h-4" />
                  <span className="font-bold text-xs font-mono uppercase tracking-wider">
                    {language === 'en' ? 'Steam Authentication' : 'Авторизация Steam'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSteamMode(false)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer text-sm p-1"
                >
                  ✕
                </button>
              </div>

              {/* Method Switcher Tabs */}
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950/80 rounded-lg border border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setSteamMethod('openid')}
                  className={`py-1.5 px-1.5 rounded-md font-mono text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    steamMethod === 'openid'
                      ? 'bg-[#1b2838] text-[#66c0f4] shadow-sm border border-[#66c0f4]/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <SteamIcon className="w-3 h-3" />
                  <span>{language === 'en' ? 'OpenID Web' : 'OpenID Веб'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSteamMethod('qr');
                    if (!steamQrData) startSteamQrSession();
                  }}
                  className={`py-1.5 px-1.5 rounded-md font-mono text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    steamMethod === 'qr'
                      ? 'bg-[#1b2838] text-[#66c0f4] shadow-sm border border-[#66c0f4]/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <QrCode size={12} className="text-sky-400" />
                  <span>{language === 'en' ? 'Steam QR' : 'Steam QR'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSteamMethod('verify')}
                  className={`py-1.5 px-1.5 rounded-md font-mono text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    steamMethod === 'verify'
                      ? 'bg-[#1b2838] text-[#66c0f4] shadow-sm border border-[#66c0f4]/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ShieldCheck size={12} className="text-emerald-400" />
                  <span>{language === 'en' ? 'Bio Code' : 'Код в профиле'}</span>
                </button>
              </div>

              {/* Method 2: Official Steam Mobile QR Code Sign-In */}
              {steamMethod === 'qr' && (
                <div className="flex flex-col items-center gap-3 p-3 bg-slate-950/90 border border-sky-500/30 rounded-xl">
                  <div className="flex items-center justify-between w-full font-mono text-[11px] text-sky-300 font-bold border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-1.5">
                      <QrCode size={14} className="text-sky-400" />
                      <span>{language === 'en' ? 'Scan with Steam Mobile App' : 'Сканируйте в приложении Steam'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={startSteamQrSession}
                      disabled={isSteamQrLoading}
                      className="p-1 hover:text-white transition-colors cursor-pointer"
                      title={language === 'en' ? 'Refresh QR Code' : 'Обновить QR-код'}
                    >
                      <RefreshCw size={13} className={isSteamQrLoading ? 'animate-spin' : ''} />
                    </button>
                  </div>

                  {isSteamQrLoading ? (
                    <div className="py-8 flex flex-col items-center gap-2 text-slate-400 font-mono text-xs">
                      <Loader2 size={24} className="animate-spin text-[#66c0f4]" />
                      <span>{language === 'en' ? 'Generating Steam QR Code...' : 'Генерация QR-кода Steam...'}</span>
                    </div>
                  ) : steamQrError ? (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 font-mono text-xs text-center flex flex-col gap-2">
                      <span>{steamQrError}</span>
                      <button
                        type="button"
                        onClick={startSteamQrSession}
                        className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded font-bold text-xs self-center"
                      >
                        {language === 'en' ? 'Try Again' : 'Попробовать снова'}
                      </button>
                    </div>
                  ) : steamQrData ? (
                    <div className="flex flex-col items-center gap-2.5">
                      <div className="p-2 bg-white rounded-xl shadow-lg border border-sky-400/40">
                        <img
                          src={steamQrData.qrImageUrl}
                          alt="Steam Auth QR"
                          className="w-48 h-48 rounded"
                        />
                      </div>
                      <div className="text-[11px] text-slate-300 font-mono text-center leading-relaxed">
                        {language === 'en'
                          ? '1. Open Steam App on your phone -> Guard -> Scan QR Code.'
                          : '1. Откройте приложение Steam на телефоне -> Guard -> Сканировать QR-код.'}
                      </div>
                      <a
                        href={steamQrData.challengeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-[#66c0f4] hover:underline font-mono inline-flex items-center gap-1"
                      >
                        <span>{language === 'en' ? 'Or click here to approve in browser ↗' : 'Или нажмите здесь для подтверждения в браузере ↗'}</span>
                        <ExternalLink size={10} />
                      </a>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Method 1: Cryptographic Proof of Account Ownership via Profile Challenge */}
              {steamMethod === 'verify' && (
                <div className="flex flex-col gap-3">
                  {steamStep === 'search' ? (
                    <form onSubmit={handleRequestChallenge} className="flex flex-col gap-2.5">
                      <div className="flex items-start gap-2 p-2 bg-emerald-950/30 border border-emerald-500/30 rounded-lg text-emerald-300 text-[11px] font-mono leading-relaxed">
                        <ShieldCheck size={16} className="shrink-0 mt-0.5 text-emerald-400" />
                        <span>
                          {language === 'en'
                            ? '100% Account Protection: Verifies ownership through a secret one-time code on your Steam profile. No one can spoof your account.'
                            : '100% Защита: Подтверждение владения через секретный проверочный код в профиле Steam. Никто не сможет войти под чужим именем.'}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-300 font-mono">
                          {language === 'en'
                            ? 'Enter your Steam username, custom URL, or profile link:'
                            : 'Введите ваш ник Steam, ссылку на профиль или SteamID:'}
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={steamInput}
                            onChange={(e) => {
                              setSteamInput(e.target.value);
                              setSteamLocalError('');
                            }}
                            placeholder="bobpingvin или https://steamcommunity.com/id/..."
                            className="flex-1 bg-slate-950 border border-slate-700 focus:border-[#66c0f4] rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none transition-colors"
                            autoFocus
                          />
                          <button
                            type="submit"
                            disabled={isSteamSearching || !steamInput.trim()}
                            className="px-3.5 py-2 bg-[#1b2838] hover:bg-[#2a475e] text-[#66c0f4] hover:text-white border border-[#66c0f4]/50 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-sm"
                          >
                            {isSteamSearching ? (
                              <Loader2 size={13} className="animate-spin text-[#66c0f4]" />
                            ) : (
                              <ShieldCheck size={13} />
                            )}
                            <span>{language === 'en' ? 'Find & Verify' : 'Найти профиль'}</span>
                          </button>
                        </div>
                      </div>

                      {steamLocalError && (
                        <div className="text-rose-400 text-xs font-mono bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg leading-relaxed">
                          {steamLocalError}
                        </div>
                      )}
                    </form>
                  ) : (
                    steamFoundProfile && (
                      <div className="flex flex-col gap-3">
                        {/* Profile Info Header */}
                        <div className="flex items-center justify-between p-2.5 bg-slate-950/90 border border-emerald-500/40 rounded-xl">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={steamFoundProfile.avatarUrl}
                              alt=""
                              className="w-10 h-10 rounded-full border border-emerald-500/60 object-cover shadow-sm"
                            />
                            <div>
                              <div className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                                <span>{steamFoundProfile.personaName}</span>
                                <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-normal">
                                  {language === 'en' ? 'Target' : 'Целевой аккаунт'}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                ID: {steamFoundProfile.steamId}
                              </div>
                            </div>
                          </div>
                          <a
                            href={steamFoundProfile.profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-[#66c0f4] hover:underline inline-flex items-center gap-1 font-mono"
                          >
                            <span>Steam</span>
                            <ExternalLink size={11} />
                          </a>
                        </div>

                        {/* Step-by-Step Challenge Verification Instructions */}
                        <div className="p-3 bg-slate-950/80 border border-indigo-500/30 rounded-xl flex flex-col gap-2.5 font-mono text-[11px]">
                          <div className="text-slate-200 font-bold flex items-center gap-1.5 text-xs text-indigo-300">
                            <ShieldCheck size={14} className="text-emerald-400" />
                            <span>{language === 'en' ? 'Confirm you own this Steam account' : 'Подтвердите владение этим аккаунтом'}</span>
                          </div>

                          <div className="space-y-2 text-slate-300 leading-relaxed">
                            <p>
                              1. {language === 'en' ? 'Copy your unique one-time verification code:' : 'Скопируйте ваш проверочный секретный код:'}
                            </p>
                            
                            <div className="flex items-center gap-2 p-2 bg-[#101726] border border-[#66c0f4]/40 rounded-lg justify-between">
                              <span className="font-mono font-bold text-sm text-[#66c0f4] tracking-wider selection:bg-[#66c0f4] selection:text-black">
                                {steamChallengeCode}
                              </span>
                              <button
                                type="button"
                                onClick={handleCopyCode}
                                className="px-2.5 py-1 bg-[#1b2838] hover:bg-[#2a475e] text-white border border-[#66c0f4]/50 rounded font-bold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer"
                              >
                                {isCodeCopied ? (
                                  <>
                                    <Check size={12} className="text-emerald-400" />
                                    <span className="text-emerald-400">{language === 'en' ? 'Copied!' : 'Скопировано!'}</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy size={12} />
                                    <span>{language === 'en' ? 'Copy Code' : 'Скопировать'}</span>
                                  </>
                                )}
                              </button>
                            </div>

                            <p>
                              2. {language === 'en'
                                ? 'Paste the code into your Steam profile "Summary" (Bio) or "Real Name" field:'
                                : 'Вставьте код в поле «О себе» (Summary) или «Настоящее имя» (Real Name) в настройках Steam:'}
                            </p>

                            <a
                              href="https://steamcommunity.com/my/edit/info"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-[#66c0f4] border border-slate-700 hover:border-[#66c0f4]/60 rounded-lg text-xs font-bold transition-all"
                            >
                              <ExternalLink size={12} />
                              <span>{language === 'en' ? 'Open Steam Profile Settings ↗' : 'Открыть настройки профиля Steam ↗'}</span>
                            </a>

                            <p>
                              3. {language === 'en'
                                ? 'Save changes in Steam and click below:'
                                : 'Сохраните профиль в Steam и нажмите кнопку:'}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={handleVerifyChallenge}
                            disabled={isVerifyingChallenge}
                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold font-mono text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer disabled:opacity-50 mt-1"
                          >
                            {isVerifyingChallenge ? (
                              <Loader2 size={14} className="animate-spin text-white" />
                            ) : (
                              <ShieldCheck size={14} />
                            )}
                            <span>{language === 'en' ? 'Verify & Sign In' : 'Подтвердить владение и войти'}</span>
                          </button>

                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] text-slate-400">
                              {language === 'en'
                                ? '✓ You can remove the code from your Steam bio right after signing in.'
                                : '✓ Сразу после входа код можно стереть из профиля Steam.'}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setSteamStep('search');
                                setSteamLocalError('');
                              }}
                              className="text-[11px] text-slate-400 hover:text-slate-200 underline font-mono cursor-pointer shrink-0 ml-2"
                            >
                              {language === 'en' ? 'Change account' : 'Другой профиль'}
                            </button>
                          </div>
                        </div>

                        {steamLocalError && (
                          <div className="text-rose-400 text-xs font-mono bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg leading-relaxed">
                            {steamLocalError}
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Method 2: Official Steam OpenID Web Redirect */}
              {steamMethod === 'openid' && (
                <div className="flex flex-col gap-3 pt-1">
                  <p className="text-[11px] text-slate-300 font-mono leading-relaxed">
                    {language === 'en'
                      ? 'Sign in via the official Steam Community website (OpenID 2.0):'
                      : 'Вход через официальный сайт Steam Community:'}
                  </p>

                  <button
                    type="button"
                    onClick={onSteamLogin}
                    disabled={isSteamLoggingIn}
                    className="w-full py-2.5 bg-[#171a21] hover:bg-[#1b2838] text-[#66c0f4] hover:text-white border border-[#66c0f4]/50 rounded-lg font-mono font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-md"
                  >
                    {isSteamLoggingIn ? (
                      <Loader2 size={14} className="animate-spin text-[#66c0f4]" />
                    ) : (
                      <SteamIcon className="w-4 h-4" />
                    )}
                    <span>
                      {isSteamLoggingIn
                        ? (language === 'en' ? 'Waiting for Steam window...' : 'Ожидание авторизации в окне...')
                        : (language === 'en' ? 'Open Steam Sign-In Page ↗' : 'Открыть страницу входа Steam ↗')}
                    </span>
                  </button>

                  {/* 403 Google Error Resolution Bridge */}
                  <div className="p-3 bg-slate-950/95 border border-sky-500/40 rounded-xl flex flex-col gap-2.5 shadow-inner">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-amber-300">
                        <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                        <span>
                          {language === 'en'
                            ? 'Got Google 403 error in the popup window?'
                            : 'В окне входа появилась ошибка Google 403?'}
                        </span>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono">
                        Valve OpenID
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-300 font-mono leading-relaxed">
                      {language === 'en'
                        ? 'Google Cloud Run blocks external redirects, but the address bar of that 403 window already contains Valve’s cryptographic signature. Simply copy the full URL from the 403 window and paste it here:'
                        : 'Google Cloud Run блокирует обратные перенаправления, но в адресной строке окна 403 уже находится цифровая подпись Valve. Скопируйте ссылку из адресной строки окна 403 и вставьте её сюда:'}
                    </p>

                    <form onSubmit={handleSteamManualSubmit} className="flex flex-col gap-2">
                      <div className="flex gap-1.5">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={steamManualUrl}
                            onChange={(e) => {
                              setSteamManualUrl(e.target.value);
                              setSteamManualError('');
                            }}
                            placeholder="https://...openid.claimed_id=...&openid.sig=..."
                            className="w-full bg-slate-900 border border-slate-700 focus:border-[#66c0f4] rounded-lg px-2.5 py-2 text-white font-mono text-[11px] focus:outline-none pr-8 transition-colors"
                          />
                          <button
                            type="button"
                            onClick={handlePasteClipboard}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer p-0.5"
                            title={language === 'en' ? 'Paste from clipboard' : 'Вставить из буфера'}
                          >
                            <ClipboardPaste size={13} />
                          </button>
                        </div>
                        <button
                          type="submit"
                          disabled={isSteamManualSubmitting || !steamManualUrl.trim()}
                          className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold font-mono text-[11px] flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-md shadow-sky-900/30"
                        >
                          {isSteamManualSubmitting ? (
                            <Loader2 size={13} className="animate-spin text-white" />
                          ) : (
                            <Check size={13} />
                          )}
                          <span>{language === 'en' ? 'Verify & Sign In' : 'Завершить вход'}</span>
                        </button>
                      </div>

                      {steamManualError && (
                        <div className="text-rose-400 text-[10px] font-mono bg-rose-500/10 border border-rose-500/20 p-2 rounded leading-relaxed">
                          {steamManualError}
                        </div>
                      )}
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="w-full flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-[10px] font-mono uppercase text-slate-500">{getTranslation(language, 'orDivider')}</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          <form onSubmit={handleEmailSubmit} className="w-full space-y-4">
            {authMode === 'register' && (
              <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                <label className="text-xs text-slate-400 font-mono uppercase">{language === 'en' ? 'Nickname' : 'Ник'}</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-lg px-4 py-2 text-white font-mono text-sm focus:outline-none transition-colors"
                />
              </div>
            )}
            
            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-mono uppercase">{authMode === 'login' ? (language === 'en' ? 'Email or Nickname' : 'Почта или Ник') : 'Email'}</label>
              <input
                type={authMode === 'login' ? 'text' : 'email'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-lg px-4 py-2 text-white font-mono text-sm focus:outline-none transition-colors"
              />
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs text-slate-400 font-mono uppercase">{language === 'en' ? 'Password' : 'Пароль'}</label>
                {authMode === 'login' && (
                  <button type="button" onClick={handleResetPassword} className="text-xs text-indigo-400 hover:text-indigo-300 font-mono">
                    {language === 'en' ? 'Forgot password?' : 'Забыли пароль?'}
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-lg px-4 py-2 pr-10 text-white font-mono text-sm focus:outline-none transition-colors"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {authMode === 'register' && password.length > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${strengthColor}`}
                      style={{ width: `${Math.min(100, Math.max(10, strength))}%` }}
                    />
                  </div>
                  <span className={`text-[10px] font-mono uppercase ${strength > 70 ? 'text-emerald-400' : strength > 40 ? 'text-amber-400' : 'text-rose-400'}`}>
                    {strength > 70 ? (language === 'en' ? 'Strong' : 'Надежный') : strength > 40 ? (language === 'en' ? 'Good' : 'Средний') : (language === 'en' ? 'Weak' : 'Слабый')}
                  </span>
                </div>
              )}
            </div>
            
            {authMode === 'register' && (
              <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                <label className="text-xs text-slate-400 font-mono uppercase">{language === 'en' ? 'Repeat Password' : 'Повторите пароль'}</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={repeatPassword}
                    onChange={(e) => setRepeatPassword(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-lg px-4 py-2 pr-10 text-white font-mono text-sm focus:outline-none transition-colors"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {authError && (
              <div className="text-rose-400 text-xs font-mono text-center p-2 bg-rose-500/10 rounded border border-rose-500/20">
                {authError}
              </div>
            )}
            
            {authSuccess && (
              <div className="text-emerald-400 text-xs font-mono text-center p-2 bg-emerald-500/10 rounded border border-emerald-500/20">
                {authSuccess}
              </div>
            )}

            <button
              type="submit"
              disabled={isEmailLoading}
              className="w-full py-3 mt-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold font-mono text-sm shadow-[0_4px_0_rgb(55,48,163)] active:shadow-none active:translate-y-[4px] transition-all uppercase cursor-pointer disabled:opacity-50"
            >
              {isEmailLoading 
                ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> 
                : (authMode === 'login' ? (language === 'en' ? 'Proceed' : 'Продолжить') : (language === 'en' ? 'Create Account' : 'Создать'))}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setAuthMode(authMode === 'login' ? 'register' : 'login');
              setAuthError('');
              setAuthSuccess('');
            }}
            className="text-slate-400 hover:text-indigo-400 text-xs font-mono transition-colors"
          >
            {authMode === 'login' 
              ? (language === 'en' ? 'No account? Register here' : 'Нет аккаунта? Зарегистрироваться') 
              : (language === 'en' ? 'Already have an account? Log in' : 'Уже есть аккаунт? Войти')}
          </button>
        </div>
      </div>
    </div>
  );
};
