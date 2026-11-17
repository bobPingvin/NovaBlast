const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const DiscordRPC = require('discord-rpc');

// CRITICAL: Stealth settings to help bypass Google's "secure browser" check
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
// Combine all features to disable in ONE switch (Chromium often overwrites multiple calls)
const disabledFeatures = [
  'IsolateOrigins',
  'site-per-process',
  'CrossSiteDocumentBlockingIframes',
  'BlockInsecurePrivateNetworkRequests',
  'Cross-Origin-Opener-Policy'
].join(',');
app.commandLine.appendSwitch('disable-features', disabledFeatures);
app.commandLine.appendSwitch('disable-site-isolation-trials');
app.commandLine.appendSwitch('disable-infobars');

if (process.platform === 'linux') {
  // Common fixes for Linux graphics issues on ALT / Russian distros
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('disable-software-rasterizer');
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
}

// Updated User Agent to match Linux and latest Chrome more accurately
const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.6943.127 Safari/537.36";
const CH_UA = '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"';
const CH_PLATFORM = '"Linux"';

const PORT = 9000;

function getGoogleLoginHtml(fbConfig) {
  // Safe default configuration fallback to prevent initialization crashes in packaged builds
  if (!fbConfig || !fbConfig.apiKey) {
    fbConfig = {
      projectId: "gen-lang-client-0487154255",
      appId: "1:870945657608:web:0d700a760d9c3aace792bd",
      apiKey: "AIzaSyCvLv8kSHjuoXJDgndMT5pOUGUHAVGP5KU",
      authDomain: "gen-lang-client-0487154255.firebaseapp.com",
      firestoreDatabaseId: "ai-studio-90ba0387-e5a4-4ed4-a38d-d1fa7b6f297f",
      storageBucket: "gen-lang-client-0487154255.firebasestorage.app",
      messagingSenderId: "870945657608",
      measurementId: ""
    };
  }

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NovaBlast - Google Auth</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js" crossorigin="anonymous"></script>
  <script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js" crossorigin="anonymous"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Inter', sans-serif;
    }
    .font-mono {
      font-family: 'JetBrains Mono', monospace;
    }
    @keyframes spin-slow {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes spin-reverse {
      0% { transform: rotate(360deg); }
      100% { transform: rotate(0deg); }
    }
    @keyframes pulse-subtle {
      0%, 100% { transform: scale(1); opacity: 0.8; }
      50% { transform: scale(1.04); opacity: 1; }
    }
    @keyframes float-cosmic {
      0%, 100% { transform: translateY(0px) rotate(0deg); }
      50% { transform: translateY(-6px) rotate(1.5deg); }
    }
    @keyframes gravitational-wave {
      0%, 100% { outline-offset: 4px; outline-color: rgba(168, 85, 247, 0.45); opacity: 0.8; }
      50% { outline-offset: 14px; outline-color: rgba(236, 72, 153, 0); opacity: 0.1; }
    }
    @keyframes orbit-cyan {
      0% { transform: rotate(0deg) translate(52px) rotate(0deg); }
      100% { transform: rotate(360deg) translate(52px) rotate(-360deg); }
    }
    @keyframes orbit-fuchsia {
      0% { transform: rotate(180deg) translate(44px) rotate(-180deg); }
      100% { transform: rotate(540deg) translate(44px) rotate(-540deg); }
    }
    .animate-spin-slow {
      animation: spin-slow 20s linear infinite;
    }
    .animate-spin-reverse {
      animation: spin-reverse 10s linear infinite;
    }
    .animate-pulse-subtle {
      animation: pulse-subtle 3s ease-in-out infinite;
    }
    .animate-float {
      animation: float-cosmic 5s ease-in-out infinite;
    }
    .animate-orbit-cyan {
      animation: orbit-cyan 7s linear infinite;
    }
    .animate-orbit-fuchsia {
      animation: orbit-fuchsia 5s linear infinite;
    }
    .black-hole-glow {
      box-shadow: 
        0 0 25px rgba(168, 85, 247, 0.65), 
        0 0 50px rgba(236, 72, 153, 0.4),
        inset 0 0 16px rgba(0, 0, 0, 0.95);
    }
    .gravitational-lens {
      outline: 2px solid transparent;
      animation: gravitational-wave 3.5s cubic-bezier(0.16, 1, 0.3, 1) infinite;
    }
  </style>
</head>
<body class="bg-[#050110] text-gray-100 min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
  <!-- Dynamic Space/Supernova Background Flare & Sparkle Grid -->
  <div class="absolute inset-0 bg-[linear-gradient(to_right,#1f1437_1px,transparent_1px),linear-gradient(to_bottom,#1f1437_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30"></div>
  
  <!-- Nebula Nebular Flares -->
  <div class="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-fuchsia-600/10 rounded-full blur-[140px] animate-pulse-subtle"></div>
  <div class="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-blue-600/10 rounded-full blur-[140px] animate-pulse-subtle" style="animation-delay: 2s;"></div>
  <div class="absolute top-[30%] right-[10%] w-96 h-96 bg-violet-600/10 rounded-full blur-[120px] animate-pulse-subtle" style="animation-delay: 1s;"></div>

  <div class="relative w-full max-w-md bg-zinc-950/75 border border-purple-500/25 rounded-2xl p-8 backdrop-blur-2xl shadow-[0_0_60px_rgba(139,92,246,0.15)] z-10 text-center">
    
    <!-- Animated Black Hole / Supernova Branding Logo -->
    <div class="mb-8">
      <div class="relative w-32 h-32 mx-auto mb-6 flex items-center justify-center animate-float">
        <!-- Gravitational lensing wave -->
        <div class="absolute w-16 h-16 rounded-full gravitational-lens pointer-events-none"></div>

        <!-- Outermost cosmic dust clouds (rotating) -->
        <div class="absolute inset-0 rounded-full bg-gradient-to-tr from-fuchsia-600 via-pink-700/40 to-cyan-400/30 opacity-45 blur-md animate-spin-slow"></div>
        
        <!-- Accretion disc layer 1 -->
        <div class="absolute w-24 h-24 rounded-full bg-gradient-to-r from-purple-500 via-rose-500 to-indigo-500 opacity-65 blur-[3px] animate-spin-reverse"></div>
        
        <!-- Accretion disc layer 2 (high contrast orbits) -->
        <div class="absolute w-20 h-20 rounded-full border-t border-b border-fuchsia-400/40 opacity-75 animate-spin-slow"></div>

        <!-- The actual dark core of the Supernova/Black Hole (Event Horizon) -->
        <div class="relative w-14 h-14 rounded-full bg-[#030109] border border-violet-500/50 black-hole-glow flex items-center justify-center">
          <!-- Inner core glow/flare -->
          <div class="absolute w-10 h-10 rounded-full bg-violet-600/35 blur-[6px]"></div>
          <!-- Small event horizon singular eye -->
          <div class="w-4 h-4 rounded-full bg-gradient-to-tr from-violet-400 to-fuchsia-300 opacity-80 blur-[0.5px]"></div>
        </div>

        <!-- Orbiting stellar dust spark 1 (Cyan) -->
        <div class="absolute w-2 h-2 rounded-full bg-cyan-300 animate-orbit-cyan shadow-[0_0_8px_#22d3ee]"></div>
        
        <!-- Orbiting stellar dust spark 2 (Fuchsia) -->
        <div class="absolute w-1.5 h-1.5 rounded-full bg-fuchsia-300 animate-orbit-fuchsia shadow-[0_0_8px_#f472b6]"></div>
      </div>
      <h1 class="text-2xl font-bold tracking-tight bg-gradient-to-r from-fuchsia-400 via-violet-300 to-cyan-300 bg-clip-text text-transparent font-mono">NovaBlast Auth</h1>
      <p class="text-[10px] text-purple-300/60 mt-2 tracking-widest uppercase font-mono">Вход в облачную синхронизацию</p>
    </div>

    <!-- Active States Container -->
    <div id="status-container" class="space-y-6">
      
      <!-- Starting State -->
      <div id="state-start" class="space-y-6">
        <p class="text-sm text-slate-300 leading-relaxed text-left border-l-2 border-fuchsia-500/50 pl-4 py-1 font-mono">
          Для входа в аккаунт нажмите кнопку ниже. Авторизация пройдет через надежные официальные серверы Google в вашем основном браузере.
        </p>
        
        <button id="btn-login" class="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-fuchsia-600 via-purple-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white rounded-xl font-bold tracking-wide transition-all duration-300 shadow-[0_0_20px_rgba(168,85,247,0.35)] hover:shadow-[0_0_30px_rgba(236,72,153,0.5)] transform hover:scale-[1.02] focus:outline-none cursor-pointer">
          <svg class="w-5 h-5 text-white filter drop-shadow" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          Войти с помощью Google
        </button>
      </div>

      <!-- Loading State -->
      <div id="state-loading" class="hidden space-y-4 py-4">
        <div class="relative w-14 h-14 mx-auto mb-6">
          <div class="absolute inset-0 border-4 border-fuchsia-950 rounded-full opacity-30"></div>
          <div class="absolute inset-0 border-4 border-fuchsia-500 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <p class="text-sm font-medium text-slate-200">Ожидание авторизации Google...</p>
        <p class="text-xs text-purple-300/50">Пожалуйста, выберите ваш аккаунт во всплывающем окне.</p>
      </div>

      <!-- Success State -->
      <div id="state-success" class="hidden space-y-4 py-4">
        <div class="w-16 h-16 bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-400 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-8 h-8 filter drop-shadow-[0_0_8px_rgba(240,73,184,0.6)]">
            <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <p class="text-lg font-bold text-white tracking-tight">Авторизация пройдена!</p>
        <p class="text-xs text-slate-400 leading-relaxed font-mono">
          Данные входа переданы в <span class="text-fuchsia-400 font-bold">NovaBlast</span>. Вы можете безопасно закрыть эту вкладку и вернуться к приложению.
        </p>
      </div>

      <!-- Error State -->
      <div id="state-err" class="hidden space-y-4 py-2">
        <div class="w-16 h-16 bg-rose-500/10 border border-rose-500/30 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-8 h-8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
        </div>
        <p class="text-lg font-bold text-rose-400">Произошла ошибка</p>
        <p id="error-message" class="text-xs font-mono text-rose-300 bg-rose-950/20 p-3.5 rounded-lg border border-rose-500/20 overflow-auto max-h-36 text-left break-words">
          Неизвестная ошибка авториазции.
        </p>
        <button id="btn-retry" class="w-full py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl font-bold tracking-wide transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] focus:outline-none cursor-pointer">
          Сделать еще одну попытку
        </button>
      </div>

    </div>

    <!-- Footer Security Notice -->
    <div class="border-t border-purple-950/40 mt-8 pt-6">
      <p class="text-[10px] text-purple-400/40 flex items-center justify-center gap-1.5 font-mono tracking-widest uppercase">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5 text-fuchsia-400/50">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
        SECURED LOCALHOST TUNNEL
      </p>
    </div>
  </div>

  <script>
    const firebaseConfig = ${JSON.stringify(fbConfig)};
    
    // Setup Global Error Handlers to display exact problems inside the UI
    window.onerror = function(message, source, lineno, colno, error) {
      const errorMsg = message + (error && error.stack ? '\\n' + error.stack : '');
      const errEl = document.getElementById('error-message');
      if (errEl) {
        errEl.textContent = "Ошибка скрипта: " + errorMsg;
        showState('err');
      }
    };
    window.onunhandledrejection = function(event) {
      const errEl = document.getElementById('error-message');
      if (errEl) {
        errEl.textContent = "Сбой сети/OAuth: " + (event.reason ? (event.reason.message || event.reason.code || JSON.stringify(event.reason)) : 'Всплывающее окно заблокировано или закрыто');
        showState('err');
      }
    };

    function showState(state) {
      document.getElementById('state-start').classList.add('hidden');
      document.getElementById('state-loading').classList.add('hidden');
      document.getElementById('state-success').classList.add('hidden');
      document.getElementById('state-err').classList.add('hidden');
      
      document.getElementById('state-' + state).classList.remove('hidden');
    }

    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    async function login() {
      showState('loading');
      try {
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        
        const credential = result.credential;
        const accessToken = credential ? credential.accessToken : null;
        // CRITICAL: We MUST pass credential.idToken (Google-issued ID Token) to satisfy GoogleAuthProvider.credential in Electron!
        const idToken = (credential && credential.idToken) ? credential.idToken : await user.getIdToken();
        
        const response = await fetch('/api/save-auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            idToken: idToken,
            accessToken: accessToken,
            user: {
              uid: user.uid,
              displayName: user.displayName,
              email: user.email,
              photoURL: user.photoURL
            }
          })
        });

        if (response.ok) {
          showState('success');
        } else {
          throw new Error('Код ошибки от Electron-сервера: ' + response.status);
        }
      } catch (err) {
        console.error(err);
        document.getElementById('error-message').textContent = err.message || err.code || JSON.stringify(err);
        showState('err');
      }
    }

    document.getElementById('btn-login').addEventListener('click', login);
    document.getElementById('btn-retry').addEventListener('click', login);

    // CRITICAL FIX: DO NOT automatically trigger login or open popup on page load.
    // This allows browser security checks to register the user click gesture, preventing popup blocker failure.
  </script>
</body>
</html>`;
}

const https = require('https');
const electronSteamLogins = new Map();

function extractXmlValue(xml, tag) {
  const cdata = xml.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'));
  if (cdata && cdata[1]) return cdata[1].trim();
  const plain = xml.match(new RegExp(`<${tag}>([^<]*)<\\/${tag}>`, 'i'));
  if (plain && plain[1]) return plain[1].trim();
  return null;
}

function httpsRequestText(urlStr, options = {}, bodyStr = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: options.method || 'GET',
        headers: options.headers || { 'User-Agent': USER_AGENT },
      },
      (resp) => {
        let chunks = '';
        resp.on('data', (c) => (chunks += c.toString()));
        resp.on('end', () => resolve({ status: resp.statusCode, text: chunks }));
      }
    );
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// tiny server to serve the app on localhost:9000
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);

  // Steam OpenID poll & session endpoints for packaged Electron builds
  if (parsedUrl.pathname.startsWith('/api/auth/steam/poll')) {
    const parts = parsedUrl.pathname.split('/').filter(Boolean);
    const loginId = parts[4] || parsedUrl.searchParams.get('loginId') || '';
    const record = electronSteamLogins.get(loginId);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    if (!record || record.status === 'pending') {
      res.end(JSON.stringify({ status: 'pending' }));
      return;
    }
    electronSteamLogins.delete(loginId);
    res.end(JSON.stringify(record));
    return;
  }

  if (parsedUrl.pathname === '/api/auth/steam/session') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ authenticated: false }));
    return;
  }

  if (parsedUrl.pathname === '/api/auth/steam/url' || parsedUrl.pathname === '/api/auth/steam/logout') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (parsedUrl.pathname.startsWith('/auth/steam/callback')) {
    const parts = parsedUrl.pathname.split('/').filter(Boolean);
    const loginId = parts[3] || parsedUrl.searchParams.get('loginId') || '';
    const mode = parsedUrl.searchParams.get('openid.mode');
    if (mode !== 'id_res') {
      if (loginId) electronSteamLogins.set(loginId, { status: 'error', error: 'Вход через Steam был отменён.' });
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<html><body style="background:#0f172a;color:#fff;font-family:monospace;padding:32px;text-align:center"><h2>Вход отменён</h2><p>Можно закрыть эту вкладку.</p></body></html>');
      return;
    }
    try {
      const verifyParams = new URLSearchParams();
      for (const [k, v] of parsedUrl.searchParams.entries()) {
        if (k.startsWith('openid.')) verifyParams.set(k, v);
      }
      verifyParams.set('openid.mode', 'check_authentication');
      const verifyResp = await httpsRequestText(
        'https://steamcommunity.com/openid/login',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': USER_AGENT,
          },
        },
        verifyParams.toString()
      );
      if (!/is_valid\s*:\s*true/i.test(verifyResp.text)) {
        if (loginId) electronSteamLogins.set(loginId, { status: 'error', error: 'Не удалось подтвердить ответ Steam.' });
        res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<html><body style="background:#0f172a;color:#fff;font-family:monospace;padding:32px;text-align:center"><h2>Ошибка проверки Steam</h2></body></html>');
        return;
      }
      const claimedId = parsedUrl.searchParams.get('openid.claimed_id') || '';
      const idMatch = claimedId.match(/\/openid\/id\/(\d{17,25})$/);
      const steamId = idMatch ? idMatch[1] : '';
      let personaName = `Steam #${steamId.slice(-6)}`;
      let avatarUrl = '';
      try {
        const xmlResp = await httpsRequestText(`https://steamcommunity.com/profiles/${steamId}/?xml=1`);
        if (xmlResp.status === 200) {
          personaName = extractXmlValue(xmlResp.text, 'steamID') || personaName;
          avatarUrl = extractXmlValue(xmlResp.text, 'avatarFull') || extractXmlValue(xmlResp.text, 'avatarMedium') || '';
        }
      } catch (e) {}
      const steamProfile = {
        steamId,
        personaName,
        avatarUrl,
        profileUrl: `https://steamcommunity.com/profiles/${steamId}`,
      };
      if (loginId) {
        electronSteamLogins.set(loginId, { status: 'authenticated', steamProfile, customToken: null });
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<html><body style="background:#0f172a;color:#66c0f4;font-family:monospace;padding:40px;text-align:center"><h2>Привет, ${personaName}!</h2><p style="color:#cbd5e1">Вход выполнен! Можете закрыть вкладку и вернуться в NovaBlast.</p><script>setTimeout(()=>window.close(),300);</script></body></html>`);
      return;
    } catch (err) {
      if (loginId) electronSteamLogins.set(loginId, { status: 'error', error: 'Ошибка при входе через Steam.' });
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<html><body style="background:#0f172a;color:#fff;font-family:monospace;padding:32px;text-align:center"><h2>Ошибка входа</h2></body></html>');
      return;
    }
  }

  // 1. Intercept /api/save-auth POST
  if (req.url === '/api/save-auth' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const authData = JSON.parse(body);
        const windows = BrowserWindow.getAllWindows();
        windows.forEach(w => {
          w.webContents.send('auth-received', authData);
        });
        
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ status: 'ok' }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Invalid JSON');
      }
    });
    return;
  }

  // 2. Intercept /google-login-external GET
  if (req.url.startsWith('/google-login-external')) {
    let fbConfig = {};
    try {
      fbConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf8'));
    } catch (e) {
      console.error("Failed to read firebase config for external auth", e);
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getGoogleLoginHtml(fbConfig));
    return;
  }

  // 3. Normal file serving
  let url = parsedUrl.pathname === '/' ? '/index.html' : parsedUrl.pathname;
  let filePath = path.join(__dirname, 'dist', url);
  
  const ext = path.extname(filePath);
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.svg': 'image/svg+xml',
    '.wasm': 'application/wasm'
  };

  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(__dirname, 'dist', 'index.html'), (err, data) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      });
      return;
    }
    res.writeHead(200, { 
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(data);
  });
});

if (!fs.existsSync(path.join(__dirname, 'dist'))) {
  console.warn('WARNING: "dist" folder not found. Please run "npm run build" before starting Electron.');
}

server.listen(PORT, '127.0.0.1');

function createWindow() {
  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    title: "NovaBlast",
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      userAgent: USER_AGENT,
      spellcheck: true,
      allowRunningInsecureContent: false,
      webSecurity: true
    }
  });
  win.setMenu(null);

  if (!app.isPackaged) {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadURL(`http://127.0.0.1:${PORT}`);
  }

  // Handle window opening (Popups for Auth)
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('accounts.google.com') || url.includes('.firebaseapp.com') || url.includes('google.com/amp/s/accounts.google.com')) {
      return { 
        action: 'allow',
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            userAgent: USER_AGENT,
            preload: path.join(__dirname, 'preload.cjs'),
            sandbox: false,
            partition: 'auth-session'
          }
        }
      };
    }
    
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.on('web-contents-created', (event, contents) => {
  // Set User Agent for everything
  contents.setUserAgent(USER_AGENT, 'ru-RU');
  
  contents.session.webRequest.onBeforeSendHeaders((details, callback) => {
    // Set headers to look like real Chrome
    details.requestHeaders['User-Agent'] = USER_AGENT;
    details.requestHeaders['Sec-CH-UA'] = CH_UA;
    details.requestHeaders['Sec-CH-UA-Mobile'] = '?0';
    details.requestHeaders['Sec-CH-UA-Platform'] = CH_PLATFORM;
    details.requestHeaders['Sec-CH-UA-Full-Version-List'] = CH_UA; // Simplified
    details.requestHeaders['Accept-Language'] = 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7';
    
    // Remove headers that leak Electron
    const toRemove = ['X-Browser-Apps', 'X-Requested-With', 'X-DevTools-Emulate-Network-Conditions-Client-Id'];
    toRemove.forEach(h => delete details.requestHeaders[h]);

    // Force standard Chrome headers
    details.requestHeaders['Connection'] = 'keep-alive';
    details.requestHeaders['Upgrade-Insecure-Requests'] = '1';
    details.requestHeaders['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7';
    details.requestHeaders['Sec-Fetch-Site'] = 'none';
    details.requestHeaders['Sec-Fetch-Mode'] = 'navigate';
    details.requestHeaders['Sec-Fetch-User'] = '?1';
    details.requestHeaders['Sec-Fetch-Dest'] = 'document';

    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  // Inject stealth script into EVERY frame and dynamic navigation
  contents.on('did-start-navigation', (e, url) => {
    contents.executeJavaScript(`
      (function() {
        try {
          // Hide WebDriver
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
          
          // Mimic Chrome features
          window.chrome = {
            runtime: {},
            loadTimes: function() {},
            csi: function() {},
            app: {}
          };

          // Mimic hardware properties
          Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
          Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
          Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
          
          // Fix platform to match User Agent (Linux)
          Object.defineProperty(navigator, 'platform', { get: () => 'Linux x86_64' });
          Object.defineProperty(navigator, 'appVersion', { get: () => USER_AGENT.replace('Mozilla/', '') });

          // Mock userAgentData to avoid leaking Linux inconsistency
          if (navigator.userAgentData) {
            Object.defineProperty(navigator, 'userAgentData', {
              get: () => ({
                brands: [
                  { brand: 'Not(A:Brand', version: '99' },
                  { brand: 'Google Chrome', version: '133' },
                  { brand: 'Chromium', version: '133' }
                ],
                mobile: false,
                platform: 'Linux',
                getHighEntropyValues: (hints) => Promise.resolve({
                  brands: [
                    { brand: 'Not(A:Brand', version: '99' },
                    { brand: 'Google Chrome', version: '133' },
                    { brand: 'Chromium', version: '133' }
                  ],
                  mobile: false,
                  platform: 'Linux',
                  platformVersion: '6.1.0',
                  architecture: 'x86',
                  bitness: '64',
                  model: '',
                  uaFullVersion: '133.0.6943.127',
                  fullVersionList: [
                    { brand: 'Not(A:Brand', version: '99' },
                    { brand: 'Google Chrome', version: '133.0.6943.127' },
                    { brand: 'Chromium', version: '133.0.6943.127' }
                  ]
                })
              })
            });
          }

          // Fix permissions query
          const originalQuery = window.navigator.permissions.query;
          window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
              Promise.resolve({ state: Notification.permission }) :
              originalQuery(parameters)
          );

          // Fix languages if they are empty
          if (!navigator.languages || navigator.languages.length === 0) {
            Object.defineProperty(navigator, 'languages', { get: () => ['ru-RU', 'ru', 'en-US', 'en'] });
          }

          // Spoof plugins to look more real
          if (navigator.plugins.length === 0) {
            const mockPlugin = { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' };
            Object.defineProperty(navigator, 'plugins', { get: () => [mockPlugin] });
          }
        } catch (e) {}
      })();
    `);
  });
});

ipcMain.handle('google-login', async () => {
  shell.openExternal(`http://localhost:${PORT}/google-login-external`);
  return { status: "ready" };
});

const clientId = '1499662145028362431'; 
DiscordRPC.register(clientId);

const rpc = new DiscordRPC.Client({ transport: 'ipc' });
const startTimestamp = new Date();

let isRpcReady = false;
let currentActivity = null;

async function setActivity(activityData) {
  if (!activityData) return;
  currentActivity = activityData;
  
  if (!rpc || !isRpcReady) return;
  
  try {
    rpc.setActivity({
      details: currentActivity.details || 'В приложении',
      state: currentActivity.state || 'Рисует',
      startTimestamp,
      largeImageKey: currentActivity.largeImageKey || 'icon',
      largeImageText: 'NovaBlast',
      instance: false,
    });
  } catch (err) {
    console.error('Failed to set discord activity', err);
  }
}

rpc.on('ready', () => {
  isRpcReady = true;
  if (currentActivity) {
    setActivity(currentActivity);
  } else {
    setActivity({ details: 'В главном меню', state: 'Выбирает что делать' });
  }
});

try {
  rpc.login({ clientId }).catch(console.error);
} catch (e) {
  console.error("Discord RPC Login failed", e);
}

ipcMain.on('set-discord-activity', (event, activityData) => {
  setActivity(activityData);
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
