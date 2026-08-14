ALTER TABLE `certificate` ADD `status` enum('active','revoked') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `certificate` ADD `issuedBy` int;--> statement-breakpoint
ALTER TABLE `certificate` ADD `issueReason` text;--> statement-breakpoint
ALTER TABLE `certificate` ADD `revokedAt` timestamp;--> statement-breakpoint
ALTER TABLE `certificate` ADD `revokedBy` int;--> statement-breakpoint
ALTER TABLE `certificate` ADD `revocationReason` text;--> statement-breakpoint
ALTER TABLE `certificate` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL;