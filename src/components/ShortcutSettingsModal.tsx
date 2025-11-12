import { useState, useEffect, useCallback } from 'react';
import { X, Keyboard, RotateCcw } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '../utils/tauri';

interface ShortcutConfig {
  key: string;
  modifiers: string[];
  label: string;
  action: string;
}

interface ShortcutSettings {
  shortcuts: Record<string, ShortcutConfig>;
}

interface ShortcutSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
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

export default function ShortcutSettingsModal({ isOpen, onClose }: ShortcutSettingsModalProps) {
  const [settings, setSettings] = useState<ShortcutSettings>({ shortcuts: {} });
  const [editingAction, setEditingAction] = useState<string | null>(null);
  const [recordingKeys, setRecordingKeys] = useState<{ key: string; modifiers: string[] } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

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

  const handleSave = async () => {
    if (isTauri()) {
      try {
        await invoke('save_shortcut_settings', { settings });
        onClose();
        // Notify user to restart for changes to take effect
        alert('Shortcut settings saved. Please restart the app for changes to take effect.');
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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100000]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-[600px] max-w-[90vw] max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Keyboard size={24} className="text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">Keyboard Shortcuts</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors border-none bg-transparent cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {Object.entries(settings.shortcuts).map(([action, config]) => (
              <div
                key={action}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div>
                  <div className="font-medium text-gray-800">{config.label}</div>
                  <div className="text-sm text-gray-500">{action}</div>
                </div>
                <div className="flex items-center gap-3">
                  {editingAction === action ? (
                    <>
                      <div className="px-4 py-2 bg-blue-100 text-blue-800 rounded-lg font-mono text-sm min-w-[150px] text-center">
                        {recordingKeys ? formatShortcut({ ...config, ...recordingKeys }) : 'Press keys...'}
                      </div>
                      <button
                        onClick={applyRecordedShortcut}
                        disabled={!recordingKeys}
                        className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed border-none cursor-pointer text-sm"
                      >
                        Apply
                      </button>
                      <button
                        onClick={cancelRecording}
                        className="px-3 py-1 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 border-none cursor-pointer text-sm"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="px-4 py-2 bg-white border border-gray-300 rounded-lg font-mono text-sm min-w-[150px] text-center">
                        {formatShortcut(config)}
                      </div>
                      <button
                        onClick={() => startRecording(action)}
                        className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 border-none cursor-pointer text-sm"
                      >
                        Change
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors border-none bg-transparent cursor-pointer"
            >
              <RotateCcw size={16} />
              Reset to Defaults
            </button>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors border-none bg-transparent cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors border-none cursor-pointer font-medium"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
