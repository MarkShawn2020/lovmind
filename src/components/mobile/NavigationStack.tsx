import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Note } from '@/store';

/**
 * Navigation Stack for iOS
 * Replaces multi-window functionality with push/pop navigation
 */

interface NavigationStackItem {
  id: string;
  type: 'list' | 'editor';
  noteId?: string;
  title?: string;
}

interface NavigationStackContextValue {
  stack: NavigationStackItem[];
  currentItem: NavigationStackItem | null;
  push: (item: NavigationStackItem) => void;
  pop: () => void;
  popToRoot: () => void;
  canGoBack: boolean;
}

const NavigationStackContext = createContext<NavigationStackContextValue | null>(null);

export function useNavigationStack() {
  const context = useContext(NavigationStackContext);
  if (!context) {
    throw new Error('useNavigationStack must be used within NavigationStackProvider');
  }
  return context;
}

interface NavigationStackProviderProps {
  children: ReactNode;
}

export function NavigationStackProvider({ children }: NavigationStackProviderProps) {
  const [stack, setStack] = useState<NavigationStackItem[]>([
    { id: 'root', type: 'list' },
  ]);

  const currentItem = stack[stack.length - 1] || null;

  const push = useCallback((item: NavigationStackItem) => {
    setStack((prev) => [...prev, item]);
  }, []);

  const pop = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const popToRoot = useCallback(() => {
    setStack([{ id: 'root', type: 'list' }]);
  }, []);

  const canGoBack = stack.length > 1;

  return (
    <NavigationStackContext.Provider
      value={{ stack, currentItem, push, pop, popToRoot, canGoBack }}
    >
      {children}
    </NavigationStackContext.Provider>
  );
}

interface NavigationHeaderProps {
  title?: string;
  onBack?: () => void;
  showBackButton?: boolean;
  rightActions?: ReactNode;
}

export function NavigationHeader({
  title = 'Lovmind',
  onBack,
  showBackButton = true,
  rightActions,
}: NavigationHeaderProps) {
  const { canGoBack, pop } = useNavigationStack();

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
    } else {
      pop();
    }
  }, [onBack, pop]);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background sticky top-0 z-50">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {showBackButton && canGoBack && (
          <button
            onClick={handleBack}
            className="p-2 -ml-2 hover:bg-accent rounded-lg transition-colors touch-manipulation"
            aria-label="返回"
          >
            <ChevronLeft size={24} />
          </button>
        )}
        <h1 className="text-lg font-semibold truncate">{title}</h1>
      </div>
      {rightActions && <div className="flex items-center gap-2">{rightActions}</div>}
    </div>
  );
}

interface NavigationPageProps {
  children: ReactNode;
  className?: string;
}

export function NavigationPage({ children, className = '' }: NavigationPageProps) {
  return (
    <div className={`h-full flex flex-col overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

interface NavigationContentProps {
  children: ReactNode;
  className?: string;
}

export function NavigationContent({ children, className = '' }: NavigationContentProps) {
  return (
    <div className={`flex-1 overflow-y-auto overflow-x-hidden ${className}`}>
      {children}
    </div>
  );
}

/**
 * Hook to navigate to a note editor (iOS navigation stack)
 */
export function useNoteNavigation() {
  const { push, pop } = useNavigationStack();

  const openNote = useCallback(
    (note: Note) => {
      push({
        id: `note-${note.id}`,
        type: 'editor',
        noteId: note.id,
        title: note.title || '无标题',
      });
    },
    [push]
  );

  const createNote = useCallback(() => {
    const tempId = `temp-${Date.now()}`;
    push({
      id: tempId,
      type: 'editor',
      noteId: undefined,
      title: '新笔记',
    });
  }, [push]);

  const closeNote = useCallback(() => {
    pop();
  }, [pop]);

  return { openNote, createNote, closeNote };
}
