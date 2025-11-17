import React from 'react';
import { User } from 'lucide-react';

import lovpenLogo from '@/assets/lovpen-logo.svg';
import type { UserProfile } from '@/hooks/useUserProfile';
import type { NoteStatsSummary } from '@/features/note/types';
import { isIOS } from '@/utils/platform';

interface MainHeaderProps {
  noteStats: NoteStatsSummary;
  userProfile: UserProfile;
  onHeaderMouseDown?: () => void;
  onUserMenuToggle: (event: React.MouseEvent<HTMLButtonElement>) => void;
  userButtonRef: React.RefObject<HTMLButtonElement | null>;
}

export const MainHeader = ({
  noteStats,
  userProfile,
  onHeaderMouseDown,
  onUserMenuToggle,
  userButtonRef,
}: MainHeaderProps) => {
  // iOS: No top border radius + safe area top padding (for status bar overlay)
  // Desktop: Rounded top corners (floating window aesthetic)
  const headerClassName = isIOS()
    ? "h-[60px] px-[var(--spacing-text)] py-[var(--spacing-s)] bg-primary text-primary-foreground shadow-[0_2px_8px_rgba(0,0,0,0.08)] flex justify-between items-center select-none flex-shrink-0 cursor-move"
    : "h-[60px] px-[var(--spacing-text)] py-[var(--spacing-s)] bg-primary text-primary-foreground shadow-[0_2px_8px_rgba(0,0,0,0.08)] flex justify-between items-center rounded-t-xl select-none flex-shrink-0 cursor-move";

  // iOS: Add safe area top padding to header content (not container) to avoid notch overlap
  const headerStyle = isIOS()
    ? {
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }
    : {};

  return (
    <div
      className={headerClassName}
      style={headerStyle}
      onMouseDown={onHeaderMouseDown}
    >
      <div className="flex items-center gap-2">
      <img
        src={lovpenLogo}
        alt="Lovmind"
        className="h-5 w-auto brightness-0 invert select-none"
        draggable={false}
      />
      <h1 className="text-lg font-semibold tracking-tight">Lovmind ({noteStats.total})</h1>
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
