import type { ReactNode } from 'react';

interface EditorLayoutProps {
  header: ReactNode;
  sidebar: ReactNode;
  editor: ReactNode;
  toolbar: ReactNode;
  userMenu: ReactNode;
  profileModal: ReactNode;
  aboutModal: ReactNode;
}

export const EditorLayout = ({
  header,
  sidebar,
  editor,
  toolbar,
  userMenu,
  profileModal,
  aboutModal,
}: EditorLayoutProps) => (
  <div className="h-screen flex flex-col relative overflow-hidden bg-transparent rounded-xl">
    {header}

    <div className="flex-1 flex min-h-0">
      <aside className="hidden sm:flex w-80 border-r border-border bg-muted flex-shrink-0 overflow-hidden flex-col">
        <div className="flex flex-col gap-2 flex-1 overflow-y-auto p-[var(--spacing-s)]">
          {sidebar}
        </div>
      </aside>

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
