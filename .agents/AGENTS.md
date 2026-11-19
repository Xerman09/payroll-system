# Formatting Rules
- Always use `date-fns` `format()` to format dates for UI display (e.g., `Jan 11, 2026`) instead of displaying raw YYYY-MM-DD strings (e.g., `2026-01-11`), unless specifically requested otherwise. Handle null/undefined dates safely using a helper function.
- **No Browser Dialogs**: Never use native browser dialogs like `window.confirm`, `window.alert`, or `window.prompt`. Always use UI components like shadcn/ui `AlertDialog`, `Dialog`, or `Toast` for confirmations and messages.

# Git & Workflow Rules
- **Auto Commit & Push**: Whenever code changes or tasks are completed and verified, automatically stage, commit, and push the changes to the active branch using a clear, concise Conventional Commit message (e.g., `feat: ...`, `fix: ...`, `refactor: ...`). State the commit message and push confirmation in the response.
