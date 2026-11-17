interface Window {
  electron?: {
    googleLogin: () => Promise<any>;
    setDiscordActivity: (activity: { details?: string; state?: string; largeImageKey?: string }) => void;
    onAuthReceived?: (callback: (authData: any) => void) => void;
  };
}
