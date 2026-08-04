CREATE TABLE `ai_auto_feedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`essayTitle` varchar(255) NOT NULL,
	`essayContent` text NOT NULL,
	`courseType` enum('elementary','middle_high') NOT NULL,
	`level` int NOT NULL,
	`overallComment` text,
	`structureScore` int,
	`logicScore` int,
	`expressionScore` int,
	`overallScore` int,
	`suggestions` text,
	`strengths` text,
	`weaknesses` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_auto_feedback_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `certificate` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`courseType` enum('elementary','middle_high') NOT NULL,
	`level` int,
	`certificateType` enum('level_certificate','graduation_certificate') NOT NULL,
	`shareToken` varchar(64),
	`pdfUrl` text,
	`issuedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `certificate_id` PRIMARY KEY(`id`),
	CONSTRAINT `certificate_shareToken_unique` UNIQUE(`shareToken`)
);
--> statement-breakpoint
CREATE TABLE `curriculum` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseType` enum('elementary','middle_high') NOT NULL,
	`level` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `curriculum_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `essay_submission` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`curriculumId` int,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`status` enum('draft','submitted','reviewed') NOT NULL DEFAULT 'draft',
	`submittedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `essay_submission_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `feedback_comment` (
	`id` int AUTO_INCREMENT NOT NULL,
	`feedbackId` int NOT NULL,
	`lineNumber` int NOT NULL,
	`startIndex` int NOT NULL,
	`endIndex` int NOT NULL,
	`comment` text NOT NULL,
	`commentType` enum('grammar','logic','expression','structure','other') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `feedback_comment_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `progress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`curriculumId` int NOT NULL,
	`score` int DEFAULT 0,
	`completed` int DEFAULT 0,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `progress_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quiz_answer` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`quizId` int NOT NULL,
	`userAnswer` text NOT NULL,
	`isCorrect` int DEFAULT 0,
	`feedback` text,
	`economyScore` decimal(3,2),
	`clarityScore` decimal(3,2),
	`accuracyScore` decimal(3,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quiz_answer_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teacher_feedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`essayId` int NOT NULL,
	`teacherId` int NOT NULL,
	`overallComment` text,
	`overallScore` int,
	`structureScore` int,
	`logicScore` int,
	`expressionScore` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teacher_feedback_id` PRIMARY KEY(`id`)
);
