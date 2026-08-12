CREATE TABLE `push_subscription` (
		`id` int AUTO_INCREMENT NOT NULL,
		`userId` int NOT NULL,
		`endpoint` text NOT NULL,
		`endpointHash` varchar(64) NOT NULL,
		`p256dh` varchar(255) NOT NULL,
	`auth` varchar(255) NOT NULL,
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
			CONSTRAINT `push_subscription_id` PRIMARY KEY(`id`),
		CONSTRAINT `push_subscription_endpointHash_unique` UNIQUE(`endpointHash`)

);
--> statement-breakpoint
CREATE TABLE `social_provider_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` enum('google','kakao','naver') NOT NULL,
	`clientId` varchar(512),
	`clientSecretEncrypted` text,
	`enabled` int NOT NULL DEFAULT 0,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `social_provider_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `social_provider_config_provider_unique` UNIQUE(`provider`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `passwordResetTokenHash` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordResetTokenExpiresAt` timestamp;