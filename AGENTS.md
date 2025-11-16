# Repository Guidelines

## Project Structure & Module Organization
- `src/`: React + TypeScript frontend. Entrypoints live in `src/App.tsx` (main window) and `src/float-window.tsx` (floating editor). Shared UI/logic sits in `src/components`, `src/components/note-editor`, `src/hooks`, and `src/features`.
- `src-tauri/`: Rust commands, window configuration, and bundling metadata.
- Assets such as logos live under `src/assets/`, while docs and marketing pages remain in `docs/`.
- Keep new platform-specific helpers under `src/utils/` and reuse the `useNoteEditorController` hook for editor state orchestration.

## Build, Test, and Development Commands
- `pnpm dev`: Launch Vite dev server for the web shell; hot reload mirrors Tauri layout.
- `pnpm tauri dev`: Run the desktop shell (Rust backend + frontend) with live reload.
- `pnpm check:type`: Strict TypeScript check; run before every PR.
- `pnpm build`: Produce production-ready web assets (Vite build).
- `pnpm tauri build`: Create distributable desktop binaries (macOS, Windows depending on toolchain).

## Coding Style & Naming Conventions
- Use TypeScript everywhere; enable `strict` options and avoid `any`.
- Components/hooks live in PascalCase files (`EditorLayout.tsx`, `useUserProfile.ts`); utility modules stay camelCase.
- JSX uses 2-space indentation and functional React components with hooks; side effects belong in `useEffect` with explicit dependency arrays.
- Prefer path aliases (`@/components/...`) already defined in `tsconfig.json`.

## Testing Guidelines
- No dedicated unit-test harness yet; rely on `pnpm check:type` plus Tauri smoke tests (`pnpm tauri dev`).
- When adding automated tests, colocate under the relevant feature directory and document how to run them in the PR.
- For UI changes, capture before/after screenshots or short screen recordings from the running Tauri window.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`type(scope): summary`), e.g., `refactor(app): inline note editor layouts` or `fix(editor): preserve selection after save`.
- One logical change per commit; avoid bundling dependency bumps with feature work.
- PR description must include: purpose, testing evidence (`pnpm check:type`, manual steps), screenshots for UI, and any follow-up tasks.
- Link issues via “Closes #123” syntax when applicable, and request review from the current maintainer responsible for the touched area.
