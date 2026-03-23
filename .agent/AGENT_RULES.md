# Agent Operating Rules

To maintain a clean and organized workspace, the following rules MUST be followed by all agents:

## 1. Directory Organization
- **NEVER** create diagnostic, log, or temporary files directly in the root directory.
- All analysis, lint results, typecheck outputs, and build reports MUST be stored in the appropriate subfolder within `diagnostics/`:
    - `diagnostics/lint/`: For all linting and ESLint reports.
    - `diagnostics/typecheck/`: For all TypeScript compiler (`tsc`) and type-checking outputs.
    - `diagnostics/build/`: For build results and build logs.
    - `diagnostics/scripts/`: For temporary analysis scripts (e.g., `.mjs`, `.js` files for data parsing).
    - `diagnostics/reports/`: For high-level optimization or system reports.
    - `diagnostics/backups/`: For temporary file backups or recovered files.

## 2. File Creation Policy
- Before creating a new file, always check if it belongs in a feature module (`modules/[feature]/`) or the global `diagnostics/` directory.
- Random file creation in the repository root is strictly prohibited.
