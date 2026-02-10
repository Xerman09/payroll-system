# Optimization & Code Quality Report

## Executive Summary
The system is well-structured using a modular architecture. However, there are significant **Security Risks** regarding authentication and data access, as well as **Performance Bottlenecks** related to client-side hydration and state management.

---

## 1. 🚨 Critical Security Issues

### A. Hardcoded Auth Logic
**File**: `app/api/auth/login/route.ts`
- **Issue**: The login route hardcodes `const deptId = 2;`.
- **Risk**: Only users from Department ID 2 can login. If the ID changes or you need multi-tenant support, this breaks.
- **Recommendation**: Remove this filter or make it dynamic based on the application context.

### B. Plain Text Password Handling (Potential)
**File**: `app/api/auth/login/route.ts`
- **Issue**: Logic compares `user.user_password` directly with the input password.
- **Risk**: If passwords are stored in plain text in the database, a leak would be catastrophic.
- **Recommendation**: Ensure Directus is hashing passwords. If Directus handles auth, use the Directus `/auth/login` endpoint instead of querying the `user` table directly.

### C. Generic API Proxies
**File**: `app/api/payroll-run/route.ts`
- **Issue**: The route accepts a `?resource=` parameter. While there is an `ALLOWED` list, it exposes raw CRUD access to these tables.
- **Risk**: A malicious user could potentially dump the entire `payroll_run_employee` table by calling the API directly if they have a valid token.
- **Recommendation**: Implement stricter server-side filtering. Instead of a generic proxy, create specific endpoints (e.g., `/api/payroll/process`) that only perform the allowed actions.

---

## 2. ⚡ Performance Optimizations

### A. Heavy Client-Side State
**File**: `modules/payroll-run/PayrollRunModule.tsx`
- **Issue**: The module manages massive state (`cutoffs`, `departments`, `run`, `ws`, `holdMap`) in a single component.
- **Impact**: Any update (like toggling a "hold" checkbox) might cause re-renders of the entire tree.
- **Recommendation**:
    - Use **React Context** or a state manager (Zustand) to isolate state.
    - Memoize heavy components (`PayrollConfigStep`, `PayrollReviewStep`) using `React.memo`.

### B. Hydration Workarounds
**File**: `app/dashboard/page.tsx`
- **Issue**: Uses `setTimeout(..., 0)` inside `useEffect` to avoid hydration errors when reading `sessionStorage`.
- **Impact**: Causes a "flash" of default content ("Admin") before the real user name appears.
- **Recommendation**: Use a proper hook for safe local storage reading or render specific client-only components that don't block the initial paint.

---

## 3. 🛠 Code Quality & Best Practices

### A. Type Safety (`any`)
- **Observation**: Frequent use of `any` in catch blocks (`catch (e: any)`) and some complex types.
- **Recommendation**: Define a standard `ApiError` type and use it. This improves error handling and debugging.

### B. Component Size
- **bservation**: `AdditionsDeductionsModule.tsx` (mentioned in structure doc) and potentially `PayrollRunModule.tsx` are very large (>500 lines).
- **Recommendation**: Break these down. For example, `PayrollRunModule` already uses sub-components for steps, which is good, but the main file still handles too much logic. Extract the data fetching logic into a custom hook (e.g., `usePayrollRunLogic`).

### C. Hardcoded Environment Variables
- **File**: `app/api/auth/login/route.ts`
- **Issue**: Fallbacks like `API_BASE` are sometimes hardcoded or chained extensively.
- **Recommendation**: Centralize config in `lib/config.ts` and use Zod to validate validation at runtime startup.

---

## 4. Recommended Next Steps

1.  **Fix Security**: Immediately address point 1A and 1B. Switch to Directus native auth if possible.
2.  **Refactor API**: Move away from `resource=` proxies for sensitive operations.
3.  **State Management**: Refactor `PayrollRunModule` to use a reducer or context to manage the complex multistep wizard state.
