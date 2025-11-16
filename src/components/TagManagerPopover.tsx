import { memo, useState, useMemo, useCallback } from 'react';
import { Plus, Search, X, Check, Sparkles } from 'lucide-react';
import type { Note } from '@/store';
import type { RenderingWysiwygEditorRef } from '@/components/RenderingWysiwygEditor';

interface TagManagerPopoverProps {
  currentTags: string[];
  allNotes: Note[];
  editorRef?: React.RefObject<RenderingWysiwygEditorRef | null>;
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
  editorRef,
  onClose,
}: TagManagerPopoverProps) => {
  const [searchQuery, setSearchQuery] = useState('');

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

  // Check if search query is a new tag (not in existing tags)
  const searchQueryNormalized = useMemo(() => {
    return searchQuery.trim().replace(/^#+/, '');
  }, [searchQuery]);

  const isNewTag = useMemo(() => {
    if (!searchQueryNormalized) return false;
    return !allTagsWithCount.has(searchQueryNormalized);
  }, [searchQueryNormalized, allTagsWithCount]);

  const showCreatePrompt = useMemo(() => {
    return searchQuery.trim() && filteredTags.length === 0 && isNewTag;
  }, [searchQuery, filteredTags.length, isNewTag]);

  // Toggle tag: add if not present, remove if already in currentTags
  const handleToggleTag = useCallback((tag: string) => {
    if (!editorRef?.current) {
      console.warn('Editor ref not available');
      return;
    }

    const isInCurrent = currentTags.includes(tag);

    if (isInCurrent) {
      // Remove tag
      editorRef.current.removeTag(tag);
    } else {
      // Add tag
      editorRef.current.insertTag(tag);
    }
  }, [editorRef, currentTags]);

  // Create and insert new tag from search query
  const handleCreateFromSearch = useCallback(() => {
    if (!searchQueryNormalized || !editorRef?.current) return;

    editorRef.current.insertTag(searchQueryNormalized);
    setSearchQuery(''); // Clear search after creating
  }, [searchQueryNormalized, editorRef]);

  // Handle Enter key in search input
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && showCreatePrompt) {
      e.preventDefault();
      handleCreateFromSearch();
    }
  }, [showCreatePrompt, handleCreateFromSearch]);

  return (
    <div className="w-80 max-h-[450px] flex flex-col">
      {/* Header */}
      <div className="pb-3 border-b border-border">
        <h3 className="font-semibold text-sm mb-2">Manage Tags</h3>

        {/* Search Input */}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search or create tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>

      {/* Current Tags Section */}
      {currentTags.length > 0 && (
        <div className="py-3 border-b border-border">
          <div className="text-xs font-medium text-muted-foreground mb-2">
            In This Note ({currentTags.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {currentTags.map(tag => (
              <button
                key={tag}
                onClick={() => handleToggleTag(tag)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-all cursor-pointer bg-primary/10 text-primary border border-primary/20 hover:bg-red-50 hover:border-red-300 hover:text-red-600 group"
                title="Click to remove from note"
              >
                <X size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="font-medium">#{tag}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* All Tags List */}
      <div className="flex-1 overflow-y-auto py-3 space-y-1">
        <div className="text-xs font-medium text-muted-foreground mb-2 px-1">
          {searchQuery ? 'Search Results' : `All Tags (${allTagsWithCount.size})`}
        </div>

        {/* Create new tag prompt when search has no results */}
        {showCreatePrompt ? (
          <div className="space-y-2">
            <button
              onClick={handleCreateFromSearch}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm rounded-lg transition-all bg-primary/5 border-2 border-dashed border-primary/30 hover:bg-primary/10 hover:border-primary/50 text-primary cursor-pointer group"
            >
              <Sparkles size={16} className="flex-shrink-0 group-hover:scale-110 transition-transform" />
              <div className="flex-1 text-left">
                <div className="font-medium">Create "#{searchQueryNormalized}"</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Press Enter or click to add to note
                </div>
              </div>
              <Plus size={16} className="flex-shrink-0 opacity-50" />
            </button>
          </div>
        ) : filteredTags.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">
            {searchQuery ? 'No matching tags' : 'No tags yet'}
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredTags.map(tag => {
              const isInCurrent = currentTags.includes(tag);
              const count = allTagsWithCount.get(tag) || 0;

              return (
                <button
                  key={tag}
                  onClick={() => handleToggleTag(tag)}
                  disabled={isInCurrent}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 text-sm rounded-md transition-all ${
                    isInCurrent
                      ? 'bg-primary/5 text-primary/60 border border-primary/10 cursor-default'
                      : 'hover:bg-accent/50 cursor-pointer'
                  }`}
                  title={isInCurrent ? 'Already in this note' : 'Click to add to note'}
                >
                  <div className={`flex-shrink-0 w-4 h-4 flex items-center justify-center ${isInCurrent ? 'opacity-100' : 'opacity-0'}`}>
                    {isInCurrent ? (
                      <Check size={14} className="text-primary" />
                    ) : (
                      <Plus size={14} className="text-muted-foreground" />
                    )}
                  </div>
                  <span className="flex-1 text-left font-medium">#{tag}</span>
                  <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Helper text */}
      {!searchQuery && (
        <div className="pt-2 pb-1 border-t border-border">
          <div className="text-xs text-muted-foreground text-center">
            💡 Type to search or create new tags
          </div>
        </div>
      )}
    </div>
  );
});

TagManagerPopover.displayName = 'TagManagerPopover';
