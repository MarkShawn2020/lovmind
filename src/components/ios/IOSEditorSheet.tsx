import { ReactNode, useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface IOSEditorSheetProps {
  /**
   * Whether the sheet is visible
   */
  isOpen: boolean;

  /**
   * Callback when sheet should close (user taps backdrop or close button)
   */
  onClose: () => void;

  /**
   * Editor content to render inside sheet
   */
  children: ReactNode;

  /**
   * Optional: Custom max height as percentage of viewport (default: 0.67 for 2/3)
   */
  maxHeightRatio?: number;

  /**
   * Optional: Callback when sheet animation completes and is ready for interaction
   * Useful for triggering auto-focus after sheet appears
   */
  onSheetReady?: () => void;
}

/**
 * IOSEditorSheet - iOS-style bottom sheet for editor
 *
 * Features:
 * - Slides up from bottom with iOS-native animation
 * - Rounded top corners (20px)
 * - Backdrop with blur effect
 * - Dynamic height calculation using visualViewport API
 * - Ensures sheet + keyboard ≤ 2/3 screen height
 * - Tap backdrop or close button to dismiss
 */
export function IOSEditorSheet({
  isOpen,
  onClose,
  children,
  maxHeightRatio = 0.67, // 2/3 of screen
  onSheetReady,
}: IOSEditorSheetProps) {
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  // Initialize with correct height to avoid layout shift
  const [sheetHeight, setSheetHeight] = useState(() => {
    const vv = window.visualViewport;
    const vh = vv ? vv.height : window.innerHeight;
    const calculatedHeight = Math.min(window.innerHeight * maxHeightRatio, vh);
    console.log('[IOSEditorSheet] Initial height:', {
      windowHeight: window.innerHeight,
      visualViewportHeight: vh,
      maxHeightRatio,
      calculatedHeight,
    });
    return calculatedHeight;
  });
  // Initialize with correct top position to avoid bottom → top shift
  const [sheetTop, setSheetTop] = useState(() => {
    const vv = window.visualViewport;
    if (!vv) return window.innerHeight * (1 - maxHeightRatio);
    const vh = vv.height;
    const offsetTop = vv.offsetTop || 0;
    const height = Math.min(window.innerHeight * maxHeightRatio, vh);
    const calculatedTop = offsetTop + (vh - height);
    console.log('[IOSEditorSheet] Initial top:', {
      visualViewportHeight: vh,
      offsetTop,
      height,
      calculatedTop,
    });
    return calculatedTop;
  });

  // Track keyboard height from visualViewport
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Monitor visualViewport for keyboard changes
  useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    const handleResize = () => {
      const newViewportHeight = visualViewport.height;
      setViewportHeight(newViewportHeight);

      // Calculate keyboard height (screen height - visible viewport height)
      const calcKeyboardHeight = window.innerHeight - newViewportHeight;
      setKeyboardHeight(calcKeyboardHeight);

      // Calculate max sheet height: 2/3 of total screen OR viewport height (whichever is smaller)
      // This ensures when keyboard appears, sheet shrinks to fit
      const maxHeight = Math.min(
        window.innerHeight * maxHeightRatio,
        newViewportHeight
      );

      setSheetHeight(maxHeight);

      console.log('[IOSEditorSheet] Viewport changed:', {
        viewportHeight: newViewportHeight,
        windowHeight: window.innerHeight,
        keyboardHeight: calcKeyboardHeight,
        calculatedSheetHeight: maxHeight,
      });
    };

    // Initial calculation
    handleResize();

    visualViewport.addEventListener('resize', handleResize);
    visualViewport.addEventListener('scroll', handleResize);

    return () => {
      visualViewport.removeEventListener('resize', handleResize);
      visualViewport.removeEventListener('scroll', handleResize);
    };
  }, [maxHeightRatio]);

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Trigger onSheetReady callback after sheet animation completes
  useEffect(() => {
    if (!isOpen || !onSheetReady) return;

    // Wait for slide-up animation to complete (300ms) + small buffer for DOM to stabilize
    const timer = setTimeout(() => {
      console.log('[IOSEditorSheet] Sheet animation complete, triggering onSheetReady');
      onSheetReady();
    }, 350); // 300ms animation + 50ms buffer

    return () => clearTimeout(timer);
  }, [isOpen, onSheetReady]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300"
        style={{
          opacity: isOpen ? 1 : 0,
        }}
        onClick={onClose}
        aria-label="关闭编辑器"
      />

      {/* Sheet Container */}
      <div
        className="fixed left-0 right-0 z-50 flex flex-col bg-background shadow-2xl ease-out overflow-hidden"
        style={{
          // Stick to bottom of screen
          bottom: 0,
          // Control height via maxHeight
          maxHeight: `${sheetHeight}px`,
          borderTopLeftRadius: '20px',
          borderTopRightRadius: '20px',
          // Smooth transition
          transition: isOpen
            ? 'max-height 0.3s ease-out, transform 0.3s ease-out'
            : 'transform 0.3s ease-out',
          // Combine slide-up animation + keyboard offset
          transform: isOpen
            ? (keyboardHeight > 0 ? `translateY(-${keyboardHeight}px)` : 'translateY(0)')
            : 'translateY(100%)',
        }}
      >
        {/* Drag Handle */}
        <div className="flex-shrink-0 flex items-center justify-center py-2 bg-background/95 backdrop-blur-sm sticky top-0 z-10">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-2 p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
            aria-label="关闭"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Sheet Content - No flex-1, let content determine height */}
        <div className="flex flex-col flex-shrink-0">
          {children}
        </div>
      </div>
    </>
  );
}
