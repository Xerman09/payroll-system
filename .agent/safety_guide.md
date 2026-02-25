# AI Workspace Safety Guide

Protect your work and understand how the AI assistant interacts with your filesystem.

---

## 🛡️ The "Undo" Mechanism

The **Undo** button in the chat interface is a powerful "Time Travel" tool. It doesn't just delete a message; it **reverts the entire workspace state** to exactly how it was at that point in time.

### ⚠️ Critical Warning
If the AI created a file, modified a database, or updated a configuration in a Turn that you then "Undo":
- **The file will be DELETED.**
- **The code changes will be REVERTED.**
- **Terminal outputs or logs from that turn will disappear.**

### ✅ Best Practices
1.  **Commit Often**: Before performing risky AI operations, commit your current stable state to Git.
2.  **Copy-Paste for Safety**: If you want to keep AI-generated code but remove the chat history, copy the code to a separate file or a scratchpad before hitting Undo.
3.  **Use "Redo" with Caution**: Redoing will restore the state, but if you've made manual changes in the meantime, they might be overwritten.

---

## ⚡ Performance Optimization

If you feel the AI is becoming slow or providing "stiff" outputs:
1.  **Clear Context**: Start a new conversation for a new task to clear old, irrelevant context.
2.  **Lean Instructions**: Use the "Lean" versions of skills if you prefer speed over verbose compliance. (See `.agent/skills/`)
3.  **Small Batches**: Give smaller, more focused tasks rather than one massive "Build this entire module" prompt.
