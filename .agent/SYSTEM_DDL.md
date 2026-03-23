
--------------------------------------------------------------------------------------------------------


CREATE TABLE `attendance_approval` (
	`approval_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	`employee_id` BIGINT UNSIGNED NOT NULL DEFAULT '0',
	`date_schedule` DATE NOT NULL DEFAULT '1970-01-01',
	`approved_by` INT NOT NULL,
	`approved_at` DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`work_minutes` INT NOT NULL DEFAULT '0',
	`late_minutes` INT NOT NULL DEFAULT '0',
	`undertime_minutes` INT NOT NULL DEFAULT '0',
	`overtime_minutes` INT NOT NULL DEFAULT '0',
	`remarks` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`status` ENUM('approved','rejected') NOT NULL DEFAULT 'approved' COLLATE 'utf8mb4_0900_ai_ci',
	PRIMARY KEY (`approval_id`) USING BTREE
)
COLLATE='utf8mb4_0900_ai_ci'
ENGINE=InnoDB
AUTO_INCREMENT=282
;




--------------------------------------------------------------------------------------------------------


CREATE TABLE `attendance_log` (
	`log_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	`user_id` INT NOT NULL,
	`department_id` INT NOT NULL,
	`log_date` DATE NOT NULL,
	`time_in` DATETIME NULL DEFAULT NULL,
	`lunch_start` DATETIME NULL DEFAULT NULL,
	`lunch_end` DATETIME NULL DEFAULT NULL,
	`break_start` DATETIME NULL DEFAULT NULL,
	`break_end` DATETIME NULL DEFAULT NULL,
	`time_out` DATETIME NULL DEFAULT NULL,
	`image_time_in` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`image_time_out` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`status` ENUM('On Time','Late','Absent','Half Day','Incomplete','Leave','Holiday') NULL DEFAULT 'On Time' COLLATE 'utf8mb4_0900_ai_ci',
	`created_at` TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP) ON UPDATE CURRENT_TIMESTAMP,
	`approval_status` ENUM('pending','approved','rejected') NULL DEFAULT 'pending' COLLATE 'utf8mb4_0900_ai_ci',
	PRIMARY KEY (`log_id`) USING BTREE,
	UNIQUE INDEX `uq_user_date` (`user_id`, `log_date`) USING BTREE,
	INDEX `idx_att_user` (`user_id`) USING BTREE,
	INDEX `idx_att_dept_date` (`department_id`, `log_date`) USING BTREE,
	CONSTRAINT `fk_att_department` FOREIGN KEY (`department_id`) REFERENCES `department` (`department_id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
	CONSTRAINT `fk_att_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON UPDATE NO ACTION ON DELETE NO ACTION
)
COLLATE='utf8mb4_0900_ai_ci'
ENGINE=InnoDB
AUTO_INCREMENT=4195301796
;



--------------------------------------------------------------------------------------------------------


CREATE TABLE `bank_names` (
	`id` INT NOT NULL AUTO_INCREMENT,
	`bank_name` VARCHAR(255) NOT NULL COLLATE 'utf8mb4_0900_ai_ci',
	PRIMARY KEY (`id`) USING BTREE
)
COLLATE='utf8mb4_0900_ai_ci'
ENGINE=InnoDB
AUTO_INCREMENT=54
;



--------------------------------------------------------------------------------------------------------


CREATE TABLE `benefit_cutoff_settings` (
	`id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
	`benefit_code` ENUM('SSS','PAGIBIG','PHILHEALTH') NOT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`benefit_name` VARCHAR(100) NOT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`cutoff` ENUM('FIRST','SECOND') NOT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`is_active` TINYINT(1) NOT NULL DEFAULT '1',
	`effective_from` DATE NULL DEFAULT NULL,
	`effective_to` DATE NULL DEFAULT NULL,
	`created_by` INT NULL DEFAULT NULL,
	`created_date` DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_by` INT NULL DEFAULT NULL,
	`updated_date` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (`id`) USING BTREE,
	UNIQUE INDEX `uq_benefit_code` (`benefit_code`) USING BTREE
)
COLLATE='utf8mb4_0900_ai_ci'
ENGINE=InnoDB
AUTO_INCREMENT=4
;



--------------------------------------------------------------------------------------------------------


CREATE TABLE `benefit_loans` (
	`loan_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	`user_id` INT NOT NULL,
	`benefit_code` ENUM('SSS','PAGIBIG') NOT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`loan_name` VARCHAR(80) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`reference_no` VARCHAR(60) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`principal_amount` DECIMAL(12,2) NOT NULL DEFAULT '0.00',
	`interest_amount` DECIMAL(12,2) NOT NULL DEFAULT '0.00',
	`total_payable` DECIMAL(12,2) NOT NULL DEFAULT '0.00',
	`accumulated_amount` DECIMAL(12,2) NOT NULL DEFAULT '0.00',
	`amortization_amount` DECIMAL(12,2) NOT NULL DEFAULT '0.00',
	`terms_installments` INT NOT NULL DEFAULT '1',
	`deduct_on` ENUM('FIRST','SECOND','BOTH') NOT NULL DEFAULT 'BOTH' COLLATE 'utf8mb4_0900_ai_ci',
	`start_cutoff_id` INT UNSIGNED NOT NULL,
	`paid_installments` INT NOT NULL DEFAULT '0',
	`remaining_balance` DECIMAL(12,2) NOT NULL DEFAULT '0.00',
	`last_paid_cutoff_id` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`status` ENUM('ACTIVE','CLOSED','CANCELLED') NOT NULL DEFAULT 'ACTIVE' COLLATE 'utf8mb4_0900_ai_ci',
	`remarks` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`created_by` INT NULL DEFAULT NULL,
	`created_date` DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_by` INT NULL DEFAULT NULL,
	`updated_date` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (`loan_id`) USING BTREE,
	INDEX `idx_bl_user` (`user_id`) USING BTREE,
	INDEX `idx_bl_benefit` (`benefit_code`) USING BTREE,
	INDEX `idx_bl_status` (`status`) USING BTREE,
	INDEX `idx_bl_start_cutoff` (`start_cutoff_id`) USING BTREE,
	INDEX `idx_bl_user_status` (`user_id`, `status`) USING BTREE
)
COLLATE='utf8mb4_0900_ai_ci'
ENGINE=InnoDB
AUTO_INCREMENT=13
;



--------------------------------------------------------------------------------------------------------



CREATE TABLE `benefit_logs` (
	`benefit_log_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	`cutoff_id` INT UNSIGNED NOT NULL,
	`cutoff_start` DATE NULL DEFAULT NULL,
	`cutoff_end` DATE NULL DEFAULT NULL,
	`cutoff_type` ENUM('FIRST','SECOND') NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`user_id` INT NOT NULL,
	`benefit_code` ENUM('SSS','PAGIBIG','PHILHEALTH') NOT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`log_type` ENUM('CONTRIBUTION','LOAN') NOT NULL DEFAULT 'CONTRIBUTION' COLLATE 'utf8mb4_0900_ai_ci',
	`loan_id` BIGINT UNSIGNED NULL DEFAULT NULL,
	`source_amount` DECIMAL(12,2) NOT NULL DEFAULT '0.00',
	`deducted_amount` DECIMAL(12,2) NOT NULL DEFAULT '0.00',
	`payroll_run_id` BIGINT UNSIGNED NOT NULL,
	`payroll_detail_id` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`note` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`created_date` DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	PRIMARY KEY (`benefit_log_id`) USING BTREE,
	UNIQUE INDEX `uq_blog_unique` (`cutoff_id`, `user_id`, `benefit_code`, `log_type`, `loan_id`, `payroll_run_id`) USING BTREE,
	INDEX `idx_blog_cutoff` (`cutoff_id`) USING BTREE,
	INDEX `idx_blog_user_cutoff` (`user_id`, `cutoff_id`) USING BTREE,
	INDEX `idx_blog_benefit` (`benefit_code`) USING BTREE,
	INDEX `idx_blog_type` (`log_type`) USING BTREE,
	INDEX `idx_blog_loan` (`loan_id`) USING BTREE,
	INDEX `idx_blog_payroll_run` (`payroll_run_id`) USING BTREE,
	CONSTRAINT `chk_loan_id_required_for_loan` CHECK ((((`log_type` = _utf8mb4\'CONTRIBUTION\') and (`loan_id` is null)) or ((`log_type` = _utf8mb4\'LOAN\') and (`loan_id` is not null)))),
	CONSTRAINT `chk_loan_not_philhealth` CHECK (((`log_type` = _utf8mb4\'CONTRIBUTION\') or ((`log_type` = _utf8mb4\'LOAN\') and (`benefit_code` in (_utf8mb4\'SSS\',_utf8mb4\'PAGIBIG\')))))
)
COLLATE='utf8mb4_0900_ai_ci'
ENGINE=InnoDB
AUTO_INCREMENT=118
;



--------------------------------------------------------------------------------------------------------


CREATE TABLE `coop_savings_contribution` (
	`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	`membership_id` BIGINT UNSIGNED NOT NULL,
	`user_id` INT NOT NULL,
	`period_month` DATE NOT NULL,
	`amount` DECIMAL(10,2) NOT NULL,
	`reference_no` VARCHAR(100) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`remarks` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`posted_by` INT NULL DEFAULT NULL,
	`posted_at` DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	PRIMARY KEY (`id`) USING BTREE,
	INDEX `idx_coop_contrib_member` (`membership_id`) USING BTREE,
	INDEX `idx_coop_contrib_user_period` (`user_id`, `period_month`) USING BTREE
)
COLLATE='utf8mb4_0900_ai_ci'
ENGINE=InnoDB
AUTO_INCREMENT=21
;



--------------------------------------------------------------------------------------------------------


CREATE TABLE `coop_savings_membership` (
	`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	`user_id` INT NOT NULL,
	`membership_id` VARCHAR(50) NOT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`monthly_amount` DECIMAL(10,2) NOT NULL,
	`total_collection` DECIMAL(12,2) NOT NULL DEFAULT '0.00',
	`total_months` INT NOT NULL DEFAULT '0',
	`start_date` DATE NOT NULL,
	`end_date` DATE NULL DEFAULT NULL,
	`is_active` TINYINT(1) NOT NULL DEFAULT '1',
	`created_by` INT NULL DEFAULT NULL,
	`created_date` DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`last_paid_cutoff_id` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`updated_by` INT NULL DEFAULT NULL,
	`updated_date` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (`id`) USING BTREE,
	INDEX `idx_membership_id` (`membership_id`) USING BTREE
)
COLLATE='utf8mb4_0900_ai_ci'
ENGINE=InnoDB
AUTO_INCREMENT=20
;


--------------------------------------------------------------------------------------------------------

CREATE TABLE `cutoff_settings` (
	`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	`status` VARCHAR(50) NULL DEFAULT 'published' COLLATE 'utf8mb4_0900_ai_ci',
	`date_created` TIMESTAMP NULL DEFAULT (CURRENT_TIMESTAMP),
	`date_updated` TIMESTAMP NULL DEFAULT (CURRENT_TIMESTAMP),
	`month` INT NOT NULL,
	`year` INT NOT NULL,
	`cutoff_type` VARCHAR(20) NOT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`start_date` DATE NOT NULL,
	`end_date` DATE NOT NULL,
	`payout_date` DATE NULL DEFAULT NULL,
	`period_status` VARCHAR(20) NULL DEFAULT 'OPEN' COLLATE 'utf8mb4_0900_ai_ci',
	`created_by` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`updated_by` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	PRIMARY KEY (`id`) USING BTREE,
	UNIQUE INDEX `id` (`id`) USING BTREE,
	UNIQUE INDEX `unique_period_definition` (`month`, `year`, `cutoff_type`) USING BTREE
)
COLLATE='utf8mb4_0900_ai_ci'
ENGINE=InnoDB
AUTO_INCREMENT=26
;



--------------------------------------------------------------------------------------------------------


CREATE TABLE `cutoff_settings_history` (
	`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	`cutoff_setting_id` BIGINT UNSIGNED NOT NULL,
	`event_type` ENUM('INSERT','UPDATE','DELETE') NOT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`event_at` TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`changed_by` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`status` VARCHAR(50) NULL DEFAULT 'published' COLLATE 'utf8mb4_0900_ai_ci',
	`source_date_created` TIMESTAMP NULL DEFAULT NULL,
	`source_date_updated` TIMESTAMP NULL DEFAULT NULL,
	`month` INT NOT NULL,
	`year` INT NOT NULL,
	`cutoff_type` VARCHAR(20) NOT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`start_date` DATE NOT NULL,
	`end_date` DATE NOT NULL,
	`payout_date` DATE NULL DEFAULT NULL,
	`period_status` VARCHAR(20) NULL DEFAULT 'OPEN' COLLATE 'utf8mb4_0900_ai_ci',
	`created_by` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`updated_by` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`raw_payload` JSON NULL DEFAULT NULL,
	PRIMARY KEY (`id`) USING BTREE,
	INDEX `idx_cutoff_setting_id` (`cutoff_setting_id`) USING BTREE,
	INDEX `idx_period` (`year`, `month`, `cutoff_type`) USING BTREE,
	INDEX `idx_event_at` (`event_at`) USING BTREE,
	CONSTRAINT `fk_cutoff_settings_history_cutoff_setting_id` FOREIGN KEY (`cutoff_setting_id`) REFERENCES `cutoff_settings` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
)
COLLATE='utf8mb4_0900_ai_ci'
ENGINE=InnoDB
AUTO_INCREMENT=55
;



--------------------------------------------------------------------------------------------------------


CREATE TABLE `department` (
	`department_id` INT NOT NULL AUTO_INCREMENT,
	`department_name` VARCHAR(255) NOT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`parent_division` INT NOT NULL DEFAULT '0',
	`department_description` TEXT NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`department_head` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`department_head_id` INT NULL DEFAULT NULL,
	`tax_id` INT NULL DEFAULT NULL,
	`date_added` DATE NULL DEFAULT NULL,
	PRIMARY KEY (`department_id`) USING BTREE,
	UNIQUE INDEX `department_name` (`department_name`) USING BTREE,
	INDEX `idx_department_department_head_id` (`department_head_id`) USING BTREE,
	CONSTRAINT `fk_department_department_head_user` FOREIGN KEY (`department_head_id`) REFERENCES `user` (`user_id`) ON UPDATE CASCADE ON DELETE SET NULL
)
COLLATE='utf8mb4_unicode_ci'
ENGINE=InnoDB
AUTO_INCREMENT=29
;


--------------------------------------------------------------------------------------------------------


CREATE TABLE `department_schedule` (
	`schedule_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	`department_id` INT NOT NULL DEFAULT '0',
	`working_days` TINYINT UNSIGNED NOT NULL,
	`work_start` TIME NOT NULL,
	`work_end` TIME NOT NULL,
	`lunch_start` TIME NOT NULL DEFAULT '12:00:00',
	`lunch_end` TIME NOT NULL DEFAULT '13:00:00',
	`break_start` TIME NOT NULL DEFAULT '15:00:00',
	`break_end` TIME NOT NULL DEFAULT '15:30:00',
	`workdays_note` VARCHAR(64) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`grace_period` TINYINT UNSIGNED NOT NULL DEFAULT '5',
	`created_at` DATETIME NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` DATETIME NULL DEFAULT NULL,
	PRIMARY KEY (`schedule_id`) USING BTREE,
	UNIQUE INDEX `uq_department_schedule` (`department_id`) USING BTREE,
	CONSTRAINT `FK_department_schedule_department` FOREIGN KEY (`department_id`) REFERENCES `department` (`department_id`) ON UPDATE NO ACTION ON DELETE NO ACTION
)
COLLATE='utf8mb4_0900_ai_ci'
ENGINE=InnoDB
AUTO_INCREMENT=22
;


--------------------------------------------------------------------------------------------------------


CREATE TABLE `dr_payment` (
	`dr_payment_id` INT NOT NULL AUTO_INCREMENT,
	`delivery_receipt_number` VARCHAR(50) NOT NULL DEFAULT '' COLLATE 'utf8mb4_general_ci',
	`employee_id` INT NOT NULL,
	`cutoff_from` DATE NOT NULL,
	`cutoff_to` DATE NOT NULL,
	`payroll_ref_no` VARCHAR(50) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`is_posted_to_payroll` TINYINT(1) NOT NULL DEFAULT '0',
	`payment_date` DATE NOT NULL,
	`amount_paid` DECIMAL(12,2) NOT NULL DEFAULT '0.00',
	`payment_method` ENUM('PAYROLL_DEDUCTION','CASH','CHECK','BANK_TRANSFER','OTHERS') NULL DEFAULT 'PAYROLL_DEDUCTION' COLLATE 'utf8mb4_general_ci',
	`remarks` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`created_at` DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`created_by` INT NULL DEFAULT NULL,
	PRIMARY KEY (`dr_payment_id`) USING BTREE,
	INDEX `idx_dr_payment_employee` (`employee_id`) USING BTREE,
	INDEX `idx_dr_payment_cutoff` (`cutoff_from`, `cutoff_to`) USING BTREE,
	INDEX `idx_dr_payment_payroll_ref` (`payroll_ref_no`) USING BTREE,
	INDEX `idx_dr_payment_dr_id` (`delivery_receipt_number`) USING BTREE
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB
AUTO_INCREMENT=21
;


--------------------------------------------------------------------------------------------------------



CREATE TABLE `employee_allowance` (
	`allowance_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	`user_id` INT NOT NULL,
	`amount` DECIMAL(12,2) NOT NULL,
	`description` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`cutoff_start` DATE NULL DEFAULT NULL,
	`cutoff_end` DATE NULL DEFAULT NULL,
	`is_recurring` TINYINT(1) NOT NULL DEFAULT '0',
	`is_active` TINYINT(1) NOT NULL DEFAULT '1',
	`pay_cycle` ENUM('N/A','PER_CUTOFF','PER_MONTH') NOT NULL DEFAULT 'N/A' COLLATE 'utf8mb4_0900_ai_ci',
	`start_date` DATE NULL DEFAULT NULL,
	`end_date` DATE NULL DEFAULT NULL,
	`is_processed` TINYINT(1) NOT NULL DEFAULT '0',
	`created_by` INT NULL DEFAULT NULL,
	`created_date` DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_by` INT NULL DEFAULT NULL,
	`updated_date` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (`allowance_id`) USING BTREE,
	INDEX `idx_allowance_user` (`user_id`) USING BTREE,
	INDEX `idx_allowance_cutoff` (`cutoff_start`, `cutoff_end`) USING BTREE,
	INDEX `idx_allowance_recurring` (`is_recurring`, `pay_cycle`, `start_date`, `end_date`) USING BTREE,
	INDEX `idx_allowance_one_time_cutoff` (`is_recurring`, `cutoff_start`, `cutoff_end`) USING BTREE,
	INDEX `idx_allowance_user_recurring_window` (`user_id`, `is_recurring`, `pay_cycle`, `start_date`, `end_date`) USING BTREE,
	INDEX `idx_allowance_recurring_active` (`is_recurring`, `is_active`) USING BTREE
)
COLLATE='utf8mb4_0900_ai_ci'
ENGINE=InnoDB
AUTO_INCREMENT=31
;


--------------------------------------------------------------------------------------------------------


CREATE TABLE `employee_loan` (
	`loan_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	`user_id` INT NOT NULL,
	`loan_type` ENUM('VALE','CAR LOAN','COOP') NOT NULL DEFAULT 'COOP' COLLATE 'utf8mb4_0900_ai_ci',
	`loan_amount` DECIMAL(12,2) NOT NULL,
	`interest_rate` DECIMAL(5,2) NOT NULL DEFAULT '3.00',
	`interest_amount` DECIMAL(12,2) NOT NULL,
	`net_amount_released` DECIMAL(12,2) NOT NULL,
	`accumulated_amount` DECIMAL(12,2) NOT NULL,
	`months_to_pay` INT NOT NULL,
	`monthly_payment` DECIMAL(12,2) NOT NULL,
	`start_date` DATE NOT NULL,
	`end_date` DATE NULL DEFAULT NULL,
	`status` ENUM('ACTIVE','PAID','CANCELLED') NOT NULL DEFAULT 'ACTIVE' COLLATE 'utf8mb4_0900_ai_ci',
	`last_paid_cutoff_id` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`created_by` INT NULL DEFAULT NULL,
	`created_date` DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_by` INT NULL DEFAULT NULL,
	`updated_date` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (`loan_id`) USING BTREE,
	INDEX `idx_loan_user` (`user_id`) USING BTREE,
	INDEX `idx_loan_user_type` (`user_id`, `loan_type`) USING BTREE
)
COLLATE='utf8mb4_0900_ai_ci'
ENGINE=InnoDB
AUTO_INCREMENT=22
;


--------------------------------------------------------------------------------------------------------


CREATE TABLE `employee_loan_payment` (
	`payment_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	`loan_id` BIGINT UNSIGNED NOT NULL,
	`user_id` INT NOT NULL,
	`payment_date` DATE NOT NULL,
	`period_month` DATE NOT NULL,
	`amount_paid` DECIMAL(12,2) NOT NULL,
	`reference_no` VARCHAR(100) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`remarks` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`posted_by` INT NULL DEFAULT NULL,
	`posted_at` DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	PRIMARY KEY (`payment_id`) USING BTREE,
	INDEX `idx_loan_payment_loan` (`loan_id`) USING BTREE,
	INDEX `idx_loan_payment_user_period` (`user_id`, `period_month`) USING BTREE
)
COLLATE='utf8mb4_0900_ai_ci'
ENGINE=InnoDB
;


--------------------------------------------------------------------------------------------------------


CREATE TABLE `holiday_calendar` (
	`id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
	`holiday_date` DATE NOT NULL,
	`cutoff_setting_id` BIGINT UNSIGNED NULL DEFAULT NULL,
	`last_working_day` DATE NULL DEFAULT NULL,
	`description` VARCHAR(255) NOT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`holiday_type` ENUM('regular','special','company') NOT NULL DEFAULT 'regular' COLLATE 'utf8mb4_0900_ai_ci',
	`is_recurring` TINYINT(1) NOT NULL DEFAULT '1',
	`is_paid` TINYINT(1) NOT NULL DEFAULT '1',
	`created_by` INT NULL DEFAULT NULL,
	`created_date` DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_by` INT NULL DEFAULT NULL,
	`updated_date` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (`id`) USING BTREE,
	UNIQUE INDEX `uq_holiday_date_type` (`holiday_date`, `holiday_type`) USING BTREE,
	INDEX `fk_holiday_calendar_cutoff_setting` (`cutoff_setting_id`) USING BTREE,
	CONSTRAINT `fk_holiday_calendar_cutoff_setting` FOREIGN KEY (`cutoff_setting_id`) REFERENCES `cutoff_settings` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
)
COLLATE='utf8mb4_0900_ai_ci'
ENGINE=InnoDB
AUTO_INCREMENT=66
;



--------------------------------------------------------------------------------------------------------


CREATE TABLE `oncall_list` (
	`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	`dept_sched_id` BIGINT UNSIGNED NOT NULL,
	`user_id` INT NOT NULL,
	PRIMARY KEY (`id`) USING BTREE,
	INDEX `idx_oncall_dept_sched_id` (`dept_sched_id`) USING BTREE,
	INDEX `idx_oncall_user_id` (`user_id`) USING BTREE,
	CONSTRAINT `fk_oncalllist_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON UPDATE CASCADE ON DELETE CASCADE
)
COLLATE='utf8mb4_unicode_ci'
ENGINE=InnoDB
AUTO_INCREMENT=75
;


--------------------------------------------------------------------------------------------------------


CREATE TABLE `oncall_schedule` (
	`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	`department_id` INT NOT NULL,
	`group` VARCHAR(255) NOT NULL COLLATE 'utf8mb4_unicode_ci',
	`working_days` INT NOT NULL,
	`work_start` TIME NOT NULL,
	`work_end` TIME NOT NULL,
	`lunch_start` TIME NULL DEFAULT '12:00:00',
	`lunch_end` TIME NULL DEFAULT '13:00:00',
	`break_start` TIME NULL DEFAULT '15:00:00',
	`break_end` TIME NULL DEFAULT '15:30:00',
	`workdays` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	`grace_period` TINYINT UNSIGNED NOT NULL DEFAULT '5',
	`created_at` DATETIME NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` DATETIME NULL DEFAULT NULL,
	`encoder_id` INT NOT NULL,
	`schedule_date` DATE NULL DEFAULT NULL,
	PRIMARY KEY (`id`) USING BTREE,
	INDEX `idx_oncallsched_department_id` (`department_id`) USING BTREE,
	INDEX `idx_oncallsched_encoder_id` (`encoder_id`) USING BTREE,
	CONSTRAINT `fk_oncallsched_department` FOREIGN KEY (`department_id`) REFERENCES `department` (`department_id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `fk_oncallsched_user` FOREIGN KEY (`encoder_id`) REFERENCES `user` (`user_id`) ON UPDATE CASCADE ON DELETE CASCADE
)
COLLATE='utf8mb4_unicode_ci'
ENGINE=InnoDB
AUTO_INCREMENT=29
;





--------------------------------------------------------------------------------------------------------


CREATE TABLE `payroll_logistics_area` (
	`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	`area_id` BIGINT UNSIGNED NOT NULL,
	`area_name` VARCHAR(200) NOT NULL COLLATE 'utf8mb4_general_ci',
	`max_days` SMALLINT UNSIGNED NULL DEFAULT NULL,
	`mode_type` ENUM('DELIVERY','PICKUP ONLY','PICKUP W/ MP DELIVERY') NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`is_deleted` TINYINT NOT NULL DEFAULT '0',
	`created_by` BIGINT UNSIGNED NULL DEFAULT NULL,
	`created_at` DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	PRIMARY KEY (`id`) USING BTREE,
	UNIQUE INDEX `uq_area_id` (`area_id`) USING BTREE,
	INDEX `idx_area_name` (`area_name`) USING BTREE
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB
AUTO_INCREMENT=14
;




--------------------------------------------------------------------------------------------------------


CREATE TABLE `payroll_logistics_location` (
	`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	`location_id` BIGINT UNSIGNED NOT NULL,
	`area_id` BIGINT UNSIGNED NOT NULL,
	`location` VARCHAR(220) NOT NULL COLLATE 'utf8mb4_general_ci',
	`distance` INT UNSIGNED NULL DEFAULT NULL,
	`is_deleted` TINYINT NOT NULL DEFAULT '0',
	`created_by` BIGINT UNSIGNED NULL DEFAULT NULL,
	`created_at` DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	PRIMARY KEY (`id`) USING BTREE,
	UNIQUE INDEX `uq_location_id` (`location_id`) USING BTREE,
	INDEX `fk_loc_area` (`area_id`) USING BTREE,
	CONSTRAINT `fk_loc_area` FOREIGN KEY (`area_id`) REFERENCES `payroll_logistics_area` (`area_id`) ON UPDATE CASCADE ON DELETE RESTRICT
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB
AUTO_INCREMENT=2
;




--------------------------------------------------------------------------------------------------------


CREATE TABLE `payroll_logistics_salary_matrix` (
	`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	`area_id` BIGINT UNSIGNED NOT NULL,
	`staff_id` BIGINT UNSIGNED NOT NULL,
	`vehicle_type_id` BIGINT UNSIGNED NOT NULL DEFAULT '0',
	`wage_amount` DECIMAL(12,2) NOT NULL,
	`created_by` BIGINT UNSIGNED NULL DEFAULT NULL,
	`created_at` DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	`updated_by` BIGINT UNSIGNED NULL DEFAULT NULL,
	`updated_at` DATETIME(3) NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP(3),
	PRIMARY KEY (`id`) USING BTREE,
	UNIQUE INDEX `uq_salary_matrix_unique` (`area_id`, `staff_id`, `vehicle_type_id`) USING BTREE,
	INDEX `fk_mat_staff` (`staff_id`) USING BTREE,
	INDEX `fk_mat_vehicle` (`vehicle_type_id`) USING BTREE,
	CONSTRAINT `fk_mat_area` FOREIGN KEY (`area_id`) REFERENCES `payroll_logistics_area` (`area_id`) ON UPDATE CASCADE ON DELETE RESTRICT,
	CONSTRAINT `fk_mat_staff` FOREIGN KEY (`staff_id`) REFERENCES `payroll_logistics_staff` (`staff_id`) ON UPDATE CASCADE ON DELETE RESTRICT,
	CONSTRAINT `fk_mat_vehicle` FOREIGN KEY (`vehicle_type_id`) REFERENCES `payroll_logistics_vehicle_type` (`vehicle_type_id`) ON UPDATE CASCADE ON DELETE RESTRICT
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB
AUTO_INCREMENT=206
;




--------------------------------------------------------------------------------------------------------


CREATE TABLE `payroll_logistics_staff` (
	`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	`staff_id` BIGINT UNSIGNED NOT NULL,
	`role` ENUM('Driver','Helper') NOT NULL COLLATE 'utf8mb4_general_ci',
	`employment_type` ENUM('EXTRA','PROBATIONARY','REGULAR(<10W)','REGULAR(10W/T)') NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`vehicle_type_id` BIGINT UNSIGNED NULL DEFAULT NULL,
	`is_deleted` TINYINT NOT NULL DEFAULT '0',
	`created_by` BIGINT UNSIGNED NULL DEFAULT NULL,
	`created_at` DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	PRIMARY KEY (`id`) USING BTREE,
	UNIQUE INDEX `uq_staff_id` (`staff_id`) USING BTREE,
	INDEX `fk_staff_vehicle` (`vehicle_type_id`) USING BTREE,
	CONSTRAINT `fk_staff_vehicle` FOREIGN KEY (`vehicle_type_id`) REFERENCES `payroll_logistics_vehicle_type` (`vehicle_type_id`) ON UPDATE CASCADE ON DELETE RESTRICT
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB
AUTO_INCREMENT=11
;





--------------------------------------------------------------------------------------------------------


CREATE TABLE `payroll_logistics_vehicle_type` (
	`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	`vehicle_type_id` BIGINT UNSIGNED NOT NULL,
	`vehicle_type` ENUM('BELOW 10 WHEELER','10 WHEELER','TRAILER','N/A') NOT NULL COLLATE 'utf8mb4_general_ci',
	`created_by` BIGINT UNSIGNED NULL DEFAULT NULL,
	`created_at` DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	PRIMARY KEY (`id`) USING BTREE,
	UNIQUE INDEX `uq_vt_id` (`vehicle_type_id`) USING BTREE,
	UNIQUE INDEX `uq_vt_name` (`vehicle_type`) USING BTREE
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB
AUTO_INCREMENT=6
;


--------------------------------------------------------------------------------------------------------
CREATE TABLE `payroll_other_additions` (
	`id` INT NOT NULL AUTO_INCREMENT,
	`user_id` INT NOT NULL,
	`amount` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`description` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`cutoff_start` DATE NOT NULL,
	`cutoff_end` DATE NOT NULL,
	`created_by` INT NULL DEFAULT NULL,
	`created_date` DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	PRIMARY KEY (`id`) USING BTREE
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB
AUTO_INCREMENT=34
;


--------------------------------------------------------------------------------------------------------

CREATE TABLE `payroll_other_deductions` (
	`id` INT NOT NULL AUTO_INCREMENT,
	`user_id` INT NOT NULL,
	`amount` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`type` ENUM('SHORTAGE','MANUAL') NOT NULL DEFAULT 'MANUAL' COLLATE 'utf8mb4_general_ci',
	`description` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`cutoff_start` DATE NOT NULL,
	`cutoff_end` DATE NOT NULL,
	`created_by` INT NULL DEFAULT NULL,
	`created_date` DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	PRIMARY KEY (`id`) USING BTREE
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB
AUTO_INCREMENT=18
;



--------------------------------------------------------------------------------------------------------


CREATE TABLE `payroll_payslip` (
	`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	`payroll_run_id` BIGINT UNSIGNED NOT NULL,
	`employee_id` INT NOT NULL,
	`file_path` TEXT NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`status` ENUM('PENDING','GENERATED','SENT','FAILED') NOT NULL DEFAULT 'PENDING' COLLATE 'utf8mb4_general_ci',
	`error_message` TEXT NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`created_at` DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (`id`) USING BTREE,
	UNIQUE INDEX `uq_payslip_run_emp` (`payroll_run_id`, `employee_id`) USING BTREE,
	INDEX `idx_payslip_run` (`payroll_run_id`) USING BTREE
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB
;



--------------------------------------------------------------------------------------------------------



CREATE TABLE `payroll_run` (
	`payroll_run_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	`cutoff_id` BIGINT UNSIGNED NOT NULL,
	`cutoff_type` ENUM('FIRST','SECOND') NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`cutoff_start` DATE NOT NULL,
	`cutoff_end` DATE NOT NULL,
	`department_id` INT NULL DEFAULT NULL,
	`status` ENUM('DRAFT','PROCESSED','POSTED','VOID') NOT NULL DEFAULT 'DRAFT' COLLATE 'utf8mb4_general_ci',
	`payroll_ref_no` VARCHAR(50) NOT NULL COLLATE 'utf8mb4_general_ci',
	`headcount` INT NOT NULL DEFAULT '0',
	`total_gross` DECIMAL(12,2) NOT NULL DEFAULT '0.00',
	`total_deductions` DECIMAL(12,2) NOT NULL DEFAULT '0.00',
	`total_net` DECIMAL(12,2) NOT NULL DEFAULT '0.00',
	`variance_alert_count` INT NOT NULL DEFAULT '0',
	`remarks` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`created_by` INT NOT NULL,
	`created_at` DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`processed_at` DATETIME NULL DEFAULT NULL,
	`posted_by` INT NULL DEFAULT NULL,
	`posted_at` DATETIME NULL DEFAULT NULL,
	PRIMARY KEY (`payroll_run_id`) USING BTREE,
	UNIQUE INDEX `uq_payroll_ref_no` (`payroll_ref_no`) USING BTREE,
	INDEX `idx_payroll_run_cutoff_dept` (`cutoff_id`, `department_id`, `status`) USING BTREE,
	INDEX `idx_payroll_run_dates` (`cutoff_start`, `cutoff_end`) USING BTREE
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB
AUTO_INCREMENT=93
;



--------------------------------------------------------------------------------------------------------

CREATE TABLE `payroll_run_access_log` (
	`id` INT NOT NULL AUTO_INCREMENT,
	`opened_by` INT NOT NULL,
	`cutoff_id` INT NOT NULL,
	`department_id` INT NULL DEFAULT NULL,
	`remarks` TEXT NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`created_date` TIMESTAMP NULL DEFAULT (CURRENT_TIMESTAMP),
	PRIMARY KEY (`id`) USING BTREE,
	INDEX `idx_opened_by` (`opened_by`) USING BTREE,
	INDEX `idx_cutoff_id` (`cutoff_id`) USING BTREE,
	INDEX `idx_created_date` (`created_date`) USING BTREE
)
COLLATE='utf8mb4_0900_ai_ci'
ENGINE=InnoDB
AUTO_INCREMENT=144
;



--------------------------------------------------------------------------------------------------------

CREATE TABLE `payroll_run_employee` (
	`id` INT NOT NULL AUTO_INCREMENT,
	`user_id` INT NOT NULL,
	`employee_name` VARCHAR(150) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`position` VARCHAR(120) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`department_name` VARCHAR(120) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`position_name` VARCHAR(120) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`department_name_snapshot` VARCHAR(120) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`payroll_run_id` BIGINT UNSIGNED NOT NULL,
	`cutoff_start` DATE NOT NULL,
	`cutoff_end` DATE NOT NULL,
	`cutoff_label` VARCHAR(50) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`daily_rate` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`cutoff_type` ENUM('FIRST','SECOND') NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`cutoff_id` INT NULL DEFAULT NULL,
	`basic_daily_rate` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`hourly_rate` DECIMAL(10,4) NOT NULL DEFAULT '0.0000',
	`monthly_rate` DECIMAL(12,2) NOT NULL DEFAULT '0.00',
	`total_days_worked` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`total_work_minutes` INT NOT NULL DEFAULT '0',
	`late_minutes` INT NOT NULL DEFAULT '0',
	`undertime_minutes` INT NOT NULL DEFAULT '0',
	`overtime_minutes` INT NOT NULL DEFAULT '0',
	`night_diff_minutes` INT NOT NULL DEFAULT '0',
	`total_hours_worked` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`basic_pay` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`ot_amount` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`leave_amount` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`retro_pay` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`retro_remarks` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`holiday` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`holiday_pay` DECIMAL(12,2) NOT NULL DEFAULT '0.00',
	`holiday_days` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`rest_day_amount` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`night_diff_amount` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`allowance` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`manual_additions` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`late_deduction` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`undertime_deduction` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`shortage_deduction` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`benefit_pagibig` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`loan_vale` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`loan_car` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`loan_coop` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`loan_total` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`benefit_philhealth` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`benefit_sss` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`benefit_loan_sss` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`benefit_loan_pagibig` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`benefit_loan_total` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`coop_savings` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`coop_loan` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`dr_deduction` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`other_deductions` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`manual_deductions` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`total_additions` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`total_deductions` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`gross_pay` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`net_pay` DECIMAL(10,2) NULL DEFAULT '0.00',
	`is_prorated` TINYINT(1) NOT NULL DEFAULT '0',
	`proration_json` JSON NULL DEFAULT NULL,
	`breakdown_json` JSON NULL DEFAULT NULL,
	`previous_net_pay` DECIMAL(12,2) NOT NULL DEFAULT '0.00',
	`variance_amount_ui` DECIMAL(12,2) NOT NULL DEFAULT '0.00',
	`variance_amount` DECIMAL(12,2) NOT NULL DEFAULT '0.00',
	`variance_pct` DECIMAL(9,4) NOT NULL DEFAULT '0.0000',
	`variance_flag` TINYINT(1) NOT NULL DEFAULT '0',
	`on_hold` TINYINT(1) NOT NULL DEFAULT '0',
	`is_card` TINYINT(1) NOT NULL DEFAULT '0',
	`created_at` DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`created_by` INT NULL DEFAULT NULL,
	`updated_date` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
	`updated_by` INT NULL DEFAULT NULL,
	PRIMARY KEY (`id`) USING BTREE,
	UNIQUE INDEX `uq_run_employee` (`payroll_run_id`, `user_id`) USING BTREE,
	INDEX `idx_pre_payroll_run_id` (`payroll_run_id`) USING BTREE,
	INDEX `idx_run_employee_lookup` (`payroll_run_id`, `user_id`) USING BTREE,
	INDEX `idx_payroll_run_employee_user_id` (`user_id`) USING BTREE,
	CONSTRAINT `fk_payroll_run_employee_run` FOREIGN KEY (`payroll_run_id`) REFERENCES `payroll_run` (`payroll_run_id`) ON UPDATE CASCADE ON DELETE RESTRICT,
	CONSTRAINT `fk_payroll_run_employee_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON UPDATE CASCADE ON DELETE RESTRICT
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB
AUTO_INCREMENT=689
;



--------------------------------------------------------------------------------------------------------

CREATE TABLE `payroll_run_employee_item` (
	`item_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	`payroll_run_employee_id` INT NOT NULL,
	`payroll_run_id` BIGINT UNSIGNED NOT NULL,
	`user_id` INT NOT NULL,
	`cutoff_start` DATE NOT NULL,
	`cutoff_end` DATE NOT NULL,
	`item_key` VARCHAR(80) NOT NULL COLLATE 'utf8mb4_general_ci',
	`item_type` ENUM('EARNING','DEDUCTION') NOT NULL COLLATE 'utf8mb4_general_ci',
	`category` VARCHAR(40) NOT NULL COLLATE 'utf8mb4_general_ci',
	`code` VARCHAR(40) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`description` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`amount` DECIMAL(12,2) NOT NULL DEFAULT '0.00',
	`source_table` VARCHAR(60) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`source_id` BIGINT NULL DEFAULT NULL,
	`meta` JSON NULL DEFAULT NULL,
	`created_at` DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`created_by` INT NULL DEFAULT NULL,
	PRIMARY KEY (`item_id`) USING BTREE,
	UNIQUE INDEX `uq_pre_item` (`payroll_run_employee_id`, `item_key`) USING BTREE,
	INDEX `idx_pre_item_lookup` (`payroll_run_id`, `user_id`, `cutoff_start`, `cutoff_end`) USING BTREE,
	INDEX `idx_pre_item_type_cat` (`payroll_run_id`, `item_type`, `category`) USING BTREE,
	INDEX `idx_pre_item_preid` (`payroll_run_employee_id`) USING BTREE,
	CONSTRAINT `fk_pre_item_pre` FOREIGN KEY (`payroll_run_employee_id`) REFERENCES `payroll_run_employee` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB
AUTO_INCREMENT=3676
;



--------------------------------------------------------------------------------------------------------

CREATE TABLE `payroll_source_posting` (
	`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	`payroll_run_id` BIGINT UNSIGNED NOT NULL,
	`source_table` VARCHAR(64) NOT NULL COLLATE 'utf8mb4_general_ci',
	`source_pk` VARCHAR(64) NOT NULL COLLATE 'utf8mb4_general_ci',
	`employee_id` INT NOT NULL,
	`amount` DECIMAL(12,2) NOT NULL DEFAULT '0.00',
	`created_at` DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	PRIMARY KEY (`id`) USING BTREE,
	UNIQUE INDEX `uq_source_once` (`source_table`, `source_pk`) USING BTREE,
	INDEX `idx_source_by_run` (`payroll_run_id`) USING BTREE,
	INDEX `idx_source_by_employee` (`employee_id`) USING BTREE
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB
;



--------------------------------------------------------------------------------------------------------

CREATE TABLE `retro_pay` (
	`retro_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	`user_id` INT NOT NULL,
	`amount` DECIMAL(12,2) NOT NULL,
	`description` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`cutoff_start` DATE NOT NULL,
	`cutoff_end` DATE NOT NULL,
	`is_processed` TINYINT(1) NOT NULL DEFAULT '0',
	`created_by` INT NULL DEFAULT NULL,
	`created_date` DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_by` INT NULL DEFAULT NULL,
	`updated_date` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (`retro_id`) USING BTREE,
	INDEX `idx_retro_user` (`user_id`) USING BTREE,
	INDEX `idx_retro_cutoff` (`cutoff_start`, `cutoff_end`) USING BTREE
)
COLLATE='utf8mb4_0900_ai_ci'
ENGINE=InnoDB
AUTO_INCREMENT=13
;


--------------------------------------------------------------------------------------------------------

CREATE TABLE `salary_schedules` (
	`schedule_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	`effectivity_date` DATE NOT NULL COMMENT 'DBM schedule effectivity (e.g. 2023-01-01)',
	`salary_grade` TINYINT UNSIGNED NOT NULL,
	`step` TINYINT UNSIGNED NOT NULL,
	`monthly_rate` DECIMAL(10,2) NOT NULL,
	`created_at` TIMESTAMP NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` TIMESTAMP NULL DEFAULT (CURRENT_TIMESTAMP) ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (`schedule_id`) USING BTREE,
	UNIQUE INDEX `uniq_schedule` (`effectivity_date`, `salary_grade`, `step`) USING BTREE,
	INDEX `idx_effectivity` (`effectivity_date`) USING BTREE,
	INDEX `idx_grade_step` (`salary_grade`, `step`) USING BTREE,
	CONSTRAINT `salary_schedules_chk_1` CHECK ((`salary_grade` between 1 and 33)),
	CONSTRAINT `salary_schedules_chk_2` CHECK ((`step` between 1 and 8))
)
COLLATE='utf8mb4_0900_ai_ci'
ENGINE=InnoDB
AUTO_INCREMENT=7
;



--------------------------------------------------------------------------------------------------------

CREATE TABLE `user` (
	`user_id` INT NOT NULL AUTO_INCREMENT,
	`user_email` VARCHAR(255) NOT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`user_password` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`user_fname` VARCHAR(255) NOT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`user_mname` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`user_lname` VARCHAR(255) NOT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`user_contact` VARCHAR(255) NOT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`user_province` VARCHAR(255) NOT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`user_city` VARCHAR(255) NOT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`user_brgy` VARCHAR(255) NOT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`user_department` INT NULL DEFAULT NULL,
	`user_sss` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`user_philhealth` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`user_tin` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`user_position` VARCHAR(255) NOT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`user_dateOfHire` DATE NOT NULL,
	`user_tags` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`user_bday` DATE NULL DEFAULT NULL,
	`role_id` INT NULL DEFAULT NULL,
	`user_image` TEXT NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	`updateAt` TIMESTAMP NULL DEFAULT NULL,
	`external_id` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	`is_deleted` BIT(1) NULL DEFAULT NULL,
	`update_at` DATETIME(6) NULL DEFAULT NULL,
	`externalId` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	`isDeleted` BIT(1) NULL DEFAULT NULL,
	`biometric_id` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	`rf_id` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	`isAdmin` TINYINT(1) NOT NULL DEFAULT '0',
	`user_pagibig` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	`signature` TEXT NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	`emergency_contact_name` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	`emergency_contact_number` VARCHAR(50) NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	`role` VARCHAR(10) NOT NULL DEFAULT 'USER' COLLATE 'utf8mb4_unicode_ci',
	`hash_password` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	PRIMARY KEY (`user_id`) USING BTREE,
	INDEX `role_id` (`role_id`) USING BTREE,
	INDEX `FK_user_department` (`user_department`) USING BTREE,
	CONSTRAINT `user_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
)
COLLATE='utf8mb4_unicode_ci'
ENGINE=InnoDB
AUTO_INCREMENT=357
;



--------------------------------------------------------------------------------------------------------

CREATE TABLE `user_wage_access_log` (
	`id` INT NOT NULL AUTO_INCREMENT,
	`user_id` INT NOT NULL,
	`opened_by` INT NOT NULL,
	`opened_at` DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`remarks` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	PRIMARY KEY (`id`) USING BTREE,
	INDEX `idx_user_id` (`user_id`) USING BTREE,
	INDEX `idx_opened_by` (`opened_by`) USING BTREE
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB
AUTO_INCREMENT=437
;



--------------------------------------------------------------------------------------------------------

CREATE TABLE `user_wage_history` (
	`history_id` INT NOT NULL AUTO_INCREMENT,
	`user_wage_id` INT NOT NULL,
	`user_id` INT NOT NULL,
	`daily_wage` DECIMAL(10,2) NOT NULL,
	`philhealth_contribution_monthly` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`sss_contribution_monthly` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`pagibig_contribution_monthly` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`vacation_leave_per_year` INT NOT NULL,
	`sick_leave_per_year` INT NOT NULL,
	`paid_holiday` TINYINT(1) NOT NULL,
	`valid_from` DATETIME NOT NULL,
	`valid_to` DATETIME NULL DEFAULT NULL,
	`change_type` ENUM('INSERT','UPDATE','DELETE') NOT NULL COLLATE 'utf8mb4_general_ci',
	`changed_by` INT NULL DEFAULT NULL,
	`changed_at` DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	PRIMARY KEY (`history_id`) USING BTREE,
	INDEX `idx_uw_user` (`user_id`) USING BTREE,
	INDEX `idx_uw_wageid` (`user_wage_id`) USING BTREE
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB
AUTO_INCREMENT=11
;



--------------------------------------------------------------------------------------------------------

CREATE TABLE `user_wage_management` (
	`id` INT NOT NULL AUTO_INCREMENT,
	`user_id` INT NOT NULL,
	`daily_wage` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`schedule_id` BIGINT UNSIGNED NULL DEFAULT NULL,
	`cutoff_wage_date_update` DATE NULL DEFAULT NULL,
	`philhealth_contribution_monthly` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`sss_contribution_monthly` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`pagibig_contribution_monthly` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
	`isCard` TINYINT(1) NOT NULL DEFAULT '0',
	`isRegularEmployee` TINYINT(1) NOT NULL DEFAULT '0',
	`vacation_leave_per_year` INT NOT NULL DEFAULT '0',
	`sick_leave_per_year` INT NOT NULL DEFAULT '0',
	`paid_holiday` TINYINT(1) NOT NULL DEFAULT '0',
	`created_date` DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`created_by` INT NULL DEFAULT NULL,
	`updated_date` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
	`updated_by` INT NULL DEFAULT NULL,
	PRIMARY KEY (`id`) USING BTREE,
	INDEX `fk_user_wage_schedule` (`schedule_id`) USING BTREE,
	CONSTRAINT `fk_user_wage_schedule` FOREIGN KEY (`schedule_id`) REFERENCES `salary_schedules` (`schedule_id`) ON UPDATE CASCADE ON DELETE SET NULL
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB
AUTO_INCREMENT=257
;



--------------------------------------------------------------------------------------------------------

CREATE TABLE `user_wage_proration_log` (
	`id` INT NOT NULL AUTO_INCREMENT,
	`user_id` INT NOT NULL,
	`previous_daily_wage` DECIMAL(10,2) NOT NULL,
	`new_daily_wage` DECIMAL(10,2) NOT NULL,
	`effective_date` DATE NOT NULL,
	`cutoff_id` INT NOT NULL,
	`updated_by` INT NOT NULL,
	`created_at` DATETIME NULL DEFAULT (CURRENT_TIMESTAMP),
	PRIMARY KEY (`id`) USING BTREE,
	INDEX `idx_proration_user` (`user_id`) USING BTREE,
	INDEX `idx_proration_cutoff` (`cutoff_id`) USING BTREE
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB
AUTO_INCREMENT=14
;
