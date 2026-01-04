import type { ReactNode } from 'react';

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
  /**
   * Mobile view control
   * - "list": Show sidebar on mobile (master view)
   * - "editor": Show editor on mobile (detail view)
   * - undefined: Use drawer-based navigation (legacy behavior)
   */
  mobileView?: 'list' | 'editor';
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
  mobileView,
}: EditorLayoutProps) => {
  // iOS fullscreen variant: Drawer takes full width and hides header
  const isFullscreen = mobileDrawerVariant === 'fullscreen';
  const drawerClassName = isFullscreen
    ? "w-screen h-full max-h-screen flex flex-col"
    : "h-full max-h-screen flex flex-col";

  // iOS: No rounded corners (full-screen native aesthetic)
  // Desktop: Rounded corners (floating window aesthetic)
  const containerClassName = isIOS()
    ? "h-full flex flex-col relative overflow-hidden bg-transparent"
    : "h-full flex flex-col relative overflow-hidden bg-transparent rounded-xl";

  // Determine mobile layout behavior based on mobileView prop
  const useMobileViewSwitching = mobileView !== undefined;

  return (
    <div className={containerClassName}>
      {header}

      <div className="flex-1 flex min-h-0">
        {/* Desktop Sidebar - Always visible on sm+ screens */}
        <aside className="hidden sm:flex w-80 border-r border-border bg-muted flex-shrink-0 overflow-hidden flex-col">
          {sidebar}
        </aside>

        {/* Mobile View Switching: Show sidebar OR editor based on mobileView */}
        {useMobileViewSwitching && (
          <>
            {/* Mobile Sidebar - Shown when mobileView === 'list' */}
            <aside className={`
              sm:hidden w-full border-r border-border bg-muted flex-shrink-0 overflow-hidden flex-col
              ${mobileView === 'list' ? 'flex' : 'hidden'}
            `}>
              {sidebar}
            </aside>

            {/* Mobile Editor Container - CSS visibility only, NO duplicate rendering */}
            {/* Editor is rendered once below in the shared content area */}
          </>
        )}

        {/* Legacy Mobile Sidebar Drawer - Only used when mobileView is undefined */}
        {!useMobileViewSwitching && (
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
        )}

        {/* Shared Editor Content Area - Single instance for both mobile and desktop */}
        {/* On mobile with view switching: hidden when mobileView === 'list' */}
        {/* On desktop: always visible */}
        <div className={`
          flex-1 flex-col min-w-0
          ${useMobileViewSwitching
            ? (mobileView === 'editor' ? 'flex' : 'hidden sm:flex')
            : 'flex'
          }
        `}>
          <div className="flex-1 flex flex-col relative overflow-y-auto overflow-x-hidden min-h-0 bg-background">
            {editor}
          </div>
          {toolbar}
        </div>
      </div>

      {userMenu}
      {profileModal}
      {aboutModal}
    </div>
  );
};
