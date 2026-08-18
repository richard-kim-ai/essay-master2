CREATE TABLE `certificate_approval_policies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseType` enum('elementary','middle_high','high_univ','general_adult') NOT NULL,
	`teacherReviewRequired` int NOT NULL DEFAULT 1,
	`adminApprovalRequired` int NOT NULL DEFAULT 1,
	`minimumCompletionRate` int NOT NULL DEFAULT 100,
	`minimumAverageScore` int NOT NULL DEFAULT 0,
	`isActive` int NOT NULL DEFAULT 1,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `certificate_approval_policies_id` PRIMARY KEY(`id`),
	CONSTRAINT `certificate_approval_policies_courseType_unique` UNIQUE(`courseType`)
);
--> statement-breakpoint
CREATE TABLE `certificate_approval_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentId` int NOT NULL,
	`courseType` enum('elementary','middle_high','high_univ','general_adult') NOT NULL,
	`level` int,
	`certificateType` enum('level_certificate','graduation_certificate') NOT NULL,
	`status` enum('pending_teacher','pending_admin','approved','rejected') NOT NULL DEFAULT 'pending_teacher',
	`requestedBy` int NOT NULL,
	`requestScope` enum('organization','student') NOT NULL,
	`evidenceCompletionRate` int NOT NULL DEFAULT 0,
	`evidenceAverageScore` int NOT NULL DEFAULT 0,
	`teacherApprovedBy` int,
	`teacherApprovedAt` timestamp,
	`teacherNote` text,
	`adminApprovedBy` int,
	`adminApprovedAt` timestamp,
	`adminNote` text,
	`certificateId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `certificate_approval_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teacher_permission_grants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`teacherId` int NOT NULL,
	`scopeType` enum('organization','student') NOT NULL,
	`organizationName` varchar(160),
	`studentId` int,
	`canManageProgress` int NOT NULL DEFAULT 0,
	`canRequestCertificate` int NOT NULL DEFAULT 0,
	`isActive` int NOT NULL DEFAULT 1,
	`grantedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teacher_permission_grants_id` PRIMARY KEY(`id`)
);
