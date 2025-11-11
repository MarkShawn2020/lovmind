import { useState, useRef, useEffect } from 'react';
import { X, Upload, User } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '../utils/tauri';

interface UserProfile {
  nickname?: string;
  avatar?: string;
}

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const [profile, setProfile] = useState<UserProfile>({});
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadProfile();
    }
  }, [isOpen]);

  const loadProfile = async () => {
    if (isTauri()) {
      try {
        const savedProfile = await invoke<UserProfile | null>('get_user_profile');
        if (savedProfile) {
          setProfile(savedProfile);
          setNickname(savedProfile.nickname || '');
          setAvatar(savedProfile.avatar || null);
        }
      } catch (error) {
        console.error('Failed to load profile:', error);
      }
    } else {
      // Web fallback
      const saved = localStorage.getItem('user_profile');
      if (saved) {
        const savedProfile = JSON.parse(saved) as UserProfile;
        setProfile(savedProfile);
        setNickname(savedProfile.nickname || '');
        setAvatar(savedProfile.avatar || null);
      }
    }
  };

  const handleSave = async () => {
    const newProfile: UserProfile = {
      nickname: nickname.trim() || undefined,
      avatar: avatar || undefined,
    };

    if (isTauri()) {
      try {
        await invoke('save_user_profile', { profile: newProfile });
        setProfile(newProfile);
        onClose();
      } catch (error) {
        console.error('Failed to save profile:', error);
      }
    } else {
      // Web fallback
      localStorage.setItem('user_profile', JSON.stringify(newProfile));
      setProfile(newProfile);
      onClose();
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setAvatar(result);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100000]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-[400px] max-w-[90vw] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Edit Profile</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors border-none bg-transparent cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border-2 border-gray-200">
                {avatar ? (
                  <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User size={48} className="text-gray-400" />
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full hover:bg-primary/90 transition-colors border-none cursor-pointer shadow-md"
                title="Upload avatar"
              >
                <Upload size={16} />
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            {avatar && (
              <button
                onClick={() => setAvatar(null)}
                className="text-xs text-red-600 hover:text-red-700 bg-transparent border-none cursor-pointer"
              >
                Remove avatar
              </button>
            )}
          </div>

          {/* Nickname Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nickname
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Enter your nickname"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              maxLength={50}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer bg-transparent"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors cursor-pointer border-none"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
