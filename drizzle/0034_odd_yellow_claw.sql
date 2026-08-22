CREATE TABLE `admin_audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorId` int NOT NULL,
	`targetUserId` int,
	`action` enum('admin_account_created','role_changed','level_changed','teacher_assigned') NOT NULL,
	`summary` varchar(500) NOT NULL,
	`metadataJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `class_announcements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`groupId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `class_announcements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `class_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`groupId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`instructions` text NOT NULL,
	`dueAt` timestamp,
	`createdBy` int NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `class_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `class_attendance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`groupId` int NOT NULL,
	`studentId` int NOT NULL,
	`attendanceDate` varchar(10) NOT NULL,
	`status` enum('present','late','absent','excused') NOT NULL DEFAULT 'present',
	`note` varchar(500),
	`recordedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `class_attendance_id` PRIMARY KEY(`id`)
);
