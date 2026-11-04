-- Production orders schema inspected 2026-11-04; no customer data.
CREATE TABLE "orders" (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_number` text NOT NULL,
	`customer_id` integer,
	`guest_name` text,
	`verified_phone` text DEFAULT '' NOT NULL,
	`governorate_id` integer,
	`delivery_address` text DEFAULT '' NOT NULL,
	`source` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`payment_method` text NOT NULL,
	`payment_status` text DEFAULT 'unpaid' NOT NULL,
	`subtotal` real NOT NULL,
	`discount` real DEFAULT 0 NOT NULL,
	`original_shipping` real DEFAULT 0 NOT NULL,
	`charged_shipping` real DEFAULT 0 NOT NULL,
	`free_shipping` integer DEFAULT false NOT NULL,
	`total` real NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL, governorate_name TEXT NOT NULL DEFAULT '', mutation_token TEXT NOT NULL DEFAULT '',
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`governorate_id`) REFERENCES `governorates`(`id`) ON UPDATE no action ON DELETE no action
);
