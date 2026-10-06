CREATE TABLE `money_request` (
	`id` text PRIMARY KEY NOT NULL,
	`requester_user_id` text NOT NULL,
	`requester_phone` text NOT NULL,
	`recipient_user_id` text,
	`recipient_phone` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`send_ngn` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`nudged_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`requester_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipient_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `request_block` (
	`id` text PRIMARY KEY NOT NULL,
	`blocker_user_id` text NOT NULL,
	`blocked_phone` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`blocker_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `user` ADD `request_privacy` text DEFAULT 'contacts' NOT NULL;