CREATE TABLE `lesson_theory_drafts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseType` enum('elementary','middle_high','high_univ','general_adult') NOT NULL,
	`lessonLevel` int NOT NULL,
	`theoryCategory` varchar(32) NOT NULL,
	`theorySubcategory` varchar(128) NOT NULL,
	`exampleMode` enum('TEXTBOOK_SIMILAR','TEXTBOOK_PLUS_NEW') NOT NULL DEFAULT 'TEXTBOOK_PLUS_NEW',
	`title` varchar(255) NOT NULL,
	`contentData` text NOT NULL,
	`sourceNote` varchar(255) DEFAULT 'AI 생성 이론 콘텐츠',
	`generationRequestJson` text,
	`modelId` varchar(120),
	`qaIssuesJson` text,
	`status` enum('preview','approved','rejected') NOT NULL DEFAULT 'preview',
	`createdBy` int NOT NULL,
	`approvedBy` int,
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lesson_theory_drafts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lesson_theory_progress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`theoryContentId` int NOT NULL,
	`completedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lesson_theory_progress_id` PRIMARY KEY(`id`)
);
