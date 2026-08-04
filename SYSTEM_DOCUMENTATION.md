# HR and Payroll System - Detailed System Documentation

---

## 🤖 Agentic Orchestration (WAT v2)

The system is designed to be co-authored by human developers and AI agents using the **WAT (Workflows, Agents, Tools)** framework.

### Core Mechanics
1. **Deterministic Tools**: Complex logic (e.g., tax calculation, PDF generation) is offloaded to TypeScript scripts in `/tools` to ensure absolute accuracy and type-safety.
2. **Persistent Memory**: The `.agent/remedies.md` log enables "self-healing," where the system learns from past errors.
3. **Automatic Intelligence**: Specialized skills in `.agent/skills/` are dynamically loaded by the AI based on the task domain (Frontend vs Backend).

### Available Tools (`tools/*.ts`)
- `tools/module-scaffolder.ts`: Creates full module structure (`modules/`, `providers/`, `types`, `app/dashboard`).
- `tools/api-scaffolder.ts`: Creates standardized API routes with security checks.
- `tools/component-generator.ts`: Creates Shadcn/Framer Motion components.

---

## 1. System Overview
**Framework**: Next.js 16 (App Router)
**Language**: TypeScript (React 19)
**Backend**: Directus (Headless CMS)
**UI Library**: Shadcn UI (Radix + Tailwind 4)
**State Management**: React Hooks + SWR

---

## 2. Global Folder Structure

```
payroll_system/
├── app/                        # Next.js App Router
│   ├── api/                    # Backend proxy routes
│   ├── auth/                   # Authentication pages
│   ├── dashboard/              # Protected application pages
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Landing page
├── components/                 # Shared UI components
│   ├── layout/                 # Layout components (Sidebar, Header)
│   └── ui/                     # primitive UI elements (Button, Input, etc.)
├── lib/                        # Shared utilities
├── modules/                    # Feature Modules (Code Logic)
│   ├── additions-deductions/
│   ├── allowance/
│   ├── benefit-settings/
│   ├── calendar-management/
│   ├── coop-management/
│   ├── cutoff-settings/
│   ├── payroll-records/
│   ├── payroll-run/
│   ├── retro/
│   └── wage/
└── types/                      # Global TypeScript definitions
```

---

## 3. Module Details

### 3.1 Wage Module
**Path**: `modules/wage/`
**Description**: Managing employee wage profiles (monthly rates, hourly rates), effective dates, and history.

#### **Files & Functions**:

- **`WageModule.tsx`** (Main Entry)
    - `WageModule()`: Main component rendering the wage management dashboard.
    - `handlePasswordSubmit(password)`: Authenticates sensitive actions.
    - `loadWageData(userId)`: Fetches wage profile for selected user.
    - `saveWageData()`: Commits changes to backend.

- **`providers/wageApi.ts`** (Service Layer - *Huge Service*)
    - **Wages**:
        - `fetchWageByUser(userId)`: Get wage profile.
        - `createWage(payload)`: Create new wage record.
        - `patchWage(id, payload)`: Update wage record.
        - `createWageProrationLog(payload)`: Logs changes for proration.
    - **Employees**:
        - `fetchEmployeesPaged(params)`: Search/Sort/Filter employees.
    - **Loans**:
        - `fetchEmployeeLoansByUser(userId)`: Get employee loans.
        - `createEmployeeLoan(payload)`
        - `patchEmployeeLoan(id, payload)`
    - **Retro Pay**:
        - `fetchRetroPayByUser(userId)`
        - `createRetroPay(payload)`
    - **Other Additions/Deductions**:
        - `fetchPayrollOtherAdditionsByUser(userId)`
        - `createPayrollOtherAddition(payload)`

---

### 3.2 Payroll Run Module
**Path**: `modules/payroll-run/`
**Description**: The core engine for calculating payroll. Handles the 4-step process: Configure -> Adjust -> Process -> Review.

#### **Files & Functions**:

- **`PayrollRunModule.tsx`** (Main Entry)
    - `PayrollRunModule()`: Orchestrates the wizard steps.
    - `loadOrCreateRunAndWorkspace()`: Initializes a DRAFT run or loads existing one.
    - `processAndSave()`: Triggers computation and saves lines.
    - `postPayroll()`: Finalizes the run and posts to ledgers.

- **`providers/payrollRunService.ts`** (Service Layer - *Complex Calculation Logic*)
    - **Helpers**:
        - `generatePayrollRefNo()`: Creates partial-unique ref strings.
        - `normalizeProrationLog()`: Handles effective-date logic for salary changes.
    - **API Interactions**:
        - `createOrGetActiveRun()`: Idempotent run creator.
        - `saveLines()`: Bulk inserts computed payroll lines.
        - `postRun()`: Marks run as POSTED.

---

### 3.3 Retro Module
**Path**: `modules/retro/`
**Description**: Management of retroactive pay adjustments.

#### **Files & Functions**:

- **`RetroModule.tsx`** (Main Entry)
    - `RetroModule()`: Renders the retro pay table and CRUD modals.
    - `handleCreate()`, `handleUpdate()`, `handleDelete()`: CRUD handlers.

- **`providers/retroApi.ts`**
    - `fetchAll()`: Get all retro records.
    - `create(data, createdBy)`: POST new retro pay.
    - `update(id, data, updatedBy)`: PATCH retro pay.
    - `delete(id)`: DELETE retro pay.

---

### 3.4 Allowance Module
**Path**: `modules/allowance/`
**Description**: Managing recurring and one-time allowances.

#### **Files & Functions**:

- **`AllowanceModule.tsx`** (Main Entry)
    - `AllowanceModule()`: Main UI.
    - `handleSave()`: Handles creating/updating allowances.

- **`providers/allowanceApi.ts`**
    - `getAllowancesList(params)`: Fetches allowances with pagination and filtering.
    - `createAllowance()`, `updateAllowance()`, `deleteAllowance()`: CRUD.
    - `computeCutoffFromDate(date)`: Utility to determine cutoff period from a date.

---

### 3.5 Benefit Settings Module
**Path**: `modules/benefit-settings/`
**Description**: Configuring government contributions (SSS, Philhealth, Pagibig) and their deduction schedules.

#### **Files & Functions**:

- **`BenefitSettingsModule.tsx`** (Main Entry)
    - `BenefitSettingsModule()`: Main UI.
    - `onCutoff()`: Updates which cutoff a benefit is deducted on.
    - `onSaveAll()`: Persists all settings.

- **`providers/benefitApi.ts`**
    - `fetchBenefitSettings()`: Loads current config.
    - `saveBenefitSetting()`: Writes config.
    - `computeLoanCutoffSchedule()`: Projects loan deductions based on terms.

---

### 3.6 Calendar Management Module
**Path**: `modules/calendar-management/`
**Description**: Managing holidays and work-suspensions (affects attendance computations).

#### **Files & Functions**:

- **`CalendarManagementModule.tsx`** (Main Entry)
    - `CalendarManagementModule()`: Renders calendar view.
    - `handleSaveHoliday()`: Creates a new holiday event.
    - `SimpleCalendar()`: Custom calendar grid component.

- **`types.ts`**: Defines `Holiday` structure (Regular, Special Non-Working, etc.).

---

### 3.7 Coop Management Module
**Path**: `modules/coop-management/`
**Description**: Tracking cooperative savings and loans.

#### **Files & Functions**:

- **`CoopManagementModule.tsx`** (Main Entry)
    - `CoopManagementModule()`: Tabs for Savings vs Loans.

- **`providers/coopApi.ts`**
    - `listItems(collection)`: Generic fetcher for coop collections.
    - `createItem(collection, body)`: Generic creator.
    - `updateItem()`, `deleteItem()`: Generic update/delete.
    - *Collections used*: `employee_loan`, `coop_savings_membership`.

---

### 3.8 Cutoff Settings Module
**Path**: `modules/cutoff-settings/`
**Description**: Defining the global payroll cutoff dates (e.g., 26-10, 11-25).

#### **Files & Functions**:

- **`CutoffSettingsModule.tsx`** (Main Entry)
    - `CutoffSettingsModule()`: UI for viewing/editing cutoff ranges.
    - `applyAndSaveRow()`: Updates the 2 main rows (FIRST/SECOND).

- **`providers/cutoffSettingsApi.ts`**
    - `ensureTwoRowsForCurrentPayrollPeriod()`: Critical function ensuring the database always has 2 active cutoff rows for the current month.
    - `computeCurrentPayrollPeriod()`: Determines which month we are operating in.

---

### 3.9 Payroll Records Module
**Path**: `modules/payroll-records/`
**Description**: Historical view of past payrolls, employees, and top-sheets.

#### **Files & Functions**:

- **`PayrollRecordsModule.tsx`** (Main Entry)
    - `PayrollRecordsModule()`: Wrapper for the tabs.
    - `handleDownloadSummary()`: Triggers PDF generation.

- **`providers/payrollRecordsApi.ts`**
    - `fetchTapSheet(args)`: Fetches the aggregated payroll data for the "Top Sheet" view.
    - `fetchEmployees()`, `fetchCutoffs()`.

---

### 3.10 Additions & Deductions Module
**Path**: `modules/additions-deductions/`
**Description**: Managing generic recurring additions/deductions (separate from Benefits).

#### **Files & Functions**:
*(Inferred from structure)*
- **`AdditionsDeductionsModule.tsx`**: Main CRUD UI.
- **`providers/additionsDeductionsApi.ts`**: (Presumed) API service for fetching/saving generic `payroll_other_additions` / `payroll_other_deductions`.

---

## 4. API & Authentication

### Auth API
**Path**: `app/api/auth/login/route.ts`
- **Function**: `POST`
- **Logic**: Accepts email/password. Fetches user from Directus. Verifies password. Returns user object.

### General API Proxy (`api-proxy.ts` pattern)
Most API routes (`app/api/[module]/route.ts`) follow a pattern:
1.  **Validate Resource**: Check if `?resource=table_name` is in the `ALLOWED` list.
2.  **Forward**: Proxy request to Directus `items/` endpoint.
3.  **Return**: Pass JSON response back to frontend.

## 5. Key Libraries/Utilities
- **`lib/utils.ts`**: `cn()` helper for dynamic Tailwind classes.
- **`lib/api-proxy.ts`** (implied): Shared proxy logic used by some routes.
- **`swr`**: Used extensively in modules for data fetching (caching, revalidation).
- **`sonner`**: Toast notifications.
- **`lucide-react`**: Icon set.
