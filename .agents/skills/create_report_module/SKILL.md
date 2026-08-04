---
name: create_report_module
description: Standardized pattern for creating new report modules, including API, frontend UI, and sidebar navigation, based on the Leave Report template.
---

# Instructions

When you are asked to create a new report module, you MUST strictly follow this established architecture pattern to ensure consistency across the application. 

### 1. Backend API (`app/api/reports/<report_name>/route.ts`)
- Implement a `GET` endpoint.
- Always use `directusFetch` accompanied by `resolveApiConfig()` and `buildForwardHeaders()` for API calls to Directus.
- Do **not** rely on deep relational nesting fields in Directus if they are unreliable. Instead, fetch the primary records (e.g., `leave_request`) and separately fetch related records (e.g., `user`, `department`). Map them together securely on the server-side before sending the response.
- Use the standard `json(payload, companyName)` helper structure to return `{ data: mappedData, meta: { companyName } }`.

### 2. Frontend Page (`app/reports/<report_name>/[userId]/page.tsx`)
- Keep the page component lightweight. 
- You MUST wrap the inner module component with `<DashboardLayout>` so that the Sidebar and Navigation bar are correctly rendered.
Example:
```tsx
export default function ExampleReportPage() {
  return (
    <DashboardLayout>
      <ExampleReportModule />
    </DashboardLayout>
  );
}
```

### 3. Frontend Module (`modules/reports/<report_name>/<Name>ReportModule.tsx`)
- Build the report UI using standard Shadcn components (`Card`, `CardContent`, `Input`, `Select`, `Separator`).
- Use standard HTML tables styled with Tailwind for data presentation instead of complex datagrid libraries unless specified.
- The module must be a Client Component (`"use client";`).
- **Filters**: Implement local state filtering using `useMemo`. Include:
  - A text `Search` input for broad text filtering (e.g., searching by employee name).
  - `Select` dropdowns for categorical data filtering (e.g., Department, Status).
- **Loading State**: Show a loading indicator (`Loader2` from `lucide-react`) within the table body while data is being fetched.
- Ensure empty states are gracefully handled when no data matches the filters.

### 4. Sidebar Navigation (`components/layout/Sidebar.tsx`)
- Add the new report to the Sidebar.
- Place it as a `subItem` underneath the existing **Reports** module. 
- Example format:
```tsx
{
  title: "Reports",
  href: "#",
  icon: <FileText size={18} />,
  subItems: [
    {
      title: "Leave Report",
      href: `/reports/leave/${userId}`,
    },
    {
      title: "New Report",
      href: `/reports/new/${userId}`,
    }
  ]
}
```
