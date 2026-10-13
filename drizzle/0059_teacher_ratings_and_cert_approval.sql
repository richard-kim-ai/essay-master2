CREATE TABLE `teacher_feedback_ratings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`feedbackId` int NOT NULL,
	`essayId` int NOT NULL,
	`studentId` int NOT NULL,
	`teacherId` int NOT NULL,
	`rating` int NOT NULL,
	`review` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teacher_feedback_ratings_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_tf_ratings_feedbackId` UNIQUE(`feedbackId`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `certificateApprovalRevoked` int DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_tf_ratings_teacherId` ON `teacher_feedback_ratings` (`teacherId`);--> statement-breakpoint
CREATE INDEX `idx_tf_ratings_studentId` ON `teacher_feedback_ratings` (`studentId`);