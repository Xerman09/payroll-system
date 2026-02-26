---
description: Analysis of Calendar Management Module (Settings, Logic, and DDLs)
---
# Calendar Management Module Analysis

## 1. Module Overview
**Path**: `modules/calendar-management`
**Entry Point**: `CalendarManagementModule.tsx`
**API Proxy**: `app/api/calendar-management/route.ts`

The Calendar Management module handles company holidays, special events, and non-working days. It provides a visual calendar for scheduling and a list view for management. These holidays are consumed by the payroll engine to calculate premium pay.

## 2. Logic & Flow

### Data Fetching & Proxying
- **Client Side**: `CalendarManagementModule` currently uses mock data for display but is designed to interact with the backend API.
- **Backend Side**: The system uses a proxy pattern in `app/api/calendar-management/route.ts`. It forwards requests to an upstream **Directus** instance.
- **Resources**: It manages two main resources: `holidays` and `users`.

### Logic Flows
1. **Management**: Users can Add, Edit, and Delete holidays via the UI. These actions are proxied to the upstream API.
2. **Payroll Integration**: 
   - During a payroll run, the system fetches all holidays within the cutoff period.
   - The `normHoliday` function in `compute.ts` standardizes the holiday data for the calculation engine.
   - **Multipliers** are applied based on the holiday type:
     - **Regular Holiday**: 2.0x base rate.
     - **Special Holiday**: 1.3x base rate.
     - **Special + Rest Day**: 1.5x base rate.
     - **Regular + Rest Day**: 2.6x base rate.

## 3. Database DDLs (Inferred Schema)

Based on the `Holiday` interface and API proxy, the underlying collection (likely in Directus/MySQL) follows this structure:

```sql
-- Actual Holiday Calendar Table
CREATE TABLE `holiday_calendar` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `holiday_date` date NOT NULL,
  `cutoff_setting_id` bigint unsigned DEFAULT NULL,
  `last_working_day` date DEFAULT NULL,
  `description` varchar(255) NOT NULL,
  `holiday_type` enum('regular','special','company') NOT NULL DEFAULT 'regular',
  `is_recurring` tinyint(1) NOT NULL DEFAULT '1',
  `is_paid` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` int DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_holiday_date_type` (`holiday_date`,`holiday_type`),
  KEY `fk_holiday_calendar_cutoff_setting` (`cutoff_setting_id`),
  CONSTRAINT `fk_holiday_calendar_cutoff_setting` FOREIGN KEY (`cutoff_setting_id`) REFERENCES `cutoff_settings` (`id`)
) ENGINE=InnoDB;

-- User Table (Reference for Author)
CREATE TABLE `user` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `user_email` varchar(255) COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `user_fname` varchar(255) COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `user_lname` varchar(255) COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `user_position` varchar(255) COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `user_dateOfHire` date NOT NULL,
  `isAdmin` tinyint(1) NOT NULL DEFAULT '0',
  `role` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'USER',
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## 4. Key Functions & Files

| Component / Utility | Description |
| :--- | :--- |
| `CalendarManagementModule.tsx` | Main UI component with Calendar and List views. |
| `route.ts` (API) | Proxy handler for GET, POST, PATCH, DELETE to upstream Directus. |
| `compute.ts` (`normHoliday`) | Normalizes holiday data for payroll calculations. |
| `compute.ts` (`getDayMultipliers`) | Applies the correct pay multipliers based on holiday flags. |
| `types.ts` | Defines the `Holiday` and `CalendarUser` interfaces. |
