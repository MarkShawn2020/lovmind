# Intent-Based Architecture Design

## 📋 Overview

This document outlines the **Intent Pattern** architecture for unified action handling in Lovmind's editor system. This addresses the double-submission bug and provides a scalable, maintainable foundation for all editor actions.

---

## 🎯 Problem Statement

### Current Architecture Issues

```
Multiple Event Sources → Multiple Code Paths → Inconsistent Behavior
  ↓                           ↓                    ↓
Button onClick          Cmd+Enter handler      Different logic
EditorToolbar.tsx       keyboard-shortcuts     Potential bugs
Line 258                     -kit.tsx          (e.g., double submit)
```

**Problems:**
1. ❌ **Code Duplication**: Submit logic scattered across multiple files
2. ❌ **Inconsistent Behavior**: Button vs keyboard shortcut behave differently
3. ❌ **Race Conditions**: Multiple triggers can cause duplicate submissions
4. ❌ **Hard to Test**: Must test each trigger separately
5. ❌ **Poor Maintainability**: Changes require updating multiple locations

---

## ✅ Solution: Intent Pattern

### Core Concept

**All actions flow through a single, centralized handler**

```
Multiple Event Sources → Single Intent → One Unified Handler → Consistent Output
  ↓                           ↓                ↓                     ↓
Button, Kbd, API       SUBMIT_NOTE       useEditorIntent      Always creates 1 note
```

### Benefits

1. ✅ **Single Source of Truth**: All logic in one place
2. ✅ **Automatic Deduplication**: Intent handler prevents duplicate actions
3. ✅ **Consistent Behavior**: Same input → same output, always
4. ✅ **Easy Testing**: Test one handler instead of multiple paths
5. ✅ **Better Debugging**: Single breakpoint catches all actions
6. ✅ **Scalable**: Easy to add new actions or event sources

---

## 🏗️ Architecture Design

### 1. Intent Type Definition

```typescript
// src/types/editor-intents.ts

/**
 * Editor Intent - Unified action type for all editor operations
 * Similar to Redux actions or Android Intents
 */
export type EditorIntent =
  | SubmitNoteIntent
  | SaveDraftIntent
  | ResetEditorIntent
  | InsertTagIntent
  | RemoveTagIntent;

export interface SubmitNoteIntent {
  type: 'SUBMIT_NOTE';
  payload?: {
    forceReset?: boolean; // Override default behavior
    silent?: boolean;     // No confetti/feedback
  };
}

export interface SaveDraftIntent {
  type: 'SAVE_DRAFT';
  payload?: {
    triggerSource: 'auto-save' | 'manual' | 'shortcut';
  };
}

export interface ResetEditorIntent {
  type: 'RESET_EDITOR';
  payload?: {
    focusAfterReset?: boolean;
  };
}

export interface InsertTagIntent {
  type: 'INSERT_TAG';
  payload: {
    tag: string;
  };
}

export interface RemoveTagIntent {
  type: 'REMOVE_TAG';
  payload: {
    tag: string;
  };
}
```

---

### 2. Intent Handler Hook

```typescript
// src/hooks/useEditorIntent.ts

import { useCallback, useRef } from 'react';
import type { EditorIntent } from '@/types/editor-intents';
import { useNoteSubmit } from './useNoteSubmit';

/**
 * Central intent handler for all editor actions
 * Provides deduplication, logging, and analytics
 */
export function useEditorIntent(options: {
  noteId: string | null;
  editorRef: React.RefObject<LovmindEditorRef | null>;
  resetEditorAfterCreate?: boolean;
}) {
  const { noteId, editorRef, resetEditorAfterCreate } = options;
  const { handleSubmit } = useNoteSubmit({ noteId, editorRef, resetEditorAfterCreate });

  // Deduplication: Prevent rapid-fire duplicate intents
  const lastIntentTime = useRef<Record<string, number>>({});
  const DEBOUNCE_MS = 300;

  const dispatch = useCallback(async (intent: EditorIntent): Promise<void> => {
    const now = Date.now();
    const lastTime = lastIntentTime.current[intent.type] || 0;

    // Deduplication check
    if (now - lastTime < DEBOUNCE_MS) {
      console.log(`[Intent] Ignoring duplicate ${intent.type} (debounced)`);
      return;
    }
    lastIntentTime.current[intent.type] = now;

    // Log intent for debugging/analytics
    console.log('[Intent] Dispatching:', intent.type, intent.payload || {});

    // Route to appropriate handler
    switch (intent.type) {
      case 'SUBMIT_NOTE':
        await handleSubmit();
        break;

      case 'SAVE_DRAFT':
        // Future implementation
        console.log('[Intent] SAVE_DRAFT not yet implemented');
        break;

      case 'RESET_EDITOR':
        editorRef.current?.resetAndFocus();
        break;

      case 'INSERT_TAG':
        editorRef.current?.insertTag(intent.payload.tag);
        break;

      case 'REMOVE_TAG':
        editorRef.current?.removeTag(intent.payload.tag);
        break;

      default:
        console.warn('[Intent] Unknown intent type:', (intent as any).type);
    }
  }, [handleSubmit, editorRef]);

  return { dispatch };
}
```

---

### 3. Update Components to Use Intents

#### Button Click (EditorToolbar)

```typescript
// src/components/EditorToolbar.tsx

import { useEditorIntent } from '@/hooks/useEditorIntent';

function EditorToolbar({ ... }) {
  const { dispatch } = useEditorIntent({ noteId, editorRef, resetEditorAfterCreate });

  return (
    <button
      onClick={() => dispatch({ type: 'SUBMIT_NOTE' })}
      disabled={submitDisabled}
      title="Submit note (Cmd+Enter)"
    >
      <Send size={16} />
    </button>
  );
}
```

#### Keyboard Shortcut (keyboard-shortcuts-kit.tsx)

```typescript
// src/components/editor/plugins/keyboard-shortcuts-kit.tsx

const handleSubmit = (event: KeyboardEvent) => {
  if (!event || !(event.metaKey || event.ctrlKey)) return;
  if (event.key !== 'Enter') return;
  if (!isEventFromEditor(event)) return;

  event.preventDefault();
  event.stopPropagation();

  // Emit intent instead of direct action
  if (typeof editor.emit === 'function') {
    editor.emit('intent', { type: 'SUBMIT_NOTE' });
  }
};
```

#### Event Bridge (useEditorEventBridge.ts)

```typescript
// src/hooks/useEditorEventBridge.ts

export function useEditorEventBridge(
  editor: MyEditor,
  onChange?: (payload: EditorContentChange) => void,
  dispatch?: (intent: EditorIntent) => Promise<void>
) {
  useEffect(() => {
    const handleIntent = (intent: EditorIntent) => {
      dispatch?.(intent);
    };

    if (typeof editor.on === 'function') {
      editor.on('intent', handleIntent);
    }

    return () => {
      if (typeof editor.off === 'function') {
        editor.off('intent', handleIntent);
      }
    };
  }, [editor, dispatch]);
}
```

---

## 🔄 Migration Plan

### Phase 1: Immediate Fix (Already Done)
- ✅ Fix `isEventFromEditor` logic
- ✅ Add deduplication to keyboard shortcuts

### Phase 2: Intent Infrastructure (Recommended Next)
1. Create `src/types/editor-intents.ts`
2. Create `src/hooks/useEditorIntent.ts`
3. Update `useEditorEventBridge` to handle intents
4. Update `keyboard-shortcuts-kit` to emit intents

### Phase 3: Component Migration
1. Update `EditorToolbar` to use intents
2. Update `BaseMainWindow` to use intents
3. Update float windows to use intents
4. Remove old direct submission code

### Phase 4: Expand Intent System
1. Add more intent types (SAVE_DRAFT, DELETE_NOTE, etc.)
2. Add middleware support (analytics, logging, undo/redo)
3. Add intent history for debugging

---

## 📊 Comparison: Before vs After

### Before (Current - with quick fix)
```typescript
// Button
<button onClick={handleSubmit}>

// Keyboard
editor.emit('submit-shortcut') → onSubmit() → handleSubmit()

// API
someFunction() → handleSubmit()
```

**Issues:**
- Multiple code paths
- Potential for inconsistency
- Harder to add features (analytics, undo, etc.)

### After (Intent Pattern)
```typescript
// Button
<button onClick={() => dispatch({ type: 'SUBMIT_NOTE' })}>

// Keyboard
editor.emit('intent', { type: 'SUBMIT_NOTE' }) → dispatch()

// API
dispatch({ type: 'SUBMIT_NOTE' })
```

**Benefits:**
- Single code path
- Guaranteed consistency
- Easy to extend (add middleware, analytics, undo)
- Built-in deduplication

---

## 🎓 Related Patterns

This design is inspired by proven patterns from:

1. **Redux** (React ecosystem)
   - Actions → Reducer → Store update

2. **Android Intents**
   - Intent → Intent Filter → Component activation

3. **Command Pattern** (GoF Design Patterns)
   - Command object → Invoker → Receiver

4. **CQRS** (Domain-Driven Design)
   - Command → Command Handler → Domain logic

---

## 🧪 Testing Benefits

### Before
```typescript
// Must test each trigger separately
test('button click submits note', ...)
test('Cmd+Enter submits note', ...)
test('API call submits note', ...)
```

### After
```typescript
// Test one handler, verify all triggers call it
test('SUBMIT_NOTE intent creates note', ...)
test('button dispatches SUBMIT_NOTE', ...)
test('Cmd+Enter dispatches SUBMIT_NOTE', ...)
test('API dispatches SUBMIT_NOTE', ...)
```

---

## 📝 Summary

The **Intent Pattern** transforms Lovmind's editor from a fragmented event system to a unified, maintainable architecture. This pattern:

1. ✅ **Fixes the double-submission bug** (already done with quick fix)
2. ✅ **Prevents future similar bugs** (centralized logic)
3. ✅ **Makes the codebase more maintainable** (single source of truth)
4. ✅ **Enables future features** (undo/redo, analytics, middleware)
5. ✅ **Follows industry best practices** (Redux, CQRS, Command Pattern)

**Recommendation**: Adopt this pattern incrementally, starting with the submit action, then expanding to other editor operations.
