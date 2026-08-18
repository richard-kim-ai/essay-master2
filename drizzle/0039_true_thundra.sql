CREATE TABLE `ai_lesson_guide_histories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`courseType` varchar(50) NOT NULL,
	`level` int NOT NULL,
	`lessonIndex` int NOT NULL,
	`lessonTitle` varchar(255) NOT NULL,
	`guideJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_lesson_guide_histories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `approved_writing_examples` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceSubmissionId` int NOT NULL,
	`teacherId` int NOT NULL,
	`courseType` enum('elementary','middle_high','high_univ','general_adult') NOT NULL,
	`title` varchar(255) NOT NULL,
	`topic` varchar(255) NOT NULL,
	`skillTags` varchar(255),
	`anonymizedContent` text NOT NULL,
	`teacherNote` text,
	`status` enum('draft','published','withdrawn') NOT NULL DEFAULT 'draft',
	`publishedAt` timestamp,
	`withdrawnAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `approved_writing_examples_id` PRIMARY KEY(`id`)
);
