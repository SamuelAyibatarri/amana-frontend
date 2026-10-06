CREATE TABLE `transfer` (
	`id` text PRIMARY KEY NOT NULL,
	`sender_user_id` text,
	`recipient_user_id` text NOT NULL,
	`sender_phone` text NOT NULL,
	`recipient_phone` text,
	`recipient_address` text,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`status` text DEFAULT 'completed' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`sender_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipient_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
