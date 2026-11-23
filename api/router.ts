import type { IncomingMessage, ServerResponse } from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

type VercelRequest = IncomingMessage & {
  query?: Record<string, string | string[] | undefined>;
  body?: any;
};

type VercelResponse = ServerResponse;

const SESSION_COOKIE_NAME = 'novablast_steam_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const CHALLENGE_TTL_MS = 10 * 60 * 1000; // 10 minutes

let defaultFirebaseProjectId = process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0487154255';
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (parsed.projectId) {
      defaultFirebaseProjectId = parsed.projectId;
    }
  }
} catch {
  // Fallback to defaultFirebaseProjectId
}

const SESSION_SECRET =
  process.env.STEAM_SESSION_SECRET ||
  crypto
    .createHash('sha256')
    .update(`novablast-steam-hmac:${defaultFirebaseProjectId || 'vercel-prod'}`)
    .digest('hex');

interface SteamPlayerProfile {
  steamId: string;
  personaName: string;
  avatarUrl: string;
  profileUrl: string;
}

interface GitHubUserProfile {
  githubId: string;
  login: string;
  name: string;
  avatarUrl: string;
  profileUrl: string;
  email?: string;
}

interface XUserProfile {
  xId: string;
  username: string;
  name: string;
  avatarUrl: string;
  profileUrl: string;
}

interface ServiceAccountCreds {
  clientEmail: string;
  privateKey: string;
}

let cachedServiceAccount: ServiceAccountCreds | null | undefined;

function getServiceAccountCreds(): ServiceAccountCreds | null {
  if (cachedServiceAccount !== undefined) {
    return cachedServiceAccount;
  }

  try {
    const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
    if (rawServiceAccount) {
      let jsonStr = rawServiceAccount;
      if (!rawServiceAccount.startsWith('{')) {
        jsonStr = Buffer.from(rawServiceAccount, 'base64').toString('utf-8');
      }
      const parsed = JSON.parse(jsonStr);
      const clientEmail = String(parsed.client_email || parsed.clientEmail || '').trim();
      const privateKey = String(parsed.private_key || parsed.privateKey || '').replace(/\\n/g, '\n');
      if (clientEmail && privateKey) {
        cachedServiceAccount = { clientEmail, privateKey };
        return cachedServiceAccount;
      }
    } else if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL.trim();
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      if (clientEmail && privateKey) {
        cachedServiceAccount = { clientEmail, privateKey };
        return cachedServiceAccount;
      }
    }
  } catch (err) {
    console.error('[Vercel Auth] Failed to parse Firebase service account:', err);
  }

  cachedServiceAccount = null;
  return null;
}

// Pure Node crypto RS256 Firebase Custom Token generator (zero external dependencies)
function createFirebaseCustomToken(uid: string, claims?: Record<string, unknown>): string | null {
  const creds = getServiceAccountCreds();
  if (!creds) return null;

  try {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' }), 'utf-8').toString('base64url');
    const payloadObj: Record<string, unknown> = {
      iss: creds.clientEmail,
      sub: creds.clientEmail,
      aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
      iat: now,
      exp: now + 3600,
      uid,
    };
    if (claims && Object.keys(claims).length > 0) {
      payloadObj.claims = claims;
    }
    const payload = Buffer.from(JSON.stringify(payloadObj), 'utf-8').toString('base64url');
    const signingInput = `${header}.${payload}`;
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signingInput);
    signer.end();
    const signature = signer.sign(creds.privateKey).toString('base64url');
    return `${signingInput}.${signature}`;
  } catch (err) {
    console.error('[Vercel Auth] Failed to sign Firebase custom token:', err);
    return null;
  }
}

function getQueryString(params: URLSearchParams, key: string): string {
  return params.get(key) || '';
}

function getRequestHost(req: VercelRequest): string {
  const forwardedHost = req.headers['x-forwarded-host'];
  if (typeof forwardedHost === 'string' && forwardedHost.length > 0) {
    return forwardedHost.split(',')[0].trim();
  }
  const host = req.headers.host;
  return typeof host === 'string' ? host.split(',')[0].trim() : '';
}

function resolveBaseUrl(req: VercelRequest, queryParams: URLSearchParams): string {
  const reqHost = getRequestHost(req);
  const clientOrigin = getQueryString(queryParams, 'origin').trim();

  if (clientOrigin) {
    try {
      const parsed = new URL(clientOrigin);
      const isAllowedOrigin =
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname.endsWith('.vercel.app') ||
        parsed.hostname.endsWith('.run.app') ||
        (reqHost && parsed.host === reqHost) ||
        (process.env.APP_URL && parsed.origin === new URL(process.env.APP_URL).origin);

      if ((parsed.protocol === 'https:' || parsed.protocol === 'http:') && isAllowedOrigin) {
        return parsed.origin;
      }
    } catch {
      // Ignore invalid origin
    }
  }

  if (reqHost) {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const proto =
      typeof forwardedProto === 'string'
        ? forwardedProto.split(',')[0].trim()
        : reqHost.startsWith('localhost') || reqHost.startsWith('127.0.0.1')
        ? 'http'
        : 'https';
    return `${proto}://${reqHost}`;
  }

  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/+$/, '');
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return 'http://localhost:3000';
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

function verifyTokenPayload<T = Record<string, any>>(token: string | undefined | null): T | null {
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

function signSessionPayload(profile: SteamPlayerProfile | GitHubUserProfile | object): string {
  return signTokenPayload(profile as Record<string, unknown>, SESSION_MAX_AGE_SECONDS);
}

function verifySignedToken(token: string | undefined | null): SteamPlayerProfile | null {
  const decoded = verifyTokenPayload<any>(token);
  if (!decoded || !decoded.steamId) return null;
  return {
    steamId: String(decoded.steamId),
    personaName: String(decoded.personaName || `Steam #${String(decoded.steamId).slice(-6)}`),
    avatarUrl: String(decoded.avatarUrl || ''),
    profileUrl: String(decoded.profileUrl || `https://steamcommunity.com/profiles/${decoded.steamId}`),
  };
}

function extractSessionProfile(req: VercelRequest): SteamPlayerProfile | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.slice(7).trim();
    const fromBearer = verifySignedToken(bearerToken);
    if (fromBearer) return fromBearer;
  }

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

function buildSessionCookieHeader(value: string, maxAgeSeconds: number, isHttps: boolean): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`,
    `Path=/`,
    `Max-Age=${maxAgeSeconds}`,
    `HttpOnly`,
    isHttps ? `SameSite=None` : `SameSite=Lax`,
  ];
  if (isHttps) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

function buildClearSessionCookieHeaders(isHttps: boolean): string[] {
  const expired = 'Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
  const headers = [
    `${SESSION_COOKIE_NAME}=; Path=/; ${expired}; HttpOnly; SameSite=Lax`,
  ];
  if (isHttps) {
    headers.push(
      `${SESSION_COOKIE_NAME}=; Path=/; ${expired}; HttpOnly; SameSite=None; Secure`,
      `${SESSION_COOKIE_NAME}=; Path=/; ${expired}; HttpOnly; SameSite=None; Secure; Partitioned`,
      `${SESSION_COOKIE_NAME}=; Path=/; ${expired}; HttpOnly; SameSite=Lax; Secure`
    );
  }
  return headers;
}

function isRequestHttps(req: VercelRequest): boolean {
  const forwardedProto = req.headers['x-forwarded-proto'];
  return (
    (typeof forwardedProto === 'string' && forwardedProto.includes('https')) ||
    Boolean(process.env.VERCEL) ||
    Boolean(process.env.APP_URL?.startsWith('https://'))
  );
}

function sendJson(res: VercelResponse, statusCode: number, data: unknown, extraHeaders?: Record<string, string | string[]>) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) {
      res.setHeader(k, v);
    }
  }
  res.end(JSON.stringify(data));
}

function sendHtml(res: VercelResponse, statusCode: number, html: string, extraHeaders?: Record<string, string | string[]>) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) {
      res.setHeader(k, v);
    }
  }
  res.end(html);
}

async function readJsonBody(req: VercelRequest): Promise<any> {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk.toString();
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
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

  if (steamId) {
    return await fetchSteamProfile(steamId);
  }

  if (vanity) {
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

async function verifySteamOpenIdParams(queryParams: URLSearchParams): Promise<boolean> {
  const buildParams = (fixPlusInBase64: boolean) => {
    const params = new URLSearchParams();
    for (const [key, val] of queryParams.entries()) {
      if (!key.startsWith('openid.') || !val) continue;
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

  const sig = queryParams.get('openid.sig') || '';
  const handle = queryParams.get('openid.assoc_handle') || '';
  const nonce = queryParams.get('openid.response_nonce') || '';
  if (sig.includes(' ') || handle.includes(' ') || nonce.includes(' ')) {
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
      ? `<img src="${escapeHtml(avatarUrl)}" alt="Avatar" class="avatar" referrerpolicy="no-referrer" />`
      : `<div class="badge">${isSuccess ? '✓' : '!'}</div>`;

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NovaBlast — Auth</title>
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
          var channels = ['novablast_steam_auth', 'novablast_github_auth', 'novablast_x_auth'];
          for (var i = 0; i < channels.length; i++) {
            try {
              var bc = new BroadcastChannel(channels[i]);
              bc.postMessage(data);
              (function(ch) { setTimeout(function() { try { ch.close(); } catch (e) {} }, 500); })(bc);
            } catch (e1) {}
          }
        }
      } catch (e) {}
      setTimeout(function() {
        try { window.close(); } catch (e) {}
      }, 300);
    })();
  </script>
</body>
</html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const rawUrl = req.url || '/';
    const parsed = new URL(rawUrl, 'http://localhost');
    const queryParams = new URLSearchParams(parsed.searchParams);

    if (req.query) {
      for (const [k, v] of Object.entries(req.query)) {
        if (!queryParams.has(k) && v !== undefined) {
          queryParams.set(k, Array.isArray(v) ? String(v[0] ?? '') : String(v));
        }
      }
    }

    const routeOverride = queryParams.get('__route') || '';
    const pathname = (routeOverride ? routeOverride.split('?')[0] : parsed.pathname).replace(/\/+$/, '') || '/';
    const method = (req.method || 'GET').toUpperCase();
    const baseUrl = resolveBaseUrl(req, queryParams);
    const httpsFlag = isRequestHttps(req);

    // 1. Steam OpenID URL
    if (pathname === '/api/auth/steam/url' && method === 'GET') {
      const rawLoginId = getQueryString(queryParams, 'loginId').trim();
      const loginId = /^[a-zA-Z0-9_-]{8,80}$/.test(rawLoginId) ? rawLoginId : crypto.randomUUID();
      const callbackUrl = `${baseUrl}/auth/steam/callback/${loginId}`;

      const params = new URLSearchParams({
        'openid.ns': 'http://specs.openid.net/auth/2.0',
        'openid.mode': 'checkid_setup',
        'openid.return_to': callbackUrl,
        'openid.realm': baseUrl,
        'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
        'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
      });

      sendJson(res, 200, {
        url: `https://steamcommunity.com/openid/login?${params.toString()}`,
        callbackUrl,
        loginId,
      });
      return;
    }

    // 2. Steam QR Begin
    if (pathname === '/api/auth/steam/qr/begin' && method === 'POST') {
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
        sendJson(res, 200, {
          success: true,
          clientId: r.client_id,
          requestId: r.request_id,
          challengeUrl: r.challenge_url,
          qrImageUrl,
          interval: r.interval || 4,
        });
      } catch (err) {
        console.error('[Steam Auth] QR begin error:', err);
        sendJson(res, 500, { success: false, error: 'Не удалось начать QR-авторизацию Steam.' });
      }
      return;
    }

    // 3. Steam QR Poll
    if (pathname === '/api/auth/steam/qr/poll' && method === 'POST') {
      const body = await readJsonBody(req);
      const clientId = typeof body?.clientId === 'string' ? body.clientId.trim() : '';
      const requestId = typeof body?.requestId === 'string' ? body.requestId.trim() : '';

      if (!clientId || !requestId) {
        sendJson(res, 400, { authenticated: false, error: 'Отсутствует clientId или requestId' });
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
          sendJson(res, 200, { authenticated: false, status: 'pending' });
          return;
        }
        const data = (await resp.json()) as {
          response?: {
            steamid?: string;
            had_remote_interaction?: boolean;
          };
        };
        const r = data.response;
        if (!r?.steamid) {
          sendJson(res, 200, {
            authenticated: false,
            status: 'pending',
            hadRemoteInteraction: Boolean(r?.had_remote_interaction),
          });
          return;
        }

        const steamId = r.steamid;
        const steamProfile = await fetchSteamProfile(steamId);
        const signedSession = signSessionPayload(steamProfile);
        const customToken = createFirebaseCustomToken(`steam_${steamId}`, {
          steamId,
          provider: 'steam',
          personaName: steamProfile.personaName,
        });

        sendJson(
          res,
          200,
          {
            authenticated: true,
            status: 'authenticated',
            steamProfile,
            customToken,
            sessionToken: signedSession,
            firebaseCustomAuthReady: Boolean(customToken),
          },
          {
            'Set-Cookie': buildSessionCookieHeader(signedSession, SESSION_MAX_AGE_SECONDS, httpsFlag),
          }
        );
      } catch (err) {
        console.error('[Steam Auth] QR poll error:', err);
        sendJson(res, 500, { authenticated: false, error: 'Ошибка опроса сессии Steam QR.' });
      }
      return;
    }

    // 4. Steam Poll (serverless stateless stub)
    if (pathname.startsWith('/api/auth/steam/poll')) {
      sendJson(res, 200, { status: 'pending' });
      return;
    }

    // 5. Steam OpenID Callback
    if (pathname.startsWith('/auth/steam/callback') || pathname.startsWith('/api/auth/steam/callback')) {
      const segs = pathname.split('/').filter(Boolean);
      const maybeLoginId = segs[segs.length - 1] !== 'callback' ? segs[segs.length - 1] : '';
      const rawLoginId = maybeLoginId || getQueryString(queryParams, 'loginId');
      const loginId = /^[a-zA-Z0-9_-]{8,80}$/.test(rawLoginId.trim()) ? rawLoginId.trim() : '';

      try {
        const mode = getQueryString(queryParams, 'openid.mode');
        if (mode !== 'id_res') {
          const cancelMsg = 'Вход через Steam был отменён.';
          sendHtml(
            res,
            400,
            renderPopupCallbackHtml(
              { type: 'STEAM_AUTH_ERROR', loginId, error: cancelMsg },
              'Вход отменён',
              'Вы можете закрыть это окно и вернуться в NovaBlast.',
              false
            )
          );
          return;
        }

        const isValid = await verifySteamOpenIdParams(queryParams);
        if (!isValid) {
          const invalidMsg = 'Не удалось подтвердить подпись ответа Steam OpenID.';
          sendHtml(
            res,
            401,
            renderPopupCallbackHtml(
              { type: 'STEAM_AUTH_ERROR', loginId, error: invalidMsg },
              'Ошибка проверки Steam',
              'Подпись ответа не прошла валидацию. Закройте окно и попробуйте войти снова.',
              false
            )
          );
          return;
        }

        const claimedId = getQueryString(queryParams, 'openid.claimed_id');
        const idMatch = claimedId.match(/^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17,25})$/);
        if (!idMatch) {
          const formatMsg = 'Некорректный формат идентификатора SteamID.';
          sendHtml(
            res,
            400,
            renderPopupCallbackHtml(
              { type: 'STEAM_AUTH_ERROR', loginId, error: formatMsg },
              'Ошибка SteamID',
              'Не удалось определить SteamID из ответа Steam.',
              false
            )
          );
          return;
        }

        const steamId = idMatch[1];
        const steamProfile = await fetchSteamProfile(steamId);
        const signedSession = signSessionPayload(steamProfile);
        const customToken = createFirebaseCustomToken(`steam_${steamId}`, {
          steamId,
          provider: 'steam',
          personaName: steamProfile.personaName,
        });

        sendHtml(
          res,
          200,
          renderPopupCallbackHtml(
            {
              type: 'STEAM_AUTH_SUCCESS',
              loginId,
              steamProfile,
              customToken,
              sessionToken: signedSession,
              firebaseCustomAuthReady: Boolean(customToken),
            },
            `Привет, ${steamProfile.personaName}!`,
            'Вход через Steam выполнен. Это окно автоматически закроется.',
            true,
            steamProfile.avatarUrl
          ),
          {
            'Set-Cookie': buildSessionCookieHeader(signedSession, SESSION_MAX_AGE_SECONDS, httpsFlag),
          }
        );
      } catch (err) {
        console.error('[Steam Auth] Callback error:', err);
        const errMsg = 'Внутренняя ошибка сервера при проверке входа Steam.';
        sendHtml(
          res,
          500,
          renderPopupCallbackHtml(
            { type: 'STEAM_AUTH_ERROR', loginId, error: errMsg },
            'Ошибка входа',
            errMsg,
            false
          )
        );
      }
      return;
    }

    // 6. Steam Manual Callback Recovery
    if (pathname === '/api/auth/steam/manual-callback' && method === 'POST') {
      const body = await readJsonBody(req);
      const rawUrl = typeof body?.url === 'string' ? body.url.trim() : '';
      if (!rawUrl) {
        sendJson(res, 400, { authenticated: false, error: 'Вставьте ссылку из адресной строки окна с ошибкой.' });
        return;
      }

      try {
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(rawUrl);
        } catch {
          sendJson(res, 400, { authenticated: false, error: 'Некорректная ссылка. Скопируйте весь URL из адресной строки.' });
          return;
        }

        if (parsedUrl.searchParams.get('openid.mode') !== 'id_res') {
          sendJson(res, 400, { authenticated: false, error: 'В этой ссылке отсутствуют параметры ответа Steam (openid.mode=id_res).' });
          return;
        }

        const isValid = await verifySteamOpenIdParams(parsedUrl.searchParams);
        if (!isValid) {
          sendJson(res, 401, { authenticated: false, error: 'Подпись ответа Steam OpenID недействительна или уже устарела.' });
          return;
        }

        const claimedId = parsedUrl.searchParams.get('openid.claimed_id') || '';
        const idMatch = claimedId.match(/^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17,25})$/);
        if (!idMatch) {
          sendJson(res, 400, { authenticated: false, error: 'Не удалось извлечь SteamID из ссылки.' });
          return;
        }

        const steamId = idMatch[1];
        const steamProfile = await fetchSteamProfile(steamId);
        const signedSession = signSessionPayload(steamProfile);
        const customToken = createFirebaseCustomToken(`steam_${steamId}`, {
          steamId,
          provider: 'steam',
          personaName: steamProfile.personaName,
        });

        sendJson(
          res,
          200,
          {
            authenticated: true,
            steamProfile,
            customToken,
            sessionToken: signedSession,
            firebaseCustomAuthReady: Boolean(customToken),
          },
          {
            'Set-Cookie': buildSessionCookieHeader(signedSession, SESSION_MAX_AGE_SECONDS, httpsFlag),
          }
        );
      } catch (err) {
        console.error('[Steam Auth] Manual callback error:', err);
        sendJson(res, 500, { authenticated: false, error: 'Внутренняя ошибка при обработке ссылки Steam.' });
      }
      return;
    }

    // 7. Steam Session Check
    if (pathname === '/api/auth/steam/session' && method === 'GET') {
      const profile = extractSessionProfile(req);
      if (!profile) {
        sendJson(res, 200, { authenticated: false });
        return;
      }

      const customToken = createFirebaseCustomToken(`steam_${profile.steamId}`, {
        steamId: profile.steamId,
        provider: 'steam',
        personaName: profile.personaName,
      });

      sendJson(res, 200, {
        authenticated: true,
        steamProfile: profile,
        customToken,
        sessionToken: signSessionPayload(profile),
        firebaseCustomAuthReady: Boolean(customToken),
      });
      return;
    }

    // 8. Steam Logout
    if (pathname === '/api/auth/steam/logout' && (method === 'POST' || method === 'GET')) {
      sendJson(
        res,
        200,
        { ok: true },
        {
          'Set-Cookie': buildClearSessionCookieHeaders(httpsFlag),
        }
      );
      return;
    }

    // 9. Steam Profile Ownership Challenge
    if (pathname === '/api/auth/steam/challenge' && method === 'POST') {
      const body = await readJsonBody(req);
      const queryStr = typeof body?.query === 'string' ? body.query.trim() : '';
      if (!queryStr) {
        sendJson(res, 400, { success: false, error: 'Укажите никнейм, ссылку на профиль или SteamID.' });
        return;
      }

      try {
        const profile = await resolveSteamProfileInput(queryStr);
        if (!profile) {
          sendJson(res, 404, {
            success: false,
            error: 'Профиль Steam не найден. Убедитесь, что ник или ссылка верны, а профиль открыт для сообщества.',
          });
          return;
        }

        const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
        const challengeCode = `NOVA-${randomHex}`;
        const expiresAt = Date.now() + CHALLENGE_TTL_MS;
        const challengeToken = signTokenPayload(
          { steamId: profile.steamId, code: challengeCode, expiresAt },
          Math.ceil(CHALLENGE_TTL_MS / 1000)
        );

        sendJson(res, 200, {
          success: true,
          profile,
          challengeCode,
          challengeToken,
          expiresAt,
        });
      } catch (err) {
        console.error('[Steam Auth] Challenge error:', err);
        sendJson(res, 500, { success: false, error: 'Ошибка сервера при поиске профиля Steam.' });
      }
      return;
    }

    // 10. Verify Steam Challenge
    if (pathname === '/api/auth/steam/verify-challenge' && method === 'POST') {
      const body = await readJsonBody(req);
      const steamId = typeof body?.steamId === 'string' ? body.steamId.trim() : '';
      const inputCode = typeof body?.challengeCode === 'string' ? body.challengeCode.trim() : '';
      const challengeToken = typeof body?.challengeToken === 'string' ? body.challengeToken.trim() : '';

      if (!steamId || !inputCode || !challengeToken) {
        sendJson(res, 400, { authenticated: false, error: 'Не указан SteamID, токен или проверочный код.' });
        return;
      }

      const tokenRecord = verifyTokenPayload<{ steamId: string; code: string; expiresAt: number }>(challengeToken);
      if (!tokenRecord || tokenRecord.steamId !== steamId || Date.now() > tokenRecord.expiresAt) {
        sendJson(res, 400, {
          authenticated: false,
          error: 'Срок действия кода проверки истек или запрос не найден. Запросите новый код.',
        });
        return;
      }

      const normExpected = tokenRecord.code.toUpperCase();
      const normInput = inputCode.toUpperCase();
      const rawPart = tokenRecord.code.split('-')[1] || '';
      if (normInput !== normExpected && !normInput.endsWith(rawPart)) {
        sendJson(res, 400, { authenticated: false, error: 'Введен неверный проверочный код.' });
        return;
      }

      try {
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
        } catch {}

        const summary = (extractXmlTag(liveXml, 'summary') || '').toLowerCase();
        const realname = (extractXmlTag(liveXml, 'realname') || '').toLowerCase();
        const headline = (extractXmlTag(liveXml, 'headline') || '').toLowerCase();
        const stateMessage = (extractXmlTag(liveXml, 'stateMessage') || '').toLowerCase();

        const expectedCodeLower = tokenRecord.code.toLowerCase();
        const rawPartLower = rawPart.toLowerCase();

        let isMatch =
          summary.includes(expectedCodeLower) ||
          realname.includes(expectedCodeLower) ||
          headline.includes(expectedCodeLower) ||
          stateMessage.includes(expectedCodeLower) ||
          (rawPartLower.length >= 4 &&
            (summary.includes(rawPartLower) || realname.includes(rawPartLower) || headline.includes(rawPartLower))) ||
          liveXml.toLowerCase().includes(expectedCodeLower);

        if (!isMatch) {
          const customUrl = extractXmlTag(liveXml, 'customURL');
          if (customUrl) {
            try {
              const vanityResp = await fetch(
                `https://steamcommunity.com/id/${encodeURIComponent(customUrl)}/?xml=1&_t=${Date.now()}`,
                {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NovaBlast/1.0',
                    Accept: 'application/xml,text/xml,*/*',
                    'Cache-Control': 'no-cache, no-store',
                  },
                  signal: AbortSignal.timeout(8000),
                }
              );
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
          sendJson(res, 400, {
            authenticated: false,
            error: `Код «${tokenRecord.code}» не найден в описании профиля («О себе»), настоящем имени или статусе Steam. Убедитесь, что изменения сохранены и профиль открыт.`,
          });
          return;
        }

        const freshProfile = await fetchSteamProfile(steamId);
        const signedSession = signSessionPayload(freshProfile);
        const customToken = createFirebaseCustomToken(`steam_${freshProfile.steamId}`, {
          steamId: freshProfile.steamId,
          provider: 'steam',
          personaName: freshProfile.personaName,
        });

        sendJson(
          res,
          200,
          {
            authenticated: true,
            steamProfile: freshProfile,
            customToken,
            sessionToken: signedSession,
            firebaseCustomAuthReady: Boolean(customToken),
          },
          {
            'Set-Cookie': buildSessionCookieHeader(signedSession, SESSION_MAX_AGE_SECONDS, httpsFlag),
          }
        );
      } catch (err) {
        console.error('[Steam Auth] Verification error:', err);
        sendJson(res, 500, { authenticated: false, error: 'Ошибка проверки владения профилем Steam.' });
      }
      return;
    }

    // 11. GitHub OAuth 2.0 URL
    if (pathname === '/api/auth/github/url' && method === 'GET') {
      const clientId = (process.env.GITHUB_CLIENT_ID || process.env.CLIENT_ID || '').trim();
      const rawLoginId = getQueryString(queryParams, 'loginId').trim();
      const loginId = /^[a-zA-Z0-9_-]{8,80}$/.test(rawLoginId) ? rawLoginId : crypto.randomUUID();
      const callbackUrl = `${baseUrl}/auth/github/callback`;

      if (!clientId) {
        sendJson(res, 200, {
          configured: false,
          error: 'GITHUB_CLIENT_ID is not configured',
          callbackUrl,
          loginId,
        });
        return;
      }

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: callbackUrl,
        scope: 'read:user user:email',
        state: loginId,
      });

      sendJson(res, 200, {
        url: `https://github.com/login/oauth/authorize?${params.toString()}`,
        callbackUrl,
        loginId,
        configured: true,
      });
      return;
    }

    // 12. GitHub Poll (stateless stub)
    if (pathname.startsWith('/api/auth/github/poll')) {
      sendJson(res, 200, { status: 'pending' });
      return;
    }

    // 13. GitHub Callback
    if (pathname.startsWith('/auth/github/callback') || pathname.startsWith('/api/auth/github/callback')) {
      const segs = pathname.split('/').filter(Boolean);
      const maybeLoginId = segs[segs.length - 1] !== 'callback' ? segs[segs.length - 1] : '';
      const rawLoginId = maybeLoginId || getQueryString(queryParams, 'state') || getQueryString(queryParams, 'loginId');
      const loginId = /^[a-zA-Z0-9_-]{8,80}$/.test(rawLoginId.trim()) ? rawLoginId.trim() : '';

      const errorParam = getQueryString(queryParams, 'error');
      if (errorParam) {
        const cancelMsg = getQueryString(queryParams, 'error_description') || 'Вход через GitHub был отменён.';
        sendHtml(
          res,
          400,
          renderPopupCallbackHtml(
            { type: 'GITHUB_AUTH_ERROR', loginId, error: cancelMsg },
            'Вход отменён',
            'Вы можете закрыть это окно и вернуться в NovaBlast.',
            false
          )
        );
        return;
      }

      const code = getQueryString(queryParams, 'code').trim();
      if (!code) {
        sendHtml(
          res,
          400,
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
        sendHtml(
          res,
          500,
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
              const primaryObj = emails.find((e) => e.primary && e.verified) || emails.find((e) => e.primary) || emails[0];
              if (primaryObj?.email) {
                primaryEmail = primaryObj.email;
              }
            }
          } catch {}
        }

        const githubProfile: GitHubUserProfile = {
          githubId: String(ghUser.id),
          login: ghUser.login,
          name: ghUser.name || ghUser.login,
          avatarUrl: ghUser.avatar_url || '',
          profileUrl: ghUser.html_url || `https://github.com/${ghUser.login}`,
          email: primaryEmail || undefined,
        };

        const customToken = createFirebaseCustomToken(`github_${githubProfile.githubId}`, {
          provider: 'github',
          githubId: githubProfile.githubId,
          login: githubProfile.login,
        });

        const sessionToken = signSessionPayload({
          steamId: `github_${githubProfile.githubId}`,
          personaName: githubProfile.name,
          avatarUrl: githubProfile.avatarUrl,
          profileUrl: githubProfile.profileUrl,
        });

        sendHtml(
          res,
          200,
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
        sendHtml(
          res,
          500,
          renderPopupCallbackHtml(
            { type: 'GITHUB_AUTH_ERROR', loginId, error: errMsg },
            'Ошибка авторизации',
            errMsg,
            false
          )
        );
      }
      return;
    }

    // 14. X (Twitter) OAuth 2.0 URL
    if (pathname === '/api/auth/x/url' && method === 'GET') {
      const clientId = (process.env.X_CLIENT_ID || process.env.TWITTER_CLIENT_ID || '').trim();
      const rawLoginId = getQueryString(queryParams, 'loginId').trim();
      const loginId = /^[a-zA-Z0-9_-]{8,80}$/.test(rawLoginId) ? rawLoginId : crypto.randomUUID();
      const callbackUrl = `${baseUrl}/auth/x/callback`;

      if (!clientId) {
        sendJson(res, 200, {
          configured: false,
          error: 'X_CLIENT_ID is not configured',
          callbackUrl,
          loginId,
        });
        return;
      }

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: callbackUrl,
        scope: 'tweet.read users.read offline.access',
        state: loginId,
        code_challenge: 'challenge',
        code_challenge_method: 'plain',
      });

      sendJson(res, 200, {
        url: `https://twitter.com/i/oauth2/authorize?${params.toString()}`,
        callbackUrl,
        loginId,
        configured: true,
      });
      return;
    }

    // 15. X Poll (stateless stub)
    if (pathname.startsWith('/api/auth/x/poll')) {
      sendJson(res, 200, { status: 'pending' });
      return;
    }

    // 16. X Callback
    if (pathname.startsWith('/auth/x/callback') || pathname.startsWith('/api/auth/x/callback')) {
      const segs = pathname.split('/').filter(Boolean);
      const maybeLoginId = segs[segs.length - 1] !== 'callback' ? segs[segs.length - 1] : '';
      const rawLoginId = maybeLoginId || getQueryString(queryParams, 'state') || getQueryString(queryParams, 'loginId');
      const loginId = /^[a-zA-Z0-9_-]{8,80}$/.test(rawLoginId.trim()) ? rawLoginId.trim() : '';

      const errorParam = getQueryString(queryParams, 'error');
      if (errorParam) {
        const cancelMsg = getQueryString(queryParams, 'error_description') || 'Вход через X был отменён.';
        sendHtml(
          res,
          400,
          renderPopupCallbackHtml(
            { type: 'X_AUTH_ERROR', loginId, error: cancelMsg },
            'Вход отменён',
            'Вы можете закрыть это окно и вернуться в NovaBlast.',
            false
          )
        );
        return;
      }

      const code = getQueryString(queryParams, 'code').trim();
      if (!code) {
        sendHtml(
          res,
          400,
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
      const callbackUrl = `${baseUrl}/auth/x/callback`;

      if (!clientId) {
        const configError = 'X_CLIENT_ID не настроен на сервере.';
        sendHtml(
          res,
          500,
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
        const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        const tokenResp = await fetch('https://api.twitter.com/2/oauth2/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...(clientSecret ? { Authorization: `Basic ${credentials}` } : {}),
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: callbackUrl,
            code_verifier: 'challenge',
          }),
          signal: AbortSignal.timeout(10000),
        });

        const tokenData = (await tokenResp.json()) as { access_token?: string; error?: string; error_description?: string };
        if (!tokenResp.ok || !tokenData.access_token) {
          throw new Error(tokenData.error_description || tokenData.error || 'Не удалось обменять код X на токен.');
        }

        const accessToken = tokenData.access_token;
        const userResp = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url,username,name', {
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

        const xProfile: XUserProfile = {
          xId: String(xUser.id),
          username: xUser.username,
          name: xUser.name || xUser.username,
          avatarUrl: xUser.profile_image_url || '',
          profileUrl: `https://twitter.com/${xUser.username}`,
        };

        const customToken = createFirebaseCustomToken(`x_${xProfile.xId}`, {
          provider: 'x',
          xId: xProfile.xId,
          username: xProfile.username,
        });

        const sessionToken = signSessionPayload({
          steamId: `x_${xProfile.xId}`,
          personaName: xProfile.name,
          avatarUrl: xProfile.avatarUrl,
          profileUrl: xProfile.profileUrl,
        });

        sendHtml(
          res,
          200,
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
        sendHtml(
          res,
          500,
          renderPopupCallbackHtml(
            { type: 'X_AUTH_ERROR', loginId, error: errMsg },
            'Ошибка авторизации',
            errMsg,
            false
          )
        );
      }
      return;
    }

    // 17. AI Moderation Inspect (via Gemini REST API — zero external SDK dependencies)
    if (pathname === '/api/moderation/inspect' && method === 'POST') {
      try {
        const body = await readJsonBody(req);
        const { image, title, description } = body || {};

        if (!image || typeof image !== 'string') {
          sendJson(res, 400, { allowed: false, reason: 'Отсутствуют данные изображения.' });
          return;
        }

        const apiKey = process.env.GEMINI_API_KEY?.trim();
        if (apiKey) {
          try {
            const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, '').trim();
            const geminiResp = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
                apiKey
              )}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [
                    {
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
Return STRICT JSON ONLY.`,
                        },
                      ],
                    },
                  ],
                  generationConfig: {
                    responseMimeType: 'application/json',
                  },
                }),
                signal: AbortSignal.timeout(10000),
              }
            );

            if (geminiResp.ok) {
              const geminiData = (await geminiResp.json()) as {
                candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
              };
              const jsonText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}';
              const result = JSON.parse(jsonText);
              if (result.safe === false) {
                sendJson(res, 200, {
                  allowed: false,
                  reason: result.reason || 'Работа не прошла проверку модерации безопасности AI.',
                });
                return;
              }
            }
          } catch (aiErr) {
            console.error('[AI Moderation] Gemini inspection error:', aiErr);
          }
        }

        sendJson(res, 200, { allowed: true });
      } catch (err) {
        console.error('[AI Moderation] Handler error:', err);
        sendJson(res, 500, { allowed: false, reason: 'Ошибка проверки безопасности.' });
      }
      return;
    }

    sendJson(res, 404, { error: 'Not found', path: pathname });
  } catch (fatalErr: any) {
    console.error('[Vercel Router] Unhandled error:', fatalErr);
    sendJson(res, 500, { error: fatalErr?.message || 'Internal server error' });
  }
}
