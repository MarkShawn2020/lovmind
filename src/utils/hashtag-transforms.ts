import { createSlatePlugin } from 'platejs';
import type { PlateEditor } from 'platejs/react';
import { HASHTAG_KEY } from '@/components/editor/plugins/hashtag-kit';
import type { THashtagElement } from '@/components/editor/plugins/hashtag-base-kit';

/**
 * Plugin that extends editor.api with hashtag manipulation methods.
 *
 * Usage:
 * ```typescript
 * editor.api.hashtag.insert('newtag');
 * editor.api.hashtag.remove('oldtag');
 * editor.api.hashtag.rename('old', 'new');
 * ```
 */
export const HashtagTransformsPlugin = createSlatePlugin({
  key: 'hashtag-transforms',
  extendEditor: ({ editor }) => {
    // Extend editor.api with hashtag methods
    (editor.api as any).hashtag = {
      /**
       * Insert a hashtag element at the current cursor position (or end of document if no selection).
       * @param tag - Tag value (without # prefix)
       */
      insert: (tag: string) => {
        try {
          const { selection } = editor;

          // If no selection, insert at the end of the last node
          if (!selection) {
            const lastPath = [editor.children.length - 1];
            editor.tf.select(editor.api.end(lastPath));
          }

          editor.tf.insertNodes(
            [
              { text: ' ' }, // Leading space
              {
                type: HASHTAG_KEY,
                value: tag,
                children: [{ text: '' }],
              } as THashtagElement,
              { text: ' ' }, // Trailing space
            ],
            { select: true }
          );

          editor.tf.focus();

          // Manually emit input-state-changed event to trigger sync
          // This is necessary because insertNodes bypasses insertText interception
          if (typeof editor.emit === 'function') {
            editor.emit('input-state-changed', {
              isInputting: false,
              reason: 'typing-stop' as const,
              isFocused: true,
            });
          }
        } catch (error) {
          console.error('[HashtagTransforms] Failed to insert tag:', error);
        }
      },

      /**
       * Remove all instances of a hashtag from the document.
       * @param tag - Tag value to remove (without # prefix)
       */
      remove: (tag: string) => {
        try {
          const nodes = Array.from(
            editor.api.nodes({
              at: [],
              match: (n: any) => n.type === HASHTAG_KEY && n.value === tag,
            })
          );

          // Remove in reverse order to maintain valid paths
          for (let i = nodes.length - 1; i >= 0; i--) {
            const [, path] = nodes[i];
            editor.tf.removeNodes({ at: path });
          }

          editor.tf.focus();

          // Manually emit input-state-changed event to trigger sync
          if (typeof editor.emit === 'function') {
            editor.emit('input-state-changed', {
              isInputting: false,
              reason: 'typing-stop' as const,
              isFocused: true,
            });
          }
        } catch (error) {
          console.error('[HashtagTransforms] Failed to remove tag:', error);
        }
      },

      /**
       * Rename all instances of a hashtag to a new value.
       * If the new tag already exists in the document, old instances are removed (merge strategy).
       * @param oldTag - Current tag value (without # prefix)
       * @param newTag - New tag value (without # prefix)
       */
      rename: (oldTag: string, newTag: string) => {
        try {
          const nodes = Array.from(
            editor.api.nodes({
              at: [],
              match: (n: any) => n.type === HASHTAG_KEY && n.value === oldTag,
            })
          );

          // If new tag already exists, remove old tag instances (merge strategy)
          const hasNewTag = editor.api.some({
            at: [],
            match: (n: any) => n.type === HASHTAG_KEY && n.value === newTag,
          });

          if (hasNewTag) {
            // Merge: just remove old tag instances
            for (let i = nodes.length - 1; i >= 0; i--) {
              const [, path] = nodes[i];
              editor.tf.removeNodes({ at: path });
            }
          } else {
            // Rename: update value of all old tag instances
            for (const [node, path] of nodes) {
              editor.tf.setNodes(
                { value: newTag } as Partial<THashtagElement>,
                { at: path }
              );
            }
          }

          editor.tf.focus();

          // Manually emit input-state-changed event to trigger sync
          if (typeof editor.emit === 'function') {
            editor.emit('input-state-changed', {
              isInputting: false,
              reason: 'typing-stop' as const,
              isFocused: true,
            });
          }
        } catch (error) {
          console.error('[HashtagTransforms] Failed to rename tag:', error);
        }
      },
    };

    return editor;
  },
});

// TypeScript type extension - augments editor.api with hashtag methods
// Note: This uses declaration merging to add to the existing PlateEditor type
export interface HashtagApi {
  hashtag: {
    insert: (tag: string) => void;
    remove: (tag: string) => void;
    rename: (oldTag: string, newTag: string) => void;
  };
}
