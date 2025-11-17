import { useState, useEffect } from 'react';

/**
 * Hook to detect if the current viewport is mobile-sized
 * Uses the Tailwind 'sm' breakpoint (640px) as the threshold
 *
 * @returns true if viewport width < 640px, false otherwise
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    // Initialize with current window size
    if (typeof window !== 'undefined') {
      return window.matchMedia('(max-width: 639px)').matches;
    }
    return false;
  });

  useEffect(() => {
    // Use matchMedia for better performance than resize event
    const mediaQuery = window.matchMedia('(max-width: 639px)');

    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };

    // Modern browsers use addEventListener
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return isMobile;
}
