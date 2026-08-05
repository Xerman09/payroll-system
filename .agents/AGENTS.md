# Formatting Rules
- Always use `date-fns` `format()` to format dates for UI display (e.g., `Jan 11, 2026`) instead of displaying raw YYYY-MM-DD strings (e.g., `2026-01-11`), unless specifically requested otherwise. Handle null/undefined dates safely using a helper function.
