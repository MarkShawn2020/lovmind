/**
 * Platform detection utilities for cross-platform compatibility
 */

export interface PlatformInfo {
  isIOS: boolean;
  isAndroid: boolean;
  isMobile: boolean;
  isDesktop: boolean;
  isTauri: boolean;
  platform: 'ios' | 'android' | 'macos' | 'windows' | 'linux' | 'web';
}

/**
 * Detect if running on iOS (iPhone, iPad)
 */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;

  // Check user agent for iOS devices
  const userAgent = navigator.userAgent || navigator.vendor;
  const isIOSDevice = /iPad|iPhone|iPod/.test(userAgent);

  // Additional check for iPad on iOS 13+ (reports as macOS)
  const isIPadOS = navigator.maxTouchPoints > 1 && /Mac/.test(userAgent);

  return isIOSDevice || isIPadOS;
}

/**
 * Detect if running on Android
 */
export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/.test(navigator.userAgent);
}

/**
 * Detect if running on mobile device (iOS or Android)
 */
export function isMobileDevice(): boolean {
  return isIOS() || isAndroid();
}

/**
 * Detect if running inside Tauri app
 */
export function isTauriApp(): boolean {
  return '__TAURI__' in window;
}

/**
 * Get detailed platform information
 */
export function getPlatformInfo(): PlatformInfo {
  const ios = isIOS();
  const android = isAndroid();
  const mobile = ios || android;
  const tauri = isTauriApp();

  let platform: PlatformInfo['platform'] = 'web';

  if (ios) {
    platform = 'ios';
  } else if (android) {
    platform = 'android';
  } else if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('mac')) platform = 'macos';
    else if (ua.includes('win')) platform = 'windows';
    else if (ua.includes('linux')) platform = 'linux';
  }

  return {
    isIOS: ios,
    isAndroid: android,
    isMobile: mobile,
    isDesktop: !mobile,
    isTauri: tauri,
    platform,
  };
}

/**
 * Get safe area insets for iOS devices
 * Returns padding needed to avoid notch, home indicator, etc.
 */
export function getIOSSafeAreaInsets(): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  if (!isIOS()) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  // Check CSS environment variables for safe area
  const computedStyle = getComputedStyle(document.documentElement);
  const top = parseInt(computedStyle.getPropertyValue('--safe-area-inset-top') || '0');
  const right = parseInt(computedStyle.getPropertyValue('--safe-area-inset-right') || '0');
  const bottom = parseInt(computedStyle.getPropertyValue('--safe-area-inset-bottom') || '0');
  const left = parseInt(computedStyle.getPropertyValue('--safe-area-inset-left') || '0');

  return { top, right, bottom, left };
}

/**
 * Check if device supports hover (desktop) or is touch-only (mobile)
 */
export function supportsHover(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(hover: hover)').matches;
}

/**
 * Get current screen orientation
 */
export function getOrientation(): 'portrait' | 'landscape' {
  if (typeof window === 'undefined') return 'portrait';
  return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
}

/**
 * Listen to orientation changes
 */
export function onOrientationChange(callback: (orientation: 'portrait' | 'landscape') => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = () => {
    callback(getOrientation());
  };

  window.addEventListener('resize', handler);
  window.addEventListener('orientationchange', handler);

  return () => {
    window.removeEventListener('resize', handler);
    window.removeEventListener('orientationchange', handler);
  };
}

/**
 * Platform-specific configuration
 */
export const platformConfig = {
  /**
   * Features that are disabled on iOS
   */
  ios: {
    supportsGlobalShortcuts: false,
    supportsMultipleWindows: false,
    supportsTransparency: false,
    supportsFramelessWindow: false,
    supportsAlwaysOnTop: false,
    supportsWindowHideShow: false,
  },

  /**
   * Desktop features
   */
  desktop: {
    supportsGlobalShortcuts: true,
    supportsMultipleWindows: true,
    supportsTransparency: true,
    supportsFramelessWindow: true,
    supportsAlwaysOnTop: true,
    supportsWindowHideShow: true,
  },
} as const;

/**
 * Get platform-specific feature flags
 */
export function getPlatformFeatures() {
  const info = getPlatformInfo();
  return info.isIOS ? platformConfig.ios : platformConfig.desktop;
}
