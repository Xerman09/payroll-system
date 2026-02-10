# Development Guidelines & Rules

These rules are designed to ensure consistency, maintainability, and efficiency when generating new features, modules, or logic for the Payroll System.

---

## 1. ⚡ Efficient Workflow Rules

### Rule #1: Follow the Module Pattern
**Never** put business logic directly in `app/dashboard`.
- **Correct**: Create a dedicated folder in `modules/[feature-name]`.
- **Structure**:
  - `[Feature]Module.tsx`: Main container (client-side).
  - `components/`: Sub-components specific to this feature.
  - `providers/[feature]Api.ts`: API service layer.
  - `types.ts`: Domain specific types.

### Rule #2: One-Way Data Flow
1. **Fetch** data in the **Main Module Component** (or a top-level provider) using `SWR`.
2. **Pass** data down to presentational components via props.
3. **Actions** (Create/Update/Delete) should live in `providers/[feature]Api.ts` and be called from the Main Module.

### Rule #3: Strict Typing
- **Do NOT use `any`**.
- Define interfaces in `types.ts` first.
- Share types between the Frontend (Module) and the API Route (`app/api/...`) to ensure contract safety.

---

## 2. 🧱 Feature Generation Guide

When asked to "Add a new feature X":

### Step 1: Define the Domain
Create `modules/[feature]/types.ts`:
```typescript
export interface FeatureItem {
  id: number;
  name: string;
  status: "active" | "inactive";
  created_at: string;
}
```

### Step 2: Create the Service Layer
Create `modules/[feature]/providers/[feature]Api.ts`.
- **Pattern**: Use `fetch` wrapper.
- **Must Have functions**: `fetchAll`, `create`, `update`, `delete`.
- **SWR Hook**: export `useFeatureData()` for easy consumption.

### Step 3: Create the UI Components
- Use **Shadcn UI** components from `@/components/ui`.
- **Table**: Create `[Feature]Table.tsx`.
- **Form**: Create `[Feature]Modal.tsx` for Add/Edit actions.

### Step 4: Wire it together
In `[Feature]Module.tsx`:
- Import `useFeatureData`.
- Handle `onSave` / `onDelete` events.
- Manage `isModalOpen` state.

---

## 3. 🔌 API Route Patterns

**Location**: `app/api/[feature]/route.ts`

### Standard Proxy Pattern
Most routes acts as a secure proxy to Directus.
```typescript
// app/api/[feature]/route.ts
import { NextRequest, NextResponse } from "next/server";

// 1. Define allowed resources to prevent abuse
const ALLOWED_RESOURCES = {
  my_table: true,
  related_table: true
};

export async function GET(req: NextRequest) {
  // 2. Validate params
  const { searchParams } = new URL(req.url);
  const resource = searchParams.get("resource");

  if (!ALLOWED_RESOURCES[resource]) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3. Proxy to Backend
  // ... fetch(process.env.API_BASE + ...)
}
```

---

## 4. 🎨 UI & UX Standards

### Layout
- Always wrap main modules in `<DashboardLayout>`.
- Use a `Card` for the main content area.
- Place "Page Actions" (like "Add New") in the top-right of a Header section.

### Feedback
- Use **Sonner** (`toast`) for all success/error messages.
  - `toast.success("Record saved successfully")`
  - `toast.error(error.message)`
- Use **Skeleton** loaders when data is `loading` (from SWR).

---

## 5. 🚫 Anti-Patterns (What NOT to do)
- **Don't** hardcode API URLs in components. Use the `providers/` file.
- **Don't** use `useEffect` for data fetching. Use `SWR` or `React Query`.
- **Don't** create new global CSS styles. Use **Tailwind** utility classes.
- **Don't** put huge logic files in `app/`. Keep `app/` folders thin (just routing).
