import { useState, useEffect, CSSProperties } from 'react';
import { isIOS, getIOSSafeAreaInsets } from '@/utils/platform';

/**
 * Safe area insets for iOS devices (notch, home indicator, etc.)
 */
export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Hook to get and monitor iOS safe area insets
 * Returns { top, right, bottom, left } in pixels
 */
export function useSafeArea(): SafeAreaInsets {
  const [insets, setInsets] = useState<SafeAreaInsets>(getIOSSafeAreaInsets());

  useEffect(() => {
    if (!isIOS()) return;

    const updateInsets = () => {
      setInsets(getIOSSafeAreaInsets());
    };

    // Update on resize and orientation change
    window.addEventListener('resize', updateInsets);
    window.addEventListener('orientationchange', updateInsets);

    // Set CSS custom properties for use in styles
    document.documentElement.style.setProperty('--safe-area-top', `${insets.top}px`);
    document.documentElement.style.setProperty('--safe-area-right', `${insets.right}px`);
    document.documentElement.style.setProperty('--safe-area-bottom', `${insets.bottom}px`);
    document.documentElement.style.setProperty('--safe-area-left', `${insets.left}px`);

    return () => {
      window.removeEventListener('resize', updateInsets);
      window.removeEventListener('orientationchange', updateInsets);
    };
  }, [insets]);

  return insets;
}

/**
 * Hook to monitor keyboard visibility and viewport height changes on iOS
 * Uses visualViewport API to detect keyboard show/hide
 */
export function useKeyboardResize() {
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!isIOS()) return;

    const visualViewport = window.visualViewport;
    if (!visualViewport) {
      console.warn('[useKeyboardResize] visualViewport API not available');
      return;
    }

    const handleViewportResize = () => {
      // visualViewport.height gives us the visible height accounting for keyboard
      const newHeight = visualViewport.height;
      setViewportHeight(newHeight);

      console.log('[useKeyboardResize] Viewport resized:', {
        height: newHeight,
        windowInnerHeight: window.innerHeight,
        keyboardHeight: window.innerHeight - newHeight,
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

  // Detect if keyboard is visible by comparing viewport height to window height
  const isKeyboardVisible =
    viewportHeight !== null && viewportHeight < window.innerHeight - 50; // 50px threshold

  return {
    viewportHeight,
    isKeyboardVisible,
  };
}

/**
 * Combined hook for iOS viewport management
 * Returns styles and state for iOS-specific layout adjustments
 */
export function useIOSViewport() {
  const safeAreaInsets = useSafeArea();
  const { viewportHeight, isKeyboardVisible } = useKeyboardResize();

  // Container styles for iOS viewport
  const containerStyles: CSSProperties = isIOS()
    ? {
        // DO NOT add safe area padding to container - this causes black bars
        // Safe area should be handled by individual UI components (header, FAB, etc.)
        // Use visualViewport height when available (keyboard adjustments)
        ...(viewportHeight !== null && {
          height: `${viewportHeight}px`,
          maxHeight: `${viewportHeight}px`,
        }),
      }
    : {};

  // CSS class names based on viewport state
  const containerClassName =
    viewportHeight !== null
      ? 'w-screen overflow-hidden' // Fixed height from viewport
      : 'h-screen w-screen overflow-hidden'; // Full screen height

  return {
    // Safe area insets
    safeAreaInsets,

    // Keyboard state
    viewportHeight,
    isKeyboardVisible,

    // Styles to apply to container
    containerStyles,
    containerClassName,

    // Helper: whether iOS-specific features are active
    isIOSActive: isIOS(),
  };
}
