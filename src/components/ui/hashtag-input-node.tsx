'use client';

import * as React from 'react';
import type { TComboboxInputElement } from 'platejs';
import type { PlateElementProps } from 'platejs/react';
import { PlateElement } from 'platejs/react';
import { useAtomValue } from 'jotai';
import { notesAtom } from '@/store';
import { HASHTAG_KEY } from '@/components/editor/plugins/hashtag-base-kit';
import { KEYS } from 'platejs';
import {
  InlineCombobox,
  InlineComboboxContent,
  InlineComboboxEmpty,
  InlineComboboxGroup,
  InlineComboboxInput,
  InlineComboboxItem,
  type InlineComboboxHandle,
} from './inline-combobox';

// Get all unique tags from notes, sorted by frequency
const useAllTags = (): { key: string; text: string; count: number }[] => {
  const notes = useAtomValue(notesAtom);

  return React.useMemo(() => {
    const tagCounts = new Map<string, number>();

    notes.forEach((note) => {
      note.tags.forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    return Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1]) // Sort by count descending
      .map(([tag, count]) => ({
        key: tag,
        text: tag,
        count,
      }));
  }, [notes]);
};

export function HashtagInputElement(
  props: PlateElementProps<TComboboxInputElement>
) {
  const { editor } = props;
  const [search, setSearch] = React.useState('');
  const allTags = useAllTags();
  const comboboxRef = React.useRef<InlineComboboxHandle>(null);

  // Filter tags based on search
  const filteredTags = React.useMemo(() => {
    if (!search) return allTags;
    const lowerSearch = search.toLowerCase();
    return allTags.filter((tag) => tag.text.toLowerCase().includes(lowerSearch));
  }, [allTags, search]);

  // Check if search is a new tag
  const isNewTag = React.useMemo(() => {
    if (!search.trim()) return false;
    const normalized = search.trim().toLowerCase();
    return !allTags.some((tag) => tag.text.toLowerCase() === normalized);
  }, [search, allTags]);

  // Insert hashtag node at current selection
  // Note: removeInput is called by InlineComboboxItem before onClick
  const insertHashtag = React.useCallback(
    (tagValue: string) => {
      editor.tf.insertNodes([
        {
          type: HASHTAG_KEY,
          value: tagValue,
          children: [{ text: '' }],
        },
        { text: ' ' },
      ]);
    },
    [editor]
  );

  // Handle selecting a tag from the list
  const handleSelectTag = React.useCallback(
    (tagValue: string) => {
      insertHashtag(tagValue);
    },
    [insertHashtag]
  );

  // Handle creating a new tag
  const handleCreateTag = React.useCallback(() => {
    const normalized = search.trim().replace(/^#+/, '');
    if (!normalized) return;
    insertHashtag(normalized);
  }, [search, insertHashtag]);

  // Check if hashtag input is at the start of the line (block)
  const isAtLineStart = React.useCallback(() => {
    const path = editor.api.findPath(props.element);
    if (!path) return false;

    // Get the parent block
    const blockEntry = editor.api.parent(path);
    if (!blockEntry) return false;

    const [block, blockPath] = blockEntry;

    // Check if hashtag input is the first meaningful content
    if (!block.children || !Array.isArray(block.children)) return false;

    for (let i = 0; i < block.children.length; i++) {
      const child = block.children[i];
      const childPath = [...blockPath, i];

      // If we reach the hashtag input element, it's at line start
      if (childPath.length === path.length && childPath.every((v, idx) => v === path[idx])) {
        return true;
      }

      // If there's non-empty text before hashtag input, not at line start
      if ('text' in child && typeof child.text === 'string' && child.text.trim() !== '') {
        return false;
      }
    }

    return false;
  }, [editor, props.element]);

  // Detect heading level from search (e.g., search="##" means "###" = H3)
  const getHeadingInfo = React.useCallback(() => {
    // Match pattern: optional leading #s followed by optional text
    const match = search.match(/^(#*)(.*)/);
    if (!match) return null;

    const extraHashes = match[1].length; // Additional # after the trigger #
    const text = match[2].trim();
    const level = 1 + extraHashes; // Total # count (1 trigger + extras)

    // H1-H6 only
    if (level > 6) return null;

    const headingKeys = [KEYS.h1, KEYS.h2, KEYS.h3, KEYS.h4, KEYS.h5, KEYS.h6];
    return { type: headingKeys[level - 1], text };
  }, [search]);

  // Handle special keys: Enter for new tags, Space to exit
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Space: exit hashtag mode
      if (e.key === ' ' && !e.nativeEvent.isComposing) {
        e.preventDefault();

        // If at line start: check for heading pattern
        if (isAtLineStart()) {
          const headingInfo = getHeadingInfo();
          if (headingInfo) {
            comboboxRef.current?.removeInput(true);
            editor.tf.setNodes({ type: headingInfo.type });
            if (headingInfo.text) {
              editor.tf.insertText(headingInfo.text);
            }
            return;
          }
        }

        // Not at line start or not a heading pattern: insert as plain text
        const text = '#' + search;
        comboboxRef.current?.removeInput(true);
        editor.tf.insertText(text + ' ');
        return;
      }
      // Enter: create hashtag if it's a new tag with no matches
      if (e.key === 'Enter' && !e.nativeEvent.isComposing && isNewTag && filteredTags.length === 0) {
        e.preventDefault();
        comboboxRef.current?.removeInput(true);
        handleCreateTag();
      }
    },
    [editor, search, isNewTag, filteredTags.length, handleCreateTag, isAtLineStart, getHeadingInfo]
  );

  return (
    <PlateElement {...props} as="span">
      <InlineCombobox
        value={search}
        element={props.element}
        setValue={setSearch}
        showTrigger={true}
        trigger="#"
        comboboxRef={comboboxRef}
      >
        <span className="inline-block rounded bg-brand/10 px-1 py-0.5 align-baseline text-sm text-brand/90 ring-ring focus-within:ring-1">
          <InlineComboboxInput onKeyDown={handleKeyDown} />
        </span>

        <InlineComboboxContent className="my-1.5">
          <InlineComboboxEmpty>
            <span className="text-muted-foreground">Type to search tags...</span>
          </InlineComboboxEmpty>

          <InlineComboboxGroup>
            {filteredTags.map((tag) => (
              <InlineComboboxItem
                key={tag.key}
                value={tag.text}
                onClick={() => handleSelectTag(tag.text)}
              >
                <span className="flex-1">#{tag.text}</span>
                <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                  {tag.count}
                </span>
              </InlineComboboxItem>
            ))}

            {/* Show create option at bottom if it's a new tag */}
            {isNewTag && search.trim() && (
              <InlineComboboxItem
                key="__create__"
                value={search.trim()}
                onClick={handleCreateTag}
                className="group/item border-t border-border mt-1"
              >
                <span className="text-muted-foreground group-data-[active-item=true]/item:text-accent-foreground mr-1">Create</span>
                <span className="font-medium text-brand group-data-[active-item=true]/item:text-accent-foreground">#{search.trim()}</span>
              </InlineComboboxItem>
            )}
          </InlineComboboxGroup>
        </InlineComboboxContent>
      </InlineCombobox>

      {props.children}
    </PlateElement>
  );
}
