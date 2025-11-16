# RenderingWysiwygEditor 深度问题分析

## 当前问题总结

`RenderingWysiwygEditor.tsx` 有 **3 个严重设计问题**：

### 1. ❌ 异步加载 useEffect 是不必要的 workaround

```typescript
// 行 75-89: 这个 useEffect 是多余的！
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
```

**问题根源**：
- `useNoteEditorController.ts` 在 **异步加载** 数据后才设置 `content` 和 `richContent`
- 但 `RenderingWysiwygEditor` 在数据到达前就已经渲染了
- 这导致需要用 useEffect 监听 props 变化来"补丁"更新

**为什么这是错误的？**
1. **违反单向数据流**：初始值应该在 mount 时就正确
2. **性能浪费**：组件渲染两次（空白 → 有数据）
3. **使用 JSON.stringify**：深度对比非常昂贵
4. **hasLoadedContentRef hack**：用 ref 追踪状态是反模式

**正确做法**：
```typescript
// FloatWindow.tsx - 等待数据加载完成再渲染
const { currentNote, isLoading } = useNoteEditorController({ ... });

if (isLoading) {
  return <div>Loading...</div>;
}

return (
  <RenderingWysiwygEditor
    key={currentNote.id}  // ✅ key prop 强制重新创建实例
    initialRichContent={currentNote.richContent}
    onChange={handleContentChange}
  />
);
```

---

### 2. ❌ useMemo 依赖数组为空但使用了 props

```typescript
// 行 59-65: React Hook 依赖 bug！
const initialValue = useMemo<Value>(() => {
  if (initialRichContent && !isEditorContentEmpty(initialRichContent)) {
    return initialRichContent;  // ❌ 使用了 initialRichContent
  }
  const safeContent = typeof initialContent === 'string' ? initialContent : '';
  return createInitialValue(safeContent);  // ❌ 使用了 initialContent
}, []); // ❌ 空依赖数组！
```

**问题**：
- ESLint 会警告：`React Hook useMemo has missing dependencies`
- 空依赖数组意味着"只在 mount 时计算"
- 但函数体使用了 `initialContent` 和 `initialRichContent` props
- 这和行 75-89 的 useEffect 逻辑冲突！

**矛盾**：
- useMemo 说："我只用初始 props"
- useEffect 说："props 变了我要更新"
- 这两个逻辑互相矛盾

**修复方案 A**（如果 props 永不变化）：
```typescript
// 移除 useEffect，保持 useMemo 空依赖
const initialValue = useMemo<Value>(() => {
  // ...
}, []); // ✅ 明确表达：只在 mount 时计算
```

**修复方案 B**（如果 props 可能变化）：
```typescript
// 添加依赖，移除 useEffect
const initialValue = useMemo<Value>(() => {
  // ...
}, [initialContent, initialRichContent]); // ✅ 正确依赖
```

但实际上对于编辑器，**方案 A + key prop** 是最佳实践：
```typescript
<RenderingWysiwygEditor
  key={noteId}  // 不同笔记 = 新实例
  initialRichContent={...}
/>
```

---

### 3. ✅ 事件桥接 useEffect 是必要的（但可以优化）

```typescript
// 行 101-132: 这个 useEffect 是必要的
useEffect(() => {
  const handleInputStateChange = (state: any) => {
    if (onChange) {
      const { text, tags } = extractTextContent(editor.children as Value);
      onChange({ ... });
    }
  };

  const handleSubmitShortcut = () => {
    onSubmit?.();
  };

  if (typeof editor.on === 'function') {
    editor.on('input-state-changed', handleInputStateChange);
    editor.on('submit-shortcut', handleSubmitShortcut);
  }

  return () => {
    if (typeof editor.off === 'function') {
      editor.off('input-state-changed', handleInputStateChange);
      editor.off('submit-shortcut', handleSubmitShortcut);
    }
  };
}, [editor, onChange, onSubmit]);
```

**为什么必要？**
- 桥接 **Plugin events**（editor.on）到 **React props**（onChange）
- Plugins 发出带有 `inputStateReason` 等数据的事件
- 父组件期望 React 风格的 onChange 回调

**可优化之处**：
1. 提取到自定义 Hook：`useEditorEventBridge`
2. 每次 change 都调用 `extractTextContent` 和 `isEditorContentEmpty` - 可能有性能问题

---

### 4. ❌ editorContainerRef 是死代码

```typescript
// 行 91: 定义了但从未使用
const editorContainerRef = useRef<HTMLDivElement>(null);

// 行 142: 传递给 EditorContainer
<EditorContainer ref={editorContainerRef} className="relative overflow-auto">
```

**问题**：
- 这个 ref 从未被读取
- 没有任何代码使用 `editorContainerRef.current`
- 应该删除

---

## 重构方案

### 方案 1: 最小化修改（保守）

**步骤**：
1. 删除 `editorContainerRef`（死代码）
2. 删除异步加载 useEffect（行 75-89）
3. 删除 `hasLoadedContentRef`
4. 保持 useMemo 空依赖（明确表达只用 mount 时的 props）
5. 提取事件桥接到自定义 Hook

**结果**：~120 行，清晰明确

---

### 方案 2: 深度重构（激进）

**步骤**：
1. 修复 FloatWindow/useNoteEditorController 的数据加载逻辑
2. 使用 key prop 强制重新创建实例
3. 完全移除异步加载逻辑
4. 提取所有 useEffect 到自定义 Hooks
5. 简化 RenderingWysiwygEditor 到纯渲染逻辑

**预期代码**：
```typescript
const RenderingWysiwygEditor = forwardRef((props, ref) => {
  const { initialContent = '', initialRichContent, onChange, onSubmit, placeholder } = props;

  const initialValue = useMemo(() => {
    if (initialRichContent && !isEditorContentEmpty(initialRichContent)) {
      return initialRichContent;
    }
    return createInitialValue(initialContent);
  }, []); // Empty deps OK - parent uses key prop for new instances

  const editor = usePlateEditor({
    plugins: EditorKitWithoutFixedToolbar,
    value: initialValue,
  });

  useEditorEventBridge(editor, onChange, onSubmit);

  useImperativeHandle(ref, () => ({
    resetAndFocus: () => (editor.api as any).commands.resetAndFocus(),
    focus: () => editor.tf.focus(),
    insertTag: (tag: string) => (editor.api as any).hashtag.insert(tag),
    removeTag: (tag: string) => (editor.api as any).hashtag.remove(tag),
    renameTag: (oldTag: string, newTag: string) => (editor.api as any).hashtag.rename(oldTag, newTag),
  }), [editor]);

  return (
    <Plate editor={editor}>
      <div className="h-full w-full grid grid-rows-[auto_1fr]">
        <FixedToolbar><FixedToolbarButtons /></FixedToolbar>
        <EditorContextMenu editor={editor}>
          <EditorContainer className="relative overflow-auto">
            <Editor placeholder={placeholder} variant="none" className="..." />
          </EditorContainer>
        </EditorContextMenu>
      </div>
    </Plate>
  );
});
```

**结果**：~50 行核心逻辑 + 独立的自定义 Hook

---

## 性能问题分析

### 每次 onChange 都调用的函数

```typescript
const handleInputStateChange = (state: any) => {
  if (onChange) {
    const { text, tags } = extractTextContent(editor.children as Value);  // ❌ 每次都遍历
    onChange({
      text,
      tags,
      richContent: editor.children as Value,
      isEmpty: isEditorContentEmpty(editor.children as Value),  // ❌ 每次都检查
      // ...
    });
  }
};
```

**问题**：
- 每次用户输入（每个字符）都调用 `extractTextContent`
- 每次都调用 `isEditorContentEmpty`
- 这两个函数都遍历整个文档树

**优化方案**：
1. **InputStatePlugin 应该缓存计算结果**
2. **只在必要时重新计算**（如 typing-stop 时）
3. **使用 useMemo 缓存**

---

## 推荐行动

### 立即可做（低风险）

1. ✅ 删除 `editorContainerRef`（死代码）
2. ✅ 提取事件桥接到 `useEditorEventBridge` Hook
3. ✅ 添加注释说明 useMemo 为何使用空依赖

### 需要配合修改（中等风险）

4. 修改 FloatWindow 使用 `key={noteId}` prop
5. 删除异步加载 useEffect 和 hasLoadedContentRef
6. 优化 extractTextContent 调用频率

### 深度重构（高风险，需要充分测试）

7. 重构 useNoteEditorController 的数据加载逻辑
8. 将 RenderingWysiwygEditor 简化到 ~50 行
9. 性能优化：缓存 text/tags 计算结果

---

## 结论

当前 RenderingWysiwygEditor 的问题：

| 问题 | 严重性 | 是否必要 | 推荐动作 |
|------|--------|---------|---------|
| 异步加载 useEffect | 🔴 高 | ❌ 否 | 删除 |
| useMemo 空依赖 | 🟡 中 | ⚠️ 设计缺陷 | 添加注释或修复依赖 |
| 事件桥接 useEffect | 🟢 低 | ✅ 是 | 提取到 Hook |
| editorContainerRef | 🟡 中 | ❌ 否 | 删除 |
| hasLoadedContentRef | 🔴 高 | ❌ 否 | 删除 |

**核心观点**：RenderingWysiwygEditor 应该是**薄包装器**，不应该处理异步数据加载。数据加载是父组件的职责。
