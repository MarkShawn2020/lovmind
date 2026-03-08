import { Plus } from 'lucide-react';
import { useCallback } from 'react';
import { Toaster } from 'sonner';
import { BaseMainWindow } from './components/shared/BaseMainWindow';
import { IOSEditorSheet } from './components/ios/IOSEditorSheet';
import { useMainWindowLogic } from './hooks/useMainWindowLogic';
import LovmindEditor from '@/components/lovmind-editor/lovmind-editor';
import EditorToolbar from './components/EditorToolbar';

/**
 * MainWindowIOS - Platform wrapper for BaseMainWindow on iOS
 *
 * iOS-specific features:
 * - Fixed 100vh container (no dynamic viewport adjustments)
 * - Keyboard handling delegated to IOSEditorSheet
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


  // iOS: Show FAB when in list view and sidebar is closed
  // Always show in list view since we're always in mobile mode
  const showFAB = logic.mobileView === 'list' && !logic.isMobileSidebarOpen;

  // iOS: Editor is shown in bottom sheet when mobileView='editor'
  const isEditorSheetOpen = logic.mobileView === 'editor';

  /**
   * Auto-focus editor when sheet becomes ready (after animation)
   * Uses retry mechanism to handle async editor initialization
   * Also tries to focus contenteditable directly for iOS keyboard
   */
  const handleSheetReady = useCallback(() => {
    console.log('[MainWindowIOS] Sheet ready, attempting to focus editor');

    let attempts = 0;
    const maxAttempts = 15;
    let rafId: number | null = null;

    const tryFocus = () => {
      attempts++;
      const editorInstance = logic.editorRef.current;

      if (editorInstance) {
        // Editor ref is available, call focus
        try {
          editorInstance.focus();
          console.log('[MainWindowIOS] ✅ Editor focused via ref (attempt', attempts, ')');

          // For iOS: also try to focus contenteditable element directly
          // This ensures keyboard is triggered
          setTimeout(() => {
            const editableEl = document.querySelector('[contenteditable="true"]') as HTMLElement;
            if (editableEl) {
              editableEl.focus();
              console.log('[MainWindowIOS] ✅ Also focused contenteditable element');
            }
          }, 50);

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
        // Last resort: try to focus contenteditable directly
        const editableEl = document.querySelector('[contenteditable="true"]') as HTMLElement;
        if (editableEl) {
          editableEl.focus();
          console.log('[MainWindowIOS] Last resort: focused contenteditable element');
        }
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
    <div className="h-screen w-screen overflow-hidden">
      {/* Hidden input to maintain keyboard in user gesture context (iOS workaround) */}
      <input
        id="ios-keyboard-anchor"
        type="text"
        inputMode="text"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '1px',
          height: '1px',
          opacity: 0,
          pointerEvents: 'none',
        }}
        aria-hidden="true"
        tabIndex={-1}
      />
      <BaseMainWindow
        logic={logic}
        // iOS: No window dragging support
        onHeaderMouseDown={undefined}
        // iOS: No multi-window support, open in same window
        onOpenNoteInNewWindow={logic.handleOpenNoteInCurrentWindow}
        // Force mobileView to always be 'list' - editor is shown in sheet overlay
        mobileView="list"
        onBackToList={async () => {
          // Auto-submit when leaving editor on iOS
          await logic.handleSubmit();
          logic.setMobileView('list');
        }}
        // iOS: No additional modals (no userMenu, no aboutModal)
        additionalModals={null}
        // iOS: Use fullscreen drawer for better mobile experience
        mobileDrawerVariant="fullscreen"
        editorPlaceholder="此时此刻，你在想什么呢？"
      />

      {/* FAB (Floating Action Button) for quick note creation on iOS */}
      {showFAB && (
        <button
          onClick={() => {
            // iOS Keyboard Workaround:
            // 1. Immediately focus hidden input in user gesture context
            const anchor = document.getElementById('ios-keyboard-anchor') as HTMLInputElement;
            if (anchor) {
              anchor.focus();
              console.log('[MainWindowIOS FAB] Focused keyboard anchor to maintain gesture');
            }

            // 2. Open sheet
            logic.handleCreateNewNote();

            // 3. Transfer focus to real editor when it's ready
            // Use RAF chain to wait for DOM update
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  const editableEl = document.querySelector('[contenteditable="true"]') as HTMLElement;
                  if (editableEl) {
                    editableEl.focus();
                    console.log('[MainWindowIOS FAB] Transferred focus from anchor to editor');
                  }
                });
              });
            });
          }}
          className="fixed bottom-8 right-8 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors active:scale-95 z-50 sm:hidden"
          aria-label="新建笔记"
        >
          <Plus size={24} />
        </button>
      )}

      {/* iOS Bottom Sheet for Editor */}
      <IOSEditorSheet
        isOpen={isEditorSheetOpen}
        onClose={async () => {
          // Auto-submit when sheet is closed (tap backdrop or close button)
          await logic.handleSubmit();
          logic.setMobileView('list');
        }}
        maxHeightRatio={0.67} // 2/3 of screen height
        onSheetReady={handleSheetReady} // Auto-focus editor when sheet appears
      >
        {/* Editor Content - Fixed height 240px */}
        <div className="flex flex-col overflow-y-auto overflow-x-hidden bg-background" style={{ height: '240px' }}>
          <LovmindEditor
            key={logic.viewingNoteId ?? `create-mode-${logic.editorSessionKey}`}
            editorId={logic.viewingNoteId ?? `create-mode-${logic.editorSessionKey}`}
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
          onBackToList={async () => {
            await logic.handleSubmit();
            logic.setMobileView('list');
          }}
        />
      </IOSEditorSheet>

      {/* Toast notifications */}
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'var(--popover)',
            color: 'var(--popover-foreground)',
            border: '1px solid var(--border)',
          },
        }}
      />
    </div>
  );
}

export default MainWindowIOS;
