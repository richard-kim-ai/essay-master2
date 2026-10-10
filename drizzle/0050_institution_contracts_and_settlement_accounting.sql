CREATE TABLE `institution_audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorId` int NOT NULL,
	`action` varchar(64) NOT NULL,
	`targetType` varchar(40) NOT NULL,
	`targetId` int NOT NULL,
	`reason` varchar(500) NOT NULL,
	`detailJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `institution_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `institution_contracts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`contractCode` varchar(80) NOT NULL,
	`periodStart` timestamp NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`status` enum('draft','active','suspended','closed') NOT NULL DEFAULT 'draft',
	`humanLimit` int NOT NULL DEFAULT 0,
	`aiLimit` int NOT NULL DEFAULT 0,
	`managementLimit` int NOT NULL DEFAULT 0,
	`humanUsed` int NOT NULL DEFAULT 0,
	`aiUsed` int NOT NULL DEFAULT 0,
	`managementUsed` int NOT NULL DEFAULT 0,
	`memo` varchar(500),
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `institution_contracts_id` PRIMARY KEY(`id`),
	CONSTRAINT `institution_contracts_contractCode_unique` UNIQUE(`contractCode`)
);
--> statement-breakpoint
CREATE TABLE `institution_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`contractId` int,
	`excludeIndividualSettlement` int NOT NULL DEFAULT 1,
	`reason` varchar(500) NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`endedAt` timestamp,
	CONSTRAINT `institution_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `institution_usage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contractId` int NOT NULL,
	`budgetType` enum('human','ai','management') NOT NULL,
	`actorId` int NOT NULL,
	`studentId` int,
	`groupId` int,
	`sourceType` varchar(40),
	`sourceId` int,
	`status` enum('consumed','released') NOT NULL DEFAULT 'consumed',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `institution_usage_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_institution_usage_source` UNIQUE(`budgetType`,`sourceType`,`sourceId`)
);
--> statement-breakpoint
CREATE TABLE `teacher_activity_accounting` (
	`id` int AUTO_INCREMENT NOT NULL,
	`activityType` varchar(40) NOT NULL,
	`sourceId` int NOT NULL,
	`teacherId` int NOT NULL,
	`studentId` int NOT NULL,
	`groupId` int,
	`contractId` int,
	`occurredAt` timestamp NOT NULL,
	`automaticExclusion` enum('none','institution_contract','institution_member','teacher_member') NOT NULL DEFAULT 'none',
	`manualExcluded` int NOT NULL DEFAULT 0,
	`manualExclusionReason` varchar(500),
	`manualExcludedBy` int,
	`manualExcludedAt` timestamp,
	`policySnapshotJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `teacher_activity_accounting_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_teacher_activity_source` UNIQUE(`activityType`,`sourceId`)
);
--> statement-breakpoint
ALTER TABLE `learning_groups` ADD `contractId` int;