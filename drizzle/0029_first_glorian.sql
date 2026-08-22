CREATE TABLE `question_bank_maintenance_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`retentionDays` int NOT NULL DEFAULT 30,
	`scheduleCronTaskUid` varchar(65),
	`updatedByUserId` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `question_bank_maintenance_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `question_bank_operation_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actionType` varchar(32) NOT NULL,
	`questionId` int,
	`trashId` int,
	`courseType` varchar(64),
	`questionTitle` varchar(255),
	`actorUserId` int,
	`actorName` varchar(255) NOT NULL,
	`details` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `question_bank_operation_logs_id` PRIMARY KEY(`id`)
);
