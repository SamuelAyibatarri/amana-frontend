ALTER TABLE `user` ADD `reset_otp_hash` text;--> statement-breakpoint
ALTER TABLE `user` ADD `reset_otp_expires_at` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `reset_otp_attempts` integer DEFAULT 0 NOT NULL;