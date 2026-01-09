# Payroll System - Modules File Structure

## Overview

Complete file structure of all modules with their functions and components, including interconnected files from `app/` and `app/api/` folders.

## Architecture Overview

### Folder Structure

```
payroll_system/
├── app/
│   ├── api/                          # Backend API routes (NextJS API handlers)
│   ├── auth/                         # Authentication pages
│   ├── dashboard/                    # Frontend dashboard pages (routing)
│   └── [other app files]
├── modules/                          # Reusable React components & business logic
│   ├── additions-deductions/
│   ├── allowance/
│   ├── benefit-settings/
│   ├── calendar-management/
│   ├── coop/
│   ├── cutoff-settings/
│   ├── payroll-run/
│   ├── retro/
│   └── wage/
└── [config files, components/, lib/, etc.]
```

### Data Flow

```
app/dashboard/[module]/page.tsx
    ↓ (imports & renders)
modules/[module]/[Module]Module.tsx
    ↓ (calls)
modules/[module]/providers/[module]Api.ts
    ↓ (HTTP requests)
app/api/[module]/route.ts
    ↓ (Directus API queries)
External Directus Database
```

---

## COMPLETE MODULE FILE STRUCTURE TREE

### 1. ADDITIONS-DEDUCTIONS MODULE

```
modules/additions-deductions/
├── AdditionsDeductionsModule.tsx
├── index.ts
├── types.ts
├── utils.ts
├── components/
│   ├── EditModal.tsx
│   └── EmployeeNameInternal.tsx
├── hooks/
│   ├── useAdditions.ts
│   ├── useDeductions.ts
│   └── useUsers.ts
└── providers/
    └── additionsDeductionsApi.ts

app/dashboard/additions-deductions/
└── page.tsx

app/api/additions-deductions/
└── route.ts
```

---

### 2. ALLOWANCE MODULE

```
modules/allowance/
├── AllowanceModule.tsx
├── index.tsx
├── types.ts
├── components/
│   ├── AllowanceModal.tsx
│   └── AllowanceTable.tsx
└── providers/
    └── allowanceApi.ts

app/dashboard/allowance-management/
└── page.tsx

app/api/allowance/
└── route.ts
```

---

### 3. BENEFIT-SETTINGS MODULE

```
modules/benefit-settings/
├── BenefitSettingsModule.tsx
├── index.ts
├── types.ts
├── components/
│   ├── BenefitCard.tsx
│   ├── BenefitCutoff.tsx
│   ├── BenefitDates.tsx
│   └── SaveButton.tsx
└── providers/
    ├── benefitApi.ts
    ├── useBenefitCrud.tsx
    └── useBenefitData.tsx

app/dashboard/benefit-settings/
└── page.tsx

app/api/benefit/
└── route.ts
```

---

### 4. CALENDAR-MANAGEMENT MODULE

```
modules/calendar-management/
├── CalendarManagementModule.tsx
├── index.ts
└── types.ts

app/dashboard/calendar-management/
└── page.tsx

app/api/calendar-management/
└── route.ts
```

---

### 5. COOP MODULE

```
modules/coop/
├── CoopModule.tsx
├── index.tsx
├── types.ts
├── components/
│   ├── SavingsTab.tsx
│   └── LoansTab.tsx
└── providers/
    └── coopApi.ts

app/dashboard/coop/
└── page.tsx

app/api/coop/
└── route.ts
```

---

### 6. CUTOFF-SETTINGS MODULE

```
modules/cutoff-settings/
├── CutoffSettingsModule.tsx
├── index.tsx
├── types.ts
├── components/
│   ├── CutoffSettingsTable.tsx
│   └── CutoffSettingsModal.tsx
└── providers/
    └── cutoffSettingsApi.ts

app/dashboard/cutoff-settings/
└── page.tsx

app/api/cutoff-settings/
└── route.ts
```

---

### 7. PAYROLL-RUN MODULE

```
modules/payroll-run/
├── PayrollRunModule.tsx
├── index.ts
├── types.ts
├── README.md
├── components/
│   ├── AdjustmentModal.tsx
│   ├── PayrollAdjustStep.tsx
│   ├── PayrollConfigStep.tsx
│   ├── PayrollHeader.tsx
│   ├── PayrollProcessStep.tsx
│   ├── PayrollReviewStep.tsx
│   └── PayrollStepper.tsx
├── providers/
│   └── mockData.ts
└── utils/
    ├── payroll.ts
    └── payroll.test.ts

app/dashboard/payroll-run/
└── page.tsx

app/dashboard/payroll-records/
└── page.tsx

app/api/payroll/
└── route.ts
```

---

### 8. RETRO MODULE

```
modules/retro/
├── RetroModule.tsx
├── index.ts
├── types.ts
├── components/
│   ├── RetroTable.tsx
│   └── RetroModal.tsx
└── providers/
    └── retroApi.ts

app/dashboard/retro/
└── page.tsx

app/api/retro/
└── route.ts
```

---

### 9. WAGE MODULE

```
modules/wage/
├── WageModule.tsx
├── index.tsx
├── types.ts
├── components/
│   ├── EmployeeTable.tsx
│   ├── PasswordDialog.tsx
│   └── WageModal.tsx
└── providers/
    └── wageApi.ts

app/dashboard/wage/
└── page.tsx

app/api/wage/
└── route.ts
```

---

### 10. AUTH MODULE

```
modules/auth/
└── login/
    └── (Login related components)

app/auth/login/
└── page.tsx

app/api/auth/
└── route.ts
```

---

### 11. CUTOFF MODULE (EMPTY)

```
modules/cutoff/
(Empty - reserved for future use)
```

---

## APP FOLDER STRUCTURE & INTERCONNECTIONS

### App Root Files

```
app/
├── layout.tsx                  # Root layout with DashboardLayout context
├── page.tsx                    # Home page
├── globals.css                 # Global styles
└── favicon.ico
```

### Authentication Folder

```
app/auth/
└── login/
    └── page.tsx               # Login page (public, redirects if authenticated)
```

### Dashboard Pages Folder

```
app/dashboard/
├── page.tsx                           # Dashboard home
├── additions-deductions/page.tsx      # Routes to AdditionsDeductionsModule
├── allowance-management/page.tsx      # Routes to AllowanceModule
├── benefit-settings/page.tsx          # Routes to BenefitSettingsModule
├── calendar-management/page.tsx       # Routes to CalendarManagementModule
├── coop/page.tsx                      # Routes to CoopModule
├── cutoff-settings/page.tsx           # Routes to CutoffSettingsModule
├── payroll-records/page.tsx           # Payroll records view
├── payroll-run/page.tsx               # Routes to PayrollRunModule
├── retro/page.tsx                     # Routes to RetroModule
└── wage/page.tsx                      # Routes to WageModule
```

### Dashboard Page Implementations

#### Page: additions-deductions/page.tsx

**Location:** `app/dashboard/additions-deductions/page.tsx`
**Full Implementation:** Contains complete component (1035 lines) - inline implementation, NOT routed to module

#### Page: allowance-management/page.tsx

**Location:** `app/dashboard/allowance-management/page.tsx`

```tsx
import AllowanceModule from "@/modules/allowance";

export default function Page() {
  return <AllowanceModule />;
}
```

**Connects To:** AllowanceModule

#### Page: benefit-settings/page.tsx

**Location:** `app/dashboard/benefit-settings/page.tsx`

```tsx
import { BenefitSettingsModule } from "@/modules/benefit-settings";

export default function Page() {
  return <BenefitSettingsModule />;
}
```

**Connects To:** BenefitSettingsModule

#### Page: calendar-management/page.tsx

**Location:** `app/dashboard/calendar-management/page.tsx`
**Expected Route:** CalendarManagementModule

#### Page: coop/page.tsx

**Location:** `app/dashboard/coop/page.tsx`
**Expected Route:** CoopModule

#### Page: cutoff-settings/page.tsx

**Location:** `app/dashboard/cutoff-settings/page.tsx`
**Expected Route:** CutoffSettingsModule

#### Page: payroll-records/page.tsx

**Location:** `app/dashboard/payroll-records/page.tsx`
**Purpose:** Display historical payroll records

#### Page: payroll-run/page.tsx

**Location:** `app/dashboard/payroll-run/page.tsx`
**Expected Route:** PayrollRunModule

#### Page: retro/page.tsx

**Location:** `app/dashboard/retro/page.tsx`
**Expected Route:** RetroModule

#### Page: wage/page.tsx

**Location:** `app/dashboard/wage/page.tsx`

```tsx
import { WageModule } from "@/modules/wage/WageModule";

export default function Page() {
  return <WageModule />;
}
```

**Connects To:** WageModule

---

## API ROUTES FOLDER STRUCTURE

```
app/api/
├── additions-deductions/
│   └── route.ts              # Handles additions & deductions CRUD
├── allowance/
│   └── route.ts              # Handles allowance operations
├── auth/
│   └── [auth routes]         # Authentication endpoints
├── benefit/
│   └── route.ts              # Handles benefit settings
├── calendar-management/
│   └── route.ts              # Handles holidays & calendar
├── coop/
│   └── route.ts              # Handles COOP savings & loans
├── cutoff-settings/
│   └── route.ts              # Handles cutoff period settings
├── payroll/
│   └── route.ts              # Handles payroll operations
├── retro/
│   └── route.ts              # Handles retroactive pay
└── wage/
    └── route.ts              # Handles wage records
```

### API Route: /api/additions-deductions/route.ts

**Location:** `app/api/additions-deductions/route.ts`

**Endpoints Handled:**

- GET: Fetch users, additions, or deductions
- POST: Create new addition/deduction record
- PATCH: Update existing record
- DELETE: Remove record

**Query Parameters:**

```
GET ?resource=users|additions|deductions
POST body: { resource: "additions|deductions", data: {...} }
PATCH body: { resource: "additions|deductions", id: number, data: {...} }
DELETE ?resource=users|additions|deductions&id=number
```

**External API Endpoints Called:**

```
Directus API Base: process.env.API_BASE || process.env.DIRECTUS_URL
- /items/user (GET, POST)
- /items/addition_deduction_history (GET, POST, PATCH, DELETE)
```

**Related Module:** modules/additions-deductions/
**Related Page:** app/dashboard/additions-deductions/page.tsx

---

### API Route: /api/allowance/route.ts

**Location:** `app/api/allowance/route.ts`

**Endpoints Handled:**

- GET: Fetch allowances with filters, pagination
- POST: Create new allowance
- PATCH: Update allowance
- DELETE: Remove allowance

**Query Parameters:**

```
GET ?mode=users                           # Fetch users list
GET ?limit=10&offset=0&sort=-created_date # List allowances
```

**Related Module:** modules/allowance/
**Related Page:** app/dashboard/allowance-management/page.tsx

---

### API Route: /api/benefit/route.ts

**Location:** `app/api/benefit/route.ts`

**Endpoints Handled:**

- GET: Fetch benefit settings
- POST: Create benefit
- PATCH: Update benefit
- DELETE: Remove benefit

**External API Endpoints Called:**

```
Directus API:
- /items/benefit_settings
- /items/user
```

**Related Module:** modules/benefit-settings/
**Related Page:** app/dashboard/benefit-settings/page.tsx

---

### API Route: /api/calendar-management/route.ts

**Location:** `app/api/calendar-management/route.ts`

**Endpoints Handled:**

- GET: Fetch holidays
- POST: Create holiday
- PATCH: Update holiday
- DELETE: Remove holiday

**Related Module:** modules/calendar-management/
**Related Page:** app/dashboard/calendar-management/page.tsx

---

### API Route: /api/coop/route.ts

**Location:** `app/api/coop/route.ts`

**Endpoints Handled:**

- GET: Fetch savings/loans data
- POST: Create savings/loans entry
- PATCH: Update entry
- DELETE: Remove entry

**Related Module:** modules/coop/
**Related Page:** app/dashboard/coop/page.tsx

---

### API Route: /api/cutoff-settings/route.ts

**Location:** `app/api/cutoff-settings/route.ts`

**Endpoints Handled:**

- GET: Fetch cutoff periods
- POST: Create cutoff setting
- PATCH: Update cutoff setting
- DELETE: Remove cutoff setting

**Related Module:** modules/cutoff-settings/
**Related Page:** app/dashboard/cutoff-settings/page.tsx

---

### API Route: /api/payroll/route.ts

**Location:** `app/api/payroll/route.ts`

**Endpoints Handled:**

- GET: Fetch payroll data
- POST: Process payroll
- PATCH: Update payroll
- DELETE: Remove payroll record

**Related Module:** modules/payroll-run/
**Related Pages:**

- app/dashboard/payroll-run/page.tsx
- app/dashboard/payroll-records/page.tsx

---

### API Route: /api/retro/route.ts

**Location:** `app/api/retro/route.ts`

**Endpoints Handled:**

- GET: Fetch retroactive pay records
- POST: Create retro pay
- PATCH: Update retro pay
- DELETE: Remove retro pay

**Related Module:** modules/retro/
**Related Page:** app/dashboard/retro/page.tsx

---

### API Route: /api/wage/route.ts

**Location:** `app/api/wage/route.ts`

**File Size:** 153 lines

**Endpoints Handled:**

- GET: Fetch wage records by employee
- POST: Create/save wage record
- PATCH: Update wage record
- DELETE: Remove wage record

**Query Parameters:**

```
GET ?user_id=number              # Fetch wage for specific user
GET ?department_id=number        # Fetch wages by department
```

**Authentication:**

- Uses `Authorization` header from browser requests
- Falls back to `SERVICE_TOKEN` if no browser auth present
- Supports cookie-based authentication

**Helper Functions:**

```typescript
- joinUrl(base: string, path: string): string
- buildForwardHeaders(req: NextRequest, contentType?: string): Record<string, string>
- parseJsonSafe(res: Response): Promise<any>
```

**External API Endpoints Called:**

```
Directus API:
- /items/wage_record
- /items/employee
- /items/department
- /items/cutoff_settings
```

**Related Module:** modules/wage/
**Related Page:** app/dashboard/wage/page.tsx

---

### API Route: /api/auth/route.ts

**Location:** `app/api/auth/route.ts`

**Endpoints Handled:**

- Authentication-related endpoints
- Login/Logout
- User session management

**Related Page:** app/auth/login/page.tsx

---

## MODULES WITH APP CONNECTIONS

### 1. ADDITIONS-DEDUCTIONS MODULE

**Path:** `modules/additions-deductions/`

### Main Component

- **AdditionsDeductionsModule.tsx** - Main module component handling additions and deductions management

**Connected Dashboard Page:** `app/dashboard/additions-deductions/page.tsx`

- Note: This page contains the full implementation inline (1035 lines), NOT imported from module
- Implementation includes table, dialogs, and all state management
- Alternative: Could be refactored to use AdditionsDeductionsModule component

**Connected API Route:** `app/api/additions-deductions/route.ts`

- Handles GET, POST, PATCH, DELETE for additions/deductions records
- Connects to Directus `/items/addition_deduction_history` endpoint

### Directory Structure

```
additions-deductions/
├── AdditionsDeductionsModule.tsx (Main component)
├── index.ts (Module exports)
├── types.ts (TypeScript types)
├── utils.ts (Utility functions)
├── components/
│   ├── EditModal.tsx
│   └── EmployeeNameInternal.tsx
├── hooks/
│   ├── useAdditions.ts
│   ├── useDeductions.ts
│   └── useUsers.ts
└── providers/
    └── additionsDeductionsApi.ts
```

### Types Defined

```typescript
-User -
  PayrollRecord -
  ActiveTab("additions" | "deductions") -
  Mode("addition" | "deduction") -
  NewRow;
```

### API Functions (additionsDeductionsApi.ts)

```typescript
- fetchJson(url: string)
- getUsers(): Promise<User[]>
- getAdditions(): Promise<PayrollRecord[]>
- getDeductions(): Promise<PayrollRecord[]>
- createRecord(resource: "additions" | "deductions", data: any)
- updateRecord(resource: "additions" | "deductions", id: number, data: any)
- deleteRecord(resource: "additions" | "deductions", id: number)
```

### Key Hooks

```typescript
- useAdditions() - Manage additions data
- useDeductions() - Manage deductions data
- useUsers() - Fetch users list
```

---

## 2. ALLOWANCE MODULE

**Path:** `modules/allowance/`

### Main Component

- **AllowanceModule.tsx** - Allowance management interface

### Directory Structure

```
allowance/
├── AllowanceModule.tsx (Main component)
├── index.tsx (Module exports)
├── types.ts (TypeScript types)
├── components/
│   ├── AllowanceTable.tsx
│   └── AllowanceModal.tsx
├── providers/
│   └── allowanceApi.ts
```

### Types Defined

```typescript
- AllowanceType ("Meals" | "Load" | "Motor Allowance" | "Gas" | "Others")
- User
- Allowance
- AllowanceListParams
- FormRow
- ExtendedParams (extended AllowanceListParams)
```

### API Functions (allowanceApi.ts)

```typescript
- iso(date: Date): string
- formatCurrency(v: string | number): string
- fullnameFromUser(u: User): string
- computeCutoffFromDate(dStr: string): { start: string; end: string }
- getUsers(): Promise<User[]>
- getAllowancesList(params: ExtendedParams): Promise<Allowance[]>
- useAllowancesQuery(params: ExtendedParams): SWR hook
- useUsers(): { users: User[]; loading: boolean }
- createAllowance(data: any): Promise<any>
- updateAllowance(id: number, data: any): Promise<any>
- deleteAllowance(id: number): Promise<any>
```

### Key Components

```typescript
- AllowanceTable - Display allowances in table format
- AllowanceModal - Create/Edit allowance modal
```

---

## 2. ALLOWANCE MODULE

**Path:** `modules/allowance/`

**Connected Dashboard Page:** `app/dashboard/allowance-management/page.tsx`

- Simple router component that imports and renders AllowanceModule
- URL route: `/dashboard/allowance-management`

**Connected API Route:** `app/api/allowance/route.ts`

- Handles GET, POST, PATCH, DELETE for allowance records
- Supports filtering, pagination, and search functionality

---

## 3. BENEFIT-SETTINGS MODULE

**Path:** `modules/benefit-settings/`

### Main Component

- **BenefitSettingsModule.tsx** - Benefits configuration management

**Connected Dashboard Page:** `app/dashboard/benefit-settings/page.tsx`

- Simple router component that imports and renders BenefitSettingsModule
- URL route: `/dashboard/benefit-settings`

**Connected API Route:** `app/api/benefit/route.ts`

- Handles GET, POST, PATCH, DELETE for benefit configuration records
- Connects to Directus `/items/benefit_settings` endpoint

### Directory Structure

```
benefit-settings/
├── BenefitSettingsModule.tsx (Main component)
├── index.ts (Module exports)
├── types.ts (TypeScript types)
├── components/
│   ├── BenefitCard.tsx
│   ├── BenefitCutoff.tsx
│   ├── BenefitDates.tsx
│   └── SaveButton.tsx
└── providers/
    ├── benefitApi.ts
    ├── useBenefitCrud.tsx
    └── useBenefitData.tsx
```

### Types Defined

```typescript
-BenefitCode("SSS" | "PAGIBIG" | "PHILHEALTH") -
  CutoffType("FIRST" | "SECOND" | null) -
  BenefitSetting -
  UserData -
  BenefitSettingRaw;
```

### API Functions (benefitApi.ts)

```typescript
- listBenefits(): Promise<BenefitSetting[]>
- getBenefitById(id: number): Promise<BenefitSetting>
- updateBenefit(id: number, data: Partial<BenefitSetting>): Promise<BenefitSetting>
- deleteBenefit(id: number): Promise<void>
```

### Custom Hooks

```typescript
- useBenefitData() - Manage benefit settings state and data loading
- useBenefitCrud() - Handle CRUD operations for benefits
```

### Key Components

```typescript
- BenefitCard - Display individual benefit card
- BenefitCutoff - Cutoff selection component
- BenefitDates - Effective dates selection
- SaveButton - Save changes button
```

---

## 4. CALENDAR-MANAGEMENT MODULE

**Path:** `modules/calendar-management/`

**Connected Dashboard Page:** `app/dashboard/calendar-management/page.tsx`

- Renders CalendarManagementModule
- URL route: `/dashboard/calendar-management`

**Connected API Route:** `app/api/calendar-management/route.ts`

- Handles GET, POST, PATCH, DELETE for holiday records
- Manages recurring holidays and holiday settings

### Main Component

- **CalendarManagementModule.tsx** - Holiday and calendar management

### Directory Structure

```
calendar-management/
├── CalendarManagementModule.tsx (Main component)
├── index.ts (Module exports)
└── types.ts (TypeScript types)
```

### Types Defined

```typescript
-Holiday - CalendarUser;
```

### Key Features

```typescript
- Holiday management (Create, Edit, Delete)
- Calendar navigation (Month/Year)
- Recurring holidays
- Holiday type classification
- Paid vs Unpaid holidays
- User assignment to holidays
- Search and pagination (5 items per page)
```

### State Management

```typescript
- holidays: Holiday[]
- users: CalendarUser[]
- currentMonth: Date
- selectedDate: Date | undefined
- flashingDate: string | null (animation state)
- modalOpen: boolean
- searchTerm: string
- currentPage: number
```

---

## 5. COOP MODULE

**Path:** `modules/coop/`

**Connected Dashboard Page:** `app/dashboard/coop/page.tsx`

- Renders CoopModule
- URL route: `/dashboard/coop`

**Connected API Route:** `app/api/coop/route.ts`

- Handles GET, POST, PATCH, DELETE for COOP savings and loans records

### Main Component

- **CoopModule.tsx** - COOP (Cooperative) management with Savings and Loans tabs

### Directory Structure

```
coop/
├── CoopModule.tsx (Main component)
├── index.tsx (Module exports)
├── types.ts (TypeScript types)
├── components/
│   ├── SavingsTab.tsx
│   └── LoansTab.tsx
└── providers/
    └── coopApi.ts
```

### Key Features

```typescript
- Tabbed interface (Savings | Loans)
- Savings management
- Loans management
- Dark/Light mode support
```

### Components

```typescript
- SavingsTab - Manage cooperative savings
- LoansTab - Manage cooperative loans
```

---

## 6. CUTOFF-SETTINGS MODULE

**Path:** `modules/cutoff-settings/`

**Connected Dashboard Page:** `app/dashboard/cutoff-settings/page.tsx`

- Renders CutoffSettingsModule
- URL route: `/dashboard/cutoff-settings`

**Connected API Route:** `app/api/cutoff-settings/route.ts`

- Handles GET, POST, PATCH, DELETE for cutoff period configurations

### Main Component

- **CutoffSettingsModule.tsx** - Payroll cutoff period configuration

### Directory Structure

```
cutoff-settings/
├── CutoffSettingsModule.tsx (Main component)
├── index.tsx (Module exports)
├── types.ts (TypeScript types)
├── components/
│   ├── CutoffSettingsTable.tsx
│   └── CutoffSettingsModal.tsx
└── providers/
    └── cutoffSettingsApi.ts
```

### Types Defined

```typescript
- CutoffSettingRow
- PeriodKey { month: number; year: number }
```

### API Functions (cutoffSettingsApi.ts)

```typescript
- computeCurrentPayrollPeriod(date: Date): PeriodKey
- ensureTwoRowsForCurrentPayrollPeriod(rows: CutoffSettingRow[], period: PeriodKey): CutoffSettingRow[]
- periodLabel(period: PeriodKey): string
- upsertCutoffSettings(rows: CutoffSettingRow[]): Promise<any>
- toEditablePayload(row: CutoffSettingRow): any
- getSessionUserId(): string | null
- listUsers(): Promise<any[]>
- makeUserNameMap(users: any[]): Map<string, string>
- getUserDisplayName(userId: string, userMap: Map<string, string>): string
```

### Key Components

```typescript
- CutoffSettingsTable - Display cutoff settings
- CutoffSettingsModal - Edit cutoff settings
```

---

## 7. PAYROLL-RUN MODULE

**Path:** `modules/payroll-run/`

**Connected Dashboard Pages:**

- `app/dashboard/payroll-run/page.tsx` - Main payroll processing wizard
  - URL route: `/dashboard/payroll-run`
  - Renders PayrollRunModule with multi-step workflow
- `app/dashboard/payroll-records/page.tsx` - View historical payroll records
  - URL route: `/dashboard/payroll-records`

**Connected API Route:** `app/api/payroll/route.ts`

- Handles GET, POST, PATCH, DELETE for payroll records
- Processes and stores payroll calculations

### Main Component

- **PayrollRunModule.tsx** - Multi-step payroll processing wizard

### Directory Structure

```
payroll-run/
├── PayrollRunModule.tsx (Main component)
├── index.ts (Module exports)
├── types.ts (TypeScript types)
├── README.md (Module documentation)
├── components/
│   ├── AdjustmentModal.tsx
│   ├── PayrollAdjustStep.tsx
│   ├── PayrollConfigStep.tsx
│   ├── PayrollHeader.tsx
│   ├── PayrollProcessStep.tsx
│   ├── PayrollReviewStep.tsx
│   └── PayrollStepper.tsx
├── providers/
│   └── mockData.ts
└── utils/
    ├── payroll.ts (Payroll calculation utilities)
    └── payroll.test.ts (Unit tests)
```

### Types Defined

```typescript
-EmployeeRow - PayrollConfigState - PayrollStep(1 | 2 | 3 | 4 | 5);
```

### API Functions (utils/payroll.ts)

```typescript
- computePayrollRegister(employees: EmployeeRow[], cutoff: any): any
- parseCutoffValue(value: string): any
```

### Mock Data (providers/mockData.ts)

```typescript
-payrollCutoffs - payrollDepartments - initialEmployees - salaryHistory;
```

### Key Components

```typescript
- PayrollStepper - Step indicator
- PayrollConfigStep - Configuration step (Step 1)
- PayrollAdjustStep - Adjustments step (Step 2)
- PayrollProcessStep - Processing step (Step 3)
- PayrollReviewStep - Review step (Step 4)
- AdjustmentModal - Modal for adjustments
- PayrollHeader - Header component
```

### Workflow Steps

```typescript
Step 1: Configuration (Select Cutoff & Department)
Step 2: Adjustments (Add/Modify adjustments)
Step 3: Processing (Process payroll)
Step 4: Review (Review results)
Step 5: Finalize (Confirm)
```

---

## 8. RETRO MODULE

**Path:** `modules/retro/`

**Connected Dashboard Page:** `app/dashboard/retro/page.tsx`

- Renders RetroModule
- URL route: `/dashboard/retro`

**Connected API Route:** `app/api/retro/route.ts`

- Handles GET, POST, PATCH, DELETE for retroactive pay records

### Main Component

- **RetroModule.tsx** - Retroactive pay management

### Directory Structure

```
retro/
├── RetroModule.tsx (Main component)
├── index.ts (Module exports)
├── types.ts (TypeScript types)
├── components/
│   ├── RetroTable.tsx
│   └── RetroModal.tsx
└── providers/
    └── retroApi.ts
```

### Types Defined

```typescript
- Employee
- RetroPayFromApi
- RetroFormState
- SortConfig { key: string; order: "asc" | "desc" }
```

### API Functions (retroApi.ts)

```typescript
- fetchEmployees(): Promise<Employee[]>
- fetchRetroPays(): Promise<RetroPayFromApi[]>
- createRetro(data: any): Promise<any>
- updateRetro(id: number, data: any): Promise<any>
- deleteRetro(id: number): Promise<void>
```

### Key Features

```typescript
- Search functionality
- Sorting (by cutoff_start, employee name, etc.)
- Pagination (5 items per page)
- Create/Edit/Delete retro pays
- Data refresh capability
```

### Key Components

```typescript
- RetroTable - Display retro pays
- RetroModal - Create/Edit retro modal
```

### State Management

```typescript
- retroPays: RetroPayFromApi[]
- employees: Employee[]
- isLoading: boolean
- isRefreshing: boolean
- dialogOpen: boolean
- isEditing: boolean
- editingId: number | null
- searchTerm: string
- rowsPerPage: number
- currentPage: number
- sortConfig: SortConfig
```

---

## 9. WAGE MODULE

**Path:** `modules/wage/`

**Connected Dashboard Page:** `app/dashboard/wage/page.tsx`

- Simple router component that imports and renders WageModule
- URL route: `/dashboard/wage`
- Implementation: `import { WageModule } from "@/modules/wage/WageModule"`

**Connected API Route:** `app/api/wage/route.ts`

- Handles GET, POST, PATCH, DELETE for employee wage records
- Supports department-based filtering and employee wage updates
- Features: Token-based authorization, service token fallback, cookie support

### Main Component

- **WageModule.tsx** - Employee wage management

### Directory Structure

```
wage/
├── WageModule.tsx (Main component)
├── index.tsx (Module exports)
├── types.ts (TypeScript types)
├── components/
│   ├── EmployeeTable.tsx
│   ├── PasswordDialog.tsx
│   └── WageModal.tsx
└── providers/
    └── wageApi.ts
```

### Types Defined

```typescript
- Department { department_id: number; department_name: string }
- Employee { user_id: number; user_fname: string; user_lname: string; user_department: number | null }
- WagePayload { user_id, daily_wage, vacation_leave_per_year, sick_leave_per_year, paid_holiday, isCard, sss/pagibig/philhealth_contribution_monthly, updated_by }
- WageRecord (Record format with optional fields)
- WageDataState (UI state representation)
- WageProrationLogPayload { user_id, previous_daily_wage, new_daily_wage, effective_date, cutoff_id, updated_by }
- CutoffSetting { id, cutoff_type, start_date, end_date }
```

### API Functions (wageApi.ts)

```typescript
- getDepartments(): Promise<Department[]>
- getEmployeesByDepartment(deptId: number): Promise<Employee[]>
- getWageRecord(userId: number): Promise<WageRecord | null>
- updateWageRecord(payload: WagePayload): Promise<any>
- logWageProration(payload: WageProrationLogPayload): Promise<any>
- getCutoffSettings(): Promise<CutoffSetting[]>
```

### Key Features

```typescript
- Department selection
- Employee wage management
- Daily wage tracking
- Leave management (vacation & sick)
- Paid holiday setting
- Bank card flag
- Contribution deductions (SSS, PAGIBIG, PhilHealth)
- Wage proration logging
- Password verification for updates
- Sort and pagination
```

### Key Components

```typescript
- EmployeeTable - Display employees with wages
- WageModal - Create/Edit wage record
- PasswordDialog - Password verification dialog
```

### State Management

```typescript
- departments: Department[]
- selectedDept: number | null
- employees: Employee[]
- modalOpen: boolean
- selectedEmployee: Employee | null
- passwordDialogOpen: boolean
- searchTerm: string
- loading: boolean
- refreshKey: number
- sortField: keyof Employee
- sortOrder: "asc" | "desc"
- currentPage: number
- rowsPerPage: number
- previousDailyWage: number | null
```

---

## 10. AUTH MODULE (LEGACY)

**Path:** `modules/auth/`

**Connected Dashboard Page:** `app/auth/login/page.tsx`

- Login interface
- URL route: `/auth/login`

**Connected API Route:** `app/api/auth/route.ts`

- Handles authentication, login/logout, session management

### Directory Structure

```
auth/
└── login/
    └── (Login related components)
```

---

## 11. CUTOFF MODULE (EMPTY)

**Path:** `modules/cutoff/`

Currently empty - reserved for future use

## COMMON PATTERNS

### API Structure

All modules follow a pattern:

```
Module/
├── [ModuleName]Module.tsx (Main component)
├── index.ts/tsx (Exports)
├── types.ts (TypeScript definitions)
├── components/ (React components)
├── providers/ (API & custom hooks)
├── hooks/ (Custom React hooks) [optional]
└── utils/ (Utility functions) [optional]
```

### Import Patterns

```typescript
// Types
import type { TypeName } from "./types";

// API & Hooks
import { functionName } from "./providers/api";
import { customHook } from "./providers/hooks";

// Components
import { ComponentName } from "./components/ComponentName";

// UI Components
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/layout/DashboardLayout";

// Libraries
import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Icon } from "lucide-react";
```

### Component Pattern

Most modules:

1. Fetch data via API/custom hooks
2. Manage state (pagination, filters, sorting)
3. Render DashboardLayout wrapper
4. Display table/list with CRUD modals
5. Handle toast notifications for success/error

### Utility Functions Commonly Used

```typescript
- formatCurrency(value: number | string): string
- fullname/fullnameFromUser(user: User): string
- iso(date: Date): string (YYYY-MM-DD format)
- computeCutoff*(): { start: string; end: string }
```

---

## INTEGRATION NOTES

### API Endpoints

- `GET /api/additions-deductions?resource=users|additions|deductions`
- `POST /api/additions-deductions` (Create)
- `PATCH /api/additions-deductions` (Update)
- `DELETE /api/additions-deductions` (Delete)

- `GET /api/allowance?mode=users`
- `GET /api/allowance?limit=&offset=&meta=filter_count`

- `GET /api/benefit` (List benefits)
- `GET /api/wage` (Wage records)
- `GET /api/cutoff-settings` (Cutoff periods)

### Authentication

- Session-based via `sessionStorage`
- User ID retrieval: `getCurrentUserIdFromSessionStorage()`
- Protected routes via `useAuthGuard()` hook

### Notifications

- Uses `sonner` toast library
- Success: `toast.success(message)`
- Error: `toast.error(message)`

### Data Fetching

- Primary: Custom fetch functions
- Secondary: SWR hooks for data fetching & caching
- Mutation: `mutate()` from SWR for cache updates

---

## INTERCONNECTION FLOW & ARCHITECTURE

### Request Flow Diagram

```
User Browser
    ↓
[Frontend Page]
  (app/dashboard/[module]/page.tsx)
    ↓
[Module Component]
  (modules/[module]/[Module]Module.tsx)
    ↓
[Provider/API Function]
  (modules/[module]/providers/[module]Api.ts)
    ↓ HTTP Request
[NextJS API Route]
  (app/api/[module]/route.ts)
    ↓
[External API]
  (Directus Backend)
    ↓
[Database]
```

### Module-to-Page Mapping

| Module               | Dashboard Page                | URL Route                         | API Route                   | Implementation           |
| -------------------- | ----------------------------- | --------------------------------- | --------------------------- | ------------------------ |
| additions-deductions | additions-deductions/page.tsx | `/dashboard/additions-deductions` | `/api/additions-deductions` | Inline (1035 lines)      |
| allowance            | allowance-management/page.tsx | `/dashboard/allowance-management` | `/api/allowance`            | AllowanceModule          |
| benefit-settings     | benefit-settings/page.tsx     | `/dashboard/benefit-settings`     | `/api/benefit`              | BenefitSettingsModule    |
| calendar-management  | calendar-management/page.tsx  | `/dashboard/calendar-management`  | `/api/calendar-management`  | CalendarManagementModule |
| coop                 | coop/page.tsx                 | `/dashboard/coop`                 | `/api/coop`                 | CoopModule               |
| cutoff-settings      | cutoff-settings/page.tsx      | `/dashboard/cutoff-settings`      | `/api/cutoff-settings`      | CutoffSettingsModule     |
| payroll-run          | payroll-run/page.tsx          | `/dashboard/payroll-run`          | `/api/payroll`              | PayrollRunModule         |
| payroll-records      | payroll-records/page.tsx      | `/dashboard/payroll-records`      | `/api/payroll`              | Payroll records view     |
| retro                | retro/page.tsx                | `/dashboard/retro`                | `/api/retro`                | RetroModule              |
| wage                 | wage/page.tsx                 | `/dashboard/wage`                 | `/api/wage`                 | WageModule               |
| auth                 | login/page.tsx                | `/auth/login`                     | `/api/auth`                 | Login page               |

### API Route Structure Pattern

Each API route (`app/api/[module]/route.ts`) typically:

1. **Exports configuration:**

   - `runtime = "nodejs"` - Runs on Node.js runtime
   - `dynamic = "force-dynamic"` - Forces dynamic rendering (no caching)

2. **Exports handler functions:**

   - `export async function GET(req: NextRequest)` - Fetch data
   - `export async function POST(req: NextRequest)` - Create data
   - `export async function PATCH(req: NextRequest)` - Update data
   - `export async function DELETE(req: NextRequest)` - Delete data

3. **Uses environment variables:**

   - `API_BASE` / `DIRECTUS_URL` - Backend API endpoint
   - `DIRECTUS_TOKEN` / `DIRECTUS_SERVICE_TOKEN` - Authentication token
   - Falls back to `NEXT_PUBLIC_DIRECTUS_URL` if needed

4. **Calls Directus endpoints:**
   - `/items/[collection_name]` - CRUD operations
   - Passes headers with Authorization: Bearer token
   - Handles response parsing and error management

### Provider Pattern

Each `modules/[module]/providers/[module]Api.ts` typically:

1. **Defines types** - TypeScript interfaces for data
2. **Utility functions** - Format, compute, transform data
3. **Fetch functions** - Call `/api/[module]` routes
4. **SWR hooks** - Cache and refetch data (useXQuery hooks)
5. **CRUD operations** - createX, updateX, deleteX functions

Example:

```typescript
// Utility
export function formatCurrency(value: number): string { ... }

// Fetch
async function fetchUsers(): Promise<User[]> { ... }

// Hook
export function useUsersQuery() { return useSWR(...) }

// CRUD
export async function createUser(data: User): Promise<User> { ... }
export async function updateUser(id: number, data: Partial<User>): Promise<User> { ... }
export async function deleteUser(id: number): Promise<void> { ... }
```

### Component Pattern

Each `modules/[module]/[Module]Module.tsx` typically:

1. **Uses client directive** - `"use client"` for client-side interactivity
2. **Imports from providers** - Hooks and CRUD functions
3. **Manages state** - Filters, pagination, sorting, modals
4. **Fetches data** - Calls hooks from providers
5. **Renders with DashboardLayout** - Wraps in dashboard template
6. **Shows tables/lists** - Displays data with edit/delete actions
7. **Modals for CRUD** - Create/edit/confirm dialogs
8. **Toast notifications** - Success/error feedback (sonner)

### Session & Authentication

- **Storage:** SessionStorage (browser)
- **User ID retrieval:** `getCurrentUserIdFromSessionStorage()`
- **Protected:** `useAuthGuard()` hook in components
- **Token:** Authorization header with Bearer token in API requests

### Error Handling

- **API errors:** Try/catch with JSON parsing
- **Toast notifications:** Success/error messages to user
- **SWR mutation:** `mutate()` to refresh cache after operations
- **Fallback values:** Default data if fetch fails

---

## FILE SIZES & COMPLEXITY

### Large Component Files

- `app/dashboard/additions-deductions/page.tsx` - 1035 lines (inline implementation)
- `modules/calendar-management/CalendarManagementModule.tsx` - 846 lines
- `modules/wage/WageModule.tsx` - 391 lines
- `modules/retro/RetroModule.tsx` - 388 lines
- `modules/additions-deductions/AdditionsDeductionsModule.tsx` - 765 lines

### API Route Files

- `app/api/additions-deductions/route.ts` - 281 lines
- `app/api/wage/route.ts` - 153 lines
- Others typically 50-150 lines

### Provider Files

- `modules/allowance/providers/allowanceApi.ts` - 195 lines
- Most providers 50-200 lines

---

## REFACTORING OPPORTUNITY

**additions-deductions module:**

- Currently: Full implementation in `app/dashboard/additions-deductions/page.tsx` (1035 lines)
- Could be refactored: Move logic to `modules/additions-deductions/AdditionsDeductionsModule.tsx`
- Benefit: Consistency with other modules, code reuse, maintainability

Current situation shows this module has both:

1. A module component at `modules/additions-deductions/`
2. A full implementation at `app/dashboard/additions-deductions/page.tsx`

These should be consolidated to use the module component instead.

---

**Generated:** January 2026
**Framework:** Next.js 14+ with App Router
**UI Library:** React + shadcn/ui + Tailwind CSS
**API:** Directus CMS Backend
**State Management:** SWR + React hooks
**Authentication:** Session-based with Bearer tokens
