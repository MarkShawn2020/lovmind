# Lovmind - 笔记新建与编辑 Spec

## 1. 数据模型

### Note

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | Y | UUID，创建窗口时生成 |
| text | string | Y | richContent 提取的纯文本（Markdown 格式） |
| title | string | Y | 自动提取或手动编辑 |
| time | string | Y | 显示用时间戳 |
| tags | string[] | Y | 从内容中提取的 #hashtag 集合 |
| richContent | any | N | Plate.js Value（JSON 树），富文本内容 |
| favorite | boolean | N | 收藏 |
| pinned | boolean | N | 置顶 |
| archived | boolean | N | 归档 |
| rank | number | N | 显示排序，数值越大越靠前 |
| manualTitle | boolean | N | 为 true 时不自动重新生成标题 |
| isDraft | boolean | N | 草稿状态（未提交） |
| submittedAt | string | N | 首次提交时间（ISO） |
| createdAt | string | N | 创建时间（ISO） |
| updatedAt | string | N | 最后更新时间（ISO） |

### DraftContent

| 字段 | 类型 | 说明 |
|------|------|------|
| text | string | 草稿纯文本 |
| tags | string[] | 草稿标签 |
| richContent | any | 草稿富文本 |
| savedAt | string | 保存时间（用于去重） |

---

## 2. 新建笔记

### 2.1 触发方式

- **全局快捷键** `Cmd+N`：创建新 float 窗口
- **主窗口输入**：在主窗口编辑器直接输入内容

### 2.2 流程：全局快捷键新建

```
用户按 Cmd+N
  → Rust toggle_float_windows()
    → 生成 UUID 作为 noteId
    → 计算 rank = max(所有笔记 rank) + 1
    → 创建 WebviewWindow，URL: ?window=editor&noteId={id}&rank={rank}
  → Float 窗口初始化 (float-window.tsx)
    → 从 URL 解析 noteId, rank
    → 调用 get_temp_note(noteId) 检查后端
    → 不存在 → 尝试从 Tauri Store 恢复草稿
      → 有草稿 → 恢复到 editorContentAtom
      → 无草稿 → 空白编辑器
  → 用户输入内容
    → Plate.js 触发 input-state-changed
    → useEditorSync 提取 text/tags/richContent → 写入 editorContentAtom
    → useDraftPersistence 检测到新笔记 → 150ms 防抖后保存草稿
      → 写入 draftContentAtom + Tauri Store
      → emit('draft-updated') 通知其他窗口
  → 用户提交（Cmd+Enter 或点击提交按钮）
    → useNoteSubmit.handleSubmit()
    → 笔记不存在于 notes 数组 → 走"创建新笔记"分支
    → 构建 Note 对象（rank, timestamps, 提取 title）
    → 更新 notesAtom（prepend）
    → invoke('store_temp_note') 持久化
    → invoke('broadcast_note_update') 广播
    → 清空草稿
    → 触发 confetti 动画
    → 根据模式：关闭窗口 或 重置编辑器
```

### 2.3 流程：主窗口新建

```
主窗口编辑器聚焦 → 用户输入
  → editorContentAtom 更新（sourceNoteId = null 表示创建模式）
  → useDraftPersistence 持续自动保存草稿
  → 用户按 Cmd+Enter
    → handleSubmit()
    → 当前 noteId 存在但笔记不在 notes 中 → 创建新笔记
    → shouldReset = true（主窗口固定模式）
      → 先生成新 noteId（temp-{timestamp}）
      → 再保存旧笔记
      → 重置编辑器并聚焦
```

### 2.4 标题自动提取规则

1. richContent 中第一个 `h1` 节点的文本
2. Markdown 文本中第一个 `# 标题` 行
3. 纯文本第一句话
4. 兜底：`'Untitled Note'`

若 `manualTitle = true`，跳过自动提取，保留用户手动设置的标题。

### 2.5 标签提取规则

- 遍历 richContent 树，收集 `type === 'hashtag'` 节点的 `value`
- 输出为不重复的 string 数组
- 标签同时出现在 `text` 中，格式为 `#tagname`

---

## 3. 编辑笔记

### 3.1 触发方式

- **主窗口列表**：点击笔记卡片 → 打开 float 窗口
- **已有 float 窗口**：窗口已存在 → setFocus()

### 3.2 流程：打开已有笔记

```
用户点击笔记卡片
  → useWindowOperations.openNoteInNewWindow(note)
    → 检查 label 为 note-editor-{id} 的窗口是否存在
      → 存在 → setFocus() 并返回
      → 不存在 → 继续
    → invoke('store_temp_note', note) 预存到后端
    → new WebviewWindow(label, { url: ?window=editor&noteId={id}, ... })
  → Float 窗口初始化
    → useNoteLoader(noteId) 加载笔记
      → 优先级 1: checkAndRestorePendingSave(noteId) 检查 beforeunload 遗留
      → 优先级 2: invoke('get_temp_note', { id }) 从后端加载
      → 优先级 3: notesAtom 中查找（兜底）
    → 写入 editorContentAtom（_loadVersion + 1 触发编辑器刷新）
  → 编辑器加载内容
    → useEffect 检测 _loadVersion 变化
    → 通过 withSuppression 设置值（避免触发 sync 循环）
```

### 3.3 流程：编辑并保存

```
用户修改内容
  → Plate.js input-state-changed
  → useEditorSync 提取 text/tags/richContent → editorContentAtom
  → （已有笔记不触发 useDraftPersistence — 仅新笔记/草稿触发）
  → 用户按 Cmd+Enter
    → handleSubmit()
    → 笔记存在于 notes 数组 → 走"更新已有笔记"分支
    → 构建更新后的 Note：
      → text, tags, richContent 取最新
      → title: manualTitle ? 保留旧标题 : 重新提取
      → time: 更新为当前时间
      → isDraft: false
      → submittedAt: 若之前是草稿则设为当前时间，否则保留原值
      → updatedAt: 当前时间
    → updateNote(updatedNote) 更新 notesAtom
    → invoke('store_temp_note') 持久化
    → invoke('broadcast_note_update') 广播
    → 清空草稿
    → 根据模式：关闭窗口 或 重置编辑器
```

### 3.4 跨窗口同步

| 事件名 | 方向 | 用途 |
|--------|------|------|
| `global-note-updated` | Rust → 所有窗口 | 笔记更新后同步到所有窗口 |
| `draft-updated` | 窗口 → 窗口 | 草稿实时同步（新建模式） |
| `draft-submitted` | 窗口 → 窗口 | 通知草稿已提交，触发窗口关闭 |

**草稿同步去重**：通过 `emittedSavedAtSet` 跳过自己发出的事件，5秒后自动清理。

---

## 4. 持久化

### 4.1 前端

| 存储 | Key | 用途 |
|------|-----|------|
| Tauri Store | `lovpen-notes` | 所有笔记数组 |
| Tauri Store | `lovpen-draft` | 当前草稿 |
| localStorage | `lovpen-pending-save-{id}` | beforeunload 紧急保存 |

### 4.2 后端（Rust）

| 位置 | 格式 | 用途 |
|------|------|------|
| `$APPDATA/notes/note-{id}.json` | JSON | 单个笔记文件 |
| `$APPDATA/notes/index.json` | JSON | 笔记索引 |

写入方式：原子写入（tmp 文件 → rename）。

---

## 5. 边界情况

| 场景 | 行为 |
|------|------|
| 编辑中窗口关闭 | beforeunload 将内容存入 localStorage pending-save |
| 重新打开同一笔记 | checkAndRestorePendingSave 恢复并同步到后端 |
| 后端笔记不存在但前端有 | 从 notesAtom 加载并同步到后端 |
| 并发编辑同一笔记 | 最后提交者的内容胜出，broadcast 同步 |
| 空内容提交 | 被拦截，不创建/更新笔记 |
| 网络/IO 错误 | console.error 记录，不阻塞 UI |

---

## 6. 单元测试（自然语言描述）

### 6.1 笔记创建

#### T-CREATE-01: 基本创建

> **当** 用户在空白编辑器中输入 "Hello World" 并按 Cmd+Enter
> **且** 当前 noteId 对应的笔记不存在于 notes 数组中
> **则** 应创建一个新 Note 对象，其中：
> - `text` 等于 "Hello World"
> - `title` 等于 "Hello World"（取首行）
> - `isDraft` 为 false
> - `submittedAt` 和 `createdAt` 均为当前时间
> - `rank` 等于现有最大 rank + 1
> **且** 新笔记被 prepend 到 notesAtom 数组头部

#### T-CREATE-02: 带标签创建

> **当** 用户输入 "学习笔记 #react #typescript" 并提交
> **则** 新笔记的 `tags` 数组包含 `["react", "typescript"]`
> **且** `text` 中包含 `#react` 和 `#typescript`

#### T-CREATE-03: 空内容不创建

> **当** 编辑器内容为空（仅空白字符或空段落）
> **且** 用户按 Cmd+Enter
> **则** handleSubmit 直接返回，不创建笔记
> **且** notesAtom 不发生变化

#### T-CREATE-04: 标题自动提取 — H1 优先

> **当** richContent 包含一个 h1 节点文本为 "我的标题"，后跟正文
> **则** 新笔记的 `title` 等于 "我的标题"

#### T-CREATE-05: 标题自动提取 — 无 H1 取首行

> **当** richContent 仅包含普通段落，首段文本为 "这是一段很长的内容……"
> **则** `title` 取首段文本（可能截断）

#### T-CREATE-06: 标题自动提取 — 兜底

> **当** richContent 为空或仅含图片/空段落
> **则** `title` 等于 "Untitled Note"

#### T-CREATE-07: rank 计算

> **给定** 现有笔记 rank 分别为 [3, 1, 5]
> **当** 创建新笔记
> **则** 新笔记 `rank` 为 6（max(5) + 1）

#### T-CREATE-08: rank 计算 — 无现有笔记

> **给定** notes 数组为空
> **当** 创建新笔记
> **则** 新笔记 `rank` 为 1

#### T-CREATE-09: 创建后重置编辑器（固定模式）

> **当** shouldReset 为 true（主窗口固定模式）
> **且** 用户提交笔记
> **则** 提交后 editorContentAtom 重置为空状态
> **且** 调用 editorRef.resetAndFocus()
> **且** 生成新的 noteId（temp-{timestamp} 格式）

#### T-CREATE-10: 创建后关闭窗口（Float 模式）

> **当** shouldReset 为 false（float 窗口模式）
> **且** 用户提交笔记
> **则** 调用 onCloseWindow()

#### T-CREATE-11: 创建后触发 confetti

> **当** 新笔记创建成功
> **则** 调用 confetti()（庆祝动画）

#### T-CREATE-12: 创建后广播

> **当** 笔记创建成功（Tauri 环境）
> **则** 依次调用：
> - `invoke('store_temp_note', { note })`
> - `invoke('broadcast_note_update', { note })`
> - `setStoreValue('lovpen-draft', null)`
> - `emit('draft-submitted', { noteId })`

---

### 6.2 笔记编辑

#### T-EDIT-01: 基本编辑保存

> **给定** notes 中存在 id="abc" 的笔记，text="旧内容"
> **当** 用户将内容改为 "新内容" 并按 Cmd+Enter
> **则** 该笔记的 `text` 更新为 "新内容"
> **且** `updatedAt` 更新为当前时间
> **且** `time` 更新为当前可读时间

#### T-EDIT-02: manualTitle 保护

> **给定** 笔记 manualTitle=true, title="我的自定义标题"
> **当** 用户修改内容（首行变了）并提交
> **则** `title` 保持 "我的自定义标题" 不变

#### T-EDIT-03: 非 manualTitle 自动更新标题

> **给定** 笔记 manualTitle=false, title="旧标题"
> **当** 用户修改首行内容为 "新标题" 并提交
> **则** `title` 更新为 "新标题"

#### T-EDIT-04: 草稿转正式

> **给定** 笔记 isDraft=true, submittedAt=null
> **当** 用户编辑后提交
> **则** `isDraft` 变为 false
> **且** `submittedAt` 设为当前时间

#### T-EDIT-05: 正式笔记保留 submittedAt

> **给定** 笔记 isDraft=false, submittedAt="2026-01-01T00:00:00Z"
> **当** 用户编辑后提交
> **则** `submittedAt` 保持 "2026-01-01T00:00:00Z" 不变

#### T-EDIT-06: 标签更新

> **给定** 笔记 tags=["old"]
> **当** 用户将内容改为 "新内容 #new" 并提交
> **则** `tags` 更新为 `["new"]`（基于当前内容重新提取）

#### T-EDIT-07: 编辑后广播

> **当** 笔记编辑保存成功（Tauri 环境）
> **则** 调用 `invoke('broadcast_note_update', { note: updatedNote })`

---

### 6.3 编辑器内容同步

#### T-SYNC-01: 用户输入同步到 atom

> **当** 用户在 Plate.js 编辑器中输入文字
> **则** useEditorSync 触发，editorContentAtom 更新为最新 text/tags/richContent
> **且** `_loadVersion` 不变（区分用户输入 vs 外部加载）

#### T-SYNC-02: 外部加载内容到编辑器

> **当** editorContentAtom._loadVersion 增加
> **且** sourceNoteId 与当前 noteId 匹配
> **则** 编辑器通过 withSuppression 设置新值
> **且** 不触发 input-state-changed 回调

#### T-SYNC-03: 版本号未变不重新加载

> **当** editorContentAtom._loadVersion 未变
> **则** 编辑器不更新内容（即使 richContent 引用变了）

#### T-SYNC-04: sourceNoteId 不匹配不加载

> **当** editorContentAtom.sourceNoteId 与当前窗口 noteId 不同
> **则** 编辑器不加载该内容（属于其他窗口的数据）

---

### 6.4 草稿持久化

#### T-DRAFT-01: 新笔记自动保存草稿

> **当** 用户在新建模式（笔记不存在于 notes 数组）输入内容
> **则** 150ms 后 draftContentAtom 更新
> **且** Tauri Store 中 `lovpen-draft` 被设置
> **且** emit('draft-updated') 被调用

#### T-DRAFT-02: 已有笔记不触发草稿保存

> **当** 用户编辑已存在于 notes 数组中的笔记
> **则** useDraftPersistence 不执行保存操作

#### T-DRAFT-03: 提交后清空草稿

> **当** 笔记提交成功
> **则** `setStoreValue('lovpen-draft', null)` 被调用
> **且** `emit('draft-submitted')` 被调用

#### T-DRAFT-04: 草稿跨窗口同步

> **给定** 窗口 A 和窗口 B 都处于新建模式
> **当** 窗口 A 输入内容触发 draft-updated
> **则** 窗口 B 的 useDraftSync 收到事件
> **且** 窗口 B 的 editorContentAtom 更新为窗口 A 的草稿内容
> **且** _loadVersion 增加（触发编辑器刷新）

#### T-DRAFT-05: 草稿自发事件过滤

> **当** 窗口 A emit draft-updated（savedAt = "T1"）
> **且** emittedSavedAtSet 中包含 "T1"
> **则** 窗口 A 自己的 useDraftSync 忽略该事件

---

### 6.5 笔记加载

#### T-LOAD-01: 从后端加载

> **当** float 窗口打开 noteId="abc"
> **且** invoke('get_temp_note', {id: "abc"}) 返回笔记数据
> **则** editorContentAtom 设置为该笔记的 text/tags/richContent
> **且** _loadVersion 增加
> **且** currentNoteIdAtom 设为 "abc"

#### T-LOAD-02: 后端无数据 → 从 atom 兜底

> **当** get_temp_note 返回 null
> **且** notesAtom 中存在 id="abc" 的笔记
> **则** 从 notesAtom 加载
> **且** 调用 store_temp_note 同步到后端

#### T-LOAD-03: pending save 恢复

> **给定** localStorage 中存在 `lovpen-pending-save-abc` 数据
> **当** float 窗口打开 noteId="abc"
> **则** 优先使用 pending save 的数据
> **且** localStorage 中该 key 被清除
> **且** 数据同步到后端

#### T-LOAD-04: 全新笔记 + 有草稿

> **当** float 窗口打开新 noteId（后端无数据，atom 无数据）
> **且** Tauri Store 中有草稿
> **则** 将草稿内容恢复到编辑器

#### T-LOAD-05: 全新笔记 + 无草稿

> **当** float 窗口打开新 noteId 且无任何已有数据
> **则** 编辑器显示空白状态（默认占位符）

---

### 6.6 窗口生命周期

#### T-WIN-01: 打开笔记 — 新建窗口

> **当** 用户点击笔记卡片（id="abc"）
> **且** 不存在 label 为 "note-editor-abc" 的窗口
> **则** 调用 store_temp_note 预存笔记
> **且** 创建新 WebviewWindow，URL 包含 noteId=abc

#### T-WIN-02: 打开笔记 — 已有窗口

> **当** 用户点击笔记卡片（id="abc"）
> **且** 存在 label 为 "note-editor-abc" 的窗口
> **则** 调用该窗口的 setFocus()
> **且** 不创建新窗口

#### T-WIN-03: 提交后关闭窗口

> **当** float 窗口收到 draft-submitted 事件
> **且** 窗口非置顶模式
> **则** 调用 currentWindow.close()

#### T-WIN-04: 提交后置顶窗口不关闭

> **当** float 窗口收到 draft-submitted 事件
> **且** 窗口为置顶模式（isAlwaysOnTop = true）
> **则** 不关闭窗口
> **且** 调用 editorRef.resetAndFocus() 重置编辑器

---

### 6.7 Rust 后端

#### T-RUST-01: store_temp_note 持久化

> **当** 调用 store_temp_note(note)
> **则** 在 `$APPDATA/notes/` 目录下创建 `note-{id}.json`
> **且** 更新 `index.json`
> **且** 使用原子写入（tmp → rename）

#### T-RUST-02: get_temp_note 读取

> **给定** `note-abc.json` 存在
> **当** 调用 get_temp_note("abc")
> **则** 返回对应的 TempNote 结构

#### T-RUST-03: get_temp_note 不存在

> **给定** `note-xyz.json` 不存在
> **当** 调用 get_temp_note("xyz")
> **则** 返回 None

#### T-RUST-04: broadcast_note_update 事件

> **当** 调用 broadcast_note_update(note)
> **则** app.emit("global-note-updated", note) 被调用
> **且** tray icon 标题更新

#### T-RUST-05: toggle_float_windows 创建窗口

> **当** 调用 toggle_float_windows
> **则** 生成新 UUID 作为 noteId
> **且** rank = max(所有笔记 rank) + 1
> **且** 创建 WebviewWindow，URL 包含 noteId 和 rank

#### T-RUST-06: remove_temp_note 删除

> **给定** `note-abc.json` 存在
> **当** 调用 remove_temp_note("abc")
> **则** 文件被删除
> **且** index.json 中移除该条目

---

### 6.8 内容提取工具函数

#### T-EXTRACT-01: extractTextContent 基本文本

> **给定** richContent = `[{ type: 'p', children: [{ text: 'Hello' }] }]`
> **则** 返回 `{ text: "Hello", tags: [] }`

#### T-EXTRACT-02: extractTextContent 含标签

> **给定** richContent 包含 hashtag 节点 `{ type: 'hashtag', value: 'react' }`
> **则** text 中包含 "#react"
> **且** tags 包含 "react"

#### T-EXTRACT-03: extractTextContent 富文本格式

> **给定** richContent 包含 bold 文本 `{ text: 'important', bold: true }`
> **则** text 中包含 `**important**`

#### T-EXTRACT-04: isEditorContentEmpty 空段落

> **给定** richContent = `[{ type: 'p', children: [{ text: '' }] }]`
> **则** 返回 true

#### T-EXTRACT-05: isEditorContentEmpty 有内容

> **给定** richContent = `[{ type: 'p', children: [{ text: 'a' }] }]`
> **则** 返回 false

#### T-EXTRACT-06: extractNoteTitle H1 优先

> **给定** richContent 第一个节点是 h1 "Title"，后跟 p "Body"
> **则** 返回 "Title"

#### T-EXTRACT-07: extractNoteTitle 无 H1 取首行

> **给定** richContent 仅有 p 节点，首段 "First line"
> **则** 返回 "First line"

#### T-EXTRACT-08: extractNoteTitle 全空

> **给定** richContent 为空或仅含空段落
> **则** 返回 "Untitled Note"
