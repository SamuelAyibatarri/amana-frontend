ALTER TABLE `user` ADD `pin_hash` text;--> statement-breakpoint
ALTER TABLE `user` ADD `pin_attempts` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `pin_locked_until` integer;