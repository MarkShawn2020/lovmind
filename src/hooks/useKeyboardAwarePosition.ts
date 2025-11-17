import { useEffect, useState } from 'react';
import { isIOS } from '@/utils/platform';

interface KeyboardState {
  isVisible: boolean;
  height: number;
}

/**
 * Hook to detect iOS keyboard visibility and height using Visual Viewport API
 *
 * On iOS, when the keyboard appears:
 * - window.visualViewport.height decreases
 * - Keyboard height = window.innerHeight - visualViewport.height
 *
 * @returns KeyboardState with visibility and height information
 */
export function useKeyboardAwarePosition(): KeyboardState {
  const [keyboardState, setKeyboardState] = useState<KeyboardState>({
    isVisible: false,
    height: 0,
  });

  useEffect(() => {
    // Only run on iOS devices
    if (!isIOS()) return;

    // Check if visualViewport API is available (iOS 13+)
    if (!window.visualViewport) {
      console.warn('[useKeyboardAwarePosition] visualViewport API not available');
      return;
    }

    const handleViewportChange = () => {
      // Calculate keyboard height
      // When keyboard shows: visualViewport.height < window.innerHeight
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const windowHeight = window.innerHeight;
      const keyboardHeight = Math.max(0, windowHeight - viewportHeight);

      // iOS keyboard toolbar is ~44px, consider keyboard visible if height > 50px
      const isKeyboardVisible = keyboardHeight > 50;

      setKeyboardState({
        isVisible: isKeyboardVisible,
        height: keyboardHeight,
      });

      console.log('[useKeyboardAwarePosition]', {
        windowHeight,
        viewportHeight,
        keyboardHeight,
        isVisible: isKeyboardVisible,
      });
    };

    // Listen to viewport resize events (keyboard show/hide)
    window.visualViewport.addEventListener('resize', handleViewportChange);
    window.visualViewport.addEventListener('scroll', handleViewportChange);

    // Initial check
    handleViewportChange();

    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
    };
  }, []);

  return keyboardState;
}
