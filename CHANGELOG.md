# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- feat(editor): 块选择复制粘贴支持完整格式保留(列表、缩进、对齐等)
- feat(editor): 支持鼠标拖拽进行跨块选择

### Changed
- feat(editor): 优化 Cmd+A 全选后粘贴位置,自动定位到文档末尾

### Fixed
- fix(editor): 修复跨block文本选择后右键菜单选区丢失及功能失效问题
- fix(ui): 修复编辑器组件宽度溢出问题,添加 min-w-0 约束防止内容超出父容器
- fix(editor): 修复 EditorContextMenu 容器高度溢出导致 toolbar 被顶出视口的问题

## [0.1.0] - 2025-11-23
### Added
- 初始版本发布
