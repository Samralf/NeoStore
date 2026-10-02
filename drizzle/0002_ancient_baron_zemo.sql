CREATE TABLE `customer_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`phone` text NOT NULL,
	`phone_verified_at` text NOT NULL,
	`created_at` text NOT NULL,
	`last_login_at` text,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_accounts_customer_id_unique` ON `customer_accounts` (`customer_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `customer_accounts_phone_unique` ON `customer_accounts` (`phone`);--> statement-breakpoint
CREATE TABLE `customer_addresses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`label` text,
	`governorate_id` integer NOT NULL,
	`area` text,
	`address_line` text NOT NULL,
	`landmark` text,
	`is_default` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `otp_challenges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`phone` text NOT NULL,
	`purpose` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`consumed_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `guest_name` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `verified_phone` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `governorate_id` integer REFERENCES governorates(id);--> statement-breakpoint
ALTER TABLE `orders` ADD `delivery_address` text DEFAULT '' NOT NULL;
