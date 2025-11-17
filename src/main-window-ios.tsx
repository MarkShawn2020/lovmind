import { Plus } from 'lucide-react';
import { useCallback } from 'react';
import { BaseMainWindow } from './components/shared/BaseMainWindow';
import { IOSEditorSheet } from './components/ios/IOSEditorSheet';
import { useMainWindowLogic } from './hooks/useMainWindowLogic';
import { useIOSViewport } from './hooks/useIOSPlatform';
import LovmindEditor from '@/components/lovmind-editor/lovmind-editor';
import EditorToolbar from './components/EditorToolbar';

/**
 * MainWindowIOS - Platform wrapper for BaseMainWindow on iOS
 *
 * iOS-specific features:
 * - Safe area handling (notch, home indicator) via useIOSViewport
 * - Keyboard resize detection via visualViewport API
 * - Bottom sheet for editor (iOS-native UX)
 * - Auto-focus editor when sheet appears (triggers keyboard)
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

  // iOS: Editor is shown in bottom sheet when mobileView='editor'
  const isEditorSheetOpen = logic.mobileView === 'editor';

  /**
   * Auto-focus editor when sheet becomes ready (after animation)
   * Uses retry mechanism to handle async editor initialization
   */
  const handleSheetReady = useCallback(() => {
    console.log('[MainWindowIOS] Sheet ready, attempting to focus editor');

    let attempts = 0;
    const maxAttempts = 10;
    let rafId: number | null = null;

    const tryFocus = () => {
      attempts++;
      const editorInstance = logic.editorRef.current;

      if (editorInstance) {
        // Editor ref is available, call focus
        try {
          editorInstance.focus();
          console.log('[MainWindowIOS] ✅ Editor focused successfully (attempt', attempts, ')');
          return; // Success, stop retrying
        } catch (error) {
          console.error('[MainWindowIOS] ❌ Failed to focus editor:', error);
        }
      }

      // Retry if we haven't exhausted attempts
      if (attempts < maxAttempts) {
        rafId = requestAnimationFrame(tryFocus);
      } else {
        console.warn('[MainWindowIOS] ⚠️ Failed to focus editor after', maxAttempts, 'attempts');
      }
    };

    // Start first attempt
    tryFocus();

    // Cleanup function (though this won't be called in this context)
    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [logic.editorRef]);

  return (
    <div className={containerClassName} style={containerStyles}>
      <BaseMainWindow
        logic={logic}
        // iOS: No window dragging support
        onHeaderMouseDown={undefined}
        // iOS: No multi-window support, open in same window
        onOpenNoteInNewWindow={logic.handleOpenNoteInCurrentWindow}
        // Force mobileView to always be 'list' - editor is shown in sheet overlay
        mobileView="list"
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

      {/* iOS Bottom Sheet for Editor */}
      <IOSEditorSheet
        isOpen={isEditorSheetOpen}
        onClose={() => logic.setMobileView('list')}
        maxHeightRatio={0.67} // 2/3 of screen height
        onSheetReady={handleSheetReady} // Auto-focus editor when sheet appears
      >
        {/* Editor Content - Fixed height 240px */}
        <div className="flex flex-col overflow-y-auto overflow-x-hidden bg-background" style={{ height: '240px' }}>
          <LovmindEditor
            key={logic.viewingNoteId || 'create-mode'}
            noteId={logic.viewingNoteId}
            onSubmit={logic.handleSubmit}
            placeholder="此时此刻，你在想什么呢？"
            ref={logic.editorRef}
          />
        </div>

        {/* Toolbar */}
        <EditorToolbar
          mode="main"
          onSubmit={logic.handleSubmit}
          submitDisabled={logic.editorContent.isEmpty}
          currentTags={logic.editorContent.tags}
          allNotes={logic.notes}
          editorRef={logic.editorRef}
          onOpenMobileSidebar={() => logic.setIsMobileSidebarOpen(true)}
          hideSubmitButton={false}
          onBackToList={() => logic.setMobileView('list')}
        />
      </IOSEditorSheet>
    </div>
  );
}

export default MainWindowIOS;
