import { memo, useState, useMemo, useCallback } from 'react';
import { Plus, Search, X, Check, Hash } from 'lucide-react';
import type { Note } from '@/store';

interface TagManagerPopoverProps {
  currentTags: string[];
  allNotes: Note[];
  onInsertTag?: (tag: string) => void; // Callback to insert tag into editor
  onClose?: () => void;
}

/**
 * Extract all unique tags from all notes with usage count
 */
const getAllTagsWithCount = (notes: Note[]): Map<string, number> => {
  const tagCounts = new Map<string, number>();

  notes.forEach(note => {
    note.tags.forEach(tag => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });

  return tagCounts;
};

export const TagManagerPopover = memo(({
  currentTags,
  allNotes,
  onInsertTag,
  onClose,
}: TagManagerPopoverProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [newTagInput, setNewTagInput] = useState('');

  // Get all tags with usage count
  const allTagsWithCount = useMemo(() => getAllTagsWithCount(allNotes), [allNotes]);

  // Sort tags by usage frequency (descending)
  const sortedTags = useMemo(() => {
    return Array.from(allTagsWithCount.entries())
      .sort((a, b) => b[1] - a[1]) // Sort by count descending
      .map(([tag]) => tag);
  }, [allTagsWithCount]);

  // Filter tags based on search query
  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return sortedTags;
    const query = searchQuery.toLowerCase();
    return sortedTags.filter(tag => tag.toLowerCase().includes(query));
  }, [sortedTags, searchQuery]);

  // Copy tag to clipboard for manual pasting
  const handleCopyTag = useCallback(async (tag: string) => {
    const tagText = `#${tag} `;
    try {
      await navigator.clipboard.writeText(tagText);
      // Optional: Show toast notification
      console.log(`Copied: ${tagText}`);
    } catch (error) {
      console.error('Failed to copy tag:', error);
    }
  }, []);

  // Create and copy new tag
  const handleCreateNewTag = useCallback(() => {
    const trimmedTag = newTagInput.trim();
    if (!trimmedTag) return;

    handleCopyTag(trimmedTag);
    setNewTagInput('');
  }, [newTagInput, handleCopyTag]);

  // Handle Enter key in new tag input
  const handleNewTagKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreateNewTag();
    }
  }, [handleCreateNewTag]);

  return (
    <div className="w-80 max-h-[400px] flex flex-col">
      {/* Header */}
      <div className="pb-3 border-b border-border">
        <h3 className="font-semibold text-sm mb-2">Manage Tags</h3>

        {/* Search Input */}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>

      {/* Current Tags Section (Read-only) */}
      {currentTags.length > 0 && (
        <div className="py-3 border-b border-border">
          <div className="text-xs font-medium text-muted-foreground mb-2">
            Current Tags ({currentTags.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {currentTags.map(tag => (
              <div
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary text-primary-foreground rounded-md"
              >
                #{tag}
              </div>
            ))}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            <Hash size={12} className="inline mr-1" />
            Type in editor to add/remove tags
          </div>
        </div>
      )}

      {/* All Tags List - Click to copy */}
      <div className="flex-1 overflow-y-auto py-3 space-y-1">
        <div className="text-xs font-medium text-muted-foreground mb-2 px-1">
          All Tags ({allTagsWithCount.size}) - Click to copy
        </div>

        {filteredTags.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            No tags found
          </div>
        ) : (
          filteredTags.map(tag => {
            const isInCurrent = currentTags.includes(tag);
            const count = allTagsWithCount.get(tag) || 0;

            return (
              <button
                key={tag}
                onClick={() => handleCopyTag(tag)}
                className={`w-full flex items-center justify-between px-2 py-1.5 text-sm rounded-md transition-colors ${
                  isInCurrent
                    ? 'bg-primary/5 text-primary border border-primary/20'
                    : 'hover:bg-accent hover:text-accent-foreground'
                }`}
                title={isInCurrent ? 'Already in note - Click to copy' : 'Click to copy to clipboard'}
              >
                <div className="flex items-center gap-2">
                  {isInCurrent && <Check size={14} className="text-primary flex-shrink-0" />}
                  <span>#{tag}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {count}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Quick Copy New Tag */}
      <div className="pt-3 border-t border-border">
        <div className="text-xs font-medium text-muted-foreground mb-2">
          Quick Copy
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Tag name..."
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={handleNewTagKeyDown}
              className="w-full pl-3 pr-3 py-1.5 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <button
            onClick={handleCreateNewTag}
            disabled={!newTagInput.trim()}
            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
            title="Copy to clipboard"
          >
            <Plus size={14} />
            Copy
          </button>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Then paste into editor
        </div>
      </div>
    </div>
  );
});

TagManagerPopover.displayName = 'TagManagerPopover';
