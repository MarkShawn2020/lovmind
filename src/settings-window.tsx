import { useState, useEffect, useCallback } from 'react';
import { X, Keyboard, RotateCcw, Image as ImageIcon, Tag, Info } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emit } from '@tauri-apps/api/event';
import { isTauri } from './utils/tauri';
import { useAtom } from 'jotai';
import { imageMaxHeightAtom } from './store';
import { useTagMergeStrategy, type TagMergeStrategy } from '@/hooks/useTagMergeStrategy';

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

const TAG_STRATEGY_OPTIONS: Array<{
  value: TagMergeStrategy;
  label: string;
  description: string;
  example: { user: string[]; ai: string[]; result: string[] };
}> = [
  {
    value: 'union',
    label: 'Merge Tags (Union)',
    description: 'Keep user tags and add AI-generated tags as supplements',
    example: {
      user: ['test', 'demo'],
      ai: ['markdown', 'note'],
      result: ['test', 'demo', 'markdown', 'note'],
    },
  },
  {
    value: 'user-only',
    label: 'User Tags Only',
    description: 'Prioritize user tags, use AI tags only if user provides none',
    example: {
      user: ['test', 'demo'],
      ai: ['markdown', 'note'],
      result: ['test', 'demo'],
    },
  },
  {
    value: 'ai-only',
    label: 'AI Tags Only',
    description: 'Prioritize AI tags, use user tags only if AI provides none',
    example: {
      user: ['test', 'demo'],
      ai: ['markdown', 'note'],
      result: ['markdown', 'note'],
    },
  },
  {
    value: 'disabled',
    label: 'Disable AI',
    description: 'Completely disable AI tag generation, keep only manual tags',
    example: {
      user: ['test', 'demo'],
      ai: ['markdown', 'note'],
      result: ['test', 'demo'],
    },
  },
];

type SettingsTab = 'display' | 'shortcuts' | 'tags';

export default function SettingsWindow() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('display');
  const [settings, setSettings] = useState<ShortcutSettings>({ shortcuts: {} });
  const [editingAction, setEditingAction] = useState<string | null>(null);
  const [recordingKeys, setRecordingKeys] = useState<{ key: string; modifiers: string[] } | null>(null);
  const [imageMaxHeight, setImageMaxHeight] = useAtom(imageMaxHeightAtom);
  const { strategy: tagStrategy, saveStrategy: saveTagStrategy, isLoading: isTagLoading } = useTagMergeStrategy();
  const [selectedTagStrategy, setSelectedTagStrategy] = useState<TagMergeStrategy>(tagStrategy);

  useEffect(() => {
    setSelectedTagStrategy(tagStrategy);
  }, [tagStrategy]);

  useEffect(() => {
    loadSettings();
  }, []);

  // Helper function to update image max height and broadcast to other windows
  const updateImageMaxHeight = useCallback(async (newHeight: number) => {
    setImageMaxHeight(newHeight);

    // Broadcast to all windows (main, editor windows)
    if (isTauri()) {
      try {
        await emit('image-max-height-changed', { value: newHeight });
        console.log('[SettingsWindow] Broadcast image-max-height-changed:', newHeight);
      } catch (error) {
        console.error('[SettingsWindow] Failed to emit event:', error);
      }
    }
  }, [setImageMaxHeight]);

  // Auto-focus window after component mounts
  useEffect(() => {
    if (!isTauri()) return;

    let cancelled = false;

    const focusWindow = async () => {
      try {
        const window = getCurrentWindow();
        await window.show();
        if (cancelled) return;
        await window.setFocus();
        if (cancelled) return;
        console.log('[SettingsWindow] Window focused after mount');
      } catch (error) {
        console.error('[SettingsWindow] Failed to focus window:', error);
      }
    };

    void focusWindow();

    return () => {
      cancelled = true;
    };
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
    <div className="w-full h-full bg-[#F9F9F7] flex">
      {/* Sidebar */}
      <div className="w-56 bg-white/50 border-r border-[#E8E6DC] flex-shrink-0 flex flex-col">
        <div className="px-4 py-6">
          <h2 className="text-lg font-semibold text-[#181818] px-3">Settings</h2>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          <button
            onClick={() => setActiveTab('display')}
            className={`w-full px-3 py-2.5 text-left text-sm rounded-lg transition-all border-none cursor-pointer flex items-center gap-3 ${
              activeTab === 'display'
                ? 'bg-[#D97757]/10 text-[#D97757] font-medium'
                : 'bg-transparent text-[#181818] hover:bg-[#E8E6DC]'
            }`}
          >
            <ImageIcon size={18} />
            Display
          </button>

          <button
            onClick={() => setActiveTab('shortcuts')}
            className={`w-full px-3 py-2.5 text-left text-sm rounded-lg transition-all border-none cursor-pointer flex items-center gap-3 ${
              activeTab === 'shortcuts'
                ? 'bg-[#D97757]/10 text-[#D97757] font-medium'
                : 'bg-transparent text-[#181818] hover:bg-[#E8E6DC]'
            }`}
          >
            <Keyboard size={18} />
            Shortcuts
          </button>

          <button
            onClick={() => setActiveTab('tags')}
            className={`w-full px-3 py-2.5 text-left text-sm rounded-lg transition-all border-none cursor-pointer flex items-center gap-3 ${
              activeTab === 'tags'
                ? 'bg-[#D97757]/10 text-[#D97757] font-medium'
                : 'bg-transparent text-[#181818] hover:bg-[#E8E6DC]'
            }`}
          >
            <Tag size={18} />
            Tags
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="px-8 py-6 border-b border-[#E8E6DC] flex-shrink-0 bg-white/30">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-[#181818]">
              {activeTab === 'display' && 'Display Settings'}
              {activeTab === 'shortcuts' && 'Keyboard Shortcuts'}
              {activeTab === 'tags' && 'Tag Settings'}
            </h3>
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
          {/* Display Tab */}
          {activeTab === 'display' && (
            <div className="space-y-6">
              <div className="p-5 bg-white/60 rounded-2xl border border-transparent hover:border-[#E8E6DC] transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1">
                    <div className="font-medium text-[#181818] text-base mb-1">Image Max Height</div>
                    <div className="text-sm text-[#87867F]">Limit tall images to improve editing experience</div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="1200"
                    step="10"
                    value={imageMaxHeight}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      if (value >= 0 && value <= 1200) {
                        updateImageMaxHeight(value);
                      }
                    }}
                    className="text-sm font-mono text-[#181818] bg-white border border-[#E8E6DC] px-3 py-1.5 rounded-lg w-[100px] text-center focus:outline-none focus:border-[#D97757] focus:ring-1 focus:ring-[#D97757]"
                    placeholder="0"
                  />
                </div>

                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="1200"
                    step="10"
                    value={imageMaxHeight}
                    onChange={(e) => updateImageMaxHeight(Number(e.target.value))}
                    className="flex-1 h-2 bg-[#E8E6DC] rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#D97757] [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#D97757] [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
                  />
                  <div className="flex gap-2">
                    {[120, 240, 360, 0].map(height => (
                      <button
                        key={height}
                        onClick={() => updateImageMaxHeight(height)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          imageMaxHeight === height
                            ? 'bg-[#D97757] text-white'
                            : 'bg-white border border-[#E8E6DC] text-[#181818] hover:bg-[#E8E6DC]'
                        }`}
                      >
                        {height === 0 ? 'None' : `${height}px`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Shortcuts Tab */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-6">
              <div className="space-y-3">
                {sortedBasicShortcuts.map(renderShortcutItem)}
              </div>

              {sortedAdvancedShortcuts.length > 0 && (
                <>
                  <div className="mt-8 mb-4 flex items-center gap-3">
                    <h4 className="text-base font-semibold text-[#181818]">Advanced</h4>
                    <div className="flex-1 h-px bg-[#E8E6DC]"></div>
                  </div>
                  <div className="space-y-3">
                    {sortedAdvancedShortcuts.map(renderShortcutItem)}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tags Tab */}
          {activeTab === 'tags' && (
            <div className="space-y-4">
              {/* Info Banner */}
              <div className="p-4 bg-[#C2C07D]/10 border border-[#C2C07D]/30 rounded-xl flex items-start gap-3">
                <Info size={18} className="text-[#C2C07D] mt-0.5 flex-shrink-0" />
                <p className="text-sm text-[#181818]">
                  When you add tags (like #test) to notes, AI may also suggest tags. Choose a strategy to decide how to handle both types of tags.
                </p>
              </div>

              {/* Strategy Options */}
              <div className="space-y-3">
                {TAG_STRATEGY_OPTIONS.map((option) => {
                  const isSelected = selectedTagStrategy === option.value;
                  return (
                    <label
                      key={option.value}
                      className={`block p-5 border-2 rounded-xl cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#D97757] bg-[#D97757]/5'
                          : 'border-[#E8E6DC] hover:border-[#D97757]/50 hover:bg-white/80'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="strategy"
                          value={option.value}
                          checked={isSelected}
                          onChange={() => setSelectedTagStrategy(option.value)}
                          className="mt-1 w-4 h-4 text-[#D97757] border-[#E8E6DC] focus:ring-[#D97757] cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="font-semibold text-[#181818] mb-1">
                            {option.label}
                          </div>
                          <div className="text-sm text-[#87867F] mb-3">
                            {option.description}
                          </div>
                          {/* Example Preview */}
                          <div className="text-xs space-y-1.5 bg-[#F9F9F7] p-3 rounded-lg">
                            <div className="flex gap-2 items-center">
                              <span className="text-[#87867F] w-12 flex-shrink-0">User:</span>
                              <div className="flex gap-1.5 flex-wrap">
                                {option.example.user.map((tag) => (
                                  <span
                                    key={tag}
                                    className="px-2 py-0.5 bg-[#D97757]/15 text-[#D97757] rounded-md font-medium"
                                  >
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="flex gap-2 items-center">
                              <span className="text-[#87867F] w-12 flex-shrink-0">AI:</span>
                              <div className="flex gap-1.5 flex-wrap">
                                {option.example.ai.map((tag) => (
                                  <span
                                    key={tag}
                                    className="px-2 py-0.5 bg-[#C2C07D]/15 text-[#C2C07D] rounded-md font-medium"
                                  >
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="flex gap-2 items-center">
                              <span className="text-[#87867F] w-12 flex-shrink-0">Result:</span>
                              <div className="flex gap-1.5 flex-wrap">
                                {option.example.result.map((tag) => (
                                  <span
                                    key={tag}
                                    className="px-2 py-0.5 bg-[#181818] text-white rounded-md font-medium"
                                  >
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-[#E8E6DC] bg-white/30 flex-shrink-0">
          <div className="flex items-center justify-between">
            {activeTab === 'shortcuts' && (
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 text-[#181818] hover:bg-[#E8E6DC] rounded-xl transition-all border-none bg-transparent cursor-pointer font-medium"
              >
                <RotateCcw size={18} />
                Reset to Defaults
              </button>
            )}
            {activeTab !== 'shortcuts' && <div />}

            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="px-5 py-2 text-[#181818] hover:bg-[#E8E6DC] rounded-xl transition-all border-none bg-transparent cursor-pointer font-medium"
              >
                Close
              </button>
              {(activeTab === 'shortcuts' || activeTab === 'tags') && (
                <button
                  onClick={async () => {
                    if (activeTab === 'shortcuts') {
                      await handleSave();
                    } else if (activeTab === 'tags') {
                      try {
                        await saveTagStrategy(selectedTagStrategy);
                        handleClose();
                      } catch (error) {
                        console.error('Failed to save tag strategy:', error);
                        alert('Failed to save tag settings. Please try again.');
                      }
                    }
                  }}
                  disabled={activeTab === 'tags' && isTagLoading}
                  className="px-6 py-2 bg-[#D97757] text-white rounded-xl hover:opacity-90 transition-all border-none cursor-pointer font-medium shadow-sm disabled:opacity-50"
                >
                  {activeTab === 'tags' && isTagLoading ? 'Saving...' : 'Save'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
