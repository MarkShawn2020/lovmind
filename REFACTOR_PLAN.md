# RenderingWysiwygEditor 重构计划

## 问题诊断

当前 RenderingWysiwygEditor.tsx 有 **510 行代码**，其中：
- **67% (345行)** 的逻辑不应该在这一层
- 混合了 **UI、业务逻辑、平台特定代码、状态管理** 多个职责
- 违反了 **单一职责原则、关注点分离、插件化原则**

## 重构目标

将 510 行的臃肿组件重构为：
- **~100 行** 的轻量级 Editor Wrapper
- **5+ 个独立的 Plugins** 处理各自职责
- **清晰的架构层次** 符合 Plate.js 最佳实践

---

## 第一阶段：创建缺失的 Plugin

### 1. InputStatePlugin ✅ 已创建
**文件**: `src/components/editor/plugins/input-state-kit.tsx`

**职责**:
- 跟踪输入状态（typing-start/stop, composition, focus）
- 提供 debounced typing-stop 事件
- 暴露 `editor.api.inputState` API

**移除的代码** (从 RenderingWysiwygEditor):
- 行 103-110: `isComposingRef`, `typingTimeoutRef`, `lastInputStateRef`
- 行 297-384: 复杂的 `handleChange` 逻辑
- 行 414-469: IME composition 事件处理

**预计减少**: ~90 行

---

### 2. TauriClipboardPlugin ✅ 已创建
**文件**: `src/components/editor/plugins/tauri-clipboard-kit.tsx`

**职责**:
- Tauri 环境下的剪贴板镜像
- copy/cut/paste 事件处理
- 自动检测 Tauri 环境

**移除的代码** (从 RenderingWysiwygEditor):
- 行 202-295: `handleCopy`, `handleCut`, `handlePaste` useEffect

**预计减少**: ~95 行

**额外好处**:
- 使用现有的 `/src/utils/editorClipboard.ts` 工具函数
- 可以扩展支持 Markdown 格式复制

---

### 3. KeyboardShortcutsPlugin (待创建)
**文件**: `src/components/editor/plugins/keyboard-shortcuts-kit.tsx`

**职责**:
- Cmd+A 全选特殊处理（Tauri macOS workaround）
- Cmd+Enter 提交事件分发
- Cmd+S 保存事件分发（移除 auto-save toast 逻辑）

**移除的代码** (从 RenderingWysiwygEditor):
- 行 176-200: Cmd+A 特殊处理
- 行 386-411: `handleKeyDown` 中的快捷键逻辑

**预计减少**: ~50 行

---

### 4. FocusManagementPlugin (可选)
**文件**: `src/components/editor/plugins/focus-management-kit.tsx`

**职责**:
- 提供 `resetAndFocus()` 方法
- 管理焦点相关的 DOM 操作
- 处理 Slate shadow input 的特殊情况

**移除的代码** (从 RenderingWysiwygEditor):
- 行 116-131: `resetAndFocus` 实现
- 行 132-134: `focus` 实现
- 行 146-162: `isSlateShadowInput`, `isEventFromEditor` helpers

**预计减少**: ~50 行

**注**: 这个可以保留在 RenderingWysiwygEditor 作为 ref API 的封装层

---

## 第二阶段：注册 Plugin 到 EditorKit

**文件**: `src/components/editor/editor-kit.tsx`

```diff
+ import { InputStatePlugin } from '@/components/editor/plugins/input-state-kit';
+ import { TauriClipboardPlugin } from '@/components/editor/plugins/tauri-clipboard-kit';
+ import { KeyboardShortcutsPlugin } from '@/components/editor/plugins/keyboard-shortcuts-kit';

export const EditorKit = [
  // ... existing plugins

  // Custom Plugins
  HashtagTransformsPlugin,
+ InputStatePlugin,
+ TauriClipboardPlugin,
+ KeyboardShortcutsPlugin,
];
```

---

## 第三阶段：简化 RenderingWysiwygEditor

### 重构前 (510 行)

```tsx
const RenderingWysiwygEditor = forwardRef<...>((props, ref) => {
  // 100+ 行的 state 和 ref 定义
  const isComposingRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastInputStateRef = useRef<...>(...);
  const [showAutoSaveToast, setShowAutoSaveToast] = useState(false);
  // ...

  // 100+ 行的 useImperativeHandle
  useImperativeHandle(ref, () => ({
    resetAndFocus: () => { /* 复杂逻辑 */ },
    focus: () => { /* ... */ },
    insertTag: (tag) => { /* ... */ },
    removeTag: (tag) => { /* ... */ },
    renameTag: (oldTag, newTag) => { /* ... */ },
  }), [editor]);

  // 200+ 行的 useEffect 事件监听
  useEffect(() => { /* Clipboard handling */ }, [editor]);
  useEffect(() => { /* Cmd+A handling */ }, [editor]);
  useEffect(() => { /* Cleanup */ }, []);

  // 100+ 行的事件处理函数
  const handleChange = ({ value }) => { /* 复杂状态跟踪 */ };
  const handleKeyDown = (e) => { /* Cmd+Enter, Cmd+S */ };
  const handleCompositionStart = () => { /* ... */ };
  const handleCompositionEnd = () => { /* ... */ };

  return <Plate>...</Plate>;
});
```

### 重构后 (~100 行)

```tsx
const RenderingWysiwygEditor = forwardRef<...>((props, ref) => {
  const { initialContent = '', initialRichContent, onChange, onSubmit, placeholder } = props;

  // Simple initial value computation
  const initialValue = useMemo<Value>(() => {
    if (initialRichContent && !isEditorContentEmpty(initialRichContent)) {
      return initialRichContent;
    }
    return createInitialValue(initialContent);
  }, []);

  // Create editor with plugins
  const editor = usePlateEditor({
    plugins: EditorKitWithoutFixedToolbar,
    value: initialValue,
  });

  // Async content loading (keep this, it's editor initialization logic)
  useEffect(() => {
    if (hasLoadedContentRef.current) return;
    const hasRichContent = initialRichContent && !isEditorContentEmpty(initialRichContent);
    const hasTextContent = initialContent && typeof initialContent === 'string' && initialContent.trim();

    if (hasRichContent || hasTextContent) {
      const newValue = hasRichContent ? initialRichContent! : createInitialValue(initialContent);
      if (JSON.stringify(editor.children) !== JSON.stringify(newValue)) {
        editor.tf.setValue(newValue);
        hasLoadedContentRef.current = true;
      }
    }
  }, [initialContent, initialRichContent, editor]);

  // Listen to plugin events
  useEffect(() => {
    const handleInputStateChange = (state: InputState) => {
      if (onChange) {
        const { text, tags } = extractTextContent(editor.children as Value);
        onChange({
          text,
          tags,
          richContent: editor.children as Value,
          isEmpty: isEditorContentEmpty(editor.children as Value),
          isFocused: state.isFocused,
          isInputting: state.isInputting,
          inputStateReason: state.reason,
        });
      }
    };

    const handleSubmitShortcut = () => {
      onSubmit?.();
    };

    editor.on('input-state-changed', handleInputStateChange);
    editor.on('submit-shortcut', handleSubmitShortcut);

    return () => {
      editor.off('input-state-changed', handleInputStateChange);
      editor.off('submit-shortcut', handleSubmitShortcut);
    };
  }, [editor, onChange, onSubmit]);

  // Simplified imperative handle (focus methods only)
  useImperativeHandle(ref, () => ({
    resetAndFocus: () => {
      const emptyValue = [{ type: 'p', children: [{ text: '' }] }];
      editor.tf.setValue(emptyValue);
      requestAnimationFrame(() => {
        try {
          editor.tf.select({ path: [0, 0], offset: 0 });
          editor.tf.focus();
        } catch (error) {
          console.error('[RenderingWysiwygEditor] Failed to set selection:', error);
          editor.tf.focus();
        }
      });
    },
    focus: () => editor.tf.focus(),
    insertTag: (tag: string) => (editor.api as any).hashtag.insert(tag),
    removeTag: (tag: string) => (editor.api as any).hashtag.remove(tag),
    renameTag: (oldTag: string, newTag: string) => (editor.api as any).hashtag.rename(oldTag, newTag),
  }), [editor]);

  // Simple render
  return (
    <Plate editor={editor}>
      <div className="h-full w-full grid grid-rows-[auto_1fr]">
        <FixedToolbar>
          <FixedToolbarButtons />
        </FixedToolbar>
        <EditorContextMenu editor={editor}>
          <EditorContainer className="relative overflow-auto">
            <Editor
              placeholder={placeholder}
              variant="none"
              className="h-full w-full px-8 py-2 outline-none caret-primary select-text selection:bg-brand/25"
            />
          </EditorContainer>
        </EditorContextMenu>
      </div>
    </Plate>
  );
});
```

**代码减少**: 510 行 → ~100 行 (**减少 80%**)

---

## 第四阶段：移除 Auto-Save Toast

### 问题
Auto-save toast 是 UI 反馈，不属于编辑器层，应该在上层组件管理。

### 方案
1. 在 `App.tsx` 和 `FloatWindow.tsx` 中监听 `Cmd+S` 快捷键
2. 显示全局 Toast（使用 sonner 或其他 toast 库）
3. RenderingWysiwygEditor 只负责分发 `save-shortcut` 事件

**移除的代码**:
- 行 111-113: `showAutoSaveToast` state
- 行 395-411: Cmd+S 处理逻辑
- 行 491-499: Toast 渲染

**预计减少**: ~30 行

---

## 第五阶段：优化 Hashtag API

### 当前问题
```tsx
// TagManagerPopover.tsx
editorRef.current.insertTag(tag);  // 通过 ref 间接调用
```

### 优化方案 A: 直接使用 Plugin API (推荐)

在 `TagManagerPopover` 和 `EditorToolbar` 中直接使用 `useEditorRef()`:

```tsx
// TagManagerPopover.tsx
import { useEditorRef } from 'platejs/react';

export const TagManagerPopover = ({ currentTags, allNotes }) => {
  const editor = useEditorRef();  // 直接获取 editor instance

  const handleToggleTag = (tag: string) => {
    const isInCurrent = currentTags.includes(tag);
    if (isInCurrent) {
      (editor.api as any).hashtag.remove(tag);  // 直接调用 plugin API
    } else {
      (editor.api as any).hashtag.insert(tag);
    }
  };

  // ...
};
```

**优点**:
- 移除 `editorRef` prop 传递
- 直接访问 editor API
- 更符合 Plate.js 设计模式

**注意**: 这只适用于在 `<Plate>` 组件树内部的组件

### 优化方案 B: 保留 Ref API（向后兼容）

对于 `FloatWindow` 和 `useNoteEditorController` 这些在 Plate 树外的组件，保留 ref API：

```tsx
// useNoteEditorController.ts
editorRef.current?.resetAndFocus();  // 依然通过 ref 调用
```

**结论**: 采用混合模式
- 内部组件（TagManagerPopover, EditorToolbar）→ 使用 `useEditorRef()`
- 外部组件（FloatWindow, useNoteEditorController）→ 使用 ref API

---

## 代码减少总结

| 重构项 | 移除行数 | 移动到 |
|--------|---------|--------|
| 输入状态跟踪 | ~90 行 | InputStatePlugin |
| 剪贴板处理 | ~95 行 | TauriClipboardPlugin |
| 键盘快捷键 | ~50 行 | KeyboardShortcutsPlugin |
| Auto-save toast | ~30 行 | App.tsx/FloatWindow.tsx |
| 焦点管理 (可选) | ~50 行 | FocusManagementPlugin/保留 |
| **总计** | **~315 行** | **插件系统** |

**最终结果**:
- RenderingWysiwygEditor: 510 行 → **~100 行** (减少 **80%**)
- 新增 Plugin: **3-4 个**，每个 50-150 行，职责单一
- 架构清晰度: **显著提升** ✅

---

## 架构对比

### 重构前（混乱）
```
RenderingWysiwygEditor (510 行，混合职责)
├─ 输入状态跟踪 (应该在 Plugin)
├─ 剪贴板管理 (应该在 Plugin)
├─ 键盘快捷键 (应该在 Plugin)
├─ Auto-save toast (应该在上层)
├─ IME 处理 (应该在 Plugin)
├─ Hashtag API (应该直接暴露)
└─ Plate + Plugins
```

### 重构后（清晰）
```
App.tsx / FloatWindow.tsx (上层组件)
├─ Auto-save toast
├─ Save/Submit 事件处理
└─ RenderingWysiwygEditor (100 行，UI wrapper)
    └─ Plate Editor Instance
        ├─ InputStatePlugin (状态跟踪)
        ├─ TauriClipboardPlugin (剪贴板)
        ├─ KeyboardShortcutsPlugin (快捷键)
        ├─ HashtagTransformsPlugin (标签操作)
        └─ ...其他 Plugins
```

---

## 下一步行动

### 立即可做
1. ✅ 已创建 `InputStatePlugin`
2. ✅ 已创建 `TauriClipboardPlugin`
3. ⏳ 创建 `KeyboardShortcutsPlugin`
4. ⏳ 注册 Plugins 到 EditorKit
5. ⏳ 重构 RenderingWysiwygEditor

### 需要讨论
- [ ] 是否完全移除 Auto-save toast，还是移到上层组件？
- [ ] 是否将 `resetAndFocus`/`focus` 也移到 FocusManagementPlugin？
- [ ] TagManagerPopover/EditorToolbar 是否改用 `useEditorRef()` 直接访问？

---

## 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| Plugin 事件监听失败 | 低 | 中 | 完善的错误处理和降级方案 |
| 现有功能回归 | 中 | 高 | 完整的测试覆盖（单元测试 + E2E） |
| 性能下降 | 低 | 低 | Plugin 逻辑更轻量，预期性能提升 |
| API 变化影响消费者 | 低 | 中 | 保持向后兼容的 ref API |

---

## 预期收益

### 代码质量
- ✅ 单一职责原则：每个 Plugin 职责清晰
- ✅ 可维护性：独立 Plugin 易于测试和修改
- ✅ 可扩展性：新功能通过新 Plugin 添加
- ✅ 复用性：Plugin 可在其他 Plate 项目复用

### 性能
- ✅ 减少不必要的 re-render
- ✅ Plugin 事件机制更高效
- ✅ 代码体积减少（减少 bundle size）

### 开发体验
- ✅ 代码更易读（510 行 → 100 行）
- ✅ 调试更容易（职责分离）
- ✅ 符合 Plate.js 最佳实践
- ✅ 更好的 TypeScript 类型支持

---

## 参考资料

- [Plate.js 官方文档 - Plugins](https://platejs.org/docs/plugins)
- [Plate.js 源码 - Plugin 示例](https://github.com/udecode/plate)
- 当前项目现有 Plugin 实现：
  - `src/components/editor/plugins/hashtag-kit.tsx`
  - `src/components/editor/plugins/media-kit.tsx`
  - `src/components/editor/plugins/ai-kit.tsx`
