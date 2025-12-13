# Rearrange Additions-Deductions UI to Match Allowance Module

## Steps to Complete

1. **Create SWR Hooks for Data Fetching**

   - Add useAdditions and useDeductions hooks similar to useAllowances
   - Import SWR and create fetcher functions for additions and deductions APIs

2. **Update Component Imports and State**

   - Import necessary components from allowance module (Dialog, Select, etc.)
   - Replace useState for data with SWR hooks
   - Add search/filter state: searchName, searchDescription

3. **Restructure Each Tab's UI**

   - Change from simple div to Card with CardHeader (title + add button) and CardContent
   - Add filter bar with search inputs and reset/refresh buttons
   - Update table structure to match allowance columns
   - Add pagination controls matching allowance style

4. **Update Modals to Use Dialog Components**

   - Replace custom modal divs with Dialog, DialogContent, etc.
   - Update add modal to match allowance: employee select, date picker with cutoff preview, multiple rows grid, submission preview
   - Update edit modal to simple dialog form

5. **Implement Employee Search in Modal**

   - Add employee search state and debounced query
   - Use Select component for employee selection in modal

6. **Update CRUD Operations**

   - Modify create, update, delete functions to use mutate for SWR revalidation
   - Update error handling and alerts

7. **Add User Cache and Helper Functions**

   - Implement user cache for created_by display
   - Add fullname and formatCurrency helpers

8. **Test and Refine**
   - Ensure pagination, filtering, and modals work correctly
   - Verify API calls and data consistency
