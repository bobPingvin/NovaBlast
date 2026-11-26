import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { initializeApp as initAdminApp, getApps as getAdminApps, cert } from 'firebase-admin/app';
import type { ServiceAccount } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import type { Auth as AdminAuth } from 'firebase-admin/auth';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd =
  process.env.NODE_ENV === 'production' ||
  process.env.npm_lifecycle_event === 'start';

const SESSION_COOKIE_NAME = 'novablast_steam_session';
const GITHUB_COOKIE_NAME = 'novablast_github_session';
const X_COOKIE_NAME = 'novablast_x_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const PENDING_LOGIN_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Read default projectId from firebase-applet-config.json if available
let defaultFirebaseProjectId = process.env.FIREBASE_PROJECT_ID || '';
try {
  const configPath = path.join(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (!defaultFirebaseProjectId && parsed.projectId) {
      defaultFirebaseProjectId = parsed.projectId;
    }
  }
} catch {
  // Ignore config read errors
}

const SESSION_SECRET =
  process.env.STEAM_SESSION_SECRET ||
  crypto
    .createHash('sha256')
    .update(`novablast-steam-hmac:${defaultFirebaseProjectId || 'local-dev'}`)
    .digest('hex');

export interface SteamPlayerProfile {
  steamId: string;
  personaName: string;
  avatarUrl: string;
  profileUrl: string;
}

export interface GitHubUserProfile {
  githubId: string;
  login: string;
  name: string;
  avatarUrl: string;
  profileUrl: string;
  email?: string;
}

export interface XUserProfile {
  xId: string;
  username: string;
  name: string;
  avatarUrl: string;
  profileUrl: string;
}

interface PendingSteamAuthRecord {
  status: 'pending' | 'authenticated' | 'error';
  steamProfile?: SteamPlayerProfile;
  customToken?: string | null;
  sessionToken?: string;
  error?: string;
  createdAt: number;
}

interface PendingGitHubAuthRecord {
  status: 'pending' | 'authenticated' | 'error';
  githubProfile?: GitHubUserProfile;
  customToken?: string | null;
  sessionToken?: string;
  error?: string;
  createdAt: number;
}

interface PendingXAuthRecord {
  status: 'pending' | 'authenticated' | 'error';
  xProfile?: XUserProfile;
  customToken?: string | null;
  sessionToken?: string;
  error?: string;
  createdAt: number;
}

const pendingSteamLogins = new Map<string, PendingSteamAuthRecord>();
const pendingGitHubLogins = new Map<string, PendingGitHubAuthRecord>();
const pendingXLogins = new Map<string, PendingXAuthRecord>();

export interface PendingSteamChallenge {
  code: string;
  steamProfile: SteamPlayerProfile;
  expiresAt: number;
}
const pendingSteamChallenges = new Map<string, PendingSteamChallenge>();

function cleanupExpiredPendingLogins() {
  const now = Date.now();
  for (const [key, record] of pendingSteamLogins.entries()) {
    if (now - record.createdAt > PENDING_LOGIN_TTL_MS) {
      pendingSteamLogins.delete(key);
    }
  }
  for (const [key, record] of pendingGitHubLogins.entries()) {
    if (now - record.createdAt > PENDING_LOGIN_TTL_MS) {
      pendingGitHubLogins.delete(key);
    }
  }
  for (const [key, record] of pendingXLogins.entries()) {
    if (now - record.createdAt > PENDING_LOGIN_TTL_MS) {
      pendingXLogins.delete(key);
    }
  }
  for (const [key, record] of pendingSteamChallenges.entries()) {
    if (now > record.expiresAt) {
      pendingSteamChallenges.delete(key);
    }
  }
}

let cachedAdminAuth: AdminAuth | null | undefined;

function getFirebaseAdmin(): AdminAuth | null {
  if (cachedAdminAuth !== undefined) {
    return cachedAdminAuth;
  }

  try {
    const existingApps = getAdminApps();
    if (existingApps.length > 0) {
      cachedAdminAuth = getAdminAuth(existingApps[0]);
      return cachedAdminAuth;
    }

    let serviceAccount: ServiceAccount | null = null;
    const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();

    if (rawServiceAccount) {
      let jsonStr = rawServiceAccount;
      if (!rawServiceAccount.startsWith('{')) {
        jsonStr = Buffer.from(rawServiceAccount, 'base64').toString('utf-8');
      }
      const parsed = JSON.parse(jsonStr);
      serviceAccount = {
        projectId: parsed.project_id || parsed.projectId || defaultFirebaseProjectId,
        clientEmail: parsed.client_email || parsed.clientEmail,
        privateKey: (parsed.private_key || parsed.privateKey || '').replace(/\\n/g, '\n'),
      };
    } else if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID || defaultFirebaseProjectId,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL.trim(),
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      };
    }

    if (serviceAccount && serviceAccount.clientEmail && serviceAccount.privateKey) {
      const adminApp = initAdminApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.projectId || defaultFirebaseProjectId,
      });
      cachedAdminAuth = getAdminAuth(adminApp);
      return cachedAdminAuth;
    }
  } catch (err) {
    console.error('[Steam Auth] Failed to initialize Firebase Admin SDK:', err);
  }

  cachedAdminAuth = null;
  return null;
}

function resolveBaseUrl(req: Request): string {
  const clientOrigin = typeof req.query.origin === 'string' ? req.query.origin.trim() : '';

  if (clientOrigin) {
    try {
      const parsed = new URL(clientOrigin);
      const isAllowedOrigin =
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname.endsWith('.vercel.app') ||
        parsed.hostname.endsWith('.run.app') ||
        (process.env.APP_URL && parsed.origin === new URL(process.env.APP_URL).origin);

      if ((parsed.protocol === 'https:' || parsed.protocol === 'http:') && isAllowedOrigin) {
        return parsed.origin;
      }
    } catch {
      // Fallback to APP_URL below
    }
  }

  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/+$/, '');
  }

  const forwardedHost = req.headers['x-forwarded-host'];
  const forwardedProto = req.headers['x-forwarded-proto'];
  if (typeof forwardedHost === 'string' && forwardedHost.length > 0) {
    const proto = typeof forwardedProto === 'string' ? forwardedProto.split(',')[0].trim() : 'https';
    return `${proto}://${forwardedHost.split(',')[0].trim()}`;
  }

  return `http://localhost:${PORT}`;
}

function signTokenPayload(data: Record<string, unknown>, ttlSeconds: number): string {
  const payload = Buffer.from(
    JSON.stringify({
      ...data,
      exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    }),
    'utf-8'
  ).toString('base64url');

  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');

  return `${payload}.${sig}`;
}

function verifyGenericTokenPayload<T = Record<string, any>>(token: string | undefined | null): T | null {
  if (!token) return null;
  const dotIdx = token.indexOf('.');
  if (dotIdx === -1) return null;

  const payload = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return decoded as T;
  } catch {
    return null;
  }
}

function signSessionPayload(profile: SteamPlayerProfile | GitHubUserProfile | XUserProfile | object): string {
  return signTokenPayload(profile as Record<string, unknown>, SESSION_MAX_AGE_SECONDS);
}

function verifySignedToken(token: string | undefined | null): SteamPlayerProfile | null {
  if (!token) return null;

  const dotIdx = token.indexOf('.');
  if (dotIdx === -1) return null;

  const payload = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (!decoded.steamId || (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000))) {
      return null;
    }
    return {
      steamId: String(decoded.steamId),
      personaName: String(decoded.personaName || `Steam #${String(decoded.steamId).slice(-6)}`),
      avatarUrl: String(decoded.avatarUrl || ''),
      profileUrl: String(decoded.profileUrl || `https://steamcommunity.com/profiles/${decoded.steamId}`),
    };
  } catch {
    return null;
  }
}

function extractSessionProfile(req: Request): SteamPlayerProfile | null {
  // 1. Prefer Bearer token header (works in cross-origin iframes even when 3P cookies are blocked)
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.slice(7).trim();
    const fromBearer = verifySignedToken(bearerToken);
    if (fromBearer) return fromBearer;
  }

  // 2. Fallback to cookie header
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const cookies: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      try {
        cookies[k] = decodeURIComponent(v);
      } catch {
        cookies[k] = v;
      }
    }
  }

  return verifySignedToken(cookies[SESSION_COOKIE_NAME]);
}

function extractXmlTag(xml: string, tag: string): string | null {
  const cdataRegex = new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch && cdataMatch[1]) {
    return cdataMatch[1].trim();
  }
  const plainRegex = new RegExp(`<${tag}>([^<]*)<\\/${tag}>`, 'i');
  const plainMatch = xml.match(plainRegex);
  if (plainMatch && plainMatch[1]) {
    return plainMatch[1].trim();
  }
  return null;
}

async function fetchSteamProfile(steamId: string): Promise<SteamPlayerProfile> {
  const fallbackProfileUrl = `https://steamcommunity.com/profiles/${steamId}`;
  const steamApiKey = process.env.STEAM_API_KEY?.trim();

  // 1. Official Steam Web API (when STEAM_API_KEY is configured)
  if (steamApiKey) {
    try {
      const apiUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${encodeURIComponent(
        steamApiKey
      )}&steamids=${encodeURIComponent(steamId)}`;
      const resp = await fetch(apiUrl, { signal: AbortSignal.timeout(7000) });
      if (resp.ok) {
        const data = (await resp.json()) as {
          response?: {
            players?: Array<{
              personaname?: string;
              avatarfull?: string;
              avatarmedium?: string;
              profileurl?: string;
            }>;
          };
        };
        const player = data.response?.players?.[0];
        if (player) {
          return {
            steamId,
            personaName: player.personaname || `Steam #${steamId.slice(-6)}`,
            avatarUrl: player.avatarfull || player.avatarmedium || '',
            profileUrl: player.profileurl || fallbackProfileUrl,
          };
        }
      }
    } catch (err) {
      console.warn('[Steam Auth] Steam Web API fetch failed, trying XML profile fallback:', err);
    }
  }

  // 2. Public Steam Community XML feed fallback (works without STEAM_API_KEY for public profiles)
  try {
    const xmlResp = await fetch(`https://steamcommunity.com/profiles/${encodeURIComponent(steamId)}/?xml=1`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NovaBlast/1.0',
        Accept: 'application/xml,text/xml,*/*',
      },
      signal: AbortSignal.timeout(7000),
    });
    if (xmlResp.ok) {
      const xmlText = await xmlResp.text();
      const personaName = extractXmlTag(xmlText, 'steamID');
      const avatarFull = extractXmlTag(xmlText, 'avatarFull') || extractXmlTag(xmlText, 'avatarMedium');
      if (personaName) {
        return {
          steamId,
          personaName,
          avatarUrl: avatarFull || '',
          profileUrl: fallbackProfileUrl,
        };
      }
    }
  } catch (err) {
    console.warn('[Steam Auth] Public XML profile fallback failed:', err);
  }

  return {
    steamId,
    personaName: `Steam #${steamId.slice(-6)}`,
    avatarUrl: '',
    profileUrl: fallbackProfileUrl,
  };
}

async function resolveSteamProfileInput(rawInput: string): Promise<SteamPlayerProfile | null> {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  const idMatch = trimmed.match(/steamcommunity\.com\/id\/([^\/\?#]+)/i);
  const profilesMatch = trimmed.match(/steamcommunity\.com\/profiles\/(\d{17,25})/i);

  let steamId = '';
  let vanity = '';

  if (profilesMatch) {
    steamId = profilesMatch[1];
  } else if (idMatch) {
    vanity = idMatch[1];
  } else if (/^\d{17,25}$/.test(trimmed)) {
    steamId = trimmed;
  } else {
    vanity = trimmed.replace(/^@/, '').replace(/\/+$/, '');
  }

  // 1. If steamId is direct
  if (steamId) {
    return await fetchSteamProfile(steamId);
  }

  // 2. If vanity name or custom URL
  if (vanity) {
    // Try public XML for vanity
    try {
      const xmlResp = await fetch(`https://steamcommunity.com/id/${encodeURIComponent(vanity)}/?xml=1`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NovaBlast/1.0',
          Accept: 'application/xml,text/xml,*/*',
        },
        signal: AbortSignal.timeout(7000),
      });
      if (xmlResp.ok) {
        const xmlText = await xmlResp.text();
        const personaName = extractXmlTag(xmlText, 'steamID');
        const resolvedId = extractXmlTag(xmlText, 'steamID64');
        const avatarFull = extractXmlTag(xmlText, 'avatarFull') || extractXmlTag(xmlText, 'avatarMedium');
        if (personaName && resolvedId) {
          return {
            steamId: resolvedId,
            personaName,
            avatarUrl: avatarFull || '',
            profileUrl: `https://steamcommunity.com/id/${vanity}`,
          };
        }
      }
    } catch (err) {
      console.warn('[Steam Auth] Public vanity XML resolution failed:', err);
    }

    // Try Steam Web API if key present
    const steamApiKey = process.env.STEAM_API_KEY?.trim();
    if (steamApiKey) {
      try {
        const rUrl = `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key=${encodeURIComponent(
          steamApiKey
        )}&vanityurl=${encodeURIComponent(vanity)}`;
        const rResp = await fetch(rUrl, { signal: AbortSignal.timeout(7000) });
        if (rResp.ok) {
          const rData = (await rResp.json()) as { response?: { success?: number; steamid?: string } };
          if (rData.response?.success === 1 && rData.response.steamid) {
            return await fetchSteamProfile(rData.response.steamid);
          }
        }
      } catch (err) {
        console.warn('[Steam Auth] ResolveVanityURL failed:', err);
      }
    }
  }

  return null;
}

async function verifySteamOpenIdAssertion(queryObj: Request['query']): Promise<boolean> {
  const buildParams = (fixPlusInBase64: boolean) => {
    const params = new URLSearchParams();
    for (const [key, rawValue] of Object.entries(queryObj)) {
      if (!key.startsWith('openid.')) continue;
      const val = Array.isArray(rawValue) ? String(rawValue[0] ?? '') : typeof rawValue === 'string' ? rawValue : '';
      if (!val) continue;

      if (
        fixPlusInBase64 &&
        (key === 'openid.sig' || key === 'openid.assoc_handle' || key === 'openid.response_nonce') &&
        val.includes(' ')
      ) {
        params.set(key, val.replace(/ /g, '+'));
      } else {
        params.set(key, val);
      }
    }
    params.set('openid.mode', 'check_authentication');
    return params;
  };

  const postCheck = async (params: URLSearchParams): Promise<boolean> => {
    const resp = await fetch('https://steamcommunity.com/openid/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NovaBlast/1.0',
        Accept: 'text/plain,*/*',
      },
      body: params.toString(),
      signal: AbortSignal.timeout(10000),
    });
    const text = await resp.text();
    return /is_valid\s*:\s*true/i.test(text);
  };

  if (await postCheck(buildParams(false))) {
    return true;
  }

  // Retry once if an intermediate auth proxy decoded '%2B' to '+' -> ' ' in Base64 fields
  const sig = String(queryObj['openid.sig'] || '');
  const handle = String(queryObj['openid.assoc_handle'] || '');
  const nonce = String(queryObj['openid.response_nonce'] || '');
  if (sig.includes(' ') || handle.includes(' ') || nonce.includes(' ')) {
    console.warn('[Steam Auth] Retrying OpenID verification with restored Base64 plus signs');
    return postCheck(buildParams(true));
  }

  return false;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderPopupCallbackHtml(
  payload: Record<string, unknown>,
  statusTitle: string,
  statusSubtitle: string,
  isSuccess: boolean,
  avatarUrl?: string
): string {
  const safeJson = JSON.stringify(payload).replace(/</g, '\\u003c');
  const accentColor = isSuccess ? '#66c0f4' : '#fb7185';
  const borderColor = isSuccess ? 'rgba(102, 192, 244, 0.4)' : 'rgba(251, 113, 133, 0.4)';
  const avatarHtml =
    isSuccess && avatarUrl
      ? `<img src="${escapeHtml(avatarUrl)}" alt="Steam Avatar" class="avatar" referrerpolicy="no-referrer" />`
      : `<div class="badge">${isSuccess ? '✓' : '!'}</div>`;

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NovaBlast — Steam Auth</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at 50% 20%, #1b2838 0%, #0f172a 65%, #020617 100%);
      color: #f8fafc;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      text-align: center;
      padding: 24px;
    }
    .card {
      background: rgba(15, 23, 42, 0.92);
      border: 1px solid ${borderColor};
      border-radius: 20px;
      padding: 32px 28px;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65);
    }
    .avatar {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      border: 2px solid #66c0f4;
      margin: 0 auto 16px;
      display: block;
      box-shadow: 0 0 24px rgba(102, 192, 244, 0.35);
    }
    .badge {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      margin: 0 auto 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 26px;
      font-weight: bold;
      color: ${accentColor};
      border: 2px solid ${borderColor};
      background: rgba(255, 255, 255, 0.04);
    }
    h2 {
      margin: 0 0 10px;
      font-size: 18px;
      color: ${accentColor};
      word-break: break-word;
    }
    p {
      margin: 0 0 20px;
      font-size: 13px;
      color: #cbd5e1;
      line-height: 1.55;
    }
    button {
      width: 100%;
      padding: 12px 18px;
      border-radius: 12px;
      border: 1px solid ${borderColor};
      background: #1b2838;
      color: #f8fafc;
      font-family: inherit;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    button:hover {
      background: #2a475e;
    }
  </style>
</head>
<body>
  <div class="card">
    ${avatarHtml}
    <h2>${escapeHtml(statusTitle)}</h2>
    <p>${escapeHtml(statusSubtitle)}</p>
    <button type="button" onclick="window.close()">Закрыть окно</button>
  </div>
  <script>
    (function() {
      var data = ${safeJson};
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(data, '*');
        }
      } catch (e) {}
      try {
        if (typeof localStorage !== 'undefined') {
          var serialized = JSON.stringify(Object.assign({}, data, { _ts: Date.now() }));
          localStorage.setItem('novablast_oauth_bridge', serialized);
          if (data.loginId) {
            localStorage.setItem('novablast_oauth_bridge_' + data.loginId, serialized);
          }
        }
      } catch (e) {}
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          try {
            var bcSteam = new BroadcastChannel('novablast_steam_auth');
            bcSteam.postMessage(data);
            setTimeout(function() { bcSteam.close(); }, 500);
          } catch (e1) {}
          try {
            var bcGithub = new BroadcastChannel('novablast_github_auth');
            bcGithub.postMessage(data);
            setTimeout(function() { bcGithub.close(); }, 500);
          } catch (e2) {}
          try {
            var bcX = new BroadcastChannel('novablast_x_auth');
            bcX.postMessage(data);
            setTimeout(function() { bcX.close(); }, 500);
          } catch (e3) {}
        }
      } catch (e) {}
      setTimeout(function() {
        try { window.close(); } catch (e) {}
      }, 250);
    })();
  </script>
</body>
</html>`;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // 1. Construct Steam OpenID 2.0 Authorization URL
  app.get('/api/auth/steam/url', (req: Request, res: Response) => {
    cleanupExpiredPendingLogins();
    const baseUrl = resolveBaseUrl(req);
    const rawLoginId = typeof req.query.loginId === 'string' ? req.query.loginId.trim() : '';
    const loginId = /^[a-zA-Z0-9_-]{8,80}$/.test(rawLoginId) ? rawLoginId : crypto.randomUUID();

    pendingSteamLogins.set(loginId, {
      status: 'pending',
      createdAt: Date.now(),
    });

    const callbackUrl = `${baseUrl}/auth/steam/callback/${loginId}`;

    const params = new URLSearchParams({
      'openid.ns': 'http://specs.openid.net/auth/2.0',
      'openid.mode': 'checkid_setup',
      'openid.return_to': callbackUrl,
      'openid.realm': baseUrl,
      'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
      'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
    });

    const url = `https://steamcommunity.com/openid/login?${params.toString()}`;
    res.setHeader('Cache-Control', 'no-store');
    res.json({ url, callbackUrl, loginId });
  });

  // 1a. Official Steam QR Code Session Start
  app.post('/api/auth/steam/qr/begin', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const resp = await fetch('https://api.steampowered.com/IAuthenticationService/BeginAuthSessionViaQR/v1/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ device_friendly_name: 'NovaBlast App' }).toString(),
        signal: AbortSignal.timeout(8000),
      });

      if (!resp.ok) {
        throw new Error(`Steam QR API returned ${resp.status}`);
      }

      const data = (await resp.json()) as {
        response?: {
          client_id?: string;
          challenge_url?: string;
          request_id?: string;
          interval?: number;
        };
      };

      const r = data.response;
      if (!r?.client_id || !r?.challenge_url || !r?.request_id) {
        throw new Error('Invalid response from Steam QR API');
      }

      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(
        r.challenge_url
      )}`;

      res.json({
        success: true,
        clientId: r.client_id,
        requestId: r.request_id,
        challengeUrl: r.challenge_url,
        qrImageUrl,
        interval: r.interval || 4,
      });
    } catch (err: any) {
      console.error('[Steam Auth] QR session start error:', err);
      res.status(500).json({ success: false, error: 'Не удалось начать QR-авторизацию Steam.' });
    }
  });

  // 1b. Official Steam QR Code Session Poll
  app.post('/api/auth/steam/qr/poll', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const clientId = typeof req.body.clientId === 'string' ? req.body.clientId.trim() : '';
    const requestId = typeof req.body.requestId === 'string' ? req.body.requestId.trim() : '';

    if (!clientId || !requestId) {
      res.status(400).json({ authenticated: false, error: 'Отсутствует clientId или requestId' });
      return;
    }

    try {
      const resp = await fetch('https://api.steampowered.com/IAuthenticationService/PollAuthSessionStatus/v1/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: clientId, request_id: requestId }).toString(),
        signal: AbortSignal.timeout(8000),
      });

      if (!resp.ok) {
        res.json({ authenticated: false, status: 'pending' });
        return;
      }

      const data = (await resp.json()) as {
        response?: {
          steamid?: string;
          account_name?: string;
          had_remote_interaction?: boolean;
        };
      };

      const r = data.response;
      if (!r?.steamid) {
        res.json({ authenticated: false, status: 'pending', hadRemoteInteraction: Boolean(r?.had_remote_interaction) });
        return;
      }

      const steamId = r.steamid;
      const steamProfile = await fetchSteamProfile(steamId);
      const signedSession = signSessionPayload(steamProfile);

      const forwardedProto = req.headers['x-forwarded-proto'];
      const isHttps =
        req.secure ||
        (typeof forwardedProto === 'string' && forwardedProto.includes('https')) ||
        Boolean(process.env.APP_URL?.startsWith('https://'));

      res.cookie(SESSION_COOKIE_NAME, signedSession, {
        httpOnly: true,
        secure: isHttps,
        sameSite: isHttps ? 'none' : 'lax',
        partitioned: isHttps,
        maxAge: SESSION_MAX_AGE_SECONDS * 1000,
        path: '/',
      });

      let customToken: string | null = null;
      const adminAuth = getFirebaseAdmin();
      if (adminAuth) {
        try {
          customToken = await adminAuth.createCustomToken(`steam_${steamId}`, {
            steamId,
            provider: 'steam',
            personaName: steamProfile.personaName,
          });
        } catch (tokenErr) {
          console.error('[Steam Auth] QR custom token error:', tokenErr);
        }
      }

      console.log('[Steam Auth] QR Authentication success:', {
        steamId,
        personaName: steamProfile.personaName,
      });

      res.json({
        authenticated: true,
        status: 'authenticated',
        steamProfile,
        customToken,
        sessionToken: signedSession,
        firebaseCustomAuthReady: Boolean(customToken),
      });
    } catch (err: any) {
      console.error('[Steam Auth] QR poll error:', err);
      res.status(500).json({ authenticated: false, error: 'Ошибка опроса сессии Steam QR.' });
    }
  });

  // 1b. Steam OpenID Popup Start Bridge (Pre-authenticates popup in Cloud Run before redirecting to Steam)
  const steamStartHandler = (req: Request, res: Response) => {
    cleanupExpiredPendingLogins();
    const baseUrl = resolveBaseUrl(req);
    const rawLoginId =
      (typeof req.params.loginId === 'string' ? req.params.loginId : '') ||
      (typeof req.query.loginId === 'string' ? req.query.loginId : '');
    const loginId = /^[a-zA-Z0-9_-]{8,80}$/.test(rawLoginId.trim()) ? rawLoginId.trim() : crypto.randomUUID();

    pendingSteamLogins.set(loginId, {
      status: 'pending',
      createdAt: Date.now(),
    });

    const callbackUrl = `${baseUrl}/auth/steam/callback/${loginId}`;
    const params = new URLSearchParams({
      'openid.ns': 'http://specs.openid.net/auth/2.0',
      'openid.mode': 'checkid_setup',
      'openid.return_to': callbackUrl,
      'openid.realm': baseUrl,
      'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
      'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
    });

    const steamAuthUrl = `https://steamcommunity.com/openid/login?${params.toString()}`;
    const safeUrlJson = JSON.stringify(steamAuthUrl).replace(/</g, '\\u003c');

    res.setHeader('Cache-Control', 'no-store');
    res.send(`<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NovaBlast — Переход на Steam</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at 50% 20%, #1b2838 0%, #0f172a 65%, #020617 100%);
      color: #f8fafc;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      text-align: center;
      padding: 24px;
    }
    .card {
      background: rgba(15, 23, 42, 0.92);
      border: 1px solid rgba(102, 192, 244, 0.4);
      border-radius: 20px;
      padding: 32px 28px;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65);
    }
    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid rgba(102, 192, 244, 0.2);
      border-top-color: #66c0f4;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h2 { margin: 0 0 10px; font-size: 18px; color: #66c0f4; }
    p { margin: 0; font-size: 13px; color: #cbd5e1; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h2>Переход на сайт Steam...</h2>
    <p>Пожалуйста, подождите. Открывается официальная страница входа Steam.</p>
  </div>
  <script>
    (function() {
      var targetUrl = ${safeUrlJson};
      setTimeout(function() {
        window.location.href = targetUrl;
      }, 50);
    })();
  </script>
</body>
</html>`);
  };

  app.get('/auth/steam/start/:loginId', steamStartHandler);
  app.get('/auth/steam/start', steamStartHandler);
  app.get('/api/auth/steam/start/:loginId', steamStartHandler);
  app.get('/api/auth/steam/start', steamStartHandler);

  // 2. Poll pending Steam login by loginId (works across COOP-severed popups & 3P-cookie-blocked iframes)
  const steamPollHandler = (req: Request, res: Response) => {
    cleanupExpiredPendingLogins();
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    const rawId =
      (typeof req.params.loginId === 'string' ? req.params.loginId : '') ||
      (typeof req.query.loginId === 'string' ? req.query.loginId : '');
    const loginId = rawId.trim();

    if (!loginId || !/^[a-zA-Z0-9_-]{8,80}$/.test(loginId)) {
      res.status(400).json({ status: 'error', error: 'Invalid loginId' });
      return;
    }

    const record = pendingSteamLogins.get(loginId);
    if (!record || record.status === 'pending') {
      res.json({ status: 'pending' });
      return;
    }

    // Consume terminal state once delivered so tokens aren't left around unnecessarily
    pendingSteamLogins.delete(loginId);

    if (record.status === 'error') {
      res.json({
        status: 'error',
        error: record.error || 'Вход через Steam был отменён или завершился ошибкой.',
      });
      return;
    }

    res.json({
      status: 'authenticated',
      steamProfile: record.steamProfile,
      customToken: record.customToken || null,
      sessionToken: record.sessionToken || null,
      firebaseCustomAuthReady: Boolean(record.customToken),
    });
  };

  app.get('/api/auth/steam/poll/:loginId', steamPollHandler);
  app.get('/api/auth/steam/poll', steamPollHandler);

  // 3. Steam OpenID 2.0 Callback Handler (supports path loginId, query loginId, and trailing slashes)
  const steamCallbackHandler = async (req: Request, res: Response) => {
    cleanupExpiredPendingLogins();
    const rawLoginId =
      (typeof req.params.loginId === 'string' ? req.params.loginId : '') ||
      (typeof req.query.loginId === 'string' ? req.query.loginId : '');
    const loginId = /^[a-zA-Z0-9_-]{8,80}$/.test(rawLoginId.trim()) ? rawLoginId.trim() : '';

    try {
      const mode = req.query['openid.mode'];
      console.log('[Steam Auth] Callback hit:', { mode, hasLoginId: Boolean(loginId) });

      if (mode !== 'id_res') {
        const cancelMsg = 'Вход через Steam был отменён.';
        if (loginId) {
          pendingSteamLogins.set(loginId, {
            status: 'error',
            error: cancelMsg,
            createdAt: Date.now(),
          });
        }
        res.status(400).send(
          renderPopupCallbackHtml(
            { type: 'STEAM_AUTH_ERROR', loginId, error: cancelMsg },
            'Вход отменён',
            'Вы можете закрыть это окно и вернуться в NovaBlast.',
            false
          )
        );
        return;
      }

      const isValid = await verifySteamOpenIdAssertion(req.query);
      if (!isValid) {
        const invalidMsg = 'Не удалось подтвердить подпись ответа Steam OpenID.';
        console.error('[Steam Auth] OpenID check_authentication returned false');
        if (loginId) {
          pendingSteamLogins.set(loginId, {
            status: 'error',
            error: invalidMsg,
            createdAt: Date.now(),
          });
        }
        res.status(401).send(
          renderPopupCallbackHtml(
            { type: 'STEAM_AUTH_ERROR', loginId, error: invalidMsg },
            'Ошибка проверки Steam',
            'Подпись ответа не прошла валидацию. Закройте окно и попробуйте войти снова.',
            false
          )
        );
        return;
      }

      const claimedId = String(req.query['openid.claimed_id'] || '');
      const idMatch = claimedId.match(/^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17,25})$/);
      if (!idMatch) {
        const formatMsg = 'Некорректный формат идентификатора SteamID.';
        if (loginId) {
          pendingSteamLogins.set(loginId, {
            status: 'error',
            error: formatMsg,
            createdAt: Date.now(),
          });
        }
        res.status(400).send(
          renderPopupCallbackHtml(
            { type: 'STEAM_AUTH_ERROR', loginId, error: formatMsg },
            'Ошибка SteamID',
            'Не удалось извлечь идентификатор профиля Steam.',
            false
          )
        );
        return;
      }

      const steamId = idMatch[1];
      const steamProfile = await fetchSteamProfile(steamId);
      const signedSession = signSessionPayload(steamProfile);

      // Set cross-origin iframe-compatible cookie as secondary persistence layer
      const forwardedProto = req.headers['x-forwarded-proto'];
      const isHttps =
        req.secure ||
        (typeof forwardedProto === 'string' && forwardedProto.includes('https')) ||
        Boolean(process.env.APP_URL?.startsWith('https://'));

      res.cookie(SESSION_COOKIE_NAME, signedSession, {
        httpOnly: true,
        secure: isHttps,
        sameSite: isHttps ? 'none' : 'lax',
        partitioned: isHttps,
        maxAge: SESSION_MAX_AGE_SECONDS * 1000,
        path: '/',
      });

      // Mint Firebase Custom Token if Firebase Admin Service Account is configured
      let customToken: string | null = null;
      const adminAuth = getFirebaseAdmin();
      if (adminAuth) {
        try {
          customToken = await adminAuth.createCustomToken(`steam_${steamId}`, {
            steamId,
            provider: 'steam',
            personaName: steamProfile.personaName,
          });
        } catch (tokenErr) {
          console.error('[Steam Auth] Failed to create Firebase Custom Token:', tokenErr);
        }
      }

      if (loginId) {
        pendingSteamLogins.set(loginId, {
          status: 'authenticated',
          steamProfile,
          customToken,
          sessionToken: signedSession,
          createdAt: Date.now(),
        });
      }

      console.log('[Steam Auth] Authenticated player:', {
        steamId,
        personaName: steamProfile.personaName,
        hasCustomToken: Boolean(customToken),
        hasLoginId: Boolean(loginId),
      });

      res.send(
        renderPopupCallbackHtml(
          {
            type: 'STEAM_AUTH_SUCCESS',
            loginId,
            customToken,
            sessionToken: signedSession,
            steamProfile,
            firebaseCustomAuthReady: Boolean(customToken),
          },
          `Привет, ${steamProfile.personaName}!`,
          'Вход через Steam выполнен! Вернитесь на вкладку с NovaBlast — это окно можно закрыть.',
          true,
          steamProfile.avatarUrl
        )
      );
    } catch (err) {
      console.error('[Steam Auth] Callback error:', err);
      const serverErrMsg = 'Внутренняя ошибка сервера при проверке входа Steam.';
      if (loginId) {
        pendingSteamLogins.set(loginId, {
          status: 'error',
          error: serverErrMsg,
          createdAt: Date.now(),
        });
      }
      res.status(500).send(
        renderPopupCallbackHtml(
          { type: 'STEAM_AUTH_ERROR', loginId, error: serverErrMsg },
          'Ошибка авторизации',
          'Попробуйте закрыть это окно и повторить вход.',
          false
        )
      );
    }
  };

  app.get('/auth/steam/callback/:loginId', steamCallbackHandler);
  app.get('/auth/steam/callback/:loginId/', steamCallbackHandler);
  app.get('/auth/steam/callback', steamCallbackHandler);
  app.get('/auth/steam/callback/', steamCallbackHandler);
  app.get('/api/auth/steam/callback/:loginId', steamCallbackHandler);
  app.get('/api/auth/steam/callback/:loginId/', steamCallbackHandler);
  app.get('/api/auth/steam/callback', steamCallbackHandler);
  app.get('/api/auth/steam/callback/', steamCallbackHandler);

  // 3b. Manual Steam OpenID Completion (when popup ends on Google 403 page, user can paste URL from that window)
  app.post('/api/auth/steam/manual-callback', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const rawInput = typeof req.body.url === 'string' ? req.body.url.trim() : '';
    if (!rawInput) {
      res.status(400).json({ authenticated: false, error: 'Вставьте ссылку из окна с ошибкой 403' });
      return;
    }

    try {
      let text = rawInput;
      for (let i = 0; i < 3; i++) {
        if (
          text.includes('%20') ||
          text.includes('%3A') ||
          text.includes('%2F') ||
          text.includes('%3F') ||
          text.includes('%3D')
        ) {
          try {
            text = decodeURIComponent(text);
          } catch {
            break;
          }
        }
      }

      const paramsObj: Record<string, string> = {};
      const regex = /openid\.([a-zA-Z0-9_\.]+)=([^& \n\r\t]+)/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        const key = `openid.${match[1]}`;
        let val = match[2];
        try {
          val = decodeURIComponent(val);
        } catch {}
        paramsObj[key] = val;
      }

      try {
        const url = new URL(rawInput);
        for (const [k, v] of url.searchParams.entries()) {
          if (k.startsWith('openid.')) paramsObj[k] = v;
        }
        const returnUrl = url.searchParams.get('return_url');
        if (returnUrl) {
          try {
            const nestedUrl = new URL(returnUrl);
            for (const [k, v] of nestedUrl.searchParams.entries()) {
              if (k.startsWith('openid.')) paramsObj[k] = v;
            }
          } catch {}
        }
      } catch {}

      if (!paramsObj['openid.claimed_id'] || !paramsObj['openid.sig']) {
        res.status(400).json({
          authenticated: false,
          error:
            'В указанной ссылке не найдены параметры авторизации Steam. Убедитесь, что скопировали всю адресную строку из окна после нажатия Sign In в Steam.',
        });
        return;
      }

      const isValid = await verifySteamOpenIdAssertion(paramsObj);
      if (!isValid) {
        res.status(401).json({
          authenticated: false,
          error: 'Подпись ответа Steam не прошла валидацию на серверах Valve.',
        });
        return;
      }

      const claimedId = String(paramsObj['openid.claimed_id'] || '');
      const idMatch = claimedId.match(/^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17,25})$/);
      if (!idMatch) {
        res.status(400).json({ authenticated: false, error: 'Некорректный SteamID в ответе.' });
        return;
      }

      const steamId = idMatch[1];
      const steamProfile = await fetchSteamProfile(steamId);
      const signedSession = signSessionPayload(steamProfile);

      const forwardedProto = req.headers['x-forwarded-proto'];
      const isHttps =
        req.secure ||
        (typeof forwardedProto === 'string' && forwardedProto.includes('https')) ||
        Boolean(process.env.APP_URL?.startsWith('https://'));

      res.cookie(SESSION_COOKIE_NAME, signedSession, {
        httpOnly: true,
        secure: isHttps,
        sameSite: isHttps ? 'none' : 'lax',
        partitioned: isHttps,
        maxAge: SESSION_MAX_AGE_SECONDS * 1000,
        path: '/',
      });

      let customToken: string | null = null;
      const adminAuth = getFirebaseAdmin();
      if (adminAuth) {
        try {
          customToken = await adminAuth.createCustomToken(`steam_${steamId}`, {
            steamId,
            provider: 'steam',
            personaName: steamProfile.personaName,
          });
        } catch (tokenErr) {
          console.error('[Steam Auth] Manual callback custom token error:', tokenErr);
        }
      }

      console.log('[Steam Auth] Manual callback success:', {
        steamId,
        personaName: steamProfile.personaName,
      });

      res.json({
        authenticated: true,
        steamProfile,
        customToken,
        sessionToken: signedSession,
        firebaseCustomAuthReady: Boolean(customToken),
      });
    } catch (err: any) {
      console.error('[Steam Auth] Manual callback error:', err);
      res.status(500).json({ authenticated: false, error: 'Внутренняя ошибка сервера при обработке ссылки Steam.' });
    }
  });

  // 4. Check current verified Steam session (via Bearer token or cookie)
  app.get('/api/auth/steam/session', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const profile = extractSessionProfile(req);
    if (!profile) {
      res.json({ authenticated: false });
      return;
    }

    let customToken: string | null = null;
    const adminAuth = getFirebaseAdmin();
    if (adminAuth) {
      try {
        customToken = await adminAuth.createCustomToken(`steam_${profile.steamId}`, {
          steamId: profile.steamId,
          provider: 'steam',
          personaName: profile.personaName,
        });
      } catch (err) {
        console.error('[Steam Auth] Session custom token error:', err);
      }
    }

    res.json({
      authenticated: true,
      steamProfile: profile,
      customToken,
      sessionToken: signSessionPayload(profile),
      firebaseCustomAuthReady: Boolean(customToken),
    });
  });

  // 5. Logout from Steam server session
  app.post('/api/auth/steam/logout', (req: Request, res: Response) => {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const isHttps =
      req.secure ||
      (typeof forwardedProto === 'string' && forwardedProto.includes('https')) ||
      Boolean(process.env.APP_URL?.startsWith('https://'));

    for (const cookieName of [SESSION_COOKIE_NAME, GITHUB_COOKIE_NAME, X_COOKIE_NAME]) {
      res.clearCookie(cookieName, {
        httpOnly: true,
        secure: isHttps,
        sameSite: isHttps ? 'none' : 'lax',
        partitioned: isHttps,
        path: '/',
      });
      res.clearCookie(cookieName, {
        httpOnly: true,
        secure: isHttps,
        sameSite: isHttps ? 'none' : 'lax',
        path: '/',
      });
    }
    res.json({ ok: true });
  });

  // 5a. Generate Steam Ownership Verification Challenge (Proof of Account Ownership)
  app.post('/api/auth/steam/challenge', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    cleanupExpiredPendingLogins();
    const query = typeof req.body.query === 'string' ? req.body.query.trim() : '';
    if (!query) {
      res.status(400).json({ success: false, error: 'Укажите никнейм, ссылку на профиль или SteamID.' });
      return;
    }
    try {
      const profile = await resolveSteamProfileInput(query);
      if (!profile) {
        res.status(404).json({
          success: false,
          error: 'Профиль Steam не найден. Убедитесь, что ник или ссылка верны, а профиль открыт для сообщества.',
        });
        return;
      }

      // Generate a secure one-time challenge code, e.g. NOVA-7B9F
      const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
      const challengeCode = `NOVA-${randomHex}`;
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      pendingSteamChallenges.set(profile.steamId, {
        code: challengeCode,
        steamProfile: profile,
        expiresAt,
      });

      console.log('[Steam Auth] Generated ownership challenge:', {
        steamId: profile.steamId,
        personaName: profile.personaName,
        code: challengeCode,
      });

      res.json({
        success: true,
        profile,
        challengeCode,
        expiresAt,
      });
    } catch (err: any) {
      console.error('[Steam Auth] Challenge generation error:', err);
      res.status(500).json({ success: false, error: 'Ошибка сервера при поиске профиля Steam.' });
    }
  });

  // 5b. Verify Steam Profile Ownership via Live Profile Challenge Code
  app.post('/api/auth/steam/verify-challenge', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    cleanupExpiredPendingLogins();

    const steamId = typeof req.body.steamId === 'string' ? req.body.steamId.trim() : '';
    const inputCode = typeof req.body.challengeCode === 'string' ? req.body.challengeCode.trim() : '';

    if (!steamId || !inputCode) {
      res.status(400).json({ authenticated: false, error: 'Не указан SteamID или проверочный код.' });
      return;
    }

    const record = pendingSteamChallenges.get(steamId);
    if (!record || Date.now() > record.expiresAt) {
      res.status(400).json({
        authenticated: false,
        error: 'Срок действия кода проверки истек или запрос не найден. Запросите новый код.',
      });
      return;
    }

    const normExpected = record.code.toUpperCase();
    const normInput = inputCode.toUpperCase();
    const rawPart = record.code.split('-')[1] || '';
    if (normInput !== normExpected && !normInput.endsWith(rawPart)) {
      res.status(400).json({ authenticated: false, error: 'Введен неверный проверочный код.' });
      return;
    }

    try {
      // Fetch live Steam XML with cache-busting timestamp
      let liveXml = '';
      const xmlUrl = `https://steamcommunity.com/profiles/${encodeURIComponent(steamId)}/?xml=1&_t=${Date.now()}`;
      try {
        const xmlResp = await fetch(xmlUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NovaBlast/1.0',
            Accept: 'application/xml,text/xml,*/*',
            'Cache-Control': 'no-cache, no-store',
          },
          signal: AbortSignal.timeout(8000),
        });
        if (xmlResp.ok) {
          liveXml = await xmlResp.text();
        }
      } catch (xmlErr) {
        console.warn('[Steam Auth] Could not fetch live XML for verification:', xmlErr);
      }

      const summary = (extractXmlTag(liveXml, 'summary') || '').toLowerCase();
      const realname = (extractXmlTag(liveXml, 'realname') || '').toLowerCase();
      const headline = (extractXmlTag(liveXml, 'headline') || '').toLowerCase();
      const stateMessage = (extractXmlTag(liveXml, 'stateMessage') || '').toLowerCase();

      const expectedCodeLower = record.code.toLowerCase();
      const rawPartLower = rawPart.toLowerCase();

      let isMatch =
        summary.includes(expectedCodeLower) ||
        realname.includes(expectedCodeLower) ||
        headline.includes(expectedCodeLower) ||
        stateMessage.includes(expectedCodeLower) ||
        (rawPartLower.length >= 4 &&
          (summary.includes(rawPartLower) ||
            realname.includes(rawPartLower) ||
            headline.includes(rawPartLower))) ||
        liveXml.toLowerCase().includes(expectedCodeLower);

      // If not matched yet, check vanity profile URL XML if available
      if (!isMatch) {
        const customUrl = extractXmlTag(liveXml, 'customURL');
        if (customUrl) {
          try {
            const vanityUrl = `https://steamcommunity.com/id/${encodeURIComponent(customUrl)}/?xml=1&_t=${Date.now()}`;
            const vanityResp = await fetch(vanityUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NovaBlast/1.0',
                Accept: 'application/xml,text/xml,*/*',
                'Cache-Control': 'no-cache, no-store',
              },
              signal: AbortSignal.timeout(8000),
            });
            if (vanityResp.ok) {
              const vanityXml = await vanityResp.text();
              const vSummary = (extractXmlTag(vanityXml, 'summary') || '').toLowerCase();
              const vRealname = (extractXmlTag(vanityXml, 'realname') || '').toLowerCase();
              isMatch =
                vSummary.includes(expectedCodeLower) ||
                vRealname.includes(expectedCodeLower) ||
                (rawPartLower.length >= 4 && (vSummary.includes(rawPartLower) || vRealname.includes(rawPartLower))) ||
                vanityXml.toLowerCase().includes(expectedCodeLower);
            }
          } catch {}
        }
      }

      if (!isMatch) {
        res.status(400).json({
          authenticated: false,
          error: `Код «${record.code}» не найден в описании профиля («О себе»), настоящем имени или статусе Steam. Убедитесь, что вы сохранили изменения в настройках профиля Steam и профиль открыт для сообщества.`,
        });
        return;
      }

      // 100% Proven Ownership! Delete the one-time challenge
      pendingSteamChallenges.delete(steamId);

      // Fetch latest profile state (personaName, avatar)
      const freshProfile = await fetchSteamProfile(steamId);
      const signedSession = signSessionPayload(freshProfile);

      const forwardedProto = req.headers['x-forwarded-proto'];
      const isHttps =
        req.secure ||
        (typeof forwardedProto === 'string' && forwardedProto.includes('https')) ||
        Boolean(process.env.APP_URL?.startsWith('https://'));

      res.cookie(SESSION_COOKIE_NAME, signedSession, {
        httpOnly: true,
        secure: isHttps,
        sameSite: isHttps ? 'none' : 'lax',
        partitioned: isHttps,
        maxAge: SESSION_MAX_AGE_SECONDS * 1000,
        path: '/',
      });

      let customToken: string | null = null;
      const adminAuth = getFirebaseAdmin();
      if (adminAuth) {
        try {
          customToken = await adminAuth.createCustomToken(`steam_${freshProfile.steamId}`, {
            steamId: freshProfile.steamId,
            provider: 'steam',
            personaName: freshProfile.personaName,
          });
        } catch (tokenErr) {
          console.error('[Steam Auth] Challenge custom token error:', tokenErr);
        }
      }

      console.log('[Steam Auth] Ownership verified successfully for:', {
        steamId: freshProfile.steamId,
        personaName: freshProfile.personaName,
        code: record.code,
      });

      res.json({
        authenticated: true,
        steamProfile: freshProfile,
        customToken,
        sessionToken: signedSession,
        firebaseCustomAuthReady: Boolean(customToken),
      });
    } catch (err: any) {
      console.error('[Steam Auth] Verification error:', err);
      res.status(500).json({
        authenticated: false,
        error: 'Внутренняя ошибка сервера при проверке владения профилем Steam.',
      });
    }
  });

  // 6. GitHub OAuth 2.0 Endpoints
  app.get('/api/auth/github/url', (req: Request, res: Response) => {
    cleanupExpiredPendingLogins();
    const baseUrl = resolveBaseUrl(req);
    const clientId = (process.env.GITHUB_CLIENT_ID || process.env.CLIENT_ID || '').trim();
    const rawLoginId = typeof req.query.loginId === 'string' ? req.query.loginId.trim() : '';
    const loginId = /^[a-zA-Z0-9_-]{8,80}$/.test(rawLoginId) ? rawLoginId : crypto.randomUUID();

    const callbackUrl = `${baseUrl}/auth/github/callback`;

    if (!clientId) {
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        configured: false,
        error: 'GITHUB_CLIENT_ID is not configured',
        callbackUrl,
        loginId,
      });
      return;
    }

    pendingGitHubLogins.set(loginId, {
      status: 'pending',
      createdAt: Date.now(),
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      scope: 'read:user user:email',
      state: loginId,
      prompt: 'select_account',
      allow_signup: 'true',
    });

    const url = `https://github.com/login/oauth/authorize?${params.toString()}`;
    res.setHeader('Cache-Control', 'no-store');
    res.json({ url, callbackUrl, loginId, configured: true });
  });

  const githubPollHandler = (req: Request, res: Response) => {
    cleanupExpiredPendingLogins();
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    const rawId =
      (typeof req.params.loginId === 'string' ? req.params.loginId : '') ||
      (typeof req.query.loginId === 'string' ? req.query.loginId : '');
    const loginId = rawId.trim();

    if (!loginId || !/^[a-zA-Z0-9_-]{8,80}$/.test(loginId)) {
      res.status(400).json({ status: 'error', error: 'Invalid loginId' });
      return;
    }

    const record = pendingGitHubLogins.get(loginId);
    if (!record || record.status === 'pending') {
      res.json({ status: 'pending' });
      return;
    }

    pendingGitHubLogins.delete(loginId);

    if (record.status === 'error') {
      res.json({
        status: 'error',
        error: record.error || 'Вход через GitHub был отменён или завершился ошибкой.',
      });
      return;
    }

    res.json({
      status: 'authenticated',
      githubProfile: record.githubProfile,
      customToken: record.customToken || null,
      sessionToken: record.sessionToken || null,
      firebaseCustomAuthReady: Boolean(record.customToken),
    });
  };

  app.get('/api/auth/github/poll/:loginId', githubPollHandler);
  app.get('/api/auth/github/poll', githubPollHandler);

  const githubCallbackHandler = async (req: Request, res: Response) => {
    cleanupExpiredPendingLogins();
    const rawLoginId =
      (typeof req.params.loginId === 'string' ? req.params.loginId : '') ||
      (typeof req.query.state === 'string' ? req.query.state : '') ||
      (typeof req.query.loginId === 'string' ? req.query.loginId : '');
    const loginId = /^[a-zA-Z0-9_-]{8,80}$/.test(rawLoginId.trim()) ? rawLoginId.trim() : '';

    const errorParam = req.query.error;
    if (errorParam) {
      const cancelMsg = String(req.query.error_description || 'Вход через GitHub был отменён.');
      if (loginId) {
        pendingGitHubLogins.set(loginId, {
          status: 'error',
          error: cancelMsg,
          createdAt: Date.now(),
        });
      }
      res.status(400).send(
        renderPopupCallbackHtml(
          { type: 'GITHUB_AUTH_ERROR', loginId, error: cancelMsg },
          'Вход отменён',
          'Вы можете закрыть это окно и вернуться в NovaBlast.',
          false
        )
      );
      return;
    }

    const code = typeof req.query.code === 'string' ? req.query.code.trim() : '';
    if (!code) {
      res.status(400).send(
        renderPopupCallbackHtml(
          { type: 'GITHUB_AUTH_ERROR', loginId, error: 'Код авторизации не получен.' },
          'Ошибка GitHub',
          'Код авторизации не найден. Попробуйте войти снова.',
          false
        )
      );
      return;
    }

    const clientId = (process.env.GITHUB_CLIENT_ID || process.env.CLIENT_ID || '').trim();
    const clientSecret = (process.env.GITHUB_CLIENT_SECRET || process.env.CLIENT_SECRET || '').trim();

    if (!clientId || !clientSecret) {
      const configError = 'GITHUB_CLIENT_ID или GITHUB_CLIENT_SECRET не настроены на сервере.';
      if (loginId) {
        pendingGitHubLogins.set(loginId, {
          status: 'error',
          error: configError,
          createdAt: Date.now(),
        });
      }
      res.status(500).send(
        renderPopupCallbackHtml(
          { type: 'GITHUB_AUTH_ERROR', loginId, error: configError },
          'Ошибка конфигурации',
          configError,
          false
        )
      );
      return;
    }

    try {
      const tokenResp = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'NovaBlast-Pixel-Editor',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
        signal: AbortSignal.timeout(10000),
      });

      const tokenData = (await tokenResp.json()) as { access_token?: string; error?: string; error_description?: string };
      if (!tokenResp.ok || !tokenData.access_token) {
        throw new Error(tokenData.error_description || tokenData.error || 'Не удалось обменять код на токен.');
      }

      const accessToken = tokenData.access_token;

      const userResp = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'NovaBlast-Pixel-Editor',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!userResp.ok) {
        throw new Error(`Ошибка получения профиля GitHub: ${userResp.status}`);
      }

      const ghUser = (await userResp.json()) as {
        id: number;
        login: string;
        name?: string;
        avatar_url?: string;
        html_url?: string;
        email?: string;
      };

      let primaryEmail = ghUser.email || '';
      if (!primaryEmail) {
        try {
          const emailResp = await fetch('https://api.github.com/user/emails', {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/vnd.github.v3+json',
              'User-Agent': 'NovaBlast-Pixel-Editor',
            },
            signal: AbortSignal.timeout(5000),
          });
          if (emailResp.ok) {
            const emails = (await emailResp.json()) as { email: string; primary?: boolean; verified?: boolean }[];
            const primaryObj = emails.find(e => e.primary && e.verified) || emails.find(e => e.primary) || emails[0];
            if (primaryObj?.email) {
              primaryEmail = primaryObj.email;
            }
          }
        } catch {
          // Non-critical
        }
      }

      const githubProfile: GitHubUserProfile = {
        githubId: String(ghUser.id),
        login: ghUser.login,
        name: ghUser.name || ghUser.login,
        avatarUrl: ghUser.avatar_url || '',
        profileUrl: ghUser.html_url || `https://github.com/${ghUser.login}`,
        email: primaryEmail || undefined,
      };

      let customToken: string | null = null;
      const admin = getFirebaseAdmin();
      if (admin) {
        try {
          customToken = await admin.createCustomToken(`github_${githubProfile.githubId}`, {
            provider: 'github',
            githubId: githubProfile.githubId,
            login: githubProfile.login,
          });
        } catch (tokenErr) {
          console.error('[GitHub Auth] Failed to create custom token:', tokenErr);
        }
      }

      const sessionToken = signSessionPayload(githubProfile);

      if (loginId) {
        pendingGitHubLogins.set(loginId, {
          status: 'authenticated',
          githubProfile,
          customToken,
          sessionToken,
          createdAt: Date.now(),
        });
      }

      const ghForwardedProto = req.headers['x-forwarded-proto'];
      const ghIsHttps =
        req.secure ||
        (typeof ghForwardedProto === 'string' && ghForwardedProto.includes('https')) ||
        Boolean(process.env.APP_URL?.startsWith('https://'));

      res.cookie(GITHUB_COOKIE_NAME, sessionToken, {
        httpOnly: true,
        secure: ghIsHttps,
        sameSite: ghIsHttps ? 'none' : 'lax',
        partitioned: ghIsHttps,
        maxAge: SESSION_MAX_AGE_SECONDS * 1000,
        path: '/',
      });

      res.send(
        renderPopupCallbackHtml(
          {
            type: 'GITHUB_AUTH_SUCCESS',
            loginId,
            githubProfile,
            customToken,
            sessionToken,
            firebaseCustomAuthReady: Boolean(customToken),
          },
          `Добро пожаловать, ${githubProfile.name}!`,
          'Авторизация через GitHub успешно завершена. Окно сейчас закроется.',
          true,
          githubProfile.avatarUrl
        )
      );
    } catch (err: any) {
      console.error('[GitHub Auth] Callback error:', err);
      const errMsg = err?.message || 'Внутренняя ошибка при входе через GitHub.';
      if (loginId) {
        pendingGitHubLogins.set(loginId, {
          status: 'error',
          error: errMsg,
          createdAt: Date.now(),
        });
      }
      res.status(500).send(
        renderPopupCallbackHtml(
          { type: 'GITHUB_AUTH_ERROR', loginId, error: errMsg },
          'Ошибка авторизации',
          errMsg,
          false
        )
      );
    }
  };

  app.get('/auth/github/callback/:loginId', githubCallbackHandler);
  app.get('/auth/github/callback/:loginId/', githubCallbackHandler);
  app.get('/auth/github/callback', githubCallbackHandler);
  app.get('/auth/github/callback/', githubCallbackHandler);
  app.get('/api/auth/github/callback/:loginId', githubCallbackHandler);
  app.get('/api/auth/github/callback', githubCallbackHandler);

  app.get('/api/auth/github/session', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const authHeader = req.headers.authorization;
    const bearerToken = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const cookieToken = typeof req.cookies?.[GITHUB_COOKIE_NAME] === 'string' ? req.cookies[GITHUB_COOKIE_NAME] : '';
    const decoded = verifyGenericTokenPayload<any>(bearerToken || cookieToken);
    const rawId = decoded?.githubId || (typeof decoded?.steamId === 'string' && decoded.steamId.startsWith('github_') ? decoded.steamId.slice(7) : '');
    if (!rawId) {
      res.json({ authenticated: false });
      return;
    }
    const login = String(decoded.login || decoded.personaName || `user_${rawId}`);
    const profile: GitHubUserProfile = {
      githubId: String(rawId),
      login,
      name: String(decoded.name || decoded.personaName || login),
      avatarUrl: String(decoded.avatarUrl || ''),
      profileUrl: String(decoded.profileUrl || `https://github.com/${login}`),
      email: decoded.email ? String(decoded.email) : undefined,
    };
    let customToken: string | null = null;
    const admin = getFirebaseAdmin();
    if (admin) {
      try {
        customToken = await admin.createCustomToken(`github_${profile.githubId}`, {
          provider: 'github',
          githubId: profile.githubId,
          login: profile.login,
        });
      } catch {}
    }
    res.json({
      authenticated: true,
      githubProfile: profile,
      customToken,
      sessionToken: signSessionPayload(profile),
      firebaseCustomAuthReady: Boolean(customToken),
    });
  });

  // 7. X (Twitter) OAuth 2.0 Endpoints (PKCE S256 + signed state)
  app.get('/api/auth/x/url', (req: Request, res: Response) => {
    cleanupExpiredPendingLogins();
    const baseUrl = resolveBaseUrl(req);
    const clientId = (process.env.X_CLIENT_ID || process.env.TWITTER_CLIENT_ID || '').trim();
    const rawLoginId = typeof req.query.loginId === 'string' ? req.query.loginId.trim() : '';
    const loginId = /^[a-zA-Z0-9_-]{8,80}$/.test(rawLoginId) ? rawLoginId : crypto.randomUUID();

    const callbackUrl = `${baseUrl}/auth/x/callback`;

    if (!clientId) {
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        configured: false,
        error: 'X_CLIENT_ID is not configured',
        callbackUrl,
        loginId,
      });
      return;
    }

    pendingXLogins.set(loginId, {
      status: 'pending',
      createdAt: Date.now(),
    });

    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    const signedState = signTokenPayload({ loginId, cv: codeVerifier, p: 'x' }, 600);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: callbackUrl,
      scope: 'users.read tweet.read',
      state: signedState,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const url = `https://x.com/i/oauth2/authorize?${params.toString()}`;
    res.setHeader('Cache-Control', 'no-store');
    res.json({ url, callbackUrl, loginId, configured: true });
  });

  const xPollHandler = (req: Request, res: Response) => {
    cleanupExpiredPendingLogins();
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    const rawId =
      (typeof req.params.loginId === 'string' ? req.params.loginId : '') ||
      (typeof req.query.loginId === 'string' ? req.query.loginId : '');
    const loginId = rawId.trim();

    if (!loginId || !/^[a-zA-Z0-9_-]{8,80}$/.test(loginId)) {
      res.status(400).json({ status: 'error', error: 'Invalid loginId' });
      return;
    }

    const record = pendingXLogins.get(loginId);
    if (!record || record.status === 'pending') {
      res.json({ status: 'pending' });
      return;
    }

    pendingXLogins.delete(loginId);

    if (record.status === 'error') {
      res.json({
        status: 'error',
        error: record.error || 'Вход через X был отменён или завершился ошибкой.',
      });
      return;
    }

    res.json({
      status: 'authenticated',
      xProfile: record.xProfile,
      customToken: record.customToken || null,
      sessionToken: record.sessionToken || null,
      firebaseCustomAuthReady: Boolean(record.customToken),
    });
  };

  app.get('/api/auth/x/poll/:loginId', xPollHandler);
  app.get('/api/auth/x/poll', xPollHandler);

  const xCallbackHandler = async (req: Request, res: Response) => {
    cleanupExpiredPendingLogins();
    const rawState = typeof req.query.state === 'string' ? req.query.state.trim() : '';
    const statePayload = verifyGenericTokenPayload<{ loginId?: string; cv?: string; p?: string }>(rawState);
    const rawLoginId =
      (typeof req.params.loginId === 'string' ? req.params.loginId : '') ||
      (statePayload?.p === 'x' && statePayload.loginId ? statePayload.loginId : '') ||
      (!rawState.includes('.') ? rawState : '') ||
      (typeof req.query.loginId === 'string' ? req.query.loginId : '');
    const loginId = /^[a-zA-Z0-9_-]{8,80}$/.test(rawLoginId.trim()) ? rawLoginId.trim() : '';
    const codeVerifier = statePayload?.p === 'x' && statePayload.cv ? statePayload.cv : 'challenge';

    const errorParam = req.query.error;
    if (errorParam) {
      const cancelMsg = String(req.query.error_description || 'Вход через X был отменён.');
      if (loginId) {
        pendingXLogins.set(loginId, {
          status: 'error',
          error: cancelMsg,
          createdAt: Date.now(),
        });
      }
      res.status(400).send(
        renderPopupCallbackHtml(
          { type: 'X_AUTH_ERROR', loginId, error: cancelMsg },
          'Вход отменён',
          'Вы можете закрыть это окно и вернуться в NovaBlast.',
          false
        )
      );
      return;
    }

    const code = typeof req.query.code === 'string' ? req.query.code.trim() : '';
    if (!code) {
      res.status(400).send(
        renderPopupCallbackHtml(
          { type: 'X_AUTH_ERROR', loginId, error: 'Код авторизации не получен.' },
          'Ошибка X',
          'Код авторизации не найден. Попробуйте войти снова.',
          false
        )
      );
      return;
    }

    const clientId = (process.env.X_CLIENT_ID || process.env.TWITTER_CLIENT_ID || '').trim();
    const clientSecret = (process.env.X_CLIENT_SECRET || process.env.TWITTER_CLIENT_SECRET || '').trim();
    const baseUrl = resolveBaseUrl(req);
    const callbackUrl = `${baseUrl}/auth/x/callback`;

    if (!clientId) {
      const configError = 'X_CLIENT_ID не настроен на сервере.';
      if (loginId) {
        pendingXLogins.set(loginId, {
          status: 'error',
          error: configError,
          createdAt: Date.now(),
        });
      }
      res.status(500).send(
        renderPopupCallbackHtml(
          { type: 'X_AUTH_ERROR', loginId, error: configError },
          'Ошибка конфигурации',
          configError,
          false
        )
      );
      return;
    }

    try {
      const tokenBody = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUrl,
        code_verifier: codeVerifier,
      });
      if (!clientSecret) {
        tokenBody.set('client_id', clientId);
      }

      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const tokenResp = await fetch('https://api.x.com/2/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(clientSecret ? { Authorization: `Basic ${credentials}` } : {}),
        },
        body: tokenBody,
        signal: AbortSignal.timeout(10000),
      });

      const tokenData = (await tokenResp.json()) as { access_token?: string; error?: string; error_description?: string };
      if (!tokenResp.ok || !tokenData.access_token) {
        throw new Error(tokenData.error_description || tokenData.error || 'Не удалось обменять код X на токен.');
      }

      const accessToken = tokenData.access_token;

      const userResp = await fetch('https://api.x.com/2/users/me?user.fields=profile_image_url,username,name', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!userResp.ok) {
        throw new Error(`Ошибка получения профиля X: ${userResp.status}`);
      }

      const userData = (await userResp.json()) as {
        data?: {
          id: string;
          name: string;
          username: string;
          profile_image_url?: string;
        };
      };

      const xUser = userData.data;
      if (!xUser) {
        throw new Error('Не удалось получить данные пользователя из X.');
      }

      const hiResAvatar = xUser.profile_image_url
        ? xUser.profile_image_url.replace(/_normal(\.[a-z0-9]+)$/i, '_400x400$1')
        : '';

      const xProfile: XUserProfile = {
        xId: String(xUser.id),
        username: xUser.username,
        name: xUser.name || xUser.username,
        avatarUrl: hiResAvatar,
        profileUrl: `https://x.com/${xUser.username}`,
      };

      let customToken: string | null = null;
      const admin = getFirebaseAdmin();
      if (admin) {
        try {
          customToken = await admin.createCustomToken(`x_${xProfile.xId}`, {
            provider: 'x',
            xId: xProfile.xId,
            username: xProfile.username,
          });
        } catch (tokenErr) {
          console.error('[X Auth] Failed to create custom token:', tokenErr);
        }
      }

      const sessionToken = signSessionPayload(xProfile);

      if (loginId) {
        pendingXLogins.set(loginId, {
          status: 'authenticated',
          xProfile,
          customToken,
          sessionToken,
          createdAt: Date.now(),
        });
      }

      const xForwardedProto = req.headers['x-forwarded-proto'];
      const xIsHttps =
        req.secure ||
        (typeof xForwardedProto === 'string' && xForwardedProto.includes('https')) ||
        Boolean(process.env.APP_URL?.startsWith('https://'));

      res.cookie(X_COOKIE_NAME, sessionToken, {
        httpOnly: true,
        secure: xIsHttps,
        sameSite: xIsHttps ? 'none' : 'lax',
        partitioned: xIsHttps,
        maxAge: SESSION_MAX_AGE_SECONDS * 1000,
        path: '/',
      });

      res.send(
        renderPopupCallbackHtml(
          {
            type: 'X_AUTH_SUCCESS',
            loginId,
            xProfile,
            customToken,
            sessionToken,
            firebaseCustomAuthReady: Boolean(customToken),
          },
          `Добро пожаловать, ${xProfile.name}!`,
          'Авторизация через X успешно завершена. Окно сейчас закроется.',
          true,
          xProfile.avatarUrl
        )
      );
    } catch (err: any) {
      console.error('[X Auth] Callback error:', err);
      const errMsg = err?.message || 'Внутренняя ошибка при входе через X.';
      if (loginId) {
        pendingXLogins.set(loginId, {
          status: 'error',
          error: errMsg,
          createdAt: Date.now(),
        });
      }
      res.status(500).send(
        renderPopupCallbackHtml(
          { type: 'X_AUTH_ERROR', loginId, error: errMsg },
          'Ошибка авторизации',
          errMsg,
          false
        )
      );
    }
  };

  app.get('/auth/x/callback/:loginId', xCallbackHandler);
  app.get('/auth/x/callback/:loginId/', xCallbackHandler);
  app.get('/auth/x/callback', xCallbackHandler);
  app.get('/auth/x/callback/', xCallbackHandler);
  app.get('/api/auth/x/callback/:loginId', xCallbackHandler);
  app.get('/api/auth/x/callback', xCallbackHandler);

  app.get('/api/auth/x/session', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const authHeader = req.headers.authorization;
    const bearerToken = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const cookieToken = typeof req.cookies?.[X_COOKIE_NAME] === 'string' ? req.cookies[X_COOKIE_NAME] : '';
    const decoded = verifyGenericTokenPayload<any>(bearerToken || cookieToken);
    const rawId = decoded?.xId || (typeof decoded?.steamId === 'string' && decoded.steamId.startsWith('x_') ? decoded.steamId.slice(2) : '');
    if (!rawId) {
      res.json({ authenticated: false });
      return;
    }
    const username = String(decoded.username || decoded.personaName || `x_${rawId}`);
    const profile: XUserProfile = {
      xId: String(rawId),
      username,
      name: String(decoded.name || decoded.personaName || username),
      avatarUrl: String(decoded.avatarUrl || ''),
      profileUrl: String(decoded.profileUrl || `https://x.com/${username}`),
    };
    let customToken: string | null = null;
    const admin = getFirebaseAdmin();
    if (admin) {
      try {
        customToken = await admin.createCustomToken(`x_${profile.xId}`, {
          provider: 'x',
          xId: profile.xId,
          username: profile.username,
        });
      } catch {}
    }
    res.json({
      authenticated: true,
      xProfile: profile,
      customToken,
      sessionToken: signSessionPayload(profile),
      firebaseCustomAuthReady: Boolean(customToken),
    });
  });

  // 8. AI Content Moderation Endpoint (Gemini Vision Safety Verification)
  app.post('/api/moderation/inspect', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const { image, title, description } = req.body || {};

      if (!image || typeof image !== 'string') {
        res.status(400).json({ allowed: false, reason: 'Отсутствуют данные изображения.' });
        return;
      }

      if (process.env.GEMINI_API_KEY) {
        try {
          const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, '').trim();
          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: 'image/png',
                    data: cleanBase64,
                  },
                },
                {
                  text: `Analyze this pixel art image and metadata for a public family-friendly pixel art gallery.
Title: "${String(title || '').slice(0, 100)}"
Description: "${String(description || '').slice(0, 500)}"

Inspect the drawing carefully for any inappropriate content, including:
1. NSFW content, explicit genitalia, sexual anatomy, or obscene drawings.
2. Severe gore, hate speech, or illegal symbols.

Strict requirement: If the image depicts NSFW, genitalia, or explicit illegal content, respond with {"safe": false, "reason": "Обнаружено недопустимое или непристойное содержимое."}.
If the image is clean pixel art (characters, items, landscapes, potions, retro art, etc.), respond with {"safe": true, "reason": "OK"}.
Return STRICT JSON ONLY.`
                }
              ]
            },
            config: {
              responseMimeType: 'application/json',
            }
          });

          const jsonText = (response.text || '{}').trim();
          const parsed = JSON.parse(jsonText);
          if (parsed.safe === false) {
            res.json({
              allowed: false,
              reason: parsed.reason || 'Работа не прошла проверку модерации безопасности AI.'
            });
            return;
          }
        } catch (aiErr) {
          console.error('[AI Moderation] Gemini inspection error:', aiErr);
        }
      }

      res.json({ allowed: true });
    } catch (err: any) {
      console.error('[AI Moderation] Inspection handler error:', err);
      res.status(500).json({ allowed: false, reason: 'Ошибка проверки безопасности.' });
    }
  });

  // 6. Vite Dev Middleware vs Production Static Assets
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.use((req: Request, res: Response, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api/')) {
        res.sendFile(path.join(distPath, 'index.html'));
      } else {
        next();
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NovaBlast server running on http://0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`);
  });
}

startServer();
