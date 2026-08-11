ALTER TABLE `users` ADD `passwordHash` text;--> statement-breakpoint
ALTER TABLE `users` ADD `emailVerifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `verificationTokenHash` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `verificationTokenExpiresAt` timestamp;