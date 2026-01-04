import React from 'react';
import { User } from 'lucide-react';

import logo from '@/assets/logo.svg';
import type { UserProfile } from '@/hooks/useUserProfile';
import type { NoteStatsSummary } from '@/features/note/types';
import type { MainViewMode } from '@/store';
import { isIOS } from '@/utils/platform';

interface MainHeaderProps {
  noteStats: NoteStatsSummary;
  todoCount: number;
  userProfile: UserProfile;
  onHeaderMouseDown?: () => void;
  onUserMenuToggle: (event: React.MouseEvent<HTMLButtonElement>) => void;
  userButtonRef: React.RefObject<HTMLButtonElement | null>;
  viewMode: MainViewMode;
  onViewModeChange: (mode: MainViewMode) => void;
}

export const MainHeader = ({
  noteStats,
  todoCount,
  userProfile,
  onHeaderMouseDown,
  onUserMenuToggle,
  userButtonRef,
  viewMode,
  onViewModeChange,
}: MainHeaderProps) => {
  // iOS: No top border radius + extra vertical padding for better spacing
  // Desktop: Rounded top corners (floating window aesthetic)
  const headerClassName = isIOS()
    ? "px-[var(--spacing-text)] pb-4 bg-primary text-primary-foreground shadow-[0_2px_8px_rgba(0,0,0,0.08)] flex justify-between items-center select-none flex-shrink-0 cursor-move"
    : "h-[60px] px-[var(--spacing-text)] py-[var(--spacing-s)] bg-primary text-primary-foreground shadow-[0_2px_8px_rgba(0,0,0,0.08)] flex justify-between items-center rounded-t-xl select-none flex-shrink-0 cursor-move";

  // iOS: Add top padding for status bar (44px) + extra spacing (1rem)
  const headerStyle = isIOS()
    ? {
        paddingTop: 'calc(44px + 1rem)', // Status bar height + spacing
      }
    : {};

  return (
    <div
      className={headerClassName}
      style={headerStyle}
      onMouseDown={onHeaderMouseDown}
    >
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-0.5">
          <img
            src={logo}
            alt="Lovmind"
            className="h-7 w-auto brightness-0 invert select-none"
            draggable={false}
          />
          <span className="text-2xl" style={{ fontFamily: 'Caveat, cursive' }}>Lovmind</span>
        </div>
        <div className="flex items-center gap-1 bg-white/10 rounded-lg p-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewModeChange('notes');
            }}
            className={`px-2.5 py-1 text-sm font-medium rounded-md transition-all cursor-pointer border-none ${
              viewMode === 'notes'
                ? 'bg-white/20 text-white'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            笔记 ({noteStats.total})
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewModeChange('todos');
            }}
            className={`px-2.5 py-1 text-sm font-medium rounded-md transition-all cursor-pointer border-none ${
              viewMode === 'todos'
                ? 'bg-white/20 text-white'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            任务 ({todoCount})
          </button>
        </div>
      </div>
      <div className="flex gap-2 items-center">
      {noteStats.streak > 2 && (
        <span
          className="px-2.5 py-1 bg-gradient-to-br from-[#ff6b6b] to-[#ffd93d] text-white rounded-xl text-xs font-medium tracking-tight backdrop-blur-lg streak-badge"
          title={`${noteStats.streak} day streak!`}
        >
          🔥 {noteStats.streak}d
        </span>
      )}

      <button
        ref={userButtonRef}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer border-none overflow-hidden"
        onClick={onUserMenuToggle}
        title={userProfile.nickname || 'User menu'}
      >
        {userProfile.avatar ? (
          <img src={userProfile.avatar} alt="Avatar" className="w-full h-full object-cover" />
        ) : userProfile.nickname ? (
          <span className="text-white text-sm font-semibold uppercase">
            {userProfile.nickname.charAt(0)}
          </span>
        ) : (
          <User size={18} className="text-white" />
        )}
      </button>
      </div>
    </div>
  );
};
