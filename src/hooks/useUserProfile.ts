import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

import { isTauri } from '@/utils/tauri';

export interface UserProfile {
  nickname?: string;
  avatar?: string;
}

const loadProfileFromLocalStorage = (): UserProfile => {
  try {
    const saved = localStorage.getItem('user_profile');
    return saved ? (JSON.parse(saved) as UserProfile) : {};
  } catch (error) {
    console.warn('Failed to load profile from localStorage:', error);
    return {};
  }
};

export const useUserProfile = (autoLoad: boolean = true) => {
  const [userProfile, setUserProfile] = useState<UserProfile>({});

  const reloadProfile = useCallback(async () => {
    if (isTauri()) {
      try {
        const profile = await invoke<UserProfile | null>('get_user_profile');
        setUserProfile(profile || {});
        return;
      } catch (error) {
        console.warn('Failed to load profile from Tauri, falling back to localStorage:', error);
      }
    }

    setUserProfile(loadProfileFromLocalStorage());
  }, []);

  useEffect(() => {
    if (autoLoad) {
      reloadProfile();
    }
  }, [autoLoad, reloadProfile]);

  return {
    userProfile,
    reloadProfile,
  };
};
