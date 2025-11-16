# 全面架构重构计划

## 目标

将 App.tsx, float-window.tsx, EditorLayout.tsx, RenderingWysiwygEditor.tsx 从 useNoteEditorController (628 行上帝 Hook) 迁移到 Jotai + 专注 Hooks 架构。

---

## 当前问题

### 1. float-window.tsx (197 行)
```typescript
const {
  notes, showArchived, currentNote, isEditingTitle, editingTitle,
  handleTitleChange, handleStartEditingTitle, handleCancelEditingTitle,
  handleSaveTitle, handleHeaderMouseDown, isWindowAlwaysOnTop,
  handleToggleAlwaysOnTop, handleFloatWindowClose, handleContentChange,
  handleSubmit, editorRef, notesListRef, editorContainerRef,
  openNoteInNewWindow, toggleArchive, deleteNote, handleDuplicateNote,
  placeholder, content, richContent, currentTags, submitDisabled, togglePin,
} = useNoteEditorController({ mode: 'float', noteId, ... });
// 从一个 Hook 返回 30+ 个值！
```

**问题**：
- Props drilling：30+ 个值传给子组件
- 状态重复：content/richContent/currentTags 在 3 个地方存在
- 职责混乱：笔记数据 + UI 状态 + 窗口操作全混在一起

### 2. App.tsx (352 行)
```typescript
const {
  notes, noteStats, userProfile, showArchived, setShowArchived,
  isUserMenuOpen, setIsUserMenuOpen, isProfileModalOpen,
  setIsProfileModalOpen, isAboutModalOpen, setIsAboutModalOpen,
  menuPosition, handleUserMenuToggle, handleHeaderMouseDown,
  handleContentChange, handleSubmit, handleDuplicateNote,
  editorRef, notesListRef, editorContainerRef, userMenuRef,
  userButtonRef, openNoteInNewWindow, toggleArchive, deleteNote,
  togglePin, placeholder, content, richContent, currentTags,
  submitDisabled, handleBackToCreate, createNewNoteWindow,
  viewingNoteId, isEditorEmpty,
} = useNoteEditorController({ mode: 'main', ... });
// 从一个 Hook 返回 40+ 个值！
```

**问题**：
- 更严重的 props drilling
- UserMenu 手动实现（应该用 Radix UI）
- Modals 状态在 Hook 里（应该在组件内部）

### 3. RenderingWysiwygEditor.tsx (106 行)
**已重构**，但仍依赖 initialContent/initialRichContent props（应该直接从 atom 读取）

### 4. EditorLayout.tsx (67 行)
**基本 OK**，只是布局组件，但传递了太多 props

---

## 重构后架构

```
Jotai Atoms (Global State)
├── notesAtom              - 所有笔记
├── currentNoteIdAtom      - 当前编辑笔记 ID
├── currentNoteAtom        - 派生：当前笔记
├── editorContentAtom      - 编辑器未保存内容
└── uiStateAtom            - 全局 UI 状态

Business Logic Hooks
├── useNoteOperations      - CRUD（已存在）
├── useAutoSave            - 自动保存（已创建）
├── useEditorSync          - 编辑器同步（已创建）
├── useNoteLoader          - 笔记加载逻辑（待创建）
└── useWindowOperations    - 窗口操作（已存在）

UI Components
├── UserMenuDropdown       - Radix UI Dropdown（待创建）
├── TitleEditor            - 标题编辑组件（待创建）
├── FloatHeader            - 已存在，需简化
└── MainHeader             - 已存在，需简化

Top-Level Components
├── FloatWindow            - 读 atoms，纯渲染
├── App                    - 读 atoms，纯渲染
├── EditorLayout           - 布局组件（可能无需改动）
└── RenderingWysiwygEditor - 纯编辑器包装器
```

---

## 实施步骤

### ✅ Phase 1: 基础设施（已完成）
- [x] 创建 noteAtoms.ts
- [x] 创建 useEditorSync.ts
- [x] 创建 useAutoSave.ts
- [x] 恢复 RenderingWysiwygEditor.tsx

### 🔄 Phase 2: 创建缺失的 Hooks 和组件

#### 2.1 创建 useNoteLoader Hook
```typescript
// hooks/useNoteLoader.ts
export function useNoteLoader(noteId: string | null) {
  const setCurrentNoteId = useSetAtom(currentNoteIdAtom);
  const { notes } = useNoteOperations();

  useEffect(() => {
    if (!noteId) {
      setCurrentNoteId(null);
      return;
    }

    // Load note from Tauri backend or find in notes array
    const loadNote = async () => {
      if (isTauri()) {
        const noteData = await invoke<Note | null>('get_temp_note', { id: noteId });
        if (noteData) {
          // Note will be available via currentNoteAtom
          setCurrentNoteId(noteId);
        }
      } else {
        const note = notes.find(n => n.id === noteId);
        if (note) {
          setCurrentNoteId(noteId);
        }
      }
    };

    loadNote();
  }, [noteId, notes, setCurrentNoteId]);
}
```

#### 2.2 创建 UI 组件

**UserMenuDropdown.tsx** - 替代手动实现的菜单
**TitleEditor.tsx** - 提取标题编辑逻辑
**FloatWindowControls.tsx** - 浮动窗口控制按钮

### 🔄 Phase 3: 重构 float-window.tsx

**重构前**（197 行）：
```typescript
function FloatWindow() {
  const { ...30+ values } = useNoteEditorController({ mode: 'float', noteId });
  return <EditorLayout ... />;
}
```

**重构后**（~80 行）：
```typescript
function FloatWindow() {
  const noteId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('noteId');
  }, []);

  // Load note into atoms
  useNoteLoader(noteId);

  // Read from atoms
  const currentNote = useAtomValue(currentNoteAtom);
  const editorContent = useAtomValue(editorContentAtom);
  const notes = useAtomValue(notesAtom);

  // Business logic hooks
  const { handleContentChange } = useEditorSync();
  useAutoSave();
  const { togglePin, toggleArchive, deleteNote } = useNoteOperations();
  const { openNoteInNewWindow } = useWindowOperations();

  // Editor ref (still needed for imperative API)
  const editorRef = useRef<RenderingWysiwygEditorRef>(null);

  // Focus on mount
  useEffect(() => {
    // ... focus logic
  }, []);

  if (!currentNote) {
    return <div>Loading...</div>;
  }

  return (
    <EditorLayout
      header={<FloatHeader note={currentNote} />}
      sidebar={<NotesSidebar notes={notes} currentNoteId={currentNote.id} />}
      editor={
        <RenderingWysiwygEditor
          key={currentNote.id}
          initialRichContent={currentNote.richContent}
          onChange={handleContentChange}
          ref={editorRef}
        />
      }
      toolbar={<EditorToolbar />}
    />
  );
}
```

**减少**：197 行 → ~80 行（-59%）

### 🔄 Phase 4: 重构 App.tsx

**重构前**（352 行）：
```typescript
function App() {
  const [viewingNoteId, setViewingNoteId] = useState<string | null>(null);
  const { ...40+ values } = useNoteEditorController({ mode: 'main', viewingNoteId });
  return <EditorLayout ... />;
}
```

**重构后**（~120 行）：
```typescript
function App() {
  const [viewingNoteId, setViewingNoteId] = useState<string | null>(null);

  // Load viewing note into atoms
  useNoteLoader(viewingNoteId);

  // Read from atoms
  const currentNote = useAtomValue(currentNoteAtom);
  const editorContent = useAtomValue(editorContentAtom);
  const notes = useAtomValue(notesAtom);
  const noteStats = useAtomValue(noteStatsAtom);

  // Business logic hooks
  const { handleContentChange } = useEditorSync();
  useAutoSave();
  const { updateNote, deleteNote, togglePin, toggleArchive } = useNoteOperations();
  const { openNoteInNewWindow, createNewNoteWindow } = useWindowOperations();

  // UI state (local)
  const [showArchived, setShowArchived] = useState(false);

  // Editor ref
  const editorRef = useRef<RenderingWysiwygEditorRef>(null);

  const handleSubmit = async () => {
    // Submit logic using editorContent from atom
    // ...
  };

  return (
    <EditorLayout
      header={<MainHeader />}
      sidebar={<NotesSidebar />}
      editor={
        <RenderingWysiwygEditor
          key={viewingNoteId || 'create-mode'}
          initialRichContent={currentNote?.richContent}
          onChange={handleContentChange}
          ref={editorRef}
        />
      }
      toolbar={<EditorToolbar />}
      userMenu={<UserMenuDropdown />}
      profileModal={<ProfileModal />}
      aboutModal={<AboutModal />}
    />
  );
}
```

**减少**：352 行 → ~120 行（-66%）

### ⏳ Phase 5: 简化子组件

#### FloatHeader.tsx
**重构前**：接收 10+ 个 props
**重构后**：直接读 atoms，只接收必要 props

#### NotesSidebarContainer.tsx
**重构前**：接收 ref + 10+ 个 props
**重构后**：直接读 atoms，移除 ref

### ⏳ Phase 6: 删除 useNoteEditorController

最后一步：删除 628 行的上帝 Hook 🎉

---

## 预期收益

### 代码量

| 文件 | 重构前 | 重构后 | 减少 |
|------|--------|--------|------|
| float-window.tsx | 197 行 | ~80 行 | -59% |
| App.tsx | 352 行 | ~120 行 | -66% |
| useNoteEditorController.ts | 628 行 | **删除** | -100% |
| **总计** | 1177 行 | ~200 行 | **-83%** |

### 架构

- ✅ 单一数据源（Jotai atoms）
- ✅ 职责分离（Hooks 各司其职）
- ✅ 可测试性（atoms/hooks 独立测试）
- ✅ 无 props drilling（直接读 atoms）
- ✅ 现代化 UI（Radix UI Dropdown 等）

### 性能

- ✅ 细粒度更新（只重渲染订阅组件）
- ✅ 减少不必要的 re-render
- ✅ Jotai 内部优化

---

## 风险

| 风险 | 等级 | 缓解措施 |
|------|------|---------|
| 破坏现有功能 | 高 | 分阶段重构 + 充分测试 |
| 数据同步问题 | 中 | 使用 Jotai atoms 自动同步 |
| 学习曲线 | 低 | Jotai API 简单 |

---

## 时间估计

- Phase 2: 创建 Hooks 和组件 - **2 小时**
- Phase 3: 重构 FloatWindow - **1 小时**
- Phase 4: 重构 App - **2 小时**
- Phase 5: 简化子组件 - **1 小时**
- Phase 6: 删除旧代码 - **0.5 小时**

**总计**: ~6.5 小时

---

## 开始！

准备从 Phase 2 开始实施。
