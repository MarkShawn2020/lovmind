## [0.99.0](https://github.com/MarkShawn2020/lovmind/compare/v0.98.4...v0.99.0) (2025-12-18)

## 0.100.2

### Patch Changes

- 修复 DevTools 相关问题

## 0.100.1

### Patch Changes

- build: migrate from semantic-release to changesets

### Features

- **editor:** 右键菜单新增复制为图片功能 ([051054c](https://github.com/MarkShawn2020/lovmind/commit/051054c630e7606449d25758f9054144bd59b71d))
- **media:** 支持七牛云图片上传 ([3675f97](https://github.com/MarkShawn2020/lovmind/commit/3675f97b1433f60d573da9eb95a38b1bbff27dd6))

### Bug Fixes

- **ci:** disable husky in CI to allow semantic-release commits ([e2ac422](https://github.com/MarkShawn2020/lovmind/commit/e2ac4226a6e98f26853632b5e59fe18b9acacde3))
- **ci:** use correct rust-toolchain action name ([d11f86b](https://github.com/MarkShawn2020/lovmind/commit/d11f86b552dce4c3f7d576b621a2912f18311257))
- **editor:** 修复复制为图片功能在无选中块时的回退逻辑 ([ed7a2f9](https://github.com/MarkShawn2020/lovmind/commit/ed7a2f963212b1838742b9f6baeecc5080b4c967))
- **editor:** 修复移动端返回列表时笔记未保存的问题 ([46624c6](https://github.com/MarkShawn2020/lovmind/commit/46624c6d93eddbc13d13c30eb111d670462d9da8))
- **editor:** 完善表格右键菜单支持 ([b65be65](https://github.com/MarkShawn2020/lovmind/commit/b65be65544f688a53436ec1a9cc179e3ced3361b))
- **ios:** 修复 iOS 构建时 window-state 插件缺失错误 ([f242c87](https://github.com/MarkShawn2020/lovmind/commit/f242c87827e8d501f83b5890a4695dd685bd80a8))

# Changelog

面向用户的版本更新记录。

## [Unreleased]

## [0.100.3] - 2025-11-29

- 新增右键菜单复制为图片功能
- 完善表格右键菜单支持
- 修复移动端返回列表时笔记未保存的问题

## [0.99.0] - 2025-11-25

- 新增七牛云图片上传支持
- 设置面板新增云存储配置

## [0.98.4] - 2025-11-23

- 新增鼠标拖拽跨块选择功能
- 支持复制粘贴时完整保留格式(列表、缩进、对齐等)
- 新增块选择右键菜单,支持复制为 Markdown
- 窗口状态自动保存(位置、大小)
- 修复多个编辑器交互问题(快捷键失效、选区丢失、重复提交等)
- iOS 移动端全面支持(全屏编辑、键盘适配、原生样式)

## [0.95.0] - 2025-11-17

- 基础功能版本发布
