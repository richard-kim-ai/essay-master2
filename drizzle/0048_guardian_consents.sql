CREATE TABLE `guardian_consents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`childBirthDate` varchar(10) NOT NULL,
	`guardianName` varchar(80) NOT NULL,
	`guardianRelation` varchar(32) NOT NULL,
	`guardianEmail` varchar(320) NOT NULL,
	`tokenHash` varchar(128) NOT NULL,
	`tokenExpiresAt` timestamp NOT NULL,
	`status` enum('pending','approved','withdrawn') NOT NULL DEFAULT 'pending',
	`consentVersion` varchar(32) NOT NULL,
	`consentMethod` varchar(32) NOT NULL DEFAULT 'email_confirmation',
	`approvedAt` timestamp,
	`evidenceJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `guardian_consents_id` PRIMARY KEY(`id`)
);
