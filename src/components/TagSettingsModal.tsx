import { useState, useEffect } from 'react';
import { X, Tag, Info } from 'lucide-react';
import { useTagMergeStrategy, type TagMergeStrategy } from '@/hooks/useTagMergeStrategy';

interface TagSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STRATEGY_OPTIONS: Array<{
  value: TagMergeStrategy;
  label: string;
  description: string;
  example: { user: string[]; ai: string[]; result: string[] };
}> = [
  {
    value: 'union',
    label: '合并标签 (Union)',
    description: '保留用户输入的标签，AI 生成的标签作为补充',
    example: {
      user: ['test', 'demo'],
      ai: ['markdown', 'note'],
      result: ['test', 'demo', 'markdown', 'note'],
    },
  },
  {
    value: 'user-only',
    label: '仅用户标签 (User Only)',
    description: '优先使用用户输入的标签，如果用户没有输入则使用 AI 标签',
    example: {
      user: ['test', 'demo'],
      ai: ['markdown', 'note'],
      result: ['test', 'demo'],
    },
  },
  {
    value: 'ai-only',
    label: '仅 AI 标签 (AI Only)',
    description: '优先使用 AI 生成的标签，如果 AI 没有生成则使用用户标签',
    example: {
      user: ['test', 'demo'],
      ai: ['markdown', 'note'],
      result: ['markdown', 'note'],
    },
  },
  {
    value: 'disabled',
    label: '禁用 AI (Disabled)',
    description: '完全禁用 AI 标签生成，仅保留用户手动输入的标签',
    example: {
      user: ['test', 'demo'],
      ai: ['markdown', 'note'],
      result: ['test', 'demo'],
    },
  },
];

export default function TagSettingsModal({ isOpen, onClose }: TagSettingsModalProps) {
  const { strategy, saveStrategy, isLoading } = useTagMergeStrategy();
  const [selectedStrategy, setSelectedStrategy] = useState<TagMergeStrategy>(strategy);

  useEffect(() => {
    setSelectedStrategy(strategy);
  }, [strategy]);

  const handleSave = async () => {
    try {
      await saveStrategy(selectedStrategy);
      onClose();
    } catch (error) {
      console.error('Failed to save tag merge strategy:', error);
      alert('保存失败，请重试');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100000]">
      <div className="bg-[var(--background)] rounded-2xl shadow-2xl w-[600px] max-w-[90vw] max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--background)] px-6 py-4 border-b border-[var(--border)] flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <Tag className="text-[var(--primary)]" size={24} />
            <h2 className="text-xl font-semibold text-[var(--foreground)]">标签合并策略</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--accent)] rounded-lg transition-colors border-none bg-transparent cursor-pointer"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Info Banner */}
        <div className="mx-6 mt-4 p-3 bg-[var(--muted)] border border-[var(--border)] rounded-lg flex items-start gap-2">
          <Info size={16} className="text-[var(--muted-foreground)] mt-0.5 flex-shrink-0" />
          <p className="text-sm text-[var(--muted-foreground)]">
            当你在笔记中输入标签（如 #test）时，AI 也会尝试生成建议标签。
            选择一个策略来决定如何处理这两种标签。
          </p>
        </div>

        {/* Strategy Options */}
        <div className="px-6 py-4 space-y-3">
          {STRATEGY_OPTIONS.map((option) => {
            const isSelected = selectedStrategy === option.value;
            return (
              <label
                key={option.value}
                className={`block p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  isSelected
                    ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                    : 'border-[var(--border)] hover:border-[var(--primary)]/50 hover:bg-[var(--accent)]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="strategy"
                    value={option.value}
                    checked={isSelected}
                    onChange={() => setSelectedStrategy(option.value)}
                    className="mt-1 w-4 h-4 text-[var(--primary)] border-[var(--border)] focus:ring-[var(--primary)] focus:ring-offset-0"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-[var(--foreground)] mb-1">
                      {option.label}
                    </div>
                    <div className="text-sm text-[var(--muted-foreground)] mb-2">
                      {option.description}
                    </div>
                    {/* Example Preview */}
                    <div className="text-xs space-y-1 bg-[var(--muted)] p-2 rounded-lg">
                      <div className="flex gap-1.5 items-center">
                        <span className="text-[var(--muted-foreground)] w-16">用户:</span>
                        <div className="flex gap-1">
                          {option.example.user.map((tag) => (
                            <span
                              key={tag}
                              className="px-1.5 py-0.5 bg-[var(--primary)]/10 text-[var(--primary)] rounded-md"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-1.5 items-center">
                        <span className="text-[var(--muted-foreground)] w-16">AI:</span>
                        <div className="flex gap-1">
                          {option.example.ai.map((tag) => (
                            <span
                              key={tag}
                              className="px-1.5 py-0.5 bg-[var(--secondary)] text-[var(--secondary-foreground)] rounded-md"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-1.5 items-center">
                        <span className="text-[var(--muted-foreground)] w-16">结果:</span>
                        <div className="flex gap-1">
                          {option.example.result.map((tag) => (
                            <span
                              key={tag}
                              className="px-1.5 py-0.5 bg-[var(--primary)] text-white rounded-md font-medium"
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

        {/* Footer */}
        <div className="sticky bottom-0 bg-[var(--background)] px-6 py-4 border-t border-[var(--border)] flex gap-3 justify-end rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-[var(--foreground)] hover:bg-[var(--accent)] rounded-lg transition-colors border border-[var(--border)] bg-transparent cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="px-5 py-2.5 bg-[var(--primary)] text-white rounded-lg transition-all border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110"
          >
            {isLoading ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
