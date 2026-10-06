ALTER TABLE `kyc_profile` ADD `full_name` text;--> statement-breakpoint
ALTER TABLE `user` ADD `contact_email` text;--> statement-breakpoint
ALTER TABLE `user` ADD `default_currency` text DEFAULT 'NGN' NOT NULL;