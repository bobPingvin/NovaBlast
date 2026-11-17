const { contextBridge, ipcRenderer } = require('electron');

// CRITICAL: Stealth script to help bypass Google's "secure browser" check
try {
  // Hide WebDriver
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  
  // Spoof platform (Match the User Agent - Linux for this distro)
  Object.defineProperty(navigator, 'platform', { get: () => 'Linux x86_64' });
  
  // Mimic hardware properties
  Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
  Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
  Object.defineProperty(navigator, 'appVersion', { get: () => navigator.userAgent.replace('Mozilla/', '') });

  // Fix languages if they are empty
  if (!navigator.languages || navigator.languages.length === 0) {
    Object.defineProperty(navigator, 'languages', { get: () => ['ru-RU', 'ru', 'en-US', 'en'] });
  }

  // Fix permissions query
  const originalQuery = window.navigator.permissions.query;
  window.navigator.permissions.query = (parameters) => (
    parameters.name === 'notifications' ?
      Promise.resolve({ state: Notification.permission }) :
      originalQuery(parameters)
  );

  // Spoof userAgentData to look like real Chrome
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
} catch (e) {}

// Expose the electron object to the renderer (App.tsx)
contextBridge.exposeInMainWorld('electron', {
  googleLogin: () => ipcRenderer.invoke('google-login'),
  setDiscordActivity: (activity) => ipcRenderer.send('set-discord-activity', activity),
  onAuthReceived: (callback) => {
    ipcRenderer.on('auth-received', (event, data) => callback(data));
  }
});
