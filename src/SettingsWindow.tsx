import { useState, useEffect, useCallback } from 'react';
import { X, Keyboard, RotateCcw } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauri } from './utils/tauri';

interface ShortcutConfig {
  key: string;
  modifiers: string[];
  label: string;
  action: string;
}

interface ShortcutSettings {
  shortcuts: Record<string, ShortcutConfig>;
}

const MODIFIER_LABELS: Record<string, string> = {
  'SUPER': navigator.platform.includes('Mac') ? '⌘' : 'Ctrl',
  'CONTROL': 'Ctrl',
  'ALT': navigator.platform.includes('Mac') ? '⌥' : 'Alt',
  'SHIFT': '⇧',
};

const KEY_LABELS: Record<string, string> = {
  'KeyA': 'A', 'KeyB': 'B', 'KeyC': 'C', 'KeyD': 'D', 'KeyE': 'E',
  'KeyF': 'F', 'KeyG': 'G', 'KeyH': 'H', 'KeyI': 'I', 'KeyJ': 'J',
  'KeyK': 'K', 'KeyL': 'L', 'KeyM': 'M', 'KeyN': 'N', 'KeyO': 'O',
  'KeyP': 'P', 'KeyQ': 'Q', 'KeyR': 'R', 'KeyS': 'S', 'KeyT': 'T',
  'KeyU': 'U', 'KeyV': 'V', 'KeyW': 'W', 'KeyX': 'X', 'KeyY': 'Y',
  'KeyZ': 'Z',
  'Digit0': '0', 'Digit1': '1', 'Digit2': '2', 'Digit3': '3', 'Digit4': '4',
  'Digit5': '5', 'Digit6': '6', 'Digit7': '7', 'Digit8': '8', 'Digit9': '9',
  'F1': 'F1', 'F2': 'F2', 'F3': 'F3', 'F4': 'F4', 'F5': 'F5',
  'F6': 'F6', 'F7': 'F7', 'F8': 'F8', 'F9': 'F9', 'F10': 'F10',
  'F11': 'F11', 'F12': 'F12',
  'Space': 'Space',
  'Enter': 'Enter',
  'Tab': 'Tab',
  'Escape': 'Esc',
};

export default function SettingsWindow() {
  const [settings, setSettings] = useState<ShortcutSettings>({ shortcuts: {} });
  const [editingAction, setEditingAction] = useState<string | null>(null);
  const [recordingKeys, setRecordingKeys] = useState<{ key: string; modifiers: string[] } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    if (isTauri()) {
      try {
        const loaded = await invoke<ShortcutSettings>('get_shortcut_settings');
        setSettings(loaded);
      } catch (error) {
        console.error('Failed to load shortcut settings:', error);
      }
    }
  };

  const handleClose = async () => {
    if (isTauri()) {
      const window = getCurrentWindow();
      await window.close();
    }
  };

  const handleSave = async () => {
    if (isTauri()) {
      try {
        await invoke('save_shortcut_settings', { settings });
        alert('Shortcut settings saved. Please restart the app for changes to take effect.');
        handleClose();
      } catch (error) {
        console.error('Failed to save shortcut settings:', error);
        alert('Failed to save settings. Please try again.');
      }
    }
  };

  const handleReset = async () => {
    if (isTauri()) {
      try {
        const defaultSettings = await invoke<ShortcutSettings>('reset_shortcut_settings');
        setSettings(defaultSettings);
        alert('Shortcuts reset to defaults. Please restart the app.');
      } catch (error) {
        console.error('Failed to reset shortcuts:', error);
      }
    }
  };

  const startRecording = (action: string) => {
    setEditingAction(action);
    setRecordingKeys(null);
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!editingAction) return;

    e.preventDefault();
    e.stopPropagation();

    // Ignore modifier-only keys
    if (['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) {
      return;
    }

    const modifiers: string[] = [];
    if (e.metaKey || e.ctrlKey) modifiers.push('SUPER');
    if (e.altKey) modifiers.push('ALT');
    if (e.shiftKey) modifiers.push('SHIFT');

    const key = e.code;

    setRecordingKeys({ key, modifiers });
  }, [editingAction]);

  useEffect(() => {
    if (editingAction) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [editingAction, handleKeyDown]);

  const applyRecordedShortcut = () => {
    if (!editingAction || !recordingKeys) return;

    setSettings(prev => ({
      shortcuts: {
        ...prev.shortcuts,
        [editingAction]: {
          ...prev.shortcuts[editingAction],
          key: recordingKeys.key,
          modifiers: recordingKeys.modifiers,
        },
      },
    }));

    setEditingAction(null);
    setRecordingKeys(null);
  };

  const cancelRecording = () => {
    setEditingAction(null);
    setRecordingKeys(null);
  };

  const formatShortcut = (config: ShortcutConfig) => {
    const mods = config.modifiers.map(m => MODIFIER_LABELS[m] || m).join(' + ');
    const key = KEY_LABELS[config.key] || config.key.replace('Key', '');
    return mods ? `${mods} + ${key}` : key;
  };

  // Define shortcut order and grouping
  const basicShortcuts = ['toggle_main_window', 'toggle_float_windows', 'submit_note', 'close_window'];
  const advancedShortcuts = ['open_devtools'];

  // Sort shortcuts according to defined order
  const sortedBasicShortcuts = basicShortcuts
    .filter(action => settings.shortcuts[action])
    .map(action => [action, settings.shortcuts[action]] as [string, ShortcutConfig]);

  const sortedAdvancedShortcuts = advancedShortcuts
    .filter(action => settings.shortcuts[action])
    .map(action => [action, settings.shortcuts[action]] as [string, ShortcutConfig]);

  const renderShortcutItem = ([action, config]: [string, ShortcutConfig]) => (
    <div
      key={action}
      className="flex items-center justify-between p-5 bg-white/60 rounded-2xl hover:bg-white/80 transition-all border border-transparent hover:border-[#E8E6DC]"
    >
      <div className="flex-1">
        <div className="font-medium text-[#181818] text-base mb-1">{config.label}</div>
        <div className="text-sm text-[#87867F]">{action}</div>
      </div>
      <div className="flex items-center gap-3">
        {editingAction === action ? (
          <>
            <div className="px-5 py-2.5 bg-[#C2C07D]/15 text-[#181818] rounded-xl font-mono text-sm min-w-[160px] text-center border border-[#C2C07D]/30">
              {recordingKeys ? formatShortcut({ ...config, ...recordingKeys }) : 'Press keys...'}
            </div>
            <button
              onClick={applyRecordedShortcut}
              disabled={!recordingKeys}
              className="px-4 py-2 bg-[#D97757] text-white rounded-xl hover:opacity-90 disabled:bg-[#87867F]/30 disabled:cursor-not-allowed border-none cursor-pointer text-sm font-medium transition-all shadow-sm"
            >
              Apply
            </button>
            <button
              onClick={cancelRecording}
              className="px-4 py-2 bg-transparent border border-[#87867F] text-[#181818] rounded-xl hover:bg-[#E8E6DC] cursor-pointer text-sm font-medium transition-all"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <div className="px-5 py-2.5 bg-white border border-[#E8E6DC] rounded-xl font-mono text-sm min-w-[160px] text-center text-[#181818] shadow-sm">
              {formatShortcut(config)}
            </div>
            <button
              onClick={() => startRecording(action)}
              className="px-4 py-2 bg-white border border-[#87867F] text-[#181818] rounded-xl hover:bg-[#E8E6DC] cursor-pointer text-sm font-medium transition-all"
            >
              Change
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="w-full h-full bg-[#F9F9F7] flex flex-col">
      {/* Header */}
      <div className="px-8 py-6 border-b border-[#E8E6DC] flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#C2C07D]/10 rounded-xl">
              <Keyboard size={28} className="text-[#C2C07D]" />
            </div>
            <h2 className="text-2xl font-semibold text-[#181818]">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2.5 hover:bg-[#E8E6DC] rounded-xl transition-all border-none bg-transparent cursor-pointer"
            aria-label="Close"
          >
            <X size={22} className="text-[#87867F]" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {/* General Shortcuts */}
        <div className="space-y-3">
          {sortedBasicShortcuts.map(renderShortcutItem)}
        </div>

        {/* Advanced Section */}
        {sortedAdvancedShortcuts.length > 0 && (
          <>
            <div className="mt-8 mb-4 flex items-center gap-3">
              <h3 className="text-lg font-semibold text-[#181818]">Advanced</h3>
              <div className="flex-1 h-px bg-[#E8E6DC]"></div>
            </div>
            <div className="space-y-3">
              {sortedAdvancedShortcuts.map(renderShortcutItem)}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-8 py-6 border-t border-[#E8E6DC] bg-[#F0EEE6] flex-shrink-0">
        <div className="flex items-center justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-5 py-2.5 text-[#181818] hover:bg-[#E8E6DC] rounded-xl transition-all border-none bg-transparent cursor-pointer font-medium"
          >
            <RotateCcw size={18} />
            Reset to Defaults
          </button>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="px-6 py-3 text-[#181818] hover:bg-[#E8E6DC] rounded-xl transition-all border-none bg-transparent cursor-pointer font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-8 py-3 bg-[#D97757] text-white rounded-xl hover:opacity-90 transition-all border-none cursor-pointer font-medium shadow-sm"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
