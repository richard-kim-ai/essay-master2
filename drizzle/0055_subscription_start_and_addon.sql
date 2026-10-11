ALTER TABLE `subscriptions` ADD `kind` varchar(16) DEFAULT 'package' NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `periodDays` int DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `awaitingStart` int DEFAULT 0 NOT NULL;