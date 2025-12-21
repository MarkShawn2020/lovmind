'use client';

import * as React from 'react';
import type { TComboboxInputElement } from 'platejs';
import type { PlateElementProps } from 'platejs/react';
import { PlateElement } from 'platejs/react';
import { useAtomValue } from 'jotai';
import { notesAtom } from '@/store';
import { HASHTAG_KEY } from '@/components/editor/plugins/hashtag-base-kit';
import {
  InlineCombobox,
  InlineComboboxContent,
  InlineComboboxEmpty,
  InlineComboboxGroup,
  InlineComboboxInput,
  InlineComboboxItem,
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

  return (
    <PlateElement {...props} as="span">
      <InlineCombobox
        value={search}
        element={props.element}
        setValue={setSearch}
        showTrigger={true}
        trigger="#"
      >
        <span className="inline-block rounded bg-brand/10 px-1 py-0.5 align-baseline text-sm text-brand/90 ring-ring focus-within:ring-1">
          <InlineComboboxInput />
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
