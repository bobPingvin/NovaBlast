import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  ExternalLink,
  Film,
  Globe,
  Grid3X3,
  Layers,
  Monitor,
  Palette,
  Sparkles,
  Terminal,
  Users,
  X,
} from 'lucide-react';
import { Language } from '../src/l10n';
import { ExtendedUser } from '../types';
import { ProjectConfig } from './WelcomeScreen';

import heroStudioImg from '../src/assets/images/hero_novablast_studio_1794794159544.jpg';
import showcaseAnimationImg from '../src/assets/images/showcase_animation_frames_1794794161021.jpg';
import showcaseCommunityImg from '../src/assets/images/showcase_community_art_1794794158997.jpg';

interface WebLandingPageProps {
  onEnterWebApp: () => void;
  onStartPreset: (config: ProjectConfig) => void;
  onOpenGallery: () => void;
  user: ExtendedUser | null;
  language: Language;
  onChangeLanguage: (lang: Language) => void;
}

const WINDOWS_DOWNLOAD_PATH = '/downloads/NovaBlast-Setup.exe';

const QUICK_PRESETS: Array<{
  id: string;
  labelRu: string;
  labelEn: string;
  meta: string;
  config: ProjectConfig;
}> = [
  {
    id: 'icon-16',
    labelRu: 'Иконка предмета',
    labelEn: 'Item Icon',
    meta: '16×16 · Статика',
    config: { name: 'Item Icon', width: 16, height: 16, bgColor: null, projectType: 'static', fps: 8 },
  },
  {
    id: 'hero-32',
    labelRu: 'Спрайт персонажа',
    labelEn: 'Character Sprite',
    meta: '32×32 · Статика',
    config: { name: 'Hero Sprite', width: 32, height: 32, bgColor: null, projectType: 'static', fps: 8 },
  },
  {
    id: 'scene-64',
    labelRu: 'Игровая сцена',
    labelEn: 'Game Scene',
    meta: '64×64 · Статика',
    config: { name: 'Pixel Scene', width: 64, height: 64, bgColor: '#0f172a', projectType: 'static', fps: 8 },
  },
  {
    id: 'anim-32',
    labelRu: 'Анимация спрайта',
    labelEn: 'Sprite Animation',
    meta: '32×32 · 8 FPS',
    config: { name: 'Animated Sprite', width: 32, height: 32, bgColor: null, projectType: 'animated', fps: 8 },
  },
];

export const WebLandingPage: React.FC<WebLandingPageProps> = ({
  onEnterWebApp,
  onStartPreset,
  onOpenGallery,
  user,
  language,
  onChangeLanguage,
}) => {
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [animImgFailed, setAnimImgFailed] = useState(false);
  const [galleryImgFailed, setGalleryImgFailed] = useState(false);

  const [isCheckingDownload, setIsCheckingDownload] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const configuredWinUrl = (import.meta.env.VITE_WINDOWS_DOWNLOAD_URL || '').trim();
  const isRu = language === 'ru';

  const triggerDirectDownload = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = 'NovaBlast-Setup.exe';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleWindowsDownload = async () => {
    if (configuredWinUrl) {
      triggerDirectDownload(configuredWinUrl);
      return;
    }

    setIsCheckingDownload(true);
    try {
      const resp = await fetch(WINDOWS_DOWNLOAD_PATH, { method: 'HEAD', cache: 'no-store' });
      const contentType = (resp.headers.get('content-type') || '').toLowerCase();
      if (resp.ok && !contentType.includes('text/html')) {
        triggerDirectDownload(WINDOWS_DOWNLOAD_PATH);
        return;
      }
    } catch {
      // Binary not bundled on static host; open Windows setup modal
    } finally {
      setIsCheckingDownload(false);
    }

    setIsDownloadModalOpen(true);
  };

  const handleCopyCommand = async () => {
    try {
      await navigator.clipboard.writeText('npm run build:electron');
      setCopiedCmd(true);
      window.setTimeout(() => setCopiedCmd(false), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <div id="top" className="min-h-screen bg-[#070b14] text-slate-100 selection:bg-fuchsia-500/30 selection:text-white">
      {/* Subtle Top Atmospheric Gradient */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-[560px] bg-[radial-gradient(ellipse_75%_55%_at_50%_-10%,rgba(99,102,241,0.18),rgba(192,38,211,0.08)_45%,transparent_80%)]"
      />

      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070b14]/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single clean text wordmark */}
          <a
            href="#top"
            className="font-pixel text-base sm:text-lg text-white tracking-tight whitespace-nowrap shrink-0 hover:text-fuchsia-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded"
          >
            NovaBlast
          </a>

          {/* Zone 2: Concise single-line text links */}
          <nav
            aria-label={isRu ? 'Навигация по сайту' : 'Site navigation'}
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300"
          >
            <a
              href="#capabilities"
              className="whitespace-nowrap shrink-0 hover:text-white underline-offset-4 hover:underline transition-colors"
            >
              {isRu ? 'Возможности' : 'Features'}
            </a>
            <a
              href="#presets"
              className="whitespace-nowrap shrink-0 hover:text-white underline-offset-4 hover:underline transition-colors"
            >
              {isRu ? 'Быстрый старт' : 'Quick Start'}
            </a>
            <a
              href="#platforms"
              className="whitespace-nowrap shrink-0 hover:text-white underline-offset-4 hover:underline transition-colors"
            >
              {isRu ? 'Платформы' : 'Platforms'}
            </a>
            <a
              href="#download"
              className="whitespace-nowrap shrink-0 hover:text-white underline-offset-4 hover:underline transition-colors"
            >
              {isRu ? 'Скачать' : 'Download'}
            </a>
          </nav>

          {/* Zone 3: Single primary action button */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={onEnterWebApp}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 shadow-[0_0_20px_rgba(79,70,229,0.28)]"
            >
              {user
                ? isRu
                  ? 'Открыть студию'
                  : 'Open Studio'
                : isRu
                  ? 'Открыть веб-версию'
                  : 'Open Web App'}
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* 1. HERO SECTION */}
        <section className="max-w-7xl mx-auto px-6 pt-12 pb-16 lg:pt-20 lg:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            {/* Hero Copy Column */}
            <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 tracking-wide">
                <span>{isRu ? 'Веб-студия в браузере' : 'Browser Web Studio'}</span>
                <span aria-hidden="true">·</span>
                <span>{isRu ? 'Приложение для Windows' : 'Windows Desktop App'}</span>
                <span aria-hidden="true">·</span>
                <span>{isRu ? 'Облако и Steam' : 'Cloud & Steam'}</span>
              </div>

              <h1
                className="font-pixel text-white leading-[1.3] text-balance"
                style={{ fontSize: 'clamp(1.75rem, 3.1vw, 2.75rem)' }}
              >
                {isRu ? (
                  <>
                    Пиксель-арт и анимация <span className="text-fuchsia-400">без границ</span>
                  </>
                ) : (
                  <>
                    Pixel art & animation <span className="text-fuchsia-400">studio</span>
                  </>
                )}
              </h1>

              <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-[60ch]">
                {isRu
                  ? 'Создавайте игровые спрайты, настраивайте 4-стороннюю симметрию, рисуйте покадровую анимацию до 60 FPS и экспортируйте в GIF или спрайт-листы. Запускайте прямо в браузере или скачайте десктопную версию для Windows.'
                  : 'Craft crisp game sprites, paint with 4-way live symmetry, animate frame by frame up to 60 FPS, and export to GIF or sprite sheets. Launch instantly in your browser or install the native Windows app.'}
              </p>

              {/* Primary + Secondary CTA Row */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-1">
                <button
                  type="button"
                  onClick={onEnterWebApp}
                  className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm sm:text-base rounded-xl transition-all duration-150 flex items-center justify-center gap-2.5 whitespace-nowrap shrink-0 cursor-pointer shadow-[0_4px_0_rgb(55,48,163)] active:shadow-none active:translate-y-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  <Globe className="w-4 h-4 shrink-0" />
                  <span>{isRu ? 'Открыть веб-версию' : 'Launch Web Version'}</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={handleWindowsDownload}
                  disabled={isCheckingDownload}
                  className="px-6 py-3.5 bg-[#0e1526] hover:bg-[#162038] text-slate-100 border border-white/15 hover:border-white/30 font-semibold text-sm sm:text-base rounded-xl transition-colors flex items-center justify-center gap-2.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  <Download className="w-4 h-4 shrink-0 text-fuchsia-400" />
                  <span>
                    {isCheckingDownload
                      ? isRu
                        ? 'Проверка файла...'
                        : 'Checking installer...'
                      : isRu
                        ? 'Скачать для Windows'
                        : 'Download for Windows'}
                  </span>
                </button>
              </div>

              {/* Clean unboxed spec notes */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-400 pt-1 tabular-nums">
                <span>Windows 10 / 11 (x64)</span>
                <span aria-hidden="true">·</span>
                <span>{isRu ? 'Браузеры Chrome, Edge, Firefox' : 'Chrome, Edge, Firefox'}</span>
                <span aria-hidden="true">·</span>
                <span>{isRu ? 'Экспорт PNG, GIF, ZIP' : 'Export PNG, GIF, ZIP'}</span>
              </div>
            </div>

            {/* Hero Showcase Visual Column */}
            <div className="lg:col-span-6 flex">
              <div className="w-full rounded-2xl overflow-hidden border border-white/10 bg-[#0d1322] flex flex-col">
                <div className="relative flex-1 min-h-[280px] sm:min-h-[360px] bg-[#0a0f1c]">
                  {!heroImgFailed ? (
                    <img
                      src={heroStudioImg}
                      alt={
                        isRu
                          ? 'Рабочее пространство пиксель-арта NovaBlast с космическим кораблём и сверхновой'
                          : 'NovaBlast cosmic pixel art workspace showcasing a starship sprite'
                      }
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImgFailed(true)}
                      className="w-full h-full lg:h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full min-h-[320px] flex flex-col items-center justify-center gap-3 p-8 bg-gradient-to-br from-indigo-950/80 via-[#0d1322] to-fuchsia-950/60 text-center">
                      <Grid3X3 className="w-12 h-12 text-fuchsia-400" />
                      <span className="font-pixel text-sm text-white">NovaBlast Studio</span>
                    </div>
                  )}
                </div>
                <div className="px-5 py-3.5 border-t border-white/10 bg-[#0b101d] flex items-center justify-between gap-4 text-xs text-slate-400">
                  <span className="truncate">
                    {isRu
                      ? 'Встроенная сетка, 4-сторонняя симметрия и живой превью анимации'
                      : 'Crisp pixel grid, 4-way mirror axes, and live animation playback'}
                  </span>
                  <button
                    type="button"
                    onClick={onOpenGallery}
                    className="text-fuchsia-300 hover:text-fuchsia-200 font-medium whitespace-nowrap shrink-0 cursor-pointer hover:underline underline-offset-4"
                  >
                    {isRu ? 'Галерея работ →' : 'Community Gallery →'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. CAPABILITIES ASYMMETRIC BENTO GRID */}
        <section id="capabilities" className="max-w-7xl mx-auto px-6 py-16 border-t border-white/10">
          <div className="max-w-2xl space-y-3 mb-10">
            <h2 className="font-pixel text-xl sm:text-2xl text-white leading-snug text-balance">
              {isRu ? 'Всё необходимое в одном окне' : 'Built for serious pixel craft'}
            </h2>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
              {isRu
                ? 'Каждый инструмент создан для точного контроля над пикселями: от быстрого скетча иконки до многокадрового спрайт-листа игры.'
                : 'Every tool is tuned for pixel-accurate workflows—from quick 16×16 icons to full multi-frame game character sheets.'}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Marquee Card 01 (col-span-2) */}
            <article className="lg:col-span-2 rounded-2xl border border-white/10 bg-[#0d1322] overflow-hidden grid grid-cols-1 md:grid-cols-12 items-stretch">
              <div className="md:col-span-6 p-6 sm:p-8 flex flex-col justify-between gap-6">
                <div className="space-y-3">
                  <h3 className="text-lg sm:text-xl font-semibold text-white">
                    {isRu ? '01. Точная графика и 4-сторонняя симметрия' : '01. Precision Tools & Quad Symmetry'}
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {isRu
                      ? 'Карандаш, ластик, заливка, пипетка, пиксельный градиент, линейка с измерением углов и расстояний, а также вертикальная, горизонтальная и 4-сторонняя ось симметрии с перетаскиванием прямо на холсте.'
                      : 'Pen, eraser, flood fill, eyedropper, pixel gradient, angle & bounds ruler, plus draggable vertical, horizontal, and 4-way mirror axes directly on canvas.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono tabular-nums pt-2 border-t border-white/10">
                  <span>{isRu ? 'Клавиши B · E · F · G · L · X' : 'Hotkeys B · E · F · G · L · X'}</span>
                  <span aria-hidden="true">/</span>
                  <span>{isRu ? 'Плавный зум и история шагов' : 'Smooth zoom & Undo history'}</span>
                </div>
              </div>
              <div className="md:col-span-6 min-h-[220px] bg-[#090e1a] border-t md:border-t-0 md:border-l border-white/10">
                {!animImgFailed ? (
                  <img
                    src={showcaseAnimationImg}
                    alt={
                      isRu
                        ? 'Покадровая анимация пиксельного рыцаря в NovaBlast'
                        : 'Frame-by-frame cyber-knight sprite animation grid in NovaBlast'
                    }
                    referrerPolicy="no-referrer"
                    onError={() => setAnimImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full min-h-[220px] flex items-center justify-center bg-slate-900 text-slate-400">
                    <Layers className="w-10 h-10 text-indigo-400" />
                  </div>
                )}
              </div>
            </article>

            {/* Card 02 (col-span-1) */}
            <article className="rounded-2xl border border-white/10 bg-[#0d1322] p-6 sm:p-8 flex flex-col justify-between gap-6">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
                  <Film className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-white">
                  {isRu ? '02. Анимация до 60 FPS и калька' : '02. Up to 60 FPS Animation & Onion Skin'}
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {isRu
                    ? 'Таймлайн кадров с дублированием, полупрозрачным наложением предыдущего кадра и мгновенным экспортом в зацикленный GIF, спрайт-лист PNG или ZIP.'
                    : 'Keyframe timeline with instant duplication, translucent onion-skin overlay, and crisp export to looped GIF, sprite sheets, or frame ZIP archives.'}
                </p>
              </div>
              <div className="text-xs text-slate-400 font-mono tabular-nums pt-2 border-t border-white/10">
                GIF · PNG Sheet · ZIP · 1–60 FPS
              </div>
            </article>

            {/* Card 03 (col-span-1) */}
            <article className="rounded-2xl border border-white/10 bg-[#0d1322] p-6 sm:p-8 flex flex-col justify-between gap-6">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-300">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-white">
                  {isRu ? '03. Нейро-спрайт ассистент' : '03. Neuro-Sprite Generator'}
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {isRu
                    ? 'Генерируйте заготовки спрайтов или дорабатывайте текущий рисунок по текстовому описанию прямо внутри пиксельной сетки вашего проекта.'
                    : 'Generate starter sprites or refine existing canvas pixels from a short prompt directly inside your active grid resolution.'}
                </p>
              </div>
              <div className="text-xs text-slate-400 font-mono pt-2 border-t border-white/10">
                {isRu ? 'Рекомендовано для сетки до 32×32' : 'Tuned for canvases up to 32×32'}
              </div>
            </article>

            {/* Card 04 (col-span-2) */}
            <article className="lg:col-span-2 rounded-2xl border border-white/10 bg-[#0d1322] overflow-hidden grid grid-cols-1 md:grid-cols-12 items-stretch">
              <div className="md:col-span-5 min-h-[220px] bg-[#090e1a] border-b md:border-b-0 md:border-r border-white/10 order-2 md:order-1">
                {!galleryImgFailed ? (
                  <img
                    src={showcaseCommunityImg}
                    alt={
                      isRu
                        ? 'Галерея работ пиксель-арта сообщества NovaBlast'
                        : 'NovaBlast community pixel art gallery showcase'
                    }
                    referrerPolicy="no-referrer"
                    onError={() => setGalleryImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full min-h-[220px] flex items-center justify-center bg-slate-900 text-slate-400">
                    <Users className="w-10 h-10 text-fuchsia-400" />
                  </div>
                )}
              </div>
              <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-between gap-6 order-1 md:order-2">
                <div className="space-y-3">
                  <h3 className="text-lg sm:text-xl font-semibold text-white">
                    {isRu
                      ? '04. Общие проекты в облаке, Steam и Галерея'
                      : '04. Cloud Save, Steam Sign-In & Gallery'}
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {isRu
                      ? 'Начните рисунок на домашнем ПК в Windows-приложении и продолжите на любом другом устройстве через браузер. Поддерживается вход через Google, Почту, GitHub, X и Steam (включая Steam QR), а также публикация артов в галерею сообщества.'
                      : 'Start artwork in your Windows Electron app and pick up seamlessly on any browser. Sign in with Google, Email, GitHub, X, or Steam (including Steam QR), and share creations to the community gallery.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
                  <span className="text-xs text-slate-400 font-mono">
                    Google · Steam QR · GitHub · X · Email
                  </span>
                  <button
                    type="button"
                    onClick={onOpenGallery}
                    className="text-xs font-semibold text-indigo-300 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isRu ? 'Смотреть галерею →' : 'Browse Gallery →'}
                  </button>
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* 3. INTERACTIVE QUICK-START PRESETS */}
        <section id="presets" className="max-w-7xl mx-auto px-6 py-16 border-t border-white/10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div className="space-y-2 max-w-2xl">
              <h2 className="font-pixel text-xl sm:text-2xl text-white leading-snug text-balance">
                {isRu ? 'Мгновенный старт в браузере' : 'Jump straight onto the canvas'}
              </h2>
              <p className="text-sm text-slate-400">
                {isRu
                  ? 'Выберите готовый формат холста — редактор откроется сразу без долгой регистрации.'
                  : 'Pick a canvas template below to launch the interactive web editor immediately.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onEnterWebApp}
              className="text-sm font-medium text-fuchsia-300 hover:text-white transition-colors whitespace-nowrap shrink-0 self-start md:self-auto cursor-pointer"
            >
              {isRu ? 'Или настроить свой размер →' : 'Or configure custom size →'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {QUICK_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onStartPreset(preset.config)}
                className="group text-left p-5 rounded-2xl border border-white/10 bg-[#0d1322] hover:bg-[#131b30] hover:border-indigo-400/50 transition-all duration-150 flex flex-col justify-between gap-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <div className="space-y-1.5">
                  <div className="text-xs text-slate-400 font-mono tabular-nums">{preset.meta}</div>
                  <div className="text-base font-semibold text-white group-hover:text-fuchsia-300 transition-colors">
                    {isRu ? preset.labelRu : preset.labelEn}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-indigo-300 font-medium pt-3 border-t border-white/10">
                  <span>{isRu ? 'Открыть холст' : 'Open canvas'}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* 4. WEB VS WINDOWS COMPARISON & DOWNLOAD CONVERSION */}
        <section id="platforms" className="max-w-7xl mx-auto px-6 py-16 border-t border-white/10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Platform Comparison Card */}
            <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-[#0d1322] p-6 sm:p-8 flex flex-col justify-between gap-6">
              <div className="space-y-2">
                <h2 className="font-pixel text-lg sm:text-xl text-white leading-snug">
                  {isRu ? 'Веб-версия и Windows Desktop' : 'Web Studio vs Windows Desktop'}
                </h2>
                <p className="text-sm text-slate-400">
                  {isRu
                    ? 'Единая кодовая база и облачное хранилище: проекты синхронизируются между браузером и десктопной программой.'
                    : 'Same studio engine and shared Firebase cloud projects across browser and Windows desktop.'}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs text-slate-400 font-mono">
                      <th className="py-3 pr-4 font-medium">{isRu ? 'Возможность' : 'Feature'}</th>
                      <th className="py-3 px-4 font-medium">{isRu ? 'Веб-версия' : 'Web Version'}</th>
                      <th className="py-3 pl-4 font-medium text-fuchsia-300">Windows (Electron)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 tabular-nums">
                    <tr>
                      <td className="py-3 pr-4 text-slate-200">{isRu ? 'Запуск без установки' : 'Instant zero-install launch'}</td>
                      <td className="py-3 px-4 text-emerald-300">{isRu ? 'Да, в любом браузере' : 'Yes, any browser'}</td>
                      <td className="py-3 pl-4 text-slate-400">{isRu ? 'Установщик .exe' : '.exe installer'}</td>
                    </tr>
                    <tr>
                      <td className="py-3 pr-4 text-slate-200">{isRu ? 'Полный набор инструментов и GIF' : 'Full pixel tools & GIF export'}</td>
                      <td className="py-3 px-4 text-emerald-300">{isRu ? 'Да' : 'Yes'}</td>
                      <td className="py-3 pl-4 text-emerald-300">{isRu ? 'Да' : 'Yes'}</td>
                    </tr>
                    <tr>
                      <td className="py-3 pr-4 text-slate-200">{isRu ? 'Облако Firebase и Галерея' : 'Cloud projects & Gallery'}</td>
                      <td className="py-3 px-4 text-emerald-300">{isRu ? 'Синхронизировано' : 'Synced'}</td>
                      <td className="py-3 pl-4 text-emerald-300">{isRu ? 'Синхронизировано' : 'Synced'}</td>
                    </tr>
                    <tr>
                      <td className="py-3 pr-4 text-slate-200">Discord Rich Presence</td>
                      <td className="py-3 px-4 text-slate-400">{isRu ? 'Только десктоп' : 'Desktop only'}</td>
                      <td className="py-3 pl-4 text-emerald-300">{isRu ? 'Активно (статус в Discord)' : 'Active (Discord status)'}</td>
                    </tr>
                    <tr>
                      <td className="py-3 pr-4 text-slate-200">{isRu ? 'Нативное окно без вкладок' : 'Dedicated desktop window'}</td>
                      <td className="py-3 px-4 text-slate-400">{isRu ? 'Вкладка браузера' : 'Browser tab'}</td>
                      <td className="py-3 pl-4 text-emerald-300">1920×1080 Fullscreen</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Download Conversion Box */}
            <div
              id="download"
              className="lg:col-span-5 rounded-2xl border border-indigo-500/40 bg-gradient-to-b from-[#131b32] to-[#0d1322] p-6 sm:p-8 flex flex-col justify-between gap-6"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-slate-200">
                  <div className="w-11 h-11 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
                    <Monitor className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      {isRu ? 'NovaBlast для Windows' : 'NovaBlast for Windows'}
                    </h2>
                    <div className="text-xs text-slate-400 font-mono tabular-nums">
                      Windows 10 / 11 (x64) · NSIS (.exe) · v1.0.0
                    </div>
                  </div>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed">
                  {isRu
                    ? 'Скачайте десктопное приложение на базе Electron с поддержкой Discord Rich Presence, быстрым запуском с рабочего стола и плавной работой в отдельном окне.'
                    : 'Download the native Electron desktop edition with Discord Rich Presence integration, instant launch from desktop, and distraction-free windowing.'}
                </p>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleWindowsDownload}
                  disabled={isCheckingDownload}
                  className="w-full px-6 py-3.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2.5 whitespace-nowrap cursor-pointer shadow-[0_4px_0_rgb(162,28,175)] active:shadow-none active:translate-y-[3px] disabled:opacity-60"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span>
                    {isRu ? 'Скачать установщик для Windows' : 'Download Windows Installer'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onEnterWebApp}
                  className="w-full px-6 py-3 bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white border border-white/10 font-medium text-sm rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <Palette className="w-4 h-4 shrink-0 text-indigo-300" />
                  <span>{isRu ? 'Продолжить в веб-версии' : 'Continue in Web Browser'}</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 5. QUIET FOOTER */}
      <footer className="border-t border-white/10 bg-[#050811]">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="font-pixel text-sm text-white">NovaBlast</div>
            <div className="text-xs text-slate-400">
              {isRu ? 'Создано автором bob_pingvin · Веб и Windows Desktop' : 'Created by bob_pingvin · Web & Windows Desktop'}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-400">
            <a
              href="https://t.me/ChOTblPE"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Telegram
            </a>
            <a
              href="https://discord.gg/mcSZ2X2B"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Discord
            </a>
            <a
              href="https://steamcommunity.com/id/bobpingvin/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Steam
            </a>
            <a
              href="https://github.com/bobPingvin"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              GitHub
            </a>

            <span aria-hidden="true" className="text-slate-700">|</span>

            <button
              type="button"
              onClick={() => onChangeLanguage(isRu ? 'en' : 'ru')}
              className="text-slate-300 hover:text-white font-mono cursor-pointer transition-colors"
            >
              {isRu ? 'RU / EN' : 'EN / RU'}
            </button>

            <button
              type="button"
              onClick={onEnterWebApp}
              className="text-indigo-300 hover:text-white font-medium cursor-pointer transition-colors"
            >
              {isRu ? 'Открыть редактор' : 'Open Editor'}
            </button>
          </div>
        </div>
      </footer>

      {/* Windows Installer Modal (shown when no direct .exe URL is attached yet) */}
      {isDownloadModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsDownloadModalOpen(false);
          }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-[#0d1322] border border-white/15 rounded-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setIsDownloadModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              aria-label={isRu ? 'Закрыть' : 'Close'}
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 pr-8">
              <div className="w-10 h-10 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-300 shrink-0">
                <Monitor className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  {isRu ? 'Сборка установщика для Windows (.exe)' : 'Windows Desktop Installer (.exe)'}
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Windows 10 / 11 (x64) · Electron NSIS
                </p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
              <p>
                {isRu
                  ? 'Файл установщика (.exe) не хранится внутри веб-репозитория. Чтобы кнопка скачивания на вашем сайте Vercel сразу отдавала готовый NovaBlast Setup.exe, подключите его одним из двух способов:'
                  : 'The compiled desktop installer (.exe) is not bundled directly inside the web repository. Connect your Windows release binary using either option below:'}
              </p>

              <div className="p-3.5 rounded-xl bg-[#070b14] border border-white/10 space-y-2 text-xs">
                <div className="font-semibold text-white">
                  {isRu ? '1. Соберите .exe локально или загрузите на GitHub Releases:' : '1. Build locally or upload to GitHub Releases:'}
                </div>
                <div className="flex items-center justify-between gap-2 bg-slate-900/90 border border-white/10 rounded-lg px-3 py-2 font-mono text-fuchsia-300">
                  <span className="flex items-center gap-2 truncate">
                    <Terminal size={13} className="shrink-0 text-slate-400" />
                    npm run build:electron
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCommand}
                    className="text-slate-300 hover:text-white flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {copiedCmd ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    <span>{copiedCmd ? (isRu ? 'Скопировано' : 'Copied') : (isRu ? 'Копия' : 'Copy')}</span>
                  </button>
                </div>
                <p className="text-slate-400 leading-relaxed pt-1">
                  {isRu
                    ? '2. В настройках проекта Vercel добавьте переменную среды VITE_WINDOWS_DOWNLOAD_URL со ссылкой на ваш .exe файл (или положите файл в public/downloads/NovaBlast-Setup.exe).'
                    : '2. In Vercel Project Settings, set VITE_WINDOWS_DOWNLOAD_URL to your .exe download link (or place NovaBlast-Setup.exe in public/downloads/).'}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <a
                href="https://github.com/bobPingvin"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs sm:text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <span>{isRu ? 'Репозиторий на GitHub' : 'Open GitHub'}</span>
                <ExternalLink size={14} />
              </a>
              <button
                type="button"
                onClick={() => {
                  setIsDownloadModalOpen(false);
                  onEnterWebApp();
                }}
                className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors cursor-pointer"
              >
                {isRu ? 'Открыть веб-версию сейчас' : 'Launch Web Version Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
