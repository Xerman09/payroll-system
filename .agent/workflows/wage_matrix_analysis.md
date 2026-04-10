# Wage Matrix Module Analysis

## Overview
The **Wage Matrix Module** (`/modules/wage-matrix`) provides an interface to configure geographical logistics salary matrices for employees. It acts as an interactive spreadsheet for inputting and dynamically managing predetermined payroll amounts for different Area configurations, Vehicle Types, and Staff Roles (Drivers, Helpers, Logistics Crew).

## Flow
1. **Initialization (`loadData`)**:
   - The React module calls `fetchWageMatrixData()` via the frontend API provider.
   - It retrieves 4 arrays from the backend:
     - `areas` (Logistics Areas)
     - `staff` (Logistics Staff details: Helpers, Crew)
     - `vehicleTypes` (All valid vehicles)
     - `matrix` (Existing Salary Matrix values)
   - Dynamic columns are generated (filtering `vehicleTypes` where `is_payroll` is true for Drivers, and hard-coding roles for Helpers and Logistics Crew).
   - An internal key-value draft state (`{areaId}_{colKey}: value`) is constructed by matching `matrix` values against generated columns.
   - Any previously unsaved changes are fetched from `localStorage` (`wage_matrix_draft_v2`) and merged into the draft.
2. **Interaction**:
   - The user inputs amounts inside `WageMatrixTable` inputs.
   - Changes update the `draft` state (`handleInputChange`).
   - The `draft` is continuously cached into `localStorage` enabling auto-save protection.
3. **Save Action (`handleSave`)**:
   - The application computes a diff between the current `draft` state and the previously loaded `matrix` array.
   - Unmodified items are ignored.
   - Modified items (existing via direct ID match) are pushed into an `updates` array.
   - Newly created values are pushed into a `creates` array.
   - It fires `patchWageMatrixBulk(updates)` for modifications and `upsertWageMatrix(creates)` for insertions simultaneously using `Promise.all`.
   - On success, `localStorage` is cleared, `lastUpdated` is set, and data is freshly re-fetched.

## Core Logic and Mapping
- **Dynamic Columns**: Driver columns are automatically injected horizontally based on DB rows of Vehicle Types explicitly marked for payroll. Helpers and Logistic Crew roles fallbacks are systematically appended to this column mapping via `columns` useMemo.
- **Cell Indexing (`{areaId}_{colKey}`)**: Data mappings are converted to flat O(1) lookups string keys for optimized updates matching rather than deep object trees.
- **Group Splitting (`areasByMode`)**: The interface dynamically splits the UI into categorized Tables filtering the Areas by `mode_type` (`DELIVERY`, `PICKUP ONLY`, `PICKUP W/ MP DELIVERY`), generating isolated sections.
- **Filtering**: Real-time filtering leverages `searchTerm` state passing it through components. If the string isolates data out of sight, `WageMatrixEmptyState` takes over.

## Database Entanglements
- Reads from `payroll_logistics_area`, `payroll_logistics_staff`, `vehicle_type`, `payroll_logistics_salary_matrix`.
- Writes individually tracked matrix records specifically identifying: `area_id`, `staff_id`, `vehicle_type_id`, and `wage_amount`.
- Data passes seamlessly directly to [Directus headless endpoints] through the `app/api/wage-matrix/route.ts` bridging.

## Related Functions
1. `fetchWageMatrixData`: GET array aggregator inside `providers/wage-matrixApi.ts`.
2. `getVehicleTypeId` / `vehicleTypeMap`: Optimizes vehicle ID resolutions avoiding multiple nested array lookups during the save routine.
3. `staffByColumn`: Associates specific UI columns correctly mapped with Staff ID from backend matching `employment_type` and `role`.
