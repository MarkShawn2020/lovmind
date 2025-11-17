import { useRef } from 'react';
import { useAtomValue } from 'jotai';
import { Plus } from 'lucide-react';

import LovmindEditor from '@/components/lovmind-editor/lovmind-editor.tsx';
import EditorToolbar from './components/EditorToolbar';
import { NotesSidebarContainer } from './components/shared/NotesSidebarContainer';
import { useNoteEventSync } from './hooks/useNoteEventSync';
import { useImageHeightSync } from './hooks/useImageHeightSync';
import { useNoteOperations } from './hooks/useNoteOperations';
import { useNoteSubmit } from './hooks/useNoteSubmit';
import { editorContentAtom, notesAtom } from './atoms/noteAtoms';
import type { LovmindEditorRef } from '@/components/lovmind-editor/lovmind-editor.tsx';
import {
  NavigationStackProvider,
  useNavigationStack,
  NavigationHeader,
  NavigationPage,
  NavigationContent,
  useNoteNavigation,
} from '@/components/mobile/NavigationStack';
import { IOSLayout } from '@/components/mobile/IOSLayout';

/**
 * iOS Main Window
 * Uses navigation stack instead of multi-window approach
 */
function MainWindowIOSInner() {
  const editorRef = useRef<LovmindEditorRef | null>(null);

  // Event sync hooks
  useNoteEventSync({ enableBroadcastChannel: true });
  useImageHeightSync();

  // Navigation
  const { currentItem } = useNavigationStack();
  const { openNote, createNote, closeNote } = useNoteNavigation();

  // Read from atoms
  const editorContent = useAtomValue(editorContentAtom);
  const notes = useAtomValue(notesAtom);

  // Business logic hooks
  const { deleteNote, togglePin, toggleArchive } = useNoteOperations();

  // Determine current mode
  const isListView = currentItem?.type === 'list';
  const isEditorView = currentItem?.type === 'editor';
  const currentNoteId = currentItem?.noteId || null;

  const { handleSubmit } = useNoteSubmit({
    noteId: currentNoteId,
    editorRef,
    resetEditorAfterCreate: false,
    onNoteIdChange: () => {
      // After creating note, return to list
      closeNote();
    },
  });

  // Render list view
  if (isListView) {
    return (
      <NavigationPage>
        <NavigationHeader
          title="Lovmind"
          showBackButton={false}
        />
        <NavigationContent>
          <NotesSidebarContainer
            notes={notes}
            currentNoteId={undefined}
            showArchived={false}
            onOpenNote={openNote}
            onTogglePin={togglePin}
            onToggleArchive={toggleArchive}
            onDeleteNote={deleteNote}
            onDuplicateNote={async (note) => {
              console.log('Duplicate:', note);
            }}
          />
        </NavigationContent>

        {/* Floating Action Button for quick note creation */}
        <button
          onClick={createNote}
          className="fixed bottom-8 right-8 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors active:scale-95 z-50"
          aria-label="新建笔记"
        >
          <Plus size={24} />
        </button>
      </NavigationPage>
    );
  }

  // Render editor view
  if (isEditorView) {
    return (
      <NavigationPage>
        <NavigationHeader
          title={currentItem?.title || '新笔记'}
          onBack={closeNote}
        />
        <NavigationContent className="flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <LovmindEditor
              key={currentNoteId || 'create-mode'}
              noteId={currentNoteId}
              onSubmit={handleSubmit}
              placeholder="此时此刻，你在想什么呢？"
              ref={editorRef}
            />
          </div>
          <EditorToolbar
            mode="float"
            onSubmit={handleSubmit}
            submitDisabled={editorContent.isEmpty}
            currentTags={editorContent.tags}
            allNotes={notes}
            editorRef={editorRef}
            hideSubmitButton={false}
          />
        </NavigationContent>
      </NavigationPage>
    );
  }

  return null;
}

/**
 * Main Window for iOS
 */
function MainWindowIOS() {
  return (
    <IOSLayout>
      <NavigationStackProvider>
        <MainWindowIOSInner />
      </NavigationStackProvider>
    </IOSLayout>
  );
}

export default MainWindowIOS;
