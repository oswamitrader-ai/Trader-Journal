/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ExnovaCaptureStatus {
  state: 'idle' | 'searching' | 'connected' | 'reading' | 'attention' | 'error' | 'unavailable';
  message: string;
  capturedCount?: number;
  lastReadAt?: string | null;
  enabled?: boolean;
}

interface ExnovaStakeShieldStatus {
  state: 'disabled' | 'waiting' | 'detecting' | 'verifying' | 'locked' | 'error';
  message: string;
  enabled?: boolean;
  amount?: number;
  bounds?: { x: number; y: number; width: number; height: number };
}

interface Window {
  electronAPI?: {
    isDesktop?: boolean;
    syncLockState?: (state: Record<string, unknown>) => void;
    getDesktopStatus?: () => Promise<unknown>;
    getExnovaCaptureStatus?: () => Promise<ExnovaCaptureStatus>;
    startExnovaCapture?: () => Promise<ExnovaCaptureStatus>;
    stopExnovaCapture?: () => Promise<ExnovaCaptureStatus>;
    getExnovaStakeShieldStatus?: () => Promise<ExnovaStakeShieldStatus>;
    onExnovaStakeShieldStatus?: (callback: (status: ExnovaStakeShieldStatus) => void) => () => void;
    onExnovaCaptureStatus?: (callback: (status: ExnovaCaptureStatus) => void) => () => void;
    onExnovaTradeCaptured?: (callback: (trade: unknown) => void) => () => void;
    onLockStateChanged?: (callback: (data: unknown) => void) => void;
  };
}
