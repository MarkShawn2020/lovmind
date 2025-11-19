import { useState, useCallback, useRef, useEffect } from 'react';
import { Archive, Sparkles, Mail, LogOut, UserCircle, Info, Settings, X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

import { isTauri } from './utils/tauri';
import { Note } from './store';
import { BaseMainWindow } from './components/shared/BaseMainWindow';
import { useMainWindowLogic } from './hooks/useMainWindowLogic';
import { useTauriWindowEvents } from './hooks/useTauriWindowEvents';
import { useWindowOperations } from './hooks/useWindowOperations';
import lovpenLogo from './assets/lovpen-logo.svg';
import packageJson from '../package.json';

/**
 * MainWindow (Desktop) - Platform wrapper for BaseMainWindow
 *
 * Desktop-specific features:
 * - Window dragging support
 * - User menu dropdown (profile, settings, archive toggle, about, contact, quit)
 * - About modal dialog
 * - Multi-window support (float windows)
 * - Floating Action Button (FAB) for mobile responsive layout
 * - Tauri window events integration
 */
function MainWindow() {
  // Get shared business logic
  const logic = useMainWindowLogic({
    useMobileView: true,
    enableTauriEvents: false, // Handled separately below
    enableBroadcastChannel: true,
  });

  // Desktop-specific state
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });

  // Desktop-specific refs
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const userButtonRef = useRef<HTMLButtonElement | null>(null);

  // Desktop-specific hooks
  useTauriWindowEvents();
  const { openNoteInNewWindow } = useWindowOperations(logic.notes, () => {});

  // Desktop-specific handlers
  const handleUserMenuToggle = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (userButtonRef.current) {
      const rect = userButtonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
    setIsUserMenuOpen((prev) => !prev);
  }, []);

  const handleHeaderMouseDown = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const appWindow = getCurrentWindow();
      await appWindow.startDragging();
    } catch (error) {
      console.error('Failed to start dragging:', error);
    }
  }, []);

  const handleBackToList = useCallback(() => {
    if (logic.isMobile) {
      logic.setMobileView('list');
    }
  }, [logic]);

  const handleOpenNoteInNewWindow = useCallback(
    logic.isMobileSidebarOpen
      ? async (note: Note) => {
          logic.setIsMobileSidebarOpen(false);
          await openNoteInNewWindow(note);
        }
      : openNoteInNewWindow,
    [logic, openNoteInNewWindow]
  );

  // Click outside to close user menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node) &&
        userButtonRef.current &&
        !userButtonRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isUserMenuOpen]);

  // Desktop-specific UI: User menu dropdown
  const userMenuNode = !isUserMenuOpen ? null : (
    <div
      ref={userMenuRef}
      className="fixed w-48 bg-white rounded-lg shadow-2xl border border-gray-200 py-1"
      style={{
        top: `${menuPosition.top}px`,
        right: `${menuPosition.right}px`,
        zIndex: 99999,
      }}
    >
      <button
        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-none bg-transparent cursor-pointer transition-colors"
        onClick={() => {
          setIsUserMenuOpen(false);
          logic.setIsProfileModalOpen(true);
        }}
      >
        <UserCircle size={16} />
        Profile
      </button>

      <button
        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-none bg-transparent cursor-pointer transition-colors"
        onClick={async () => {
          setIsUserMenuOpen(false);
          if (isTauri()) {
            try {
              await invoke('open_settings_window');
            } catch (error) {
              console.error('Failed to open settings window:', error);
            }
          }
        }}
      >
        <Settings size={16} />
        Settings
      </button>

      <button
        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-none bg-transparent cursor-pointer transition-colors"
        onClick={() => {
          setIsUserMenuOpen(false);
          logic.setShowArchived(!logic.showArchived);
        }}
      >
        <Archive size={16} />
        {logic.showArchived ? 'Active Notes' : 'Archive'}
      </button>

      <div className="border-t border-gray-200 my-1" />

      <button
        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-none bg-transparent cursor-pointer transition-colors"
        onClick={() => {
          setIsUserMenuOpen(false);
          setIsAboutModalOpen(true);
        }}
      >
        <Info size={16} />
        About
      </button>

      <button
        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center justify-between border-none bg-transparent cursor-default"
        onClick={(e) => e.preventDefault()}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={16} />
          Version
        </div>
        <span className="text-xs text-gray-500">v{packageJson.version}</span>
      </button>

      <button
        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-none bg-transparent cursor-pointer transition-colors"
        onClick={async () => {
          setIsUserMenuOpen(false);
          if (isTauri()) {
            try {
              const { openUrl } = await import('@tauri-apps/plugin-opener');
              await openUrl('mailto:shawninjuly@gmail.com');
            } catch (error) {
              console.error('Failed to open email client:', error);
            }
          } else {
            window.open('mailto:shawninjuly@gmail.com', '_blank');
          }
        }}
      >
        <Mail size={16} />
        Contact
      </button>

      <div className="border-t border-gray-200 my-1" />
      <button
        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border-none bg-transparent cursor-pointer transition-colors"
        onClick={async () => {
          setIsUserMenuOpen(false);
          if (isTauri()) {
            try {
              await invoke('quit_app');
            } catch (error) {
              console.error('Failed to exit:', error);
            }
          }
        }}
      >
        <LogOut size={16} />
        Quit
      </button>
    </div>
  );

  // Desktop-specific UI: About modal
  const aboutModalNode = !isAboutModalOpen ? null : (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100000]"
      onClick={() => setIsAboutModalOpen(false)}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-[500px] max-w-[90vw] max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <img src={lovpenLogo} alt="Lovmind" className="w-10 h-10" />
              <div>
                <h2 className="text-xl font-bold text-gray-800">Lovmind</h2>
                <p className="text-sm text-gray-500">v{packageJson.version}</p>
              </div>
            </div>
            <button
              onClick={() => setIsAboutModalOpen(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            >
              <X size={20} />
            </button>
          </div>

          <p className="text-gray-600 mb-6">随时随地，捕捉灵感。闪电般快速的浮动笔记应用。</p>

          <div className="space-y-3 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">主要特性</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span>
                  <strong>⌘N 全局快捷键</strong> - 任何时候瞬间唤起
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span>
                  <strong>浮动窗口</strong> - 置顶显示，快速记录
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span>
                  <strong>富文本编辑</strong> - 所见即所得，支持 Markdown 快捷输入
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span>
                  <strong>多窗口编辑</strong> - 每条笔记独立窗口
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span>
                  <strong>数据本地存储</strong> - 当前为特发版，跨端云同步版本即将推出
                </span>
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t border-gray-200 space-y-3">
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-700 mb-1">Lovpen</p>
              <p className="text-xs text-gray-500">专注于创造高效优雅的效率工具</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">关注公众号</p>
              <p className="text-sm font-medium text-gray-700">手工川</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Desktop: show FAB when in list view on mobile screens
  const showFAB = logic.isMobile && logic.mobileView === 'list';

  return (
    <>
      <BaseMainWindow
        logic={logic}
        onHeaderMouseDown={handleHeaderMouseDown}
        onOpenNoteInNewWindow={handleOpenNoteInNewWindow}
        mobileView={logic.mobileView}
        onBackToList={handleBackToList}
        onUserMenuToggle={handleUserMenuToggle}
        userButtonRef={userButtonRef}
        additionalModals={
          <>
            {userMenuNode}
            {aboutModalNode}
          </>
        }
        mobileDrawerVariant="default"
        editorPlaceholder="此时此刻，你在想什么呢？"
      />

      {/* FAB (Floating Action Button) for quick note creation on mobile responsive layout */}
      {showFAB && (
        <button
          onClick={logic.handleCreateNewNote}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 w-12 h-12 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors active:scale-95 z-50 sm:hidden"
          aria-label="新建笔记"
        >
          <svg viewBox="-98.605 -108 1183.26 1296" className="w-7 h-7 fill-current">
            <g>
              <path d="M281.73,892.18V281.73C281.73,126.13,155.6,0,0,0l0,0v610.44C0,766.04,126.13,892.18,281.73,892.18z" />
              <path d="M633.91,1080V469.56c0-155.6-126.13-281.73-281.73-281.73l0,0v610.44C352.14,953.87,478.31,1080,633.91,1080L633.91,1080z" />
              <path d="M704.32,91.16L704.32,91.16v563.47l0,0c155.6,0,281.73-126.13,281.73-281.73S859.92,91.16,704.32,91.16z" />
            </g>
          </svg>
        </button>
      )}
    </>
  );
}

export default MainWindow;
