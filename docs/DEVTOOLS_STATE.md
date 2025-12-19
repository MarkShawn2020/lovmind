# DevTools 自动打开状态记忆（Main Window）

## 背景

开发模式（`debug_assertions`）下，主窗口（label: `main`）此前会在启动时固定打印：

- `[DevTools] Auto-opening DevTools for main window`

导致每次启动都会自动打开 DevTools，无法记忆上次你是否手动关闭过 DevTools。

## 目标

在 **debug 模式** 下：

- 如果你上次关闭了主窗口 DevTools，下次启动不再自动打开
- 如果你上次打开了主窗口 DevTools，下次启动继续自动打开

## 实现方式

### 1) 启动时按上次状态决定是否自动打开

启动时读取 `tauri-plugin-store` 的 `settings.json`：

- key：`devtools_open_main`（`boolean`）
- 默认值：`true`（首次没有该 key 时，保持原有“默认自动打开”行为）

当 `devtools_open_main` 为：

- `true`：打印并执行自动打开
- `false`：打印并跳过自动打开

### 2) 运行中监听 DevTools 开/关变化并持久化

由于 DevTools 的关闭动作不会触发我们现有的窗口事件回调（且仅靠退出时保存容易丢失状态），因此增加了一个轻量的轮询监听：

- 每 `750ms` 检查一次 `main_window.is_devtools_open()`
- 状态发生变化时立即写入 `devtools_open_main` 并 `save()`

同时在以下场景也会尝试保存一次（兜底）：

- 主窗口收到 `CloseRequested`（隐藏窗口前）
- 触发 `quit_app` 命令
- `RunEvent::ExitRequested`

### 3) macOS：避免 DevTools 挤压窗口宽度

在 macOS 上，DevTools 以“停靠到右侧”的形式打开时，会挤压 WebView 的可视宽度，导致主窗口 UI 变窄。

为保持主窗口布局稳定：

- 当检测到 DevTools **打开**时，自动把主窗口宽度增加一个固定值（当前为 `600px`）
- 当检测到 DevTools **关闭**时，自动把窗口宽度收回到“基础宽度”

另外，为避免重启后重复放大导致越变越宽，会在 `settings.json` 中记录主窗口 DevTools 关闭时的“基础宽度”：

- key：`devtools_base_width_main`（`number`）

并在 macOS 下，当主窗口 DevTools 关闭时发生 `Resized` 事件，会同步更新该基础宽度（以匹配你手动调整后的窗口宽度）。

## 数据存储位置

使用 `tauri-plugin-store` 的 `BaseDirectory::AppData`，文件名为 `settings.json`。

以本项目 identifier `app.lovpen.minds` 为例，macOS 通常在：

- `~/Library/Application Support/app.lovpen.minds/settings.json`

其他平台的目录会不同，但都是 AppData 下的 `settings.json`。

## 日志与验证

当你手动关闭 DevTools 后，约 1 秒内应看到类似日志：

- `[DevTools] Persisted main window DevTools state (watch): false`

再次启动时应看到：

- `[DevTools] Skipping DevTools auto-open for main window`

如果 `settings.json` 里看到：

```json
{
  "devtools_open_main": false,
  "devtools_base_width_main": 420
}
```

说明状态已成功写入。

## 限制/说明

- 该行为仅在 **debug 模式** 生效（`#[cfg(debug_assertions)]`）。
- iOS 不启用该逻辑（桌面端 DevTools 行为不同）。

## 故障排查

1. 确认你运行的是最新构建（包含本改动）。
2. 观察是否出现 `[DevTools] Persisted...` 相关日志；如果没有，检查 DevTools 是否真的处于打开/关闭状态（`is_devtools_open()` 是否可用）。
3. 检查 `settings.json` 是否有写入 `devtools_open_main`：
   - 没有：可能是 store 路径、权限或未触发保存
   - 有但仍自动打开：确认启动时读取到的是同一份 store（同一个 identifier 目录）
4. 需要重置时可删除 `settings.json` 或移除 `devtools_open_main` key。
