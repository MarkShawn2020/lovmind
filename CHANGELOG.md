# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- feat(editor): 块选择复制粘贴支持完整格式保留(列表、缩进、对齐等)
- feat(editor): 支持鼠标拖拽进行跨块选择
- feat(editor): 块选择右键菜单支持复制为Markdown及优化交互
- feat(editor): implement block selection clipboard integration
- feat(devtools): dev 模式自动打开 DevTools
- feat(window): 集成 tauri-plugin-window-state 实现窗口状态持久化

### Changed
- feat(editor): 优化 Cmd+A 全选后粘贴位置,自动定位到文档末尾

### Fixed
- fix(editor): 修复 EditorContextMenu 容器高度溢出导致 toolbar 被顶出视口的问题
- fix(ui): 修复编辑器组件宽度溢出问题,添加 min-w-0 约束防止内容超出父容器
- fix(editor): 修复跨block文本选择后右键菜单选区丢失及功能失效问题
- fix(editor): 修复 block 内 Cmd+Enter 提交快捷键失效问题
- fix(editor): 修复标签新增后UI未更新的问题
- fix(editor): 修复 caption 组件中文输入法候选问题
- fix(editor): 移除 TauriClipboardPlugin 自定义粘贴处理以修复粘贴问题
- fix(editor): 修复鼠标拖选文本失效问题
- fix(viewport): 通过平台检测动态注入 interactive-widget 属性
- fix(editor): 修复 Cmd+Enter 快捷键双重触发问题
- fix(user-menu): 修复头像弹窗失去焦点后不自动关闭的问题
- fix: improve keyboard shortcuts event filtering and add deduplication
- fix: prevent double submission caused by event listener leak
- fix: resolve double submission bug on Cmd+Enter
- fix: stabilize useEditorEventBridge callbacks with useRef
- fix: move global handler outside extendEditor for stable reference
- fix: use singleton pattern for keyboard shortcuts to prevent StrictMode conflicts
- fix: cleanup keyboard shortcuts listener to prevent duplicate notes
- fix: restore avatar click handler in desktop main window
- fix: update post-commit hook to include Cargo files in version bump
- fix: sync Cargo.toml version and update bump-version script

### Performance
- perf(logging): 优化日志输出并修复重复初始化问题

## [0.98.2] - 2025-11-19

### Fixed
- fix(ios): use method swizzling to remove keyboard accessory view

## [0.98.0] - 2025-11-18

### Added
- feat(ios): remove keyboard input accessory view
- feat: iOS sheet editor with keyboard integration
- feat: mobile-first responsive layout with master-detail pattern
- feat: iOS full-screen bottom layout with toolbar safe area padding
- feat: increase iOS header vertical padding for better spacing
- feat: iOS native styling - remove rounded corners and match status bar theme
- feat: iOS keyboard-aware layout using visualViewport API
- feat: iOS keyboard-aware toolbar with Liquid Glass design

### Fixed
- fix: center empty state guide in notes sidebar
- fix: iOS status bar color and full-screen layout
- fix: remove bottom safe area padding when iOS keyboard visible
- fix: iOS toolbar visibility by respecting safe area padding
- fix: correct flex layout to prevent toolbar from being scrolled off
- fix: use 100dvh instead of 100vh for iOS toolbar visibility
- fix: iOS toolbar visibility with safe area and keyboard handling
- fix: iOS toolbar overflow with safe area handling

## [0.90.0] - 2025-11-18

### Added
- 初始版本发布
