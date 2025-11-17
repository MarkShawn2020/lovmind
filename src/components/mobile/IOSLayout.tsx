import { ReactNode, useEffect, useState } from 'react';
import { getIOSSafeAreaInsets, isIOS } from '@/utils/platform';

interface IOSLayoutProps {
  children: ReactNode;
}

/**
 * iOS-specific layout wrapper
 * Handles safe area insets, viewport meta tag, and iOS-specific styling
 */
export function IOSLayout({ children }: IOSLayoutProps) {
  const [safeAreaInsets, setSafeAreaInsets] = useState(getIOSSafeAreaInsets());

  useEffect(() => {
    if (!isIOS()) return;

    // Update safe area insets on resize/orientation change
    const updateInsets = () => {
      setSafeAreaInsets(getIOSSafeAreaInsets());
    };

    window.addEventListener('resize', updateInsets);
    window.addEventListener('orientationchange', updateInsets);

    // Set CSS custom properties for safe area
    document.documentElement.style.setProperty('--safe-area-top', `${safeAreaInsets.top}px`);
    document.documentElement.style.setProperty('--safe-area-right', `${safeAreaInsets.right}px`);
    document.documentElement.style.setProperty('--safe-area-bottom', `${safeAreaInsets.bottom}px`);
    document.documentElement.style.setProperty('--safe-area-left', `${safeAreaInsets.left}px`);

    return () => {
      window.removeEventListener('resize', updateInsets);
      window.removeEventListener('orientationchange', updateInsets);
    };
  }, [safeAreaInsets]);

  // Apply iOS-specific styles
  // Note: Bottom padding is handled by individual components (e.g., EditorToolbar)
  // to avoid layout conflicts with fixed-height containers
  const containerStyle = isIOS()
    ? {
        paddingTop: `env(safe-area-inset-top, ${safeAreaInsets.top}px)`,
        paddingRight: `env(safe-area-inset-right, ${safeAreaInsets.right}px)`,
        paddingLeft: `env(safe-area-inset-left, ${safeAreaInsets.left}px)`,
      }
    : {};

  return (
    <div className="h-screen w-screen overflow-hidden" style={containerStyle}>
      {children}
    </div>
  );
}

/**
 * Hook to get current safe area insets
 */
export function useSafeAreaInsets() {
  const [insets, setInsets] = useState(getIOSSafeAreaInsets());

  useEffect(() => {
    if (!isIOS()) return;

    const updateInsets = () => {
      setInsets(getIOSSafeAreaInsets());
    };

    window.addEventListener('resize', updateInsets);
    window.addEventListener('orientationchange', updateInsets);

    return () => {
      window.removeEventListener('resize', updateInsets);
      window.removeEventListener('orientationchange', updateInsets);
    };
  }, []);

  return insets;
}
