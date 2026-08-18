CREATE TABLE `class_assignment_ai_feedbacks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`submissionId` int NOT NULL,
	`generatedBy` int NOT NULL,
	`modelId` varchar(120) NOT NULL,
	`overallScore` int NOT NULL,
	`evaluationJson` text NOT NULL,
	`draftComment` text NOT NULL,
	`status` enum('generated','reviewed','discarded') NOT NULL DEFAULT 'generated',
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `class_assignment_ai_feedbacks_id` PRIMARY KEY(`id`)
);
