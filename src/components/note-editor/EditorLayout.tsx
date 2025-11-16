import type { ReactNode } from 'react';

import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { VisuallyHidden } from '@/components/ui/visually-hidden';

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
}: EditorLayoutProps) => {
  return (
    <div className="h-screen flex flex-col relative overflow-hidden bg-transparent rounded-xl">
      {header}

      <div className="flex-1 flex min-h-0">
        {/* Desktop Sidebar - Hidden on mobile */}
        <aside className="hidden sm:flex w-80 border-r border-border bg-muted flex-shrink-0 overflow-hidden flex-col">
          {sidebar}
        </aside>

        {/* Mobile Sidebar Drawer */}
        <Drawer open={isMobileSidebarOpen} onOpenChange={onMobileSidebarChange} direction="left">
          <DrawerContent className="h-full max-h-screen flex flex-col">
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
        <div className="flex-1 flex flex-col min-w-0">
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
