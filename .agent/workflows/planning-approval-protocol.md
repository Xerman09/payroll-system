# Workflow: Planning & Approval Protocol

This workflow defines the mandatory steps for transitioning from a task request to implementation. It is designed to ensure the USER maintains full control over architectural decisions.

## Protocol Steps

1. **Research & Analysis**
   - Use `grep_search`, `view_file`, and `list_dir` to understand the codebase.
   - Summarize findings in the `implementation_plan.md`.

2. **Plan Creation [Halt Point]**
   - Write the technical approach to `implementation_plan.md`.
   - Set `request_feedback: true` in the metadata.
   - **STOP.** Do not call any other tools except `ask_question` if clarification is needed.

3. **User Approval**
   - Wait for the user to provide explicit approval (e.g., "Proceed", "Approved").
   - If the user provides feedback, return to step 2.

4. **Execution**
   - Only after approval, begin modifications.
   - Update `task.md` with progress.

## Zero-Tolerance Rules
- **No Silent Refactoring**: Do not perform large-scale refactors without an approved plan.
- **No Background Execution**: Do not start `npm run dev` or long-running builds until the plan is approved, unless specifically requested for research.
