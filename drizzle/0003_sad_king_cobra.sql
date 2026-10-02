PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_orders` (
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
	`updated_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`governorate_id`) REFERENCES `governorates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_orders`("id", "order_number", "customer_id", "guest_name", "verified_phone", "governorate_id", "delivery_address", "source", "status", "payment_method", "payment_status", "subtotal", "discount", "original_shipping", "charged_shipping", "free_shipping", "total", "created_at", "updated_at") SELECT "id", "order_number", "customer_id", "guest_name", "verified_phone", "governorate_id", "delivery_address", "source", "status", "payment_method", "payment_status", "subtotal", "discount", "original_shipping", "charged_shipping", "free_shipping", "total", "created_at", "updated_at" FROM `orders`;--> statement-breakpoint
DROP TABLE `orders`;--> statement-breakpoint
ALTER TABLE `__new_orders` RENAME TO `orders`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_number_unique` ON `orders` (`order_number`);--> statement-breakpoint
ALTER TABLE `products` ADD `name_en` text;--> statement-breakpoint
ALTER TABLE `products` ADD `brand` text;--> statement-breakpoint
ALTER TABLE `products` ADD `category` text DEFAULT 'coffee' NOT NULL;