# Lovpen Notes

A lightning-fast floating notes app for capturing thoughts instantly. Built with Tauri for native performance.

[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)](https://github.com/yourusername/lovpen-notes)
[![Tauri](https://img.shields.io/badge/Tauri-v2-24C8DB)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-v19-61DAFB)](https://react.dev/)

## Features

- **⌘N Global Hotkey** - Instant access from anywhere
- **Floating Window** - Always-on-top note capture
- **Rich Text Editor** - WYSIWYG editing powered by Plate.js with markdown shortcuts
- **Multi-Window Editing** - Open notes in separate windows
- **Note Management** - Pin, favorite, and organize your notes
- **Resume & Continue** - Pick up where you left off
- **100% Local** - Your notes never leave your device

## Installation

### Download Binary (Recommended)

Download the latest release for your platform:
- [macOS (.dmg)](https://github.com/yourusername/lovpen-notes/releases)
- [Windows (.msi)](https://github.com/yourusername/lovpen-notes/releases)
- [Linux (.AppImage)](https://github.com/yourusername/lovpen-notes/releases)

### Build from Source

```bash
# Prerequisites: Node.js 18+, pnpm 8+, Rust stable

git clone https://github.com/yourusername/lovpen-notes.git
cd lovpen-notes
pnpm install
pnpm tauri build
```

## Usage

1. **Toggle App** - Press `⌘N` (macOS) or `Ctrl+N` (Windows/Linux)
2. **Write** - Use rich text editor with markdown shortcuts (e.g., `#` for headings, `**` for bold)
3. **Save** - Auto-saves while typing, `⌘S` for manual save
4. **Edit** - Click any note to open in a dedicated editor window
5. **Organize** - Pin important notes, favorite frequently used ones

### Keyboard Shortcuts

| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| Toggle App | `⌘N` | `Ctrl+N` |
| Submit Note | `⌘Enter` | `Ctrl+Enter` |
| Save (Editor) | `⌘S` | `Ctrl+S` |
| Close Window | `⌘W` | `Ctrl+W` |
| Dev Tools | `⌘⇧I` | `Ctrl+Shift+I` |

## Development

```bash
pnpm tauri dev    # Start development server
pnpm build        # Build frontend
pnpm tauri build  # Build release
```

### Architecture

```
src/              # React frontend
├── App.tsx       # Main floating window
├── editor.tsx    # Editor window entry
├── components/
│   ├── NoteEditor.tsx           # Main editor component
│   └── RenderingWysiwygEditor.tsx # Plate.js integration
└── store/        # Jotai state management

src-tauri/        # Rust backend
├── src/
│   ├── lib.rs    # Tauri commands & global shortcut
│   └── note_store.rs # In-memory note storage
└── tauri.conf.json # Window & app configuration
```

### Key Technologies

- **Frontend**: React 19, TypeScript, Vite
- **Backend**: Rust, Tauri v2
- **Rich Text**: Plate.js (Slate-based editor)
- **State**: Jotai
- **UI**: Radix UI, Tailwind CSS
- **Icons**: Lucide React

## Contributing

PRs welcome! Please ensure:
- Code follows existing patterns
- Tests pass (when applicable)
- Commits follow conventional format

## License

MIT © [Your Name]

## Support

[Open an issue](https://github.com/yourusername/lovpen-notes/issues) for bugs or feature requests.

---

Built with ❤️ using [Tauri](https://tauri.app)