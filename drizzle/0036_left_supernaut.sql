CREATE TABLE `class_assignment_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assignmentId` int NOT NULL,
	`studentId` int NOT NULL,
	`content` text NOT NULL,
	`status` enum('submitted','reviewed') NOT NULL DEFAULT 'submitted',
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	`reviewedAt` timestamp,
	`score` int,
	`teacherComment` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `class_assignment_submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `app_notifications` ADD `assignmentId` int;--> statement-breakpoint
ALTER TABLE `app_notifications` ADD `readAt` timestamp;