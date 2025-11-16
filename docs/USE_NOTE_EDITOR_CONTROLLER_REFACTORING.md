# useNoteEditorController 架构问题深度分析

## 核心问题：上帝 Hook 反模式

**628 行代码** 混合了 **7 种不同职责**，违反单一职责原则。

```typescript
// 当前返回 51 个值/函数
return {
  mode, noteId, placeholder, currentNoteId,
  notes, noteStats, userProfile,
  content, richContent, currentTags, currentNote,
  showArchived, setShowArchived,
  isUserMenuOpen, setIsUserMenuOpen,
  isProfileModalOpen, setIsProfileModalOpen,
  isAboutModalOpen, setIsAboutModalOpen,
  isTagSettingsModalOpen, setIsTagSettingsModalOpen,
  menuPosition, setMenuPosition,
  isEditingTitle, setIsEditingTitle,
  editingTitle, setEditingTitle,
  isEditorEmpty, isWindowAlwaysOnTop,
  notesListRef, editorRef, editorContainerRef, userMenuRef, userButtonRef,
  openNoteInNewWindow, deleteNote, togglePin, toggleArchive,
  handleUserMenuToggle, handleHeaderMouseDown,
  handleContentChange, handleSubmit,
  handleTogglePin, handleToggleAlwaysOnTop,
  handleDuplicateNote, handleSaveTitle,
  handleTitleChange, handleStartEditingTitle, handleCancelEditingTitle,
  handleFloatWindowClose, handleBackToCreate,
  createNewNoteWindow, submitDisabled, viewingNoteId,
};
```

---

## 问题分类

### 1. 🔴 状态重复问题（最严重）

**编辑器内容存在 3 份拷贝**：

```typescript
// 拷贝 1: 本地 state
const [content, setContent] = useState('');
const [richContent, setRichContent] = useState<Value | null>(null);
const [currentTags, setCurrentTags] = useState<string[]>([]);

// 拷贝 2: editor.children (在 RenderingWysiwygEditor 内部)

// 拷贝 3: currentNote.richContent / currentNote.text / currentNote.tags
const [currentNote, setCurrentNote] = useState<Note | null>(null);
```

**问题**：
- 三份数据需要手动同步
- handleContentChange 负责同步 editor → local state
- handleSubmit 负责同步 local state → note
- 容易出现不一致

**正确做法**：
```typescript
// Jotai 原子
export const currentNoteIdAtom = atom<string | null>(null);
export const currentNoteAtom = atom((get) => {
  const id = get(currentNoteIdAtom);
  const notes = get(notesAtom);
  return notes.find(n => n.id === id) || null;
});

export const editorContentAtom = atom<{
  text: string;
  tags: string[];
  richContent: Value | null;
}>({
  text: '',
  tags: [],
  richContent: null,
});
```

**优势**：
- ✅ 单一数据源
- ✅ 自动派生（currentNote 从 notes 派生）
- ✅ 跨组件共享（无需 props drilling）

---

### 2. 🔴 UI 状态污染

**与笔记编辑无关的 UI 状态**：

```typescript
// ❌ 用户菜单状态（应该在 UserMenu 组件内部）
const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
const userMenuRef = useRef<HTMLDivElement | null>(null);
const userButtonRef = useRef<HTMLButtonElement | null>(null);

// ❌ Modal 状态（应该在各自 Modal 组件内部）
const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
const [isTagSettingsModalOpen, setIsTagSettingsModalOpen] = useState(false);

// ❌ 标题编辑状态（应该在 TitleEditor 组件内部）
const [isEditingTitle, setIsEditingTitle] = useState(false);
const [editingTitle, setEditingTitle] = useState('');

// ❌ 归档显示状态（应该在 NotesList 组件内部）
const [showArchived, setShowArchived] = useState(false);
```

**问题**：
- 这些 UI 状态和笔记编辑逻辑无关
- 放在中央 Hook 导致任何 UI 变化都触发整个 Hook 重新执行
- 违反"关注点分离"原则

**正确做法**：
```typescript
// UserMenu.tsx - 组件内部管理自己的状态
function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      {/* Radix UI 自动处理位置、点击外部关闭等 */}
    </DropdownMenu>
  );
}

// TitleEditor.tsx - 组件内部管理自己的状态
function TitleEditor({ initialTitle, onSave }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialTitle);

  // ...
}
```

---

### 3. 🟡 Auto-save 逻辑混在 onChange 中

**handleContentChange 做了太多事**：

```typescript
const handleContentChange = useCallback((payload: EditorContentChange) => {
  // 1. 更新本地状态
  setContent(payload.text);
  setCurrentTags(payload.tags);
  setRichContent(payload.richContent);
  setIsEditorEmpty(payload.isEmpty);

  // 2. Auto-save 逻辑（50+ 行）
  if (mode === 'float' && currentNote && !payload.isInputting && payload.inputStateReason === 'typing-stop') {
    // 构建 updatedNote
    // 调用 updateNote
    // 更新窗口标题
    // 错误处理
  }

  // 3. 主窗口 viewing mode 的 auto-save（又是 50+ 行重复逻辑）
  if (mode === 'main' && viewingNoteId && currentNote && !payload.isInputting && payload.inputStateReason === 'typing-stop') {
    // 几乎完全相同的逻辑
  }
}, [mode, currentNote, viewingNoteId, updateNote]);
```

**问题**：
- 100+ 行逻辑混在一个函数里
- 两个 if 分支有大量重复代码
- 难以测试
- 难以复用

**正确做法**：
```typescript
// useAutoSave.ts - 独立的 Hook
export function useAutoSave() {
  const editorContent = useAtomValue(editorContentAtom);
  const currentNote = useAtomValue(currentNoteAtom);
  const { updateNote } = useNoteOperations();

  useEffect(() => {
    // 监听 editorContent 变化
    // 在 typing-stop 时触发保存
    // 单一职责：只负责自动保存
  }, [editorContent, currentNote, updateNote]);
}

// float-window.tsx / App.tsx
function FloatWindow() {
  useAutoSave(); // ✅ 声明式启用 auto-save
  // ...
}
```

---

### 4. 🟡 Ref 滥用

**5 个 ref，大部分不必要**：

```typescript
const notesListRef = useRef<HTMLDivElement | null>(null);        // ❌ 用于滚动，应该用 CSS/key
const internalEditorRef = useRef<RenderingWysiwygEditorRef | null>(null); // ✅ 命令式 API，必要
const editorContainerRef = useRef<HTMLDivElement | null>(null);  // ❌ 从未使用
const userMenuRef = useRef<HTMLDivElement | null>(null);         // ❌ Radix UI 自动处理
const userButtonRef = useRef<HTMLButtonElement | null>(null);    // ❌ Radix UI 自动处理
```

**问题**：
- 过度使用 ref 做状态管理和 DOM 操作
- Radix UI 等现代组件库已经内置了这些功能

---

### 5. 🟡 重复的加载逻辑

**两个几乎相同的 useEffect 加载笔记**：

```typescript
// useEffect 1: Float 模式加载笔记（行 139-203）
useEffect(() => {
  if (mode === 'float' && noteId) {
    const loadNote = async () => {
      let noteData: Note | null = null;
      if (isTauri()) {
        noteData = await invoke('get_temp_note', { id: noteId });
      } else {
        noteData = notes.find(n => n.id === noteId) || null;
      }

      if (noteData) {
        setCurrentNote(noteData);
        setContent(noteData.text);
        setRichContent(noteData.richContent || null);
        setCurrentTags(noteData.tags || []);
        // ...
      }
    };
    loadNote();
  }
}, [mode, noteId, notes]);

// useEffect 2: Main 模式 viewing 加载笔记（行 206-242）
useEffect(() => {
  if (mode === 'main' && viewingNoteId) {
    const loadViewingNote = async () => {
      // 几乎完全相同的逻辑！
      let noteData: Note | null = null;
      if (isTauri()) {
        noteData = await invoke('get_temp_note', { id: viewingNoteId });
      } else {
        noteData = notes.find(n => n.id === viewingNoteId) || null;
      }

      if (noteData) {
        setCurrentNote(noteData);
        setContent(noteData.text);
        setRichContent(noteData.richContent || null);
        setCurrentTags(noteData.tags || []);
        // ...
      }
    };
    loadViewingNote();
  }
}, [mode, viewingNoteId, notes]);
```

**问题**：
- 80+ 行重复代码
- 违反 DRY 原则

**正确做法**：
```typescript
// 使用 Jotai atom，自动派生
export const currentNoteAtom = atom((get) => {
  const id = get(currentNoteIdAtom);
  const notes = get(notesAtom);
  return notes.find(n => n.id === id) || null;
});

// 不需要手动加载，直接读取 atom
const currentNote = useAtomValue(currentNoteAtom);
```

---

## 重构方案

### 架构层次

```
┌─────────────────────────────────────────────────┐
│          Application State (Jotai)              │
├─────────────────────────────────────────────────┤
│ notesAtom              - 所有笔记               │
│ currentNoteIdAtom      - 当前编辑笔记 ID        │
│ currentNoteAtom        - 派生：当前笔记          │
│ editorContentAtom      - 编辑器未保存内容       │
│ uiStateAtom            - 全局 UI 状态           │
└─────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────┐
│          Business Logic Hooks                    │
├─────────────────────────────────────────────────┤
│ useNoteOperations      - CRUD 操作              │
│ useAutoSave            - 自动保存逻辑            │
│ useEditorSync          - 编辑器 ↔ Atom 同步     │
│ useWindowOperations    - 窗口操作               │
└─────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────┐
│          Editor Layer (Plate.js)                 │
├─────────────────────────────────────────────────┤
│ RenderingWysiwygEditor - 纯包装器               │
│ Plugins                - 编辑器能力扩展          │
│ useEditorEventBridge   - 事件桥接               │
└─────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────┐
│          Component Layer                         │
├─────────────────────────────────────────────────┤
│ FloatWindow            - 读 atoms，纯渲染        │
│ App                    - 读 atoms，纯渲染        │
│ UserMenu               - 本地状态（isOpen）      │
│ TitleEditor            - 本地状态（isEditing）   │
│ NotesList              - 本地状态（showArchived）│
└─────────────────────────────────────────────────┘
```

---

### 具体步骤

#### Phase 1: 创建 Jotai Atoms

```typescript
// atoms/noteAtoms.ts
import { atom } from 'jotai';
import type { Note } from '@/store';
import type { Value } from 'platejs';

// 基础 atoms
export const notesAtom = atom<Note[]>([]);
export const currentNoteIdAtom = atom<string | null>(null);

// 派生 atoms
export const currentNoteAtom = atom((get) => {
  const notes = get(notesAtom);
  const id = get(currentNoteIdAtom);
  return notes.find(n => n.id === id) || null;
});

// 编辑器内容 atom（未保存的内容）
export const editorContentAtom = atom<{
  text: string;
  tags: string[];
  richContent: Value | null;
  isEmpty: boolean;
}>({
  text: '',
  tags: [],
  richContent: null,
  isEmpty: true,
});

// UI 状态 atom
export const uiStateAtom = atom({
  showArchived: false,
});
```

#### Phase 2: 提取 useEditorSync Hook

```typescript
// hooks/useEditorSync.ts
import { useSetAtom } from 'jotai';
import { useCallback } from 'react';
import { editorContentAtom } from '@/atoms/noteAtoms';
import type { EditorContentChange } from '@/components/RenderingWysiwygEditor';

export function useEditorSync() {
  const setEditorContent = useSetAtom(editorContentAtom);

  const handleContentChange = useCallback((payload: EditorContentChange) => {
    console.log("Content changed:", payload);

    setEditorContent({
      text: payload.text,
      tags: payload.tags,
      richContent: payload.richContent,
      isEmpty: payload.isEmpty,
    });
  }, [setEditorContent]);

  return { handleContentChange };
}
```

#### Phase 3: 提取 useAutoSave Hook

```typescript
// hooks/useAutoSave.ts
import { useAtomValue } from 'jotai';
import { useEffect, useRef } from 'react';
import { editorContentAtom, currentNoteAtom } from '@/atoms/noteAtoms';
import { useNoteOperations } from './useNoteOperations';
import { extractNoteTitle } from '@/utils/titleExtractor';

export function useAutoSave() {
  const editorContent = useAtomValue(editorContentAtom);
  const currentNote = useAtomValue(currentNoteAtom);
  const { updateNote } = useNoteOperations();

  const lastSavedRef = useRef<string>('');

  useEffect(() => {
    if (!currentNote) return;
    if (editorContent.isEmpty) return;

    // 防止重复保存
    const contentHash = JSON.stringify(editorContent);
    if (contentHash === lastSavedRef.current) return;

    // Debounce - 只在 typing-stop 时保存
    // 这里需要配合 InputStatePlugin 的事件
    const timer = setTimeout(() => {
      const updatedNote = {
        ...currentNote,
        text: editorContent.text,
        tags: editorContent.tags,
        richContent: editorContent.richContent,
        title: currentNote.manualTitle
          ? currentNote.title
          : extractNoteTitle({ text: editorContent.text, richContent: editorContent.richContent }),
        time: new Date().toLocaleString(),
      };

      updateNote(updatedNote)
        .then(() => {
          console.log('🔄 Auto-saved:', updatedNote.id);
          lastSavedRef.current = contentHash;
        })
        .catch((error) => {
          console.error('Failed to auto-save:', error);
        });
    }, 1000);

    return () => clearTimeout(timer);
  }, [editorContent, currentNote, updateNote]);
}
```

#### Phase 4: 简化 FloatWindow

```typescript
// float-window.tsx - 重构后
import { useAtomValue, useSetAtom } from 'jotai';
import { currentNoteIdAtom, currentNoteAtom, editorContentAtom } from '@/atoms/noteAtoms';
import { useEditorSync } from '@/hooks/useEditorSync';
import { useAutoSave } from '@/hooks/useAutoSave';

function FloatWindow() {
  // 从 URL 获取 noteId
  const noteId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('noteId');
  }, []);

  // 设置当前笔记 ID（触发 atom 更新）
  const setCurrentNoteId = useSetAtom(currentNoteIdAtom);
  useEffect(() => {
    setCurrentNoteId(noteId);
  }, [noteId, setCurrentNoteId]);

  // 读取派生状态
  const currentNote = useAtomValue(currentNoteAtom);
  const editorContent = useAtomValue(editorContentAtom);

  // 编辑器同步和自动保存
  const { handleContentChange } = useEditorSync();
  useAutoSave();

  const editorRef = useRef<RenderingWysiwygEditorRef>(null);

  if (!currentNote) {
    return <div>Loading...</div>;
  }

  return (
    <EditorLayout
      header={<FloatHeader note={currentNote} />}
      sidebar={<NotesSidebar />}
      editor={
        <RenderingWysiwygEditor
          key={currentNote.id}
          initialRichContent={currentNote.richContent}
          onChange={handleContentChange}
          ref={editorRef}
        />
      }
    />
  );
}
```

**代码减少**：628 行 → ~50 行（**减少 92%**）

---

## 收益分析

### 代码质量

| 指标 | 当前 | 重构后 | 改进 |
|------|------|--------|------|
| useNoteEditorController 行数 | 628 | 删除 | -100% |
| 返回值数量 | 51 | 0 | -100% |
| useState 数量 | 14 | 0 | -100% |
| useRef 数量 | 5 | 1 | -80% |
| useEffect 数量 | 4 | 0 | -100% |
| 代码重复 | 高 | 无 | ✅ |

### 性能

- ✅ **减少重渲染**：Jotai 只更新订阅的组件
- ✅ **细粒度更新**：UI 状态变化不触发整个 Hook
- ✅ **自动优化**：Jotai 内部优化

### 可测试性

- ✅ **Atoms 可独立测试**：无需 mount 组件
- ✅ **Hooks 可独立测试**：清晰的输入输出
- ✅ **业务逻辑解耦**：不依赖 UI

### 可维护性

- ✅ **单一职责**：每个模块职责明确
- ✅ **关注点分离**：UI / 状态 / 业务逻辑分离
- ✅ **易于理解**：不再有 628 行的"上帝 Hook"

---

## 风险评估

| 阶段 | 风险 | 影响范围 | 缓解措施 |
|------|------|---------|---------|
| Phase 1: 创建 atoms | 低 | 无（新增文件） | 与现有代码并行 |
| Phase 2: useEditorSync | 低 | 仅编辑器同步 | 保持现有逻辑作为后备 |
| Phase 3: useAutoSave | 中 | 自动保存功能 | 充分测试 typing-stop 触发 |
| Phase 4: 重构组件 | 高 | 整个应用 | 分步骤渐进式迁移 |

---

## 迁移路径

### 渐进式重构（推荐）

1. ✅ **Week 1**: 创建 atoms，与现有代码并行
2. ✅ **Week 2**: 提取 useEditorSync，替换 handleContentChange
3. ✅ **Week 3**: 提取 useAutoSave，移除 auto-save 逻辑
4. ✅ **Week 4**: 将 UI 状态移到组件内部
5. ✅ **Week 5**: 重构 FloatWindow，删除 useNoteEditorController

### 快速重构（激进）

直接实现 Phase 1-4，一次性重构。

**风险**：高
**收益**：立即获得所有优势

---

## 结论

**你的判断完全正确**：useNoteEditorController 是典型的反模式。

**根本问题**：
- 用 Hook 做了状态管理的事（应该用 Jotai）
- 混合了 UI 状态和业务逻辑（应该分离）
- 返回 51 个值导致 props drilling（应该用 atoms）

**重构后架构**：
- Jotai atoms 管理全局状态
- 专注的 Hooks 处理特定逻辑（sync, auto-save）
- 组件只负责渲染（读 atoms，无本地状态）
- Plate.js plugins 处理编辑器逻辑

这是一次**架构级别的改进**，值得投入时间重构。
