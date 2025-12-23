# Draft Sync 测试文档

## 核心概念

- **Draft（草稿）**: 用户正在编辑但尚未提交的笔记内容
- **Main Window Create Mode**: 主窗口未选择任何笔记时的状态（`viewingNoteId === null`）
- **Float Window New Note**: 通过 Cmd+N 打开的浮动窗口，noteId 存在但笔记尚未保存到后端

## 预期行为

### 1. 单向同步：Main → Float

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 主窗口处于创建模式 | 编辑器为空 |
| 2 | 在主窗口输入 "Hello" | 内容显示 "Hello" |
| 3 | 按 Cmd+N 打开浮动窗口 | 浮动窗口应显示 "Hello" |

### 2. 单向同步：Float → Main

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 主窗口处于创建模式，编辑器为空 | - |
| 2 | 按 Cmd+N 打开浮动窗口 | 浮动窗口为空 |
| 3 | 在浮动窗口输入 "World" | 浮动窗口显示 "World" |
| 4 | 查看主窗口 | 主窗口应显示 "World" |

### 3. 双向实时同步

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 主窗口创建模式，浮动窗口新笔记 | 两者都为空 |
| 2 | 在主窗口输入 "A" | 主窗口: "A", 浮动窗口: "A" |
| 3 | 在浮动窗口追加 "B" | 主窗口: "AB", 浮动窗口: "AB" |
| 4 | 在主窗口追加 "C" | 主窗口: "ABC", 浮动窗口: "ABC" |

### 4. Draft 恢复

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 主窗口输入 "Draft content" | 内容自动保存到 draft |
| 2 | 点击侧边栏某个已有笔记 | 编辑器显示该笔记内容 |
| 3 | 点击 "+" 按钮返回创建模式 | 应恢复显示 "Draft content" |

### 5. Draft 消费（Float 窗口打开时）

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 主窗口输入 "Draft content" | 内容保存 |
| 2 | 按 Cmd+N 打开浮动窗口 | 浮动窗口显示 "Draft content" |
| 3 | 查看主窗口 | 主窗口应清空（draft 已被消费） |

**注意**: 测试 5 与测试 3 冲突！需要明确：
- 方案 A: Float 消费 draft，主窗口清空，之后不再同步
- 方案 B: 实时同步，两边始终保持一致

---

## 当前实现分析

### 相关文件

1. `useDraftPersistence.ts` - 自动保存 draft 并广播 `draft-updated` 事件
2. `useDraftSync.ts` - 监听 `draft-updated` 事件并同步到编辑器
3. `useMainWindowLogic.ts` - 监听 `draft-consumed` 事件
4. `float-window.tsx` - 启动时恢复 draft 并发送 `draft-consumed`
5. `lovmind-editor.tsx` - 处理同步更新

### 当前问题

#### 问题 1: 两种机制冲突
- `draft-consumed` 机制：Float 消费 draft 后清空主窗口
- `draft-updated` 机制：实时同步两边内容

这两种机制互相冲突！

#### 问题 2: 同步条件不一致
`useDraftSync` 中的条件：
```typescript
const isMainWindowCreateMode = noteId === null && editorContent.sourceNoteId === null;
const isFloatWindowNewNote = noteId !== null && !notes.some(n => n.id === noteId);
```

但 `draft-consumed` 后主窗口被清空，`editorContent.sourceNoteId` 变为 `null`，
此时如果 Float 窗口继续编辑并 emit，主窗口会收到更新。

#### 问题 3: Float 窗口 noteId 可能已存在
当 Float 窗口的笔记被提交后，`notes.some(n => n.id === noteId)` 变为 true，
此时该窗口不再参与 draft 同步。

---

## 建议方案

### 方案：纯实时同步（移除 draft-consumed 机制）

1. **移除** `draft-consumed` 事件和相关逻辑
2. **保留** `draft-updated` 实时同步
3. **任一窗口提交后**，清除 draft 并通知其他窗口清空

### 同步规则

| 主窗口状态 | 浮动窗口状态 | 是否同步 |
|-----------|-------------|---------|
| 创建模式 (viewingNoteId=null) | 新笔记 (未保存) | ✅ 同步 |
| 创建模式 | 已有笔记 | ❌ 不同步 |
| 查看笔记 | 新笔记 | ❌ 不同步 |
| 查看笔记 | 已有笔记 | ❌ 不同步 |

---

## 已修复

### 2024-12-23: 移除 draft-consumed 机制

**问题**: `draft-consumed` 和 `draft-updated` 两种机制冲突

**修复**:
1. 移除 `float-window.tsx` 中的 `emit('draft-consumed')` 和 `setStoreValue('lovpen-draft', null)`
2. 移除 `useMainWindowLogic.ts` 中的 `draft-consumed` 监听器
3. Float 窗口启动时恢复 draft，之后通过 `useDraftSync` 保持同步

**当前实现**:
- `useDraftPersistence`: 本地编辑 → 保存 + emit `draft-updated`
- `useDraftSync`: 收到 `draft-updated` → 更新 editorContentAtom
- `LovmindEditor`: 检测 `_syncedAt` 变化 → `editor.tf.setValue()`
- `emittedSavedAtSet`: 过滤自己发出的事件，防止回退

### 2024-12-23: 修复主窗口切换后恢复 draft

**问题**: 主窗口切换到已有笔记后，不再接收 `draft-updated` 事件。
当切回新建模式时，`draftContentAtom` 是旧数据。

**修复**: `handleBackToCreate` 直接从 Tauri Store 读取最新 draft，
而不是使用本地 atom 的可能过期数据。

### 2024-12-23: 修复 useNoteLoader 覆盖 draft

**问题**: `handleBackToCreate` 设置 draft 后，组件重新渲染，
`useNoteLoader(null)` 执行并清空了编辑器内容。

**修复**: 当 `noteId === null` 时，`useNoteLoader` 不再重置 `editorContent`，
只清除 `currentNoteId`。让调用方（如 `handleBackToCreate`）控制内容。

---

## 测试清单

### 基础同步
- [ ] Main → Float 单向同步
- [ ] Float → Main 单向同步
- [ ] 双向实时同步
- [ ] 快速输入不丢字符
- [ ] 输入后不回退

### 窗口切换场景
- [ ] 主窗口切换到已有笔记 → 浮动窗口继续编辑 → 主窗口点击新建 → 应恢复浮动窗口的内容
- [ ] 主窗口新建模式 → 浮动窗口提交笔记 → 主窗口应清空
- [ ] 浮动窗口新建 → 主窗口切换到已有笔记 → 浮动窗口继续编辑 → 不应同步到主窗口

### 生命周期
- [ ] 提交后两边都清空
- [ ] 关闭 Float 窗口后主窗口保留内容
- [ ] 多个 Float 窗口同时同步
