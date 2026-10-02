CREATE TABLE `inventory_batches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`batch_number` text NOT NULL,
	`production_date` text,
	`expiry_date` text,
	`received_quantity` integer NOT NULL,
	`remaining_quantity` integer NOT NULL,
	`unit_cost` real NOT NULL,
	`received_at` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `inventory_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`batch_id` integer,
	`type` text NOT NULL,
	`quantity` integer NOT NULL,
	`reference_type` text,
	`reference_id` integer,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`batch_id`) REFERENCES `inventory_batches`(`id`) ON UPDATE no action ON DELETE no action
);
