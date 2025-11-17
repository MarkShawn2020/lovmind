import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { isIOS } from '@/utils/platform';

interface EditorLayoutProps {
  header: ReactNode;
  sidebar: ReactNode;
  editor: ReactNode;
  toolbar: ReactNode;
  userMenu: ReactNode;
  profileModal: ReactNode;
  aboutModal: ReactNode;
  isMobileSidebarOpen: boolean;
  onMobileSidebarChange: (open: boolean) => void;
  /**
   * Mobile drawer variant
   * - "default": Slide-in drawer (desktop/Android style)
   * - "fullscreen": Full-screen drawer (iOS style)
   */
  mobileDrawerVariant?: 'default' | 'fullscreen';
}

export const EditorLayout = ({
  header,
  sidebar,
  editor,
  toolbar,
  userMenu,
  profileModal,
  aboutModal,
  isMobileSidebarOpen,
  onMobileSidebarChange,
  mobileDrawerVariant = 'default',
}: EditorLayoutProps) => {
  // iOS fullscreen variant: Drawer takes full width and hides header
  const isFullscreen = mobileDrawerVariant === 'fullscreen';
  const drawerClassName = isFullscreen
    ? "w-screen h-full max-h-screen flex flex-col"
    : "h-full max-h-screen flex flex-col";

  // iOS keyboard handling: adjust layout when keyboard appears
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!isIOS()) return;

    // Use Visual Viewport API to detect keyboard
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    const handleResize = () => {
      // Calculate keyboard height based on viewport change
      const viewportHeight = visualViewport.height;
      const windowHeight = window.innerHeight;
      const keyboardOffset = windowHeight - viewportHeight;
      setKeyboardHeight(Math.max(0, keyboardOffset));
    };

    visualViewport.addEventListener('resize', handleResize);
    visualViewport.addEventListener('scroll', handleResize);

    return () => {
      visualViewport.removeEventListener('resize', handleResize);
      visualViewport.removeEventListener('scroll', handleResize);
    };
  }, []);

  return (
    <div
      className="flex flex-col relative overflow-hidden bg-transparent rounded-xl"
      style={{
        // Use 100dvh (dynamic viewport height) for proper mobile support
        // On iOS, this accounts for browser chrome and safe areas
        height: '100dvh',
        // Fallback for older browsers
        minHeight: '100vh',
        // iOS: Adjust bottom padding when keyboard is visible
        paddingBottom: isIOS() && keyboardHeight > 0 ? `${keyboardHeight}px` : undefined,
      }}
    >
      {header}

      <div className="flex-1 flex min-h-0">
        {/* Desktop Sidebar - Hidden on mobile */}
        <aside className="hidden sm:flex w-80 border-r border-border bg-muted flex-shrink-0 overflow-hidden flex-col">
          {sidebar}
        </aside>

        {/* Mobile Sidebar Drawer */}
        <Drawer open={isMobileSidebarOpen} onOpenChange={onMobileSidebarChange} direction="left">
          <DrawerContent className={drawerClassName}>
            <VisuallyHidden>
              <DrawerTitle>Navigation Menu</DrawerTitle>
              <DrawerDescription>
                Browse and manage your notes from the sidebar
              </DrawerDescription>
            </VisuallyHidden>
            {sidebar}
          </DrawerContent>
        </Drawer>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Editor takes remaining space with internal scrolling */}
          <div className="flex-1 min-h-0 overflow-hidden bg-background">
            {editor}
          </div>
          {/* Toolbar fixed at bottom */}
          {toolbar}
        </div>
      </div>

      {userMenu}
      {profileModal}
      {aboutModal}
    </div>
  );
};
