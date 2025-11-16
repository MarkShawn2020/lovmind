# Markdown Clipboard - Quick Start

## TL;DR

**Problem:** Copy content from editor as Markdown format instead of HTML.

**Solution:** Implemented in v0.67.0 ✅

**Usage:** Press `Cmd+C` (or `Ctrl+C` on Windows/Linux) - content automatically copied as Markdown!

---

## Quick Examples

### Example 1: Basic Text

**Editor:**
```
Hello **world**!
```

**Clipboard:**
```markdown
Hello **world**!
```

### Example 2: Lists

**Editor:**
```
Shopping:
1. Milk
2. Eggs
3. Bread
```

**Clipboard:**
```markdown
Shopping:

1. Milk
2. Eggs
3. Bread
```

### Example 3: With Hashtags

**Editor:**
```
Learning #React and #TypeScript
```

**Clipboard:**
```markdown
Learning <hashtag value="React">#React</hashtag> and <hashtag value="TypeScript">#TypeScript</hashtag>
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+C` / `Ctrl+C` | Copy as Markdown |
| `Cmd+A` | Select All |
| `Cmd+V` / `Ctrl+V` | Paste (browser default) |
| `Cmd+X` / `Ctrl+X` | Cut (browser default) |

**Note:** Edit menu items (Copy/Paste) removed - use keyboard shortcuts only.

---

## Supported Markdown Syntax

✅ **Headings:** `# H1`, `## H2`, `### H3`, etc.
✅ **Bold/Italic:** `**bold**`, `*italic*`
✅ **Code:** `` `inline code` ``
✅ **Lists:** Ordered (`1.`) and unordered (`-`)
✅ **Links:** `[text](url)`
✅ **Code Blocks:** ` ```language\ncode\n``` `
✅ **Blockquotes:** `> quote`
✅ **Tables:** GitHub Flavored Markdown tables
✅ **Hashtags:** `<hashtag value="...">...</hashtag>` (MDX format)

---

## Troubleshooting

### Issue: Nothing copied

**Solution:** Open DevTools Console (`Cmd+Opt+I`), look for:
```
✅ [Document Copy] Successfully wrote to clipboard!
```

If missing, report with console logs.

### Issue: Only partial content copied after Cmd+A

**Fixed in v0.67.0** - Update to latest version.

### Issue: Hashtags show as `<hashtag>` in external apps

**Expected behavior** - This is MDX format. To simplify:
1. Edit `src/components/editor/plugins/markdown-kit.tsx`
2. Change `serialize` rule to output plain text (see full docs)

---

## Technical Details

**How it works:**
1. Intercept `Cmd+C` at document level
2. Get editor content (Slate nodes)
3. Serialize to Markdown using `@platejs/markdown`
4. Write to system clipboard via `navigator.clipboard.writeText()`

**Why not use browser's copy event?**
- Doesn't fire in Tauri WebView
- Tauri's menu items bypass browser events
- Manual implementation needed

**Files modified:**
- `src/components/RenderingWysiwygEditor.tsx` - Copy handler
- `src/components/editor/plugins/markdown-kit.tsx` - Hashtag rules
- `src/components/editor/plugins/clipboard-markdown-kit.tsx` - NEW plugin (fallback)
- `src-tauri/src/lib.rs` - Removed menu items

---

## For Developers

### Add custom serialization rule:

```typescript
// In markdown-kit.tsx
rules: {
  [YOUR_ELEMENT_KEY]: {
    serialize: (node: YourElementType) => ({
      type: 'text', // or 'mdxJsxTextElement'
      value: `your markdown syntax`,
    }),
  },
}
```

### Debug logging:

Look for these console messages:
- `🔍 [Diagnostic]` - Event detection
- `🔧 [Document Copy]` - Copy processing
- `✅ [Document Copy]` - Success
- `❌ [Document Copy]` - Errors

### Disable diagnostic logs:

Remove `console.log` calls in `RenderingWysiwygEditor.tsx` lines 365-450.

---

## FAQ

**Q: Can I paste Markdown back into the editor?**
A: Not yet - uses browser's default paste. Feature planned for future release.

**Q: Why MDX format for hashtags instead of plain `#tag`?**
A: Preserves semantic structure. Can be configured to output plain text (see full docs).

**Q: Does this work in browser (non-Tauri)?**
A: Yes, though `clipboard-markdown-kit.tsx` plugin would be more appropriate (uses ClipboardEvent).

**Q: Performance impact?**
A: <100ms for typical documents (imperceptible to users).

---

## Version History

- **v0.67.0** (2025-11-16): Initial release
  - ✅ Markdown copy
  - ✅ Cmd+A support
  - ✅ Shadow input fix

---

## See Also

- [Full Technical Documentation](./MARKDOWN_CLIPBOARD.md)
- [Plate.js Docs](https://platejs.org/docs/markdown)
- [Project README](../README.md)
