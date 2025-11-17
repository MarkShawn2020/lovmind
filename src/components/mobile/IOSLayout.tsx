import { ReactNode, useEffect, useState } from 'react';
import { getIOSSafeAreaInsets, isIOS } from '@/utils/platform';

interface IOSLayoutProps {
  children: ReactNode;
}

/**
 * iOS-specific layout wrapper
 * Handles safe area insets, viewport meta tag, and iOS-specific styling
 * Also handles keyboard resize using visualViewport API
 */
export function IOSLayout({ children }: IOSLayoutProps) {
  const [safeAreaInsets, setSafeAreaInsets] = useState(getIOSSafeAreaInsets());
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

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

  // Handle keyboard appearance using visualViewport API
  useEffect(() => {
    if (!isIOS()) return;

    const visualViewport = window.visualViewport;
    if (!visualViewport) {
      console.warn('[IOSLayout] visualViewport API not available');
      return;
    }

    const handleViewportResize = () => {
      // visualViewport.height gives us the visible height accounting for keyboard
      const newHeight = visualViewport.height;
      setViewportHeight(newHeight);

      console.log('[IOSLayout] Viewport resized:', {
        height: newHeight,
        windowInnerHeight: window.innerHeight,
        diff: window.innerHeight - newHeight,
      });
    };

    // Initial measurement
    handleViewportResize();

    // Listen to viewport changes (triggered by keyboard show/hide)
    visualViewport.addEventListener('resize', handleViewportResize);
    visualViewport.addEventListener('scroll', handleViewportResize);

    return () => {
      visualViewport.removeEventListener('resize', handleViewportResize);
      visualViewport.removeEventListener('scroll', handleViewportResize);
    };
  }, []);

  // Apply iOS-specific styles
  const containerStyle = isIOS()
    ? {
        paddingTop: `env(safe-area-inset-top, ${safeAreaInsets.top}px)`,
        paddingRight: `env(safe-area-inset-right, ${safeAreaInsets.right}px)`,
        paddingBottom: `env(safe-area-inset-bottom, ${safeAreaInsets.bottom}px)`,
        paddingLeft: `env(safe-area-inset-left, ${safeAreaInsets.left}px)`,
        // Use visualViewport height when available (keyboard adjustments)
        ...(viewportHeight !== null && {
          height: `${viewportHeight}px`,
          maxHeight: `${viewportHeight}px`,
        }),
      }
    : {};

  return (
    <div
      className={viewportHeight !== null ? "w-screen overflow-hidden" : "h-screen w-screen overflow-hidden"}
      style={containerStyle}
    >
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
