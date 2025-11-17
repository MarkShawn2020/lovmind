import { Plus } from 'lucide-react';
import { BaseMainWindow } from './components/shared/BaseMainWindow';
import { useMainWindowLogic } from './hooks/useMainWindowLogic';
import { useIOSViewport } from './hooks/useIOSPlatform';

/**
 * MainWindowIOS - Platform wrapper for BaseMainWindow on iOS
 *
 * iOS-specific features:
 * - Safe area handling (notch, home indicator) via useIOSViewport
 * - Keyboard resize detection via visualViewport API
 * - Fullscreen drawer for sidebar (better for small screens)
 * - FAB (Floating Action Button) for quick note creation
 * - No window dragging (not supported on iOS)
 * - No multi-window support (opens notes in same window)
 * - No user menu or about modal (simplified UI for mobile)
 * - Auto-closes sidebar after opening note (better mobile UX)
 */
function MainWindowIOS() {
  // Get shared business logic
  const logic = useMainWindowLogic({
    useMobileView: true, // iOS always uses mobile view navigation
    enableTauriEvents: false, // No Tauri events on iOS
    enableBroadcastChannel: true,
  });

  // iOS-specific viewport handling
  const { containerStyles, containerClassName } = useIOSViewport();

  // iOS: Show FAB when in list view and sidebar is closed
  // Always show in list view since we're always in mobile mode
  const showFAB = logic.mobileView === 'list' && !logic.isMobileSidebarOpen;

  return (
    <div className={containerClassName} style={containerStyles}>
      <BaseMainWindow
        logic={logic}
        // iOS: No window dragging support
        onHeaderMouseDown={undefined}
        // iOS: No multi-window support, open in same window
        onOpenNoteInNewWindow={logic.handleOpenNoteInCurrentWindow}
        mobileView={logic.mobileView}
        onBackToList={() => logic.setMobileView('list')}
        // iOS: No additional modals (no userMenu, no aboutModal)
        additionalModals={null}
        // iOS: Use fullscreen drawer for better mobile experience
        mobileDrawerVariant="fullscreen"
        editorPlaceholder="此时此刻，你在想什么呢？"
      />

      {/* FAB (Floating Action Button) for quick note creation on iOS */}
      {showFAB && (
        <button
          onClick={logic.handleCreateNewNote}
          className="fixed bottom-8 right-8 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors active:scale-95 z-50 sm:hidden"
          aria-label="新建笔记"
          style={{
            // iOS safe area bottom padding
            bottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))',
          }}
        >
          <Plus size={24} />
        </button>
      )}
    </div>
  );
}

export default MainWindowIOS;
