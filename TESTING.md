# Testing Guide

本项目使用 Vitest + React Testing Library 进行组件测试。

## 运行测试

```bash
# 交互式观察模式（推荐开发时使用）
pnpm test

# 带UI界面的测试运行器
pnpm test:ui

# 单次运行所有测试
pnpm test:run

# 生成测试覆盖率报告
pnpm test:coverage
```

## 测试文件位置

- 测试文件位于 `src/components/__tests__/` 目录
- 测试配置文件: `vitest.config.ts`
- 测试环境设置: `src/tests/setup.ts`

## RenderingWysiwygEditor 测试示例

### 基础渲染测试

验证组件能够正常渲染并显示 placeholder 和初始内容。

### 内容变更测试

测试 `onChange` 回调是否被正确触发，并验证返回值：
- `text`: 纯文本内容（包含 Markdown 格式）
- `tags`: 提取的标签数组
- `richContent`: 完整的富文本结构
- `isEmpty`: 内容是否为空

### 图片粘贴场景测试

**测试要点**：
1. **Markdown 格式输出**: 粘贴图片后，`onChange` 回调中的 `text` 字段应包含 Markdown 格式的图片语法 `![alt](url)`
2. **富文本结构**: `richContent` 应包含正确的图片节点结构
3. **非空检测**: `isEmpty` 应为 `false`

**示例代码**：
```typescript
it('should handle pasted image and return markdown format', async () => {
  const user = userEvent.setup();
  const onChangeMock = vi.fn();

  render(
    <RenderingWysiwygEditor
      onChange={onChangeMock as any}
      placeholder="Paste image here"
    />
  );

  const editor = screen.getByPlaceholderText('Paste image here');
  await user.click(editor);
  await user.paste('![test-image](https://example.com/image.png)');

  await waitFor(() => {
    const lastCall = onChangeMock.mock.calls[onChangeMock.mock.calls.length - 1][0];
    expect(lastCall.text).toMatch(/!\[.*\]\(.*\)/); // Markdown 图片格式
    expect(lastCall.isEmpty).toBe(false);
  });
});
```

### 焦点状态测试

**测试方法**：
1. 使用 `ref` 获取编辑器实例
2. 调用 `focus()` 或 `resetAndFocus()` 方法
3. 验证方法调用不抛出异常

**注意**: JSDOM 环境下焦点测试有限制，实际焦点状态难以完全验证。在真实浏览器环境中，可以通过 `document.activeElement` 检查焦点状态。

**示例代码**：
```typescript
it('should focus editor when focus() is called', async () => {
  const editorRef = createRef<RenderingWysiwygEditorRef | null>();

  render(
    <RenderingWysiwygEditor
      ref={editorRef}
      onChange={vi.fn() as any}
      placeholder="Test editor"
    />
  );

  await waitFor(() => {
    expect(editorRef.current).toBeDefined();
  });

  editorRef.current?.focus();
  expect(editorRef.current?.focus).toBeDefined();
});
```

## 扩展测试

### 添加新的测试用例

1. 在对应组件的 `__tests__` 目录下创建测试文件
2. 使用 `describe` 组织测试套件
3. 使用 `it` 编写单个测试用例
4. 使用 `beforeEach` 设置测试前置条件

### Mock Tauri APIs

Tauri 相关的 API 已在 `src/tests/setup.ts` 中全局 mock，包括：
- `window.__TAURI__.core.invoke`
- `window.__TAURI__.event.listen`
- `window.__TAURI__.event.emit`

如需自定义 mock 行为，可以在具体测试中覆盖。

## 常见问题

### 类型错误

如果遇到 Mock 函数类型不匹配的问题，可以使用 `as any` 进行类型断言：
```typescript
const mockFn = vi.fn();
<Component onChange={mockFn as any} />
```

### 异步测试

使用 `waitFor` 等待异步操作完成：
```typescript
await waitFor(() => {
  expect(mockFn).toHaveBeenCalled();
}, { timeout: 3000 });
```

### 调试测试

1. 使用 `pnpm test:ui` 打开可视化界面
2. 在测试中添加 `console.log` 输出
3. 使用 `screen.debug()` 查看当前 DOM 结构

## 参考资料

- [Vitest 文档](https://vitest.dev/)
- [React Testing Library 文档](https://testing-library.com/react)
- [Plate.js 文档](https://platejs.org/)
