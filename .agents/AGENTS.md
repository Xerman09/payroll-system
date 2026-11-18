# Formatting Rules
- Always use `date-fns` `format()` to format dates for UI display (e.g., `Jan 11, 2026`) instead of displaying raw YYYY-MM-DD strings (e.g., `2026-01-11`), unless specifically requested otherwise. Handle null/undefined dates safely using a helper function.
- **No Browser Dialogs**: Never use native browser dialogs like `window.confirm`, `window.alert`, or `window.prompt`. Always use UI components like shadcn/ui `AlertDialog`, `Dialog`, or `Toast` for confirmations and messages.

# Git & Workflow Rules
- **Commit Messages**: Always provide a clear, concise Git commit message (following Conventional Commits, e.g., `feat: ...`, `fix: ...`, `refactor: ...`) at the end of the response whenever code changes or tasks are completed.
