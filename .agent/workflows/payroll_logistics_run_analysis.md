# Logistics Payroll Run — Reference Sheet

> Last updated: 2026-04-27
> Status: DISCUSSION PHASE — Do not execute until workflow is finalized.

---

## APIs & Table DDLs

### 1. `payroll_logistics_area`
**API:** `http://goatedcodoer:8056/items/payroll_logistics_area`

```sql
CREATE TABLE `payroll_logistics_area` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `area_id` bigint unsigned NOT NULL,
  `area_name` varchar(200) NOT NULL,
  `max_days` smallint unsigned DEFAULT NULL,
  `mode_type` enum('DELIVERY','PICKUP ONLY','PICKUP W/ MP DELIVERY') DEFAULT NULL,
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_area_id` (`area_id`),
  KEY `idx_area_name` (`area_name`)
);
```

**Key fields:** `area_id` (natural key), `area_name`, `max_days`, `mode_type`

---

### 2. `payroll_logistics_location`
**API:** `http://goatedcodoer:8056/items/payroll_logistics_location`

```sql
CREATE TABLE `payroll_logistics_location` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `location_id` bigint unsigned NOT NULL,
  `area_id` bigint unsigned NOT NULL,
  `location` varchar(220) NOT NULL,       -- matches customer.city
  `distance` int unsigned DEFAULT NULL,
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_location_id` (`location_id`),
  KEY `fk_loc_area` (`area_id`),
  CONSTRAINT `fk_loc_area` FOREIGN KEY (`area_id`) REFERENCES `payroll_logistics_area` (`area_id`)
);
```

**Key fields:** `location_id`, `area_id`, `location` (city name — used for JOIN with `customer.city`)

---

### 3. `payroll_logistics_salary_matrix`
**API:** `http://goatedcodoer:8056/items/payroll_logistics_salary_matrix`

```sql
CREATE TABLE `payroll_logistics_salary_matrix` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `area_id` bigint unsigned NOT NULL,
  `staff_id` bigint unsigned NOT NULL,
  `vehicle_type_id` int DEFAULT NULL,
  `wage_amount` decimal(12,2) NOT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT (now(3)),
  `updated_by` bigint unsigned DEFAULT NULL,
  `updated_at` datetime(3) DEFAULT (now(3)) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_salary_matrix_unique` (`area_id`,`staff_id`,`vehicle_type_id`),
  CONSTRAINT `fk_mat_area` FOREIGN KEY (`area_id`) REFERENCES `payroll_logistics_area` (`area_id`),
  CONSTRAINT `fk_mat_staff` FOREIGN KEY (`staff_id`) REFERENCES `payroll_logistics_staff` (`staff_id`),
  CONSTRAINT `fk_mat_vehicle` FOREIGN KEY (`vehicle_type_id`) REFERENCES `vehicle_type` (`id`)
);
```

**Key fields:** composite unique key `(area_id, staff_id, vehicle_type_id)` → `wage_amount`
**Logic:** wage lookup = area + who the staff is + what vehicle type they used

---

### 4. `payroll_logistics_staff`
**API:** `http://goatedcodoer:8056/items/payroll_logistics_staff`

```sql
CREATE TABLE `payroll_logistics_staff` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `staff_id` bigint unsigned NOT NULL,      -- maps to user.user_id
  `role` enum('Driver','Helper') NOT NULL,
  `employment_type` enum('EXTRA','PROBATIONARY','REGULAR(<10W)','REGULAR(10W/T)') DEFAULT NULL,
  `vehicle_type_id` int DEFAULT NULL,
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_staff_id` (`staff_id`),
  CONSTRAINT `fk_staff_vehicle` FOREIGN KEY (`vehicle_type_id`) REFERENCES `vehicle_type` (`id`)
);
```

**Key fields:** `staff_id` (= `user.user_id`), `role`, `employment_type`, `vehicle_type_id`

---

### 5. `vehicles`
**API:** `http://goatedcodoer:8056/items/vehicles`

```sql
-- Key fields relevant to payroll:
`vehicle_id`, `vehicle_type` (FK → vehicle_type.id), `vehicle_plate`, `name`
```

---

### 6. `post_dispatch_plan`
**API:** `http://goatedcodoer:8056/items/post_dispatch_plan`

```sql
-- Main dispatch document
`id`, `doc_no`, `driver_id`, `vehicle_id`, `status`
-- Statuses relevant to payroll: 'For Clearance', 'Posted'
`time_of_dispatch`, `time_of_arrival`
```

---

### 7. `post_dispatch_invoices`
**API:** `http://goatedcodoer:8056/items/post_dispatch_invoices`

```sql
`id`, `post_dispatch_plan_id`, `invoice_id`, `distance`, `status`
-- Delivery status: 'Fulfilled','Fulfilled With Returns','Not Fulfilled','Fulfilled With Concerns'
```

---

### 8. `post_dispatch_plan_staff`
**API:** `http://goatedcodoer:8056/items/post_dispatch_plan_staff`

```sql
`id`, `post_dispatch_plan_id`, `user_id`, `role` (Driver/Helper), `is_present` (0/1)
```

---

### 9. `sales_invoice`
**API:** `http://goatedcodoer:8056/items/sales_invoice`

```sql
-- Key fields:
`invoice_id`, `order_id` (→ sales_order.order_no), `customer_code`,
`invoice_no`, `total_amount`, `invoice_date`, `dispatch_date`
```

---

### 10. `customer`
**API:** `http://goatedcodoer:8056/items/customer`

```sql
-- Key fields:
`customer_code`, `customer_name`, `store_name`, `brgy`, `city`, `province`
-- city is used to match payroll_logistics_location.location
```

---

### 11. `sales_order`
**API:** `http://goatedcodoer:8056/items/sales_order`

```sql
-- Key fields:
`order_id`, `order_no` (matched via sales_invoice.order_id), `customer_code`
```

---

### 12. `user`
**API:** `http://goatedcodoer:8056/items/user`

```sql
-- Key fields:
`user_id`, `user_fname`, `user_mname`, `user_lname`
-- Used for staff name resolution
```

---

## View Tables

### `view_post_dispatch_plan_staff_attendance`
Intermediate view — joins dispatches with staff attendance and invoice/customer details.

**Filter:** `pdp.status IN ('For Clearance', 'Posted')` AND `pdps.is_present = 1`

**Outputs:**
- `dispatch_plan_id`, `dispatch_doc_no`, `dispatch_status`
- `time_of_dispatch`, `time_of_arrival`
- `staff_user_id`, `staff_name`, `staff_role`, `staff_attendance_status`
- `vehicle_id`
- `invoice_id`, `invoice_no`, `total_amount`, `sales_order_no`
- `customer_code`, `customer_name`, `store_name`, `brgy`, `city`, `province`

---

### `view_logistics_payroll` ← **MAIN VIEW**
**API:** `http://goatedcodoer:8056/items/view_logistics_payroll`

Extends `view_post_dispatch_plan_staff_attendance` by resolving:
- Vehicle type via `vehicles.vehicle_type`
- Location/area via `payroll_logistics_location` (matched on `city collate utf8mb4_general_ci = location`)
- Area name + mode_type via `payroll_logistics_area`
- Wage amount via `payroll_logistics_salary_matrix` (area + staff + vehicle_type)

**Final Output Columns:**
| Column | Source |
|---|---|
| `dispatch_plan_id` | post_dispatch_plan |
| `dispatch_doc_no` | post_dispatch_plan |
| `dispatch_status` | post_dispatch_plan |
| `time_of_dispatch` | post_dispatch_plan |
| `time_of_arrival` | post_dispatch_plan |
| `staff_user_id` | post_dispatch_plan_staff |
| `staff_name` | user (concatenated) |
| `staff_role` | post_dispatch_plan_staff |
| `staff_attendance_status` | derived (Present/Absent) |
| `vehicle_id` | vehicles |
| `vehicle_type` | vehicles |
| `customer_code` | customer |
| `customer_name` | customer |
| `store_name` | customer |
| `customer_city` | customer.city |
| `customer_province` | customer.province |
| `location_id` | payroll_logistics_location |
| `matched_location` | payroll_logistics_location.location |
| `area_id` | payroll_logistics_area |
| `area_name` | payroll_logistics_area |
| `mode_type` | payroll_logistics_area |
| `wage_amount` | payroll_logistics_salary_matrix |

---

## Data Flow Diagram

```
post_dispatch_plan (status: For Clearance / Posted)
    │
    ├── post_dispatch_plan_staff (is_present = 1)
    │       └── user (staff_name)
    │
    └── post_dispatch_invoices
            └── sales_invoice
                    └── customer (city → location match)
                            └── payroll_logistics_location
                                    └── payroll_logistics_area
                                            └── payroll_logistics_salary_matrix
                                                    (area_id + staff_id + vehicle_type_id → wage_amount)
```

---

## Open Questions / To Discuss
- [ ] What is the payroll run scope? (date range? cutoff period?)
- [ ] Is wage_amount per trip (dispatch) or per day?
- [ ] How are multiple invoices in a single dispatch handled for wage calc?
- [ ] Are there deductions, allowances, or bonuses on top of wage_amount?
- [ ] What happens if wage_amount is NULL (unmatched area/vehicle/staff)?
- [ ] What are the payroll run output tables? (new table needed?)
- [ ] Approval workflow for the payroll run?
- [ ] How does `max_days` on `payroll_logistics_area` factor in?
- [ ] Can a staff member appear in multiple dispatch plans in the same period?
