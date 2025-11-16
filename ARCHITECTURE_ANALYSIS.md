# useImperativeHandle vs Plugin-Only Architecture

## 当前架构问题

```typescript
// FloatWindow.tsx (父组件)
const editorRef = useRef<RenderingWysiwygEditorRef>(null);
editorRef.current?.resetAndFocus();  // 如何消除这个 ref？

// RenderingWysiwygEditor.tsx (子组件)
useImperativeHandle(ref, () => ({
  resetAndFocus: () => editor.tf.setValue(...),
  insertTag: (tag) => editor.api.hashtag.insert(tag),
}), [editor]);
```

## 替代方案分析

### ❌ 方案 1：直接暴露 editor

```typescript
// RenderingWysiwygEditor.tsx
useImperativeHandle(ref, () => editor, [editor]);

// FloatWindow.tsx
editorRef.current?.tf.setValue([...]);  // 直接使用 Plate API
editorRef.current?.api.hashtag.insert(tag);
```

**问题**：
- 破坏封装：暴露 Plate 内部实现
- 无语义 API：调用方需要知道 `editor.tf.setValue` 等底层细节
- 不符合 React 惯例：ref 应该提供最小化的命令式接口

---

### ❌ 方案 2：全局事件总线

```typescript
// Plugin
export const CommandsPlugin = createSlatePlugin({
  key: 'commands',
  extendEditor: ({ editor }) => {
    window.addEventListener('editor-reset', () => {
      editor.tf.setValue([...]);
      editor.tf.focus();
    });
    return editor;
  }
});

// FloatWindow.tsx
window.dispatchEvent(new CustomEvent('editor-reset'));
```

**问题**：
- 全局污染：使用 window 对象是反模式
- 无类型安全：事件无法类型检查
- 多实例冲突：如果有多个 editor，所有都会响应
- 测试困难：需要 mock 全局事件

---

### ❌ 方案 3：全局状态管理

```typescript
// store.ts
export const editorCommandAtom = atom<EditorCommand | null>(null);

// Plugin
const command = useAtomValue(editorCommandAtom);
useEffect(() => {
  if (command?.type === 'resetAndFocus') {
    editor.tf.setValue([...]);
    setCommand(null); // 清理命令
  }
}, [command]);

// FloatWindow.tsx
setCommand({ type: 'resetAndFocus' });
```

**问题**：
- 时间耦合：需要手动清理命令状态
- 竞态条件：多个 editor 可能冲突
- 过度复杂：为简单的方法调用引入状态管理
- 无返回值：命令无法返回数据

---

### ❌ 方案 4：单例注册表

```typescript
// EditorRegistry.ts
class EditorRegistry {
  private editors = new Map<string, MyEditor>();
  register(id: string, editor: MyEditor) { ... }
  getEditor(id: string) { ... }
}

// RenderingWysiwygEditor.tsx
useEffect(() => {
  editorRegistry.register(noteId, editor);
  return () => editorRegistry.unregister(noteId);
}, []);

// FloatWindow.tsx
const editor = editorRegistry.getEditor(noteId);
editor?.api.hashtag.insert(tag);
```

**问题**：
- 全局单例：反 React 组件化原则
- 生命周期复杂：何时注册/注销？
- 内存泄漏风险：忘记清理会导致内存泄漏
- 测试噩梦：全局状态导致测试互相干扰

---

### ❌ 方案 5：反转组件层级

```typescript
// FloatWindow.tsx
const FloatWindow = () => {
  const editor = usePlateEditor({ plugins: EditorKit });

  const handleReset = () => {
    editor.tf.setValue([...]);  // 现在可以直接访问了！
  };

  return (
    <Plate editor={editor}>
      <Button onClick={handleReset}>Reset</Button>
      <EditorContent />  {/* 只是渲染 UI */}
    </Plate>
  );
};
```

**问题**：
- 破坏封装：RenderingWysiwygEditor 不再是自包含组件
- 紧耦合：FloatWindow 与 Plate 内部实现绑定
- 难以复用：每个使用方都要自己设置 Plate context
- 初始化复杂：initialContent/initialRichContent 处理变得混乱

---

## ✅ 最佳方案：Plugin + useImperativeHandle 混合

### 分工明确

**Plugin 负责**：扩展 editor 能力
```typescript
// EditorCommandsPlugin.ts
export const EditorCommandsPlugin = createSlatePlugin({
  key: 'editor-commands',
  extendEditor: ({ editor }) => {
    (editor.api as any).commands = {
      resetAndFocus: () => {
        editor.tf.setValue([{ type: 'p', children: [{ text: '' }] }]);
        requestAnimationFrame(() => {
          try {
            editor.tf.select({ path: [0, 0], offset: 0 });
            editor.tf.focus();
          } catch (error) {
            console.error('Failed to set selection:', error);
            editor.tf.focus();
          }
        });
      },
    };
    return editor;
  },
});
```

**useImperativeHandle 负责**：提供外部接口（薄代理层）
```typescript
// RenderingWysiwygEditor.tsx
useImperativeHandle(ref, () => ({
  resetAndFocus: () => (editor.api as any).commands.resetAndFocus(),
  focus: () => editor.tf.focus(),
  insertTag: (tag) => (editor.api as any).hashtag.insert(tag),
  removeTag: (tag) => (editor.api as any).hashtag.remove(tag),
  renameTag: (oldTag, newTag) => (editor.api as any).hashtag.rename(oldTag, newTag),
}), [editor]);
```

### 优势

1. **逻辑在插件**：
   - 可测试：独立测试插件逻辑
   - 可复用：其他 Plate 项目可以复用插件
   - 单一职责：插件只负责 editor 能力扩展

2. **接口在组件**：
   - 类型安全：TypeScript 接口提供编译时保证
   - 封装良好：外部不知道内部实现细节
   - React 惯例：符合 React 的 ref 模式
   - IDE 友好：自动补全和重构

3. **职责分离**：
   - Plugin：定义 editor **能做什么**（capabilities）
   - useImperativeHandle：定义外部**如何调用**（interface）

---

## 为什么必须保留 useImperativeHandle？

### React Context 的边界限制

```
FloatWindow (父组件)
  ├─ 无法使用 useEditorRef() ← Plate context 未提供
  └─ RenderingWysiwygEditor (子组件)
      └─ <Plate editor={editor}> ← Context 提供者
          └─ Plugins ← 可以访问 editor
```

**父组件在 Plate context 外部**，这是架构上的必然：
- FloatWindow **渲染** RenderingWysiwygEditor
- 父组件不能在子组件的 context 内部

### useImperativeHandle 是 React 官方方案

这是 **React 团队推荐** 的父子组件命令式通信模式：
- `react-hook-form` 使用它
- `react-select` 使用它
- 所有需要命令式 API 的库都用它

### 类型安全的保证

```typescript
export interface RenderingWysiwygEditorRef {
  resetAndFocus: () => void;
  focus: () => void;
  insertTag: (tag: string) => void;
  removeTag: (tag: string) => void;
  renameTag: (oldTag: string, newTag: string) => void;
}
```

这个接口是**契约**：
- 编译时检查
- IDE 自动补全
- 重构安全

---

## 结论

**不能完全用插件替代 useImperativeHandle**，因为：

1. **架构边界**：父组件在 Plate context 外部，无法直接访问 editor
2. **React 惯例**：useImperativeHandle 是 React 官方的父子命令式通信方案
3. **职责分离**：Plugin（能力）≠ Component Interface（接口）

**最佳实践**：
- ✅ 逻辑移到插件（可测试、可复用）
- ✅ useImperativeHandle 作为薄代理层（类型安全、封装良好）
- ✅ 保持关注点分离

这不是"必须妥协"，而是**正确的架构选择**。
