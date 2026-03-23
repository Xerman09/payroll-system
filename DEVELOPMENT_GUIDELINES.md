# Development Guidelines

## 🤖 Operation (WAT v2)
1. **Observer Pattern**: Verify every automated action (e.g., `list_dir` after creation).
2. **Self-Healing**: Record bugs/fixes in `.agent/remedies.md`.
3. **3-Strike Rule**: Stop and ask for help after 3 failures.
4. **Directory Organization**: Never create temporary, log, or diagnostic files in the root. Use `diagnostics/` subfolders (see [.agent/AGENT_RULES.md](.agent/AGENT_RULES.md)).

## ⚡ Architecture
1. **Module Pattern**: Business logic goes in `modules/[feature]/`. Use `[Feature]Module.tsx`, `components/`, `providers/`, `types.ts`.
2. **Data Flow**: SWR/React Query for fetching in main module. Props for children. Actions in `providers/`.
3. **Typing**: No `any`. Share types between Frontend and API.

## 🔌 API Patterns
- **Location**: `app/api/[feature]/route.ts`.
- **Proxy**: Use allow-lists for resources. Proxy to Directus/Backend.

## 🎨 UI/UX Standards
- **Layout**: Use `DashboardLayout` + `Card`.
- **Feedback**: Use `sonner` (toast) and `Skeleton` loaders.
- **Rules**: No hardcoded URLs, no `useEffect` fetching, no new global CSS.

## 🚫 Safety
- **Undo Warning**: Be aware that undoing a chat prompt rolls back filesystem changes (deleting new files).
