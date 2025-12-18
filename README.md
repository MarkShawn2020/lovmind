<p align="center">
  <img src="docs/images/cover.png" alt="Lovmind Cover" width="100%">
</p>

<h1 align="center">
  <img src="assets/logo.svg" width="32" height="32" alt="Lovmind Logo" align="top">
  Lovmind
</h1>

<p align="center">
  <strong>Lightning-fast floating notes for instant thought capture</strong><br>
  <sub>macOS · Windows · Linux</sub>
</p>

<p align="center">
  <a href="https://github.com/MarkShawn2020/lovmind/releases"><img src="https://img.shields.io/github/v/release/MarkShawn2020/lovmind?label=version" alt="Version"></a>
  <a href="https://tauri.app/"><img src="https://img.shields.io/badge/Tauri-v2-24C8DB" alt="Tauri"></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61DAFB" alt="React"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
</p>

<p align="center">
  <a href="https://github.com/MarkShawn2020/lovmind/releases">Download</a> ·
  <a href="https://github.com/MarkShawn2020/lovmind/issues">Report Bug</a> ·
  <a href="https://github.com/MarkShawn2020/lovmind/issues">Request Feature</a>
</p>

---

## ✨ Why Lovmind?

Born from the need for **zero-friction** note-taking, Lovmind is a floating notes app that appears instantly with a global hotkey (`⌘N` / `Ctrl+N`). No switching apps, no context loss—just pure thought capture.

**Key Differentiators:**
- 🚀 **Native Performance**: Built with Tauri for 10x smaller size than Electron apps
- ⚡ **Instant Access**: Global hotkey summons the app from anywhere
- 🎨 **WYSIWYG Editor**: Rich text editing with Markdown shortcuts (powered by Plate.js)
- 🪟 **Multi-Window**: Each note opens in its own window for parallel work
- 🔒 **100% Local**: Your data never leaves your device

## 📥 Installation

### Option 1: Download Binary (Recommended)

| Platform | Download |
|----------|----------|
| macOS | [Intel](https://github.com/MarkShawn2020/lovmind/releases) \| [Apple Silicon](https://github.com/MarkShawn2020/lovmind/releases) \| [Universal](https://github.com/MarkShawn2020/lovmind/releases) |
| Windows | [x64](https://github.com/MarkShawn2020/lovmind/releases) \| [ARM64](https://github.com/MarkShawn2020/lovmind/releases) |
| Linux | [AppImage](https://github.com/MarkShawn2020/lovmind/releases) |

### Option 2: Build from Source

```bash
# Prerequisites: Node.js 18+, pnpm 8+, Rust stable
git clone https://github.com/MarkShawn2020/lovmind.git
cd lovmind
pnpm install
pnpm tauri build
```

## 🚀 Quick Start

1. **Launch**: Press `⌘N` (macOS) or `Ctrl+N` (Windows/Linux) from anywhere
2. **Write**: Start typing—supports Markdown shortcuts (`#` for headings, `**bold**`, etc.)
3. **Save**: Auto-saves as you type, or press `⌘S` for manual save
4. **Organize**: Click notes to open in dedicated windows, pin important ones

### Keyboard Shortcuts

| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| Toggle App | `⌘N` | `Ctrl+N` |
| Submit Note | `⌘Enter` | `Ctrl+Enter` |
| Save | `⌘S` | `Ctrl+S` |
| Close Window | `⌘W` | `Ctrl+W` |

## 🎯 Features

- **⌘N Global Hotkey** – Instant access from any application
- **Floating Window** – Always-on-top, distraction-free capture
- **Rich Text Editor** – Bold, italics, headings, lists, code blocks, tables
- **Markdown Shortcuts** – Type naturally with auto-formatting
- **Multi-Window** – Edit multiple notes simultaneously
- **Pin & Favorite** – Keep important notes at the top
- **Local-First** – All data stored locally, no cloud dependency

## 🛠️ Development

```bash
# Start dev server (hot reload)
pnpm tauri dev

# Type checking
pnpm check:type

# Build production binary
pnpm tauri build
```

### Architecture

```
lovmind/
├── src/                          # React frontend
│   ├── App.tsx                   # Main window shell + editor layout
│   ├── float-window.tsx           # Floating window entry
│   ├── components/
│   │   └── RenderingWysiwygEditor.tsx  # Plate.js integration
│   ├── components/note-editor/   # Headers & chrome primitives
│   └── hooks/useNoteEditorController.ts # Shared editing state/logic
│   └── store.ts                  # Jotai state management
│
└── src-tauri/                    # Rust backend
    ├── src/
    │   ├── lib.rs                # Tauri commands & global shortcut
    │   └── note_store.rs         # In-memory note storage
    └── tauri.conf.json           # App configuration
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript, Vite |
| **Backend** | Rust, Tauri v2 |
| **UI Framework** | Radix UI, Tailwind CSS |
| **Rich Text** | Plate.js (Slate-based) |
| **State Management** | Jotai |
| **Icons** | Lucide React |

## 🤝 Contributing

Contributions welcome! Please ensure:
- Code follows existing patterns
- TypeScript strict mode compliance
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/)

## 📄 License

MIT © [Lovpen](https://github.com/MarkShawn2020)

## 💬 Support

- 🐛 [Report bugs](https://github.com/MarkShawn2020/lovmind/issues)
- 💡 [Request features](https://github.com/MarkShawn2020/lovmind/issues)
- 📖 [Documentation](https://github.com/MarkShawn2020/lovmind/wiki)

---

<div align="center">

Built with ❤️ using [Tauri](https://tauri.app)

**[⭐ Star us on GitHub](https://github.com/MarkShawn2020/lovmind)**

</div>
