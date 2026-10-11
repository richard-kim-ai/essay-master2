CREATE TABLE `teacher_feedback_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`essayId` int NOT NULL,
	`productKey` varchar(40) NOT NULL,
	`priceKrw` int NOT NULL,
	`scopeJson` text NOT NULL,
	`teacherId` int NOT NULL,
	`status` enum('paid','in_progress','delivered','cancelled','refunded') NOT NULL DEFAULT 'paid',
	`orderId` int NOT NULL,
	`dueAt` timestamp NOT NULL,
	`deliveredAt` timestamp,
	`teacherFeedbackId` int,
	`reworkCount` int NOT NULL DEFAULT 0,
	`reworkNote` text,
	`cancelledAt` timestamp,
	`cancelReason` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teacher_feedback_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_tf_requests_userId` ON `teacher_feedback_requests` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_tf_requests_teacherId_status` ON `teacher_feedback_requests` (`teacherId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_tf_requests_essayId` ON `teacher_feedback_requests` (`essayId`);--> statement-breakpoint
CREATE INDEX `idx_tf_requests_orderId` ON `teacher_feedback_requests` (`orderId`);